// Team A — Slot Lock Manager (Mutex / Exclusive Interview Slot Leases & Deadlock Detection)
// Implements Wait-For Graph (WFG) cycle detection using DFS from scratch.

const { v4: uuidv4 } = require('uuid');

class SlotLockManager {
  constructor(defaultLeaseTimeoutMs = 30000) {
    this.defaultLeaseTimeoutMs = defaultLeaseTimeoutMs;
    // slot_id -> lease object
    this.slots = new Map();
    // lease_id -> lease object
    this.leases = new Map();
    // Wait-For Graph: requester_id -> Set of holder_ids being waited on
    this.waitForGraph = new Map();

    this.metrics = {
      deadlocks_detected: 0,
      deadlocks_resolved: 0,
    };
  }

  /**
   * Cleans up expired slot leases and trims dead wait-for edges.
   */
  _cleanupExpiredLocks() {
    const now = Date.now();
    for (const [lease_id, lease] of this.leases.entries()) {
      if (lease.expires_at <= now) {
        this.slots.delete(lease.slot_id);
        this.leases.delete(lease_id);
        this._removeHolderFromWFG(lease.holder_id);
      }
    }
  }

  /**
   * Adds a directed waiting edge in the WFG: requester -> holder
   */
  _addWaitingEdge(requesterId, holderId) {
    if (requesterId === holderId) return;
    if (!this.waitForGraph.has(requesterId)) {
      this.waitForGraph.set(requesterId, new Set());
    }
    this.waitForGraph.get(requesterId).add(holderId);
  }

  /**
   * Removes a directed waiting edge from the WFG: requester -> holder
   */
  _removeWaitingEdge(requesterId, holderId) {
    if (this.waitForGraph.has(requesterId)) {
      const set = this.waitForGraph.get(requesterId);
      set.delete(holderId);
      if (set.size === 0) {
        this.waitForGraph.delete(requesterId);
      }
    }
  }

  /**
   * Removes all incoming and outgoing edges for a holder when they release/expire
   */
  _removeHolderFromWFG(holderId) {
    // If holder holds no other active slots, remove them as a dependency
    let stillHoldsAny = false;
    for (const lease of this.leases.values()) {
      if (lease.holder_id === holderId) {
        stillHoldsAny = true;
        break;
      }
    }

    if (!stillHoldsAny) {
      // Remove all incoming edges to holderId
      for (const [reqId, waitSet] of this.waitForGraph.entries()) {
        waitSet.delete(holderId);
        if (waitSet.size === 0) {
          this.waitForGraph.delete(reqId);
        }
      }
    }

    // Remove outgoing edges if holderId is no longer waiting
    if (this.waitForGraph.has(holderId)) {
      this.waitForGraph.delete(holderId);
    }
  }

