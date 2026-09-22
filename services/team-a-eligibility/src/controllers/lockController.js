// Team A — Lock Controller
// POST   /internal/v1/locks/acquire
// DELETE /internal/v1/locks/:leaseId
// POST   /internal/v1/deadlocks/analyse

const { sendSuccess } = require('../../../../shared/response');
const { ValidationError } = require('../../../../shared/errors');
const { slotLockManager } = require('../locks/SlotLockManager');
const sseService = require('../services/sseService');

/**
 * Acquire exclusive interview slot lease with deadlock detection.
 */
exports.acquireLock = async (req, res, next) => {
  try {
    const { slot_id, holder_id, lock_mode, lease_timeout_ms, wait_for_edges } = req.body || {};

    if (!slot_id) {
      throw new ValidationError('slot_id is required');
    }
    if (!holder_id) {
      throw new ValidationError('holder_id is required');
    }

    const result = slotLockManager.acquireLock({
      slot_id,
      holder_id,
      lock_mode,
      lease_timeout_ms,
      wait_for_edges,
    });

    // Broadcast SSE telemetry event
    if (result.lock_granted) {
      sseService.broadcast('LOCK_ACQUIRED', {
        slot_id,
        holder_id,
        lease_id: result.lease_id,
        expires_at: result.expires_at,
      });
    } else if (result.conflict_reason === 'DEADLOCK_DETECTED') {
      sseService.broadcast('DEADLOCK_DETECTED', {
        slot_id,
        holder_id,
        cycle: result.deadlock_cycle,
        action: result.action,
      });
    } else {
      sseService.broadcast('LOCK_CONFLICT', {
        slot_id,
        holder_id,
        conflict_reason: result.conflict_reason,
      });
    }

    const statusCode = result.lock_granted ? 201 : 200;
    sendSuccess(res, result, req.correlationId, statusCode);
  } catch (err) {
    next(err);
  }
};

/**
 * Releases an interview slot lease.
 */
exports.releaseLock = async (req, res, next) => {
  try {
    const { leaseId } = req.params;
    if (!leaseId) {
      throw new ValidationError('leaseId parameter is required');
    }

    const result = slotLockManager.releaseLock(leaseId);

    if (result.released) {
      sseService.broadcast('LOCK_RELEASED', {
        lease_id: leaseId,
        slot_id: result.slot_id,
        holder_id: result.holder_id,
      });
    }

    sendSuccess(res, result, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Evaluates the Wait-For Graph for deadlock cycles, selects victims, and resolves them.
 */
exports.analyseDeadlocks = async (req, res, next) => {
  try {
    // Optionally allow seeding edges directly in the request body
    if (Array.isArray(req.body?.edges)) {
      for (const edge of req.body.edges) {
        if (edge.from && edge.to) {
          slotLockManager.addWaitForEdge(edge.from, edge.to);
        }
      }
    }

    const analysis = slotLockManager.analyseDeadlocks();

    if (analysis.cycles.length > 0) {
      sseService.broadcast('DEADLOCK_RESOLVED', {
        cycles: analysis.cycles,
        victim_selection: analysis.victim_selection,
        actions: analysis.actions,
      });
    }

    sendSuccess(res, analysis, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Lists all active mutex slot locks and current Wait-For Graph edges.
 */
exports.listLocks = async (req, res, next) => {
  try {
    slotLockManager._cleanupExpiredLocks();
    const activeLeases = Array.from(slotLockManager.leases.values()).map(l => ({
      lease_id: l.lease_id,
      slot_id: l.slot_id,
      holder_id: l.holder_id,
      lock_mode: l.lock_mode || 'EXCLUSIVE',
      expires_at: l.expires_at,
      ttl_remaining_ms: Math.max(0, l.expires_at - Date.now()),
    }));

    const wfgEdges = [];
    for (const [requester, holders] of slotLockManager.waitForGraph.entries()) {
      for (const holder of holders) {
        wfgEdges.push({ from: requester, to: holder });
      }
    }

    sendSuccess(res, {
      active_locks_count: activeLeases.length,
      active_locks: activeLeases,
      wfg_edges: wfgEdges,
      metrics: slotLockManager.metrics,
    }, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};
