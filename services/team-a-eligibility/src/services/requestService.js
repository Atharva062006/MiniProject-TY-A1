// Team A — Request & Queue Service
// Manages intake queues, candidate evaluation workers, and telemetry stats.

const { v4: uuidv4 } = require('uuid');
const PriorityQueue  = require('../queues/PriorityQueue');
const { evaluateRules } = require('../rules/ruleEngine');
const sseService     = require('./sseService');
const { getStudent, getDrive } = require('./teamCClient');

class RequestService {
  constructor() {
    // Min-heap priority queue with sequence tie-breaker for FIFO fairness
    this.queue = new PriorityQueue((a, b) => {
      if (a.priority === b.priority) {
        return a.seq - b.seq;
      }
      return a.priority - b.priority;
    });

    this.seqCounter = 0;
    this.requests = new Map();   // request_id -> Request
    this.decisions = new Map();  // decision_id -> Decision

    this.metrics = {
      total_evaluated: 0,
      total_evaluation_time_ms: 0,
      evaluation_timestamps: [],
    };

    this.isProcessing = false;
  }

  /**
   * Enqueues an eligibility evaluation request.
   */
  createRequest({
    request_id,
    student_id,
    drive_id,
    rule_set_version = 'v1.0',
    priority = 1,
    strategy = 'SEQUENTIAL_AND',
    student = null,
    drive = null,
    correlation_id = 'team-a-req',
  }) {
    const finalRequestId = request_id || `req_${uuidv4()}`;

    // Idempotency check: if request_id already exists, return existing status
    if (this.requests.has(finalRequestId)) {
      const existing = this.requests.get(finalRequestId);
      return {
        request_id: existing.request_id,
        queue_position: this._calculateQueuePosition(existing.request_id),
        state: existing.state,
        estimated_evaluation_time_ms: existing.estimated_evaluation_time_ms,
        correlation_id: existing.correlation_id,
      };
    }

    const numericPriority = Number(priority) > 0 ? Number(priority) : 1;
    const currentQueueDepth = this.queue.size();
    const estimatedTimeMs = currentQueueDepth * 15 + 10;

    const requestItem = {
      request_id: finalRequestId,
      student_id,
      drive_id,
      rule_set_version,
      priority: numericPriority,
      strategy,
      student,
      drive,
      seq: ++this.seqCounter,
      state: 'QUEUED',
      queue_position: currentQueueDepth + 1,
      estimated_evaluation_time_ms: estimatedTimeMs,
      submitted_at: new Date().toISOString(),
      correlation_id,
    };

    this.requests.set(finalRequestId, requestItem);
    this.queue.enqueue(requestItem);

    sseService.broadcast('REQUEST_QUEUED', {
      request_id: finalRequestId,
      student_id,
      drive_id,
      queue_position: requestItem.queue_position,
      priority: numericPriority,
    });

    // Trigger worker asynchronously
    setImmediate(() => this._processQueue());

    return {
      request_id: finalRequestId,
      queue_position: requestItem.queue_position,
      state: 'QUEUED',
      estimated_evaluation_time_ms: estimatedTimeMs,
      correlation_id,
    };
  }

  /**
   * Calculates live queue position for a given request.
   */
  _calculateQueuePosition(requestId) {
    const items = this.queue.toArray().sort(this.queue.compare);
    const idx = items.findIndex((item) => item.request_id === requestId);
    return idx >= 0 ? idx + 1 : 0;
  }

