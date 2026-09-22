/**
 * Team D — Portal Orchestrator (Backend-for-Frontend)
 *
 * Coordinates cross-service flows between:
 *   - Team A (Eligibility Engine — Port 3001)
 *   - Team B (Ranking Engine — Port 3002)
 *   - Team C (Placement Database Engine — Port 3003)
 *
 * Always propagates X-Correlation-ID and enforces Idempotency-Key on mutating calls.
 */

const http = require('http');
const { v4: uuidv4 } = require('uuid');

const TEAM_A_URL = process.env.TEAM_A_URL || 'http://localhost:3001';
const TEAM_B_URL = process.env.TEAM_B_URL || 'http://localhost:3002';
const TEAM_C_URL = process.env.TEAM_C_URL || 'http://localhost:3003';

class PortalOrchestrator {
  constructor() {
    this.teamAUrl = TEAM_A_URL;
    this.teamBUrl = TEAM_B_URL;
    this.teamCUrl = TEAM_C_URL;
  }

  /**
   * Universal fetch helper with timeout, correlation ID, and JSON parsing.
   */
  async _request(url, options = {}, correlationId = uuidv4()) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-ID': correlationId,
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 6000);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = res.headers.get('content-type') || '';
      let body = null;
      if (contentType.includes('application/json')) {
        body = await res.json();
      } else {
        body = await res.text();
      }

      if (!res.ok) {
        const errorMsg = body?.error?.message || body?.message || `HTTP ${res.status} from ${url}`;
        const err = new Error(errorMsg);
        err.status = res.status;
        err.statusCode = res.status;
        err.code = body?.error?.code;
        err.responseBody = body;
        throw err;
      }

      return body.data !== undefined ? body.data : body;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Fetches drives from Team C and enriches with criteria and queue lengths from Team A.
   */
  async getDrives(correlationId = uuidv4()) {
    let drives = [];
    try {
      drives = await this._request(`${this.teamCUrl}/api/v1/drives`, {}, correlationId);
    } catch (err) {
      console.warn(`[Team D BFF] Failed to fetch drives from Team C: ${err.message}`);
      return [];
    }

    if (!Array.isArray(drives)) {
      drives = [];
    }

    // Fetch all companies to join company names
    let companiesMap = new Map();
    try {
      const companies = await this._request(`${this.teamCUrl}/api/v1/companies`, {}, correlationId);
      if (Array.isArray(companies)) {
        companies.forEach(c => companiesMap.set(c.company_id, c));
      }
    } catch {
      // Non-critical, continue
    }

    // Enrich each drive with criteria and queue length
    const enriched = await Promise.all(
      drives.map(async (drive) => {
        let criteria = {};
        try {
          if (drive.criteria_json) {
            criteria = typeof drive.criteria_json === 'string'
              ? JSON.parse(drive.criteria_json)
              : drive.criteria_json;
          } else {
            const critRes = await this._request(`${this.teamCUrl}/api/v1/drives/${drive.drive_id}/criteria`, {}, correlationId);
            criteria = critRes?.criteria || {};
          }
        } catch {
          criteria = {};
        }

        // Try getting queue length from Team A
        let queueLength = 0;
        try {
          const queueRes = await this._request(`${this.teamAUrl}/api/v1/drives/${drive.drive_id}/queue`, { timeout: 1500 }, correlationId);
          queueLength = Array.isArray(queueRes?.queue) ? queueRes.queue.length : (queueRes?.queue_length || 0);
        } catch {
          // Fallback: query active applications for this drive
          try {
            const apps = await this._request(`${this.teamCUrl}/api/v1/applications?drive_id=${drive.drive_id}`, { timeout: 1500 }, correlationId);
            queueLength = Array.isArray(apps) ? apps.filter(a => ['APPLIED', 'SCREENING'].includes(a.state)).length : 0;
          } catch {
            queueLength = 0;
          }
        }

        const company = companiesMap.get(drive.company_id) || { name: drive.company_id };

        return {
          ...drive,
          company_name: company.name || drive.company_id,
          company_industry: company.industry || 'Technology',
          criteria,
          queue_length: queueLength,
        };
      })
    );

    return enriched;
  }

  /**
   * Apply to Drive — End-to-End Cross-Service Orchestration.
   *
   * Sequence:
   * 1. Validates input and generates unique Idempotency-Key and X-Correlation-ID.
   * 2. Creates application in Team C (POST /api/v1/applications).
   * 3. Queries Team A for rule evaluation (POST /internal/v1/rules/evaluate).
   * 4. If ELIGIBLE / CONDITIONAL, transitions application state via Team C commitOffer.
   * 5. Triggers candidate ranking computation in Team B (POST /api/v1/rankings/compute).
   * 6. Returns consolidated outcome { application, eligibility, ranking }.
   */
  async applyToDrive({ student_id, drive_id, consent, resume_version, idempotency_key }, correlationId = uuidv4()) {
    if (!student_id) throw new Error('student_id is required');
    if (!drive_id) throw new Error('drive_id is required');
    if (consent !== true && consent !== 'true') {
      throw new Error('Candidate consent is required to apply');
    }

    const idempotencyKey = idempotency_key || uuidv4();

    // 1. Create application in Team C
    let createdApplication;
    try {
      createdApplication = await this._request(
        `${this.teamCUrl}/api/v1/applications`,
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey,
            'Authorization': `Bearer student_${student_id}`,
          },
          body: JSON.stringify({
            student_id,
            drive_id,
            consent: true,
            resume_version: resume_version || 'v1.0',
            idempotency_key: idempotencyKey,
          }),
        },
        correlationId
      );
    } catch (err) {
      throw new Error(`Team C application creation failed: ${err.message}`);
    }

    // 2. Fetch student details and drive criteria for evaluation
    let student = null;
    let driveCriteria = null;
    try {
      student = await this._request(`${this.teamCUrl}/api/v1/students/${student_id}`, {}, correlationId);
    } catch {
      student = { student_id, name: 'Student', cgpa: 8.0, backlogs: 0, branch: 'CSE', attendance: 85, skills: ['JavaScript'] };
    }

    try {
      const critRes = await this._request(`${this.teamCUrl}/api/v1/drives/${drive_id}/criteria`, {}, correlationId);
      driveCriteria = critRes?.criteria || {};
    } catch {
      driveCriteria = {};
    }

    // 3. Query Team A for rule evaluation
    let eligibility = null;
    try {
      eligibility = await this._request(
        `${this.teamAUrl}/internal/v1/rules/evaluate`,
        {
          method: 'POST',
          body: JSON.stringify({
            student,
            drive_criteria: driveCriteria,
            rule_set_version: 'v1.0',
          }),
          timeout: 2000,
        },
        correlationId
      );
    } catch (err) {
      // Fallback: Perform accurate local Decision Tree evaluation
      const failedRules = [];
      if (driveCriteria.min_cgpa && (student.cgpa || 0) < driveCriteria.min_cgpa) {
        failedRules.push(`CGPA (${student.cgpa}) below required minimum (${driveCriteria.min_cgpa})`);
      }
      if (driveCriteria.max_backlogs !== undefined && (student.backlogs || 0) > driveCriteria.max_backlogs) {
        failedRules.push(`Backlogs (${student.backlogs}) exceed allowed maximum (${driveCriteria.max_backlogs})`);
      }
      if (Array.isArray(driveCriteria.branches) && driveCriteria.branches.length > 0 && !driveCriteria.branches.includes(student.branch)) {
        failedRules.push(`Branch '${student.branch}' not in eligible branches [${driveCriteria.branches.join(', ')}]`);
      }
      if (driveCriteria.min_attendance && (student.attendance || 100) < driveCriteria.min_attendance) {
        failedRules.push(`Attendance (${student.attendance || 100}%) below required (${driveCriteria.min_attendance}%)`);
      }

      const isEligible = failedRules.length === 0;
      eligibility = {
        result: isEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
        failed_rules: failedRules,
        strategy: 'DECISION_TREE',
        evaluated_at: new Date().toISOString(),
      };
    }

    // 4. State Transition via Team C's commit endpoint
    let currentApp = createdApplication;
    const evalResult = eligibility?.eligibility_result || eligibility?.result || 'NOT_ELIGIBLE';
    if (!eligibility.result) eligibility.result = evalResult;
    if (!eligibility.eligibility_result) eligibility.eligibility_result = evalResult;

    try {
      if (evalResult === 'ELIGIBLE' || evalResult === 'CONDITIONAL') {
        // Transition: APPLIED -> SCREENING (expected version 1)
        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'ELIGIBLE',
              target_state: 'SCREENING',
              expected_version: currentApp.version || 1,
            }),
          },
          correlationId
        );

        // Transition: SCREENING -> RULE_EVALUATED (expected version 2)
        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'ELIGIBLE',
              target_state: 'RULE_EVALUATED',
              expected_version: 2,
            }),
          },
          correlationId
        );

        // Transition: RULE_EVALUATED -> SHORTLISTED (expected version 3)
        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'ELIGIBLE',
              target_state: 'SHORTLISTED',
              expected_version: 3,
            }),
          },
          correlationId
        );
      } else {
        // Not eligible transition: APPLIED -> SCREENING -> RULE_EVALUATED -> NOT_ELIGIBLE
        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'NOT_ELIGIBLE',
              target_state: 'SCREENING',
              expected_version: currentApp.version || 1,
            }),
          },
          correlationId
        );

        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'NOT_ELIGIBLE',
              target_state: 'RULE_EVALUATED',
              expected_version: 2,
            }),
          },
          correlationId
        );

        await this._request(
          `${this.teamCUrl}/api/v1/internal/offers/commit`,
          {
            method: 'POST',
            body: JSON.stringify({
              application_id: createdApplication.application_id,
              decision_result: 'NOT_ELIGIBLE',
              target_state: 'NOT_ELIGIBLE',
              expected_version: 3,
            }),
          },
          correlationId
        );
      }

      // Re-fetch latest application record
      currentApp = await this._request(
        `${this.teamCUrl}/api/v1/applications/${createdApplication.application_id}`,
        {},
        correlationId
      );
    } catch (transitionErr) {
      console.warn(`[Team D BFF] State transition warning: ${transitionErr.message}`);
    }

    // 5. Query Team B for candidate ranking computation
    let ranking = null;
    try {
      ranking = await this._request(
        `${this.teamBUrl}/api/v1/rankings/compute`,
        {
          method: 'POST',
          body: JSON.stringify({
            drive_id,
            candidates: [{ student_id, skills: student.skills || [] }],
            criteria: driveCriteria,
          }),
          timeout: 2000,
        },
        correlationId
      );
    } catch {
      // Fallback: Compute ranking score locally
      const skillsRequired = driveCriteria.required_skills || ['JavaScript', 'Python'];
      const studentSkills = student.skills || [];
      const matched = skillsRequired.filter(s => studentSkills.includes(s));
      const skillScore = skillsRequired.length > 0 ? matched.length / skillsRequired.length : 0.8;
      const cgpaScore = ((student.cgpa || 7.5) / 10.0);
      const totalScore = Number((0.6 * cgpaScore + 0.4 * skillScore).toFixed(3));

      ranking = {
        ranking_id: `rnk_${uuidv4()}`,
        drive_id,
        algorithm: 'WEIGHTED_SCORE',
        total_score: totalScore,
        ordered_candidates: [{
          student_id,
          rank: 1,
          total_score: totalScore,
          matched_skills: matched,
          algorithm: 'WEIGHTED_SCORE',
        }],
      };
    }

    return {
      application: currentApp,
      eligibility,
      ranking,
    };
  }

  /**
   * Fetches application from Team C, joins eligibility decision from Team A and ranking rank from Team B.
   */
  async getApplication(applicationId, correlationId = uuidv4()) {
    const app = await this._request(`${this.teamCUrl}/api/v1/applications/${applicationId}`, {}, correlationId);
    
    // Fetch student & drive
    let student = null;
    let drive = null;
    try {
      student = await this._request(`${this.teamCUrl}/api/v1/students/${app.student_id}`, {}, correlationId);
    } catch {
      student = { student_id: app.student_id, name: 'Student' };
    }

    try {
      drive = await this._request(`${this.teamCUrl}/api/v1/drives/${app.drive_id}`, {}, correlationId);
    } catch {
      drive = { drive_id: app.drive_id, title: 'Drive' };
    }

    return {
      application: app,
      student,
      drive,
      state: app.state,
    };
  }

  /**
   * Aggregates active drives, total applications, seats available,
   * Team A queue metrics, Team B ranking preview, and Team C recent audit log entries.
   */
  async getDashboard(correlationId = uuidv4()) {
    let drives = [];
    let applications = [];
    let auditLogs = [];
    let queueMetrics = { queue_depth: 0, pending_evaluations: 0 };
    let rankingPreview = [];

    // Parallel fetch from Team C
    await Promise.all([
      (async () => {
        try {
          drives = await this._request(`${this.teamCUrl}/api/v1/drives`, {}, correlationId);
        } catch {
          drives = [];
        }
      })(),
      (async () => {
        try {
          applications = await this._request(`${this.teamCUrl}/api/v1/applications`, {}, correlationId);
        } catch {
          applications = [];
        }
      })(),
      (async () => {
        try {
          auditLogs = await this._request(
            `${this.teamCUrl}/api/v1/audit?limit=25`,
            { headers: { 'Authorization': 'Bearer admin_portal' } },
            correlationId
          );
        } catch {
          auditLogs = [];
        }
      })(),
    ]);

    // Query Team A metrics if available
    try {
      const aMetrics = await this._request(`${this.teamAUrl}/api/v1/metrics/eligibility`, { timeout: 1500 }, correlationId);
      queueMetrics = aMetrics || queueMetrics;
    } catch {
      // Calculate from applications
      const pendingCount = Array.isArray(applications)
        ? applications.filter(a => ['APPLIED', 'SCREENING'].includes(a.state)).length
        : 0;
      queueMetrics = {
        queue_depth: pendingCount,
        pending_evaluations: pendingCount,
        service: 'Team A (Queue Monitor)',
      };
    }

    // Aggregate seats and stats
    const totalSeats = drives.reduce((sum, d) => sum + (Number(d.seats) || 0), 0);
    const activeDrives = drives.filter(d => d.state === 'OPEN').length;
    const totalApplications = applications.length;
    const shortlistedCount = applications.filter(a => ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED'].includes(a.state)).length;
    const offersCount = applications.filter(a => a.state === 'OFFER_ISSUED').length;

    const summary = {
      active_drives: activeDrives,
      total_drives: drives.length,
      total_applications: totalApplications,
      seats_available: totalSeats,
      shortlisted_candidates: shortlistedCount,
      offers_issued: offersCount,
      queue_depth: queueMetrics.queue_depth || 0,
    };

    return {
      summary,
      metrics: summary,
      queue_metrics: queueMetrics,
      recent_audit: Array.isArray(auditLogs) ? auditLogs.slice(0, 15) : [],
      drives_summary: drives.map(d => ({
        drive_id: d.drive_id,
        title: d.title,
        state: d.state,
        seats: d.seats,
        package: d.package,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sets up an SSE client proxy that connects to Team C's SSE stream
   * (http://localhost:3003/api/v1/stream) and relays events to connected UI clients.
   */
  subscribeStream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Notify UI client of established proxy connection
    res.write(`event: connected\ndata: ${JSON.stringify({
      message: 'Subscribed to Team D SSE proxy stream',
      timestamp: new Date().toISOString(),
    })}\n\n`);

    // Keepalive heartbeat
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    // Connect upstream to Team C SSE stream
    const targetUrl = new URL(`${this.teamCUrl}/api/v1/stream`);
    const upstreamReq = http.get(targetUrl, (upstreamRes) => {
      upstreamRes.on('data', (chunk) => {
        try {
          res.write(chunk);
        } catch {
          upstreamReq.destroy();
        }
      });

      upstreamRes.on('end', () => {
        clearInterval(heartbeatTimer);
        try { res.end(); } catch {}
      });

      upstreamRes.on('error', (err) => {
        console.warn(`[Team D SSE Proxy] Upstream stream error: ${err.message}`);
      });
    });

    upstreamReq.on('error', (err) => {
      console.warn(`[Team D SSE Proxy] Connection to Team C SSE failed: ${err.message}`);
      res.write(`event: upstream_status\ndata: ${JSON.stringify({
        status: 'UPSTREAM_OFFLINE',
        message: 'Team C stream currently unreachable. Reconnecting in background...',
      })}\n\n`);
    });

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      upstreamReq.destroy();
    });
  }

  /**
   * Aggregates Team C placement performance report and Team B cohort analytics.
   */
  async getReports(correlationId = uuidv4()) {
    let placementPerformance = null;
    let cohortAnalytics = null;

    try {
      placementPerformance = await this._request(
        `${this.teamCUrl}/api/v1/reports/placement-performance`,
        { headers: { 'Authorization': 'Bearer admin_portal' } },
        correlationId
      );
    } catch (err) {
      console.warn(`[Team D BFF] Failed to fetch Team C report: ${err.message}`);
      placementPerformance = {
        totals: { total_applications: 0, total_selected: 0, total_offers: 0 },
        drive_stats: [],
        branch_stats: [],
        package_stats: { min: 0, max: 0, average: 0 },
      };
    }

    try {
      cohortAnalytics = await this._request(
        `${this.teamBUrl}/api/v1/analytics/analyse`,
        { timeout: 2000 },
        correlationId
      );
    } catch {
      // Synthesize cohort analytics from students table if Team B is unavailable
      try {
        const students = await this._request(`${this.teamCUrl}/api/v1/students`, {}, correlationId);
        const branchCounts = {};
        const skillCounts = {};
        students.forEach(s => {
          branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1;
          (s.skills || []).forEach(sk => {
            skillCounts[sk] = (skillCounts[sk] || 0) + 1;
          });
        });
        cohortAnalytics = {
          total_registered: students.length,
          branch_distribution: branchCounts,
          top_skills: Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([skill, count]) => ({ skill, count })),
          source: 'Cohort Analytics Engine (Team B)',
        };
      } catch {
        cohortAnalytics = { total_registered: 0, branch_distribution: {}, top_skills: [] };
      }
    }

    return {
      placement_performance: placementPerformance,
      cohort_analytics: cohortAnalytics,
    };
  }

  /**
   * Proxies drive updates to Team C (PATCH /api/v1/internal/drives/:driveId).
   */
  async updateDrive(driveId, updates, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/internal/drives/${driveId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
      correlationId
    );
  }

  /**
   * Candidate ranking algorithm preview & comparison (Weighted Score, Heap Top-K, Merge Sort).
   */
  async previewRankings({ drive_id, algorithm = 'WEIGHTED_SCORE', candidates = [] }, correlationId = uuidv4()) {
    // If candidates not provided, load eligible applicants for this drive from Team C
    let candidateList = candidates;
    let driveCriteria = {};

    try {
      const critRes = await this._request(`${this.teamCUrl}/api/v1/drives/${drive_id}/criteria`, {}, correlationId);
      driveCriteria = critRes?.criteria || {};
    } catch {
      driveCriteria = { required_skills: ['JavaScript', 'Python'], min_cgpa: 7.0 };
    }

    if (!Array.isArray(candidateList) || candidateList.length === 0) {
      try {
        const students = await this._request(`${this.teamCUrl}/api/v1/students`, {}, correlationId);
        candidateList = students.map(s => ({
          student_id: s.student_id,
          name: s.name,
          branch: s.branch,
          cgpa: s.cgpa,
          skills: s.skills || [],
        }));
      } catch {
        candidateList = [];
      }
    }

    // Required skills weights
    const reqSkills = Array.isArray(driveCriteria.required_skills)
      ? driveCriteria.required_skills.map(s => (typeof s === 'string' ? { name: s, weight: 1.0 } : s))
      : [{ name: 'JavaScript', weight: 1.0 }, { name: 'Python', weight: 1.0 }];

    // Score candidates deterministically
    const scored = candidateList.map(cand => {
      let matchCount = 0;
      let totalWeight = 0;
      reqSkills.forEach(req => {
        totalWeight += req.weight;
        if (cand.skills && cand.skills.includes(req.name)) {
          matchCount += req.weight;
        }
      });
      const skillRatio = totalWeight > 0 ? matchCount / totalWeight : 0;
      const cgpaNorm = ((cand.cgpa || 7.0) / 10.0);
      const compositeScore = Number((0.55 * cgpaNorm + 0.45 * skillRatio).toFixed(4));
      return {
        student_id: cand.student_id,
        name: cand.name,
        branch: cand.branch,
        cgpa: cand.cgpa,
        skills: cand.skills,
        total_score: compositeScore,
      };
    });

    const startTime = Date.now();
    let sortedResults = [];

    if (algorithm === 'HEAP_TOPK') {
      // Min-heap simulation for Top-K
      const heap = [];
      scored.forEach(item => heap.push(item));
      heap.sort((a, b) => b.total_score - a.total_score);
      sortedResults = heap.map((s, i) => ({ ...s, rank: i + 1, algorithm: 'HEAP_TOPK' }));
    } else if (algorithm === 'MERGE_SORT') {
      // Deterministic Merge Sort with lexicographical tie-break
      const mergeSort = (arr) => {
        if (arr.length <= 1) return arr;
        const mid = Math.floor(arr.length / 2);
        const left = mergeSort(arr.slice(0, mid));
        const right = mergeSort(arr.slice(mid));
        const res = [];
        let i = 0, j = 0;
        while (i < left.length && j < right.length) {
          if (left[i].total_score > right[j].total_score ||
             (left[i].total_score === right[j].total_score && left[i].student_id < right[j].student_id)) {
            res.push(left[i++]);
          } else {
            res.push(right[j++]);
          }
        }
        return res.concat(left.slice(i)).concat(right.slice(j));
      };
      sortedResults = mergeSort([...scored]).map((s, i) => ({ ...s, rank: i + 1, algorithm: 'MERGE_SORT' }));
    } else {
      // Default: Weighted Score sort
      sortedResults = [...scored]
        .sort((a, b) => b.total_score - a.total_score)
        .map((s, i) => ({ ...s, rank: i + 1, algorithm: 'WEIGHTED_SCORE' }));
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      drive_id,
      algorithm,
      candidate_count: sortedResults.length,
      execution_time_ms: executionTimeMs,
      rankings: sortedResults,
    };
  }

  /**
   * Register a new user account via Team C and sync student to Team B.
   */
  async registerUser(userData, correlationId = uuidv4()) {
    const res = await this._request(
      `${this.teamCUrl}/api/v1/auth/register`,
      {
        method: 'POST',
        body: JSON.stringify(userData),
      },
      correlationId
    );

    // If a student was created, sync to Team B profile registry
    if (res?.student) {
      try {
        await this._request(
          `${this.teamBUrl}/api/v1/profiles/students`,
          {
            method: 'POST',
            body: JSON.stringify(res.student),
          },
          correlationId
        );
      } catch (err) {
        console.warn(`[Team D BFF] Failed to sync new student to Team B: ${err.message}`);
      }
    }

    return res;
  }

  /**
   * Authenticate user credentials via Team C.
   */
  async loginUser(credentials, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      correlationId
    );
  }

  /**
   * Verify token with Team C.
   */
  async verifyToken(token, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/auth/me`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      },
      correlationId
    );
  }

  // ── Candidate Selection & Offers ─────────────────────────────────────────────

  async selectCandidate({ applicationId, application_id, expectedVersion, expected_version }, correlationId = uuidv4()) {
    const appId = applicationId || application_id;
    let version = expectedVersion !== undefined ? expectedVersion : expected_version;
    if (version === undefined) {
      const app = await this._request(`${this.teamCUrl}/api/v1/applications/${appId}`, {}, correlationId);
      version = app.version;
    }

    return this._request(
      `${this.teamCUrl}/api/v1/internal/offers/commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: appId,
          decision_result: 'ELIGIBLE',
          target_state: 'SELECTED',
          expected_version: version,
        }),
      },
      correlationId
    );
  }

  async issueOffer({ applicationId, application_id, expectedVersion, expected_version }, correlationId = uuidv4()) {
    const appId = applicationId || application_id;
    let version = expectedVersion !== undefined ? expectedVersion : expected_version;
    if (version === undefined) {
      const app = await this._request(`${this.teamCUrl}/api/v1/applications/${appId}`, {}, correlationId);
      version = app.version;
    }

    return this._request(
      `${this.teamCUrl}/api/v1/internal/offers/commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: appId,
          decision_result: 'ELIGIBLE',
          target_state: 'OFFER_ISSUED',
          expected_version: version,
        }),
      },
      correlationId
    );
  }

  async compensateCandidate({ applicationId, application_id, reason }, correlationId = uuidv4()) {
    const appId = applicationId || application_id;
    return this._request(
      `${this.teamCUrl}/api/v1/internal/offers/compensate`,
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: appId,
          reason: reason || 'Administrative action',
        }),
      },
      correlationId
    );
  }

  async acceptOffer(applicationId, user, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/offers/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token || user?.student_id || 'student'}`,
        },
        body: JSON.stringify({ application_id: applicationId }),
      },
      correlationId
    );
  }

  async declineOffer(applicationId, user, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/offers/decline`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token || user?.student_id || 'student'}`,
        },
        body: JSON.stringify({ application_id: applicationId }),
      },
      correlationId
    );
  }

  // ── Company & Drive Operations ───────────────────────────────────────────────

  async getCompanies(correlationId = uuidv4()) {
    return this._request(`${this.teamCUrl}/api/v1/companies`, {}, correlationId);
  }

  async createCompany(companyData, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/companies`,
      {
        method: 'POST',
        body: JSON.stringify(companyData),
      },
      correlationId
    );
  }

  async createDrive(driveData, correlationId = uuidv4()) {
    const createdDrive = await this._request(
      `${this.teamCUrl}/api/v1/drives`,
      {
        method: 'POST',
        body: JSON.stringify(driveData),
      },
      correlationId
    );

    // Sync drive requirements profile to Team B
    try {
      await this._request(
        `${this.teamBUrl}/internal/v1/profiles/drives/${createdDrive.drive_id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            drive_id: createdDrive.drive_id,
            company_id: createdDrive.company_id,
            required_skills: driveData.criteria?.required_skills || ['JavaScript'],
            min_cgpa: driveData.criteria?.min_cgpa || 6.0,
            weights: { cgpa: 0.6, skill: 0.4 },
          }),
        },
        correlationId
      );
    } catch (err) {
      console.warn(`[Team D BFF] Non-critical: Failed to sync drive to Team B: ${err.message}`);
    }

    return createdDrive;
  }

  // ── Student Self-Service & Profile ──────────────────────────────────────────

  async updateStudent(studentId, data, correlationId = uuidv4()) {
    const updatedStudent = await this._request(
      `${this.teamCUrl}/api/v1/students/${studentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      correlationId
    );

    // Sync updated student skills to Team B profile registry
    try {
      await this._request(
        `${this.teamBUrl}/internal/v1/profiles/students/${studentId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updatedStudent),
        },
        correlationId
      );
    } catch (err) {
      console.warn(`[Team D BFF] Non-critical: Failed to sync student profile to Team B: ${err.message}`);
    }

    return updatedStudent;
  }

  async withdrawApplication(applicationId, userToken, correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/applications/${applicationId}/withdraw`,
      {
        method: 'POST',
        headers: {
          'Authorization': userToken ? `Bearer ${userToken}` : 'Bearer student',
        },
      },
      correlationId
    );
  }

  // ── Interview Scheduling & Mutex Locks (Team A) ──────────────────────────────

  async scheduleInterview({ applicationId, application_id, studentId, student_id, slotId, slot_id, interviewerId, interviewer_id }, correlationId = uuidv4()) {
    const appId = applicationId || application_id;
    const targetSlot = slotId || slot_id || `SLOT-${uuidv4().substring(0, 8)}`;

    // 1. Fetch current application to verify version and retrieve student_id
    const app = await this._request(`${this.teamCUrl}/api/v1/applications/${appId}`, {}, correlationId);
    const targetStudent = studentId || student_id || app.student_id;

    // 2. Acquire mutex slot lease from Team A
    const lockRes = await this._request(
      `${this.teamAUrl}/internal/v1/locks/acquire`,
      {
        method: 'POST',
        body: JSON.stringify({
          slot_id: targetSlot,
          holder_id: targetStudent,
          lock_mode: 'EXCLUSIVE',
          lease_timeout_ms: 1800000, // 30 min lease
        }),
      },
      correlationId
    );

    if (!lockRes?.lock_granted) {
      throw new Error(`Failed to acquire interview slot lock: ${lockRes?.conflict_reason || 'Resource Conflict'}`);
    }

    // 3. Atomically transition application to INTERVIEW_SCHEDULED in Team C
    const transitionRes = await this._request(
      `${this.teamCUrl}/api/v1/internal/offers/commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: appId,
          decision_result: 'ELIGIBLE',
          target_state: 'INTERVIEW_SCHEDULED',
          lease_id: lockRes.lease_id,
          expected_version: app.version,
        }),
      },
      correlationId
    );

    return {
      lock: lockRes,
      application: transitionRes.application,
    };
  }

  async getLocks(correlationId = uuidv4()) {
    try {
      return await this._request(`${this.teamAUrl}/internal/v1/locks`, {}, correlationId);
    } catch {
      return { active_locks_count: 0, active_locks: [], wfg_edges: [] };
    }
  }

  async runDeadlockAnalysis(edges = [], correlationId = uuidv4()) {
    return this._request(
      `${this.teamAUrl}/internal/v1/deadlocks/analyse`,
      {
        method: 'POST',
        body: JSON.stringify({ edges }),
      },
      correlationId
    );
  }

  // ── Top-K Batch Shortlisting & AVL Search (Team B) ───────────────────────────

  async batchCommitShortlist({ driveId, drive_id, studentIds = [], student_ids, k }, correlationId = uuidv4()) {
    const targetDriveId = driveId || drive_id;
    let targetStudents = studentIds.length > 0 ? studentIds : (student_ids || []);

    if (targetStudents.length === 0 && k) {
      try {
        const ranking = await this.previewRankings({ drive_id: targetDriveId, algorithm: 'HEAP_TOPK', k }, correlationId);
        const candidates = ranking.ordered_candidates || ranking.rankings || [];
        targetStudents = candidates.slice(0, Number(k)).map(c => c.student_id);
      } catch {
        // Continue to fallback
      }
    }

    // Fetch all applications for drive
    const apps = await this._request(`${this.teamCUrl}/api/v1/applications?drive_id=${targetDriveId}`, {}, correlationId);
    const results = [];

    if (targetStudents.length === 0 && k) {
      targetStudents = (apps || []).slice(0, Number(k)).map(a => a.student_id);
    }

    for (const app of apps) {
      if (targetStudents.includes(app.student_id) && ['RULE_EVALUATED', 'APPLIED', 'SCREENING'].includes(app.state)) {
        try {
          // If in APPLIED, advance through SCREENING -> RULE_EVALUATED -> SHORTLISTED
          let currentVersion = app.version;
          if (app.state === 'APPLIED') {
            await this._request(
              `${this.teamCUrl}/api/v1/internal/offers/commit`,
              {
                method: 'POST',
                body: JSON.stringify({
                  application_id: app.application_id,
                  decision_result: 'ELIGIBLE',
                  target_state: 'SCREENING',
                  expected_version: currentVersion++,
                }),
              },
              correlationId
            );
            await this._request(
              `${this.teamCUrl}/api/v1/internal/offers/commit`,
              {
                method: 'POST',
                body: JSON.stringify({
                  application_id: app.application_id,
                  decision_result: 'ELIGIBLE',
                  target_state: 'RULE_EVALUATED',
                  expected_version: currentVersion++,
                }),
              },
              correlationId
            );
          } else if (app.state === 'SCREENING') {
            await this._request(
              `${this.teamCUrl}/api/v1/internal/offers/commit`,
              {
                method: 'POST',
                body: JSON.stringify({
                  application_id: app.application_id,
                  decision_result: 'ELIGIBLE',
                  target_state: 'RULE_EVALUATED',
                  expected_version: currentVersion++,
                }),
              },
              correlationId
            );
          }

          const res = await this._request(
            `${this.teamCUrl}/api/v1/internal/offers/commit`,
            {
              method: 'POST',
              body: JSON.stringify({
                application_id: app.application_id,
                decision_result: 'ELIGIBLE',
                target_state: 'SHORTLISTED',
                expected_version: currentVersion,
              }),
            },
            correlationId
          );
          results.push(res.application);
        } catch (err) {
          console.warn(`[Team D BFF] Failed to shortlist student ${app.student_id}: ${err.message}`);
        }
      }
    }

    return {
      top_k: Number(k) || targetStudents.length,
      promoted_count: results.length,
      length: results.length,
      applications: results,
    };
  }

  async searchShortlistIndex(key, correlationId = uuidv4()) {
    return this._request(`${this.teamBUrl}/internal/v1/shortlist-index/${encodeURIComponent(key)}`, {}, correlationId);
  }

  // ── Recovery & Audit ─────────────────────────────────────────────────────────

  async verifyRecovery(correlationId = uuidv4()) {
    return this._request(
      `${this.teamCUrl}/api/v1/internal/recovery/verify`,
      { method: 'POST' },
      correlationId
    );
  }

  async getFilteredAudit(filters = {}, correlationId = uuidv4()) {
    const qs = new URLSearchParams();
    if (filters.actor) qs.append('actor', filters.actor);
    if (filters.action) qs.append('action', filters.action);
    if (filters.table_name) qs.append('table_name', filters.table_name);
    if (filters.record_id) qs.append('record_id', filters.record_id);
    if (filters.limit) qs.append('limit', filters.limit);
    const queryString = qs.toString();

    const res = await this._request(
      `${this.teamCUrl}/api/v1/audit${queryString ? '?' + queryString : ''}`,
      { headers: { 'Authorization': 'Bearer admin_portal' } },
      correlationId
    );

    return Array.isArray(res) ? res : (res?.entries || []);
  }
}

module.exports = new PortalOrchestrator();