  /**
   * DFS-based cycle detection on the Wait-For Graph.
   * Returns array of node IDs in the detected cycle, or null if acyclic.
   */
  _detectCycleFrom(startNode) {
    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = this.waitForGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor);
          if (cycle) return cycle;
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          return path.slice(cycleStart).concat(neighbor);
        }
      }

      recStack.delete(node);
      path.pop();
      return null;
    };

    return dfs(startNode);
  }

  /**
   * Finds all distinct cycles in the entire Wait-For Graph.
   */
  _findAllCycles() {
    const visited = new Set();
    const recStack = new Set();
    const path = [];
    const detectedCycles = [];
    const cycleSignatures = new Set();

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = this.waitForGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart).concat(neighbor);
          const sig = [...cycle].sort().join(',');
          if (!cycleSignatures.has(sig)) {
            cycleSignatures.add(sig);
            detectedCycles.push(cycle);
          }
        }
      }

      recStack.delete(node);
      path.pop();
    };

    for (const node of this.waitForGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return detectedCycles;
  }

  /**
   * Helper to manually seed WFG edges (useful for tests and simulation)
   */
  addWaitForEdge(requesterId, holderId) {
    this._addWaitingEdge(requesterId, holderId);
  }

  /**
   * Acquire a slot lease (Mutex / Exclusive Lock).
   * @param {Object} params
   * @param {string} params.slot_id - Unique slot identifier
   * @param {string} params.holder_id - Candidate or interviewer acquiring the slot
   * @param {string} [params.lock_mode='EXCLUSIVE'] - Lock mode
   * @param {number} [params.lease_timeout_ms] - Timeout in milliseconds
   * @param {Array}  [params.wait_for_edges] - Optional seeded wait-for edges
   * @returns {Object} { lock_granted, lease_id, expires_at, conflict_reason, deadlock_cycle, action }
   */
  acquireLock({ slot_id, holder_id, lock_mode = 'EXCLUSIVE', lease_timeout_ms, wait_for_edges }) {
    this._cleanupExpiredLocks();

    // Optionally seed any external wait-for edges provided
    if (Array.isArray(wait_for_edges)) {
      for (const edge of wait_for_edges) {
        if (edge.from && edge.to) {
          this._addWaitingEdge(edge.from, edge.to);
        }
      }
    }

    const effectiveTimeout = Number(lease_timeout_ms) > 0 ? Number(lease_timeout_ms) : this.defaultLeaseTimeoutMs;

    // Check if the slot is currently locked
    if (this.slots.has(slot_id)) {
      const currentLease = this.slots.get(slot_id);

      // Reentrant or renewal by the same holder
      if (currentLease.holder_id === holder_id) {
        currentLease.expires_at = Date.now() + effectiveTimeout;
        return {
          lock_granted: true,
          lease_id: currentLease.lease_id,
          expires_at: currentLease.expires_at,
          conflict_reason: null,
          deadlock_cycle: null,
          action: 'RENEWED',
        };
      }

      // Slot is held by another holder -> track dependency in WFG
      this._addWaitingEdge(holder_id, currentLease.holder_id);

      // Run DFS cycle detection from holder_id
      const cycle = this._detectCycleFrom(holder_id);
      if (cycle) {
        this.metrics.deadlocks_detected++;
        // Remove speculative edge that created the cycle to prevent lingering invalid state
        this._removeWaitingEdge(holder_id, currentLease.holder_id);
        return {
          lock_granted: false,
          lease_id: null,
          expires_at: null,
          conflict_reason: 'DEADLOCK_DETECTED',
          deadlock_cycle: cycle,
          action: 'ABORT_REQUESTER',
        };
      }

      // Conflict without deadlock -> Requester must wait
      return {
        lock_granted: false,
        lease_id: null,
        expires_at: null,
        conflict_reason: 'SLOT_HELD_BY_ANOTHER',
        deadlock_cycle: null,
        action: 'WAIT',
      };
    }

    // Slot is free -> grant lock
    const lease_id = `lease_${uuidv4()}`;
    const expires_at = Date.now() + effectiveTimeout;
    const lease = {
      lease_id,
      slot_id,
      holder_id,
      lock_mode,
      expires_at,
      acquired_at: Date.now(),
    };

    this.slots.set(slot_id, lease);
    this.leases.set(lease_id, lease);

    return {
      lock_granted: true,
      lease_id,
      expires_at,
      conflict_reason: null,
      deadlock_cycle: null,
      action: 'ACQUIRED',
    };
  }

  /**
   * Release an acquired slot lease.
   * @param {string} lease_id
   * @returns {Object}
   */
  releaseLock(lease_id) {
    this._cleanupExpiredLocks();

    const lease = this.leases.get(lease_id);
    if (!lease) {
      return {
        released: false,
        error: 'LEASE_NOT_FOUND',
        lease_id,
      };
    }

    this.slots.delete(lease.slot_id);
    this.leases.delete(lease_id);
    this._removeHolderFromWFG(lease.holder_id);

    return {
      released: true,
      lease_id,
      slot_id: lease.slot_id,
      holder_id: lease.holder_id,
    };
  }

  /**
   * Scan WFG for deadlocks, select victims, and resolve cycles.
   * @returns {Object} { cycles, victim_selection, actions }
   */
  analyseDeadlocks() {
    this._cleanupExpiredLocks();
    const cycles = this._findAllCycles();
    const victim_selection = [];
    const actions = [];

    for (const cycle of cycles) {
      // Victim selection: choose the first node in cycle to abort
      const victim = cycle[0];
      victim_selection.push(victim);
      actions.push(`RESOLVE_CYCLE_ABORT_${victim}`);

      // Break cycle by removing victim's waiting edges
      this.waitForGraph.delete(victim);
      this.metrics.deadlocks_resolved++;
    }

    return {
      cycles,
      victim_selection,
      actions,
    };
  }

  /**
   * Returns count of active (non-expired) slot leases.
   */
  getActiveLockCount() {
    this._cleanupExpiredLocks();
    return this.leases.size;
  }
}

const slotLockManager = new SlotLockManager();
module.exports = SlotLockManager;
module.exports.slotLockManager = slotLockManager;