  /**
   * Asynchronously drains the queue and evaluates rules.
   */
  async _processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (!this.queue.isEmpty()) {
        const item = this.queue.dequeue();
        if (!item) break;

        const request = this.requests.get(item.request_id);
        if (!request) continue;

        request.state = 'PROCESSING';
        sseService.broadcast('REQUEST_PROCESSING', {
          request_id: request.request_id,
          student_id: request.student_id,
          drive_id: request.drive_id,
        });

        // Resolve student profile
        let student = request.student;
        if (!student && request.student_id) {
          student = await getStudent(request.student_id, request.correlation_id);
        }
        if (!student) {
          student = {
            student_id: request.student_id,
            cgpa: 7.5,
            backlogs: 0,
            branch: 'CSE',
            attendance: 80,
            skills: [],
          };
        }

        // Resolve drive criteria
        let drive = request.drive;
        if (!drive && request.drive_id) {
          drive = await getDrive(request.drive_id, request.correlation_id);
        }
        if (!drive) {
          drive = {
            drive_id: request.drive_id,
            criteria: { min_cgpa: 7.0, max_backlogs: 1, min_attendance: 75 },
          };
        }

        // Evaluate rules
        const decision = evaluateRules({
          student,
          drive,
          strategy: request.strategy,
          rule_set_version: request.rule_set_version,
        });

        // Store decision
        this.decisions.set(decision.decision_id, {
          ...decision,
          request_id: request.request_id,
          student_id: request.student_id,
          drive_id: request.drive_id,
          evaluated_at: new Date().toISOString(),
        });

        // Update request record
        request.state = 'EVALUATED';
        request.decision_id = decision.decision_id;
        request.eligibility_result = decision.eligibility_result;
        request.queue_position = 0;
        request.evaluated_at = new Date().toISOString();

        // Update metrics
        this.metrics.total_evaluated++;
        this.metrics.total_evaluation_time_ms += decision.decision_metrics.evaluation_time_ms;
        this.metrics.evaluation_timestamps.push(Date.now());

        // Retain only last 5 minutes of timestamps for throughput computation
        const fiveMinsAgo = Date.now() - 300000;
        this.metrics.evaluation_timestamps = this.metrics.evaluation_timestamps.filter((t) => t > fiveMinsAgo);

        sseService.broadcast('RULE_EVALUATED', {
          request_id: request.request_id,
          decision_id: decision.decision_id,
          eligibility_result: decision.eligibility_result,
          failed_rules: decision.failed_rules,
          student_id: request.student_id,
          drive_id: request.drive_id,
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieves request state and decision result.
   */
  getRequest(requestId) {
    const request = this.requests.get(requestId);
    if (!request) return null;

    const copy = { ...request };
    if (copy.state === 'QUEUED') {
      copy.queue_position = this._calculateQueuePosition(requestId);
    }
    if (copy.decision_id && this.decisions.has(copy.decision_id)) {
      copy.decision = this.decisions.get(copy.decision_id);
    }
    return copy;
  }

  /**
   * Retrieves an evaluated decision by ID.
   */
  getDecision(decisionId) {
    return this.decisions.get(decisionId) || null;
  }

  /**
   * Directly stores an ad-hoc evaluated decision.
   */
  storeDecision(decision) {
    this.decisions.set(decision.decision_id, decision);
    this.metrics.total_evaluated++;
    this.metrics.total_evaluation_time_ms += decision.decision_metrics.evaluation_time_ms;
    this.metrics.evaluation_timestamps.push(Date.now());
  }

  /**
   * Returns the drive-specific queue in priority order.
   */
  getDriveQueue(driveId) {
    const allQueued = this.queue.toArray().sort(this.queue.compare);
    const driveItems = allQueued.filter((item) => item.drive_id === driveId);

    const mapped = driveItems.map((item, idx) => ({
      request_id: item.request_id,
      candidate_id: item.student_id,
      student_id: item.student_id,
      priority: item.priority,
      position: idx + 1,
      state: item.state,
      estimated_evaluation_time_ms: (idx + 1) * 15,
    }));

    return {
      drive_id: driveId,
      total_queued: mapped.length,
      queue: mapped,
    };
  }

  /**
   * Computes evaluations throughput per second over the last 10 seconds.
   */
  getThroughputPerSec() {
    const tenSecondsAgo = Date.now() - 10000;
    const recent = this.metrics.evaluation_timestamps.filter((t) => t > tenSecondsAgo);
    return Number((recent.length / 10).toFixed(2));
  }

  /**
   * Returns overall runtime telemetry metrics.
   */
  getMetrics(slotLockManager) {
    const total = this.metrics.total_evaluated;
    const avgTime = total > 0 ? Number((this.metrics.total_evaluation_time_ms / total).toFixed(2)) : 0;

    return {
      queue_depth: this.queue.size(),
      total_evaluated: total,
      avg_evaluation_time_ms: avgTime,
      throughput_per_sec: this.getThroughputPerSec(),
      active_locks: slotLockManager ? slotLockManager.getActiveLockCount() : 0,
      deadlocks_detected: slotLockManager ? slotLockManager.metrics.deadlocks_detected : 0,
      deadlocks_resolved: slotLockManager ? slotLockManager.metrics.deadlocks_resolved : 0,
    };
  }
}

// Singleton instance
const requestService = new RequestService();
module.exports = requestService;

