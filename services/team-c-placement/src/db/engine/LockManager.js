/**
 * LockManager — Row-level and table-level locking for the custom DBMS.
 *
 * Lock modes:
 *   SHARED   (S) — multiple readers allowed, no writers
 *   EXCLUSIVE (X) — single writer, no readers
 *
 * Lock key format: "<tableName>:<pk>" for row locks, "<tableName>" for table locks.
 *
 * Deadlock detection: wait-for graph. If a cycle is detected, the requesting
 * transaction is aborted (wound-wait prevention could be added later).
 */

class LockManager {
  constructor() {
    // lockKey -> { mode: 'S'|'X', holders: Set<txnId> }
    this._locks = new Map();
    // Wait-for graph: txnId -> Set<txnId>  (txnId is waiting for these txnIds)
    this._waitFor = new Map();
    // Queue of pending lock requests: lockKey -> [{ txnId, mode, resolve, reject }]
    this._queue = new Map();
    // Lock timeout in ms
    this.lockTimeout = 5000;
  }

  /**
   * Acquire a lock. Returns a Promise that resolves when the lock is granted.
   * @param {string} txnId   - Transaction requesting the lock
   * @param {string} lockKey - "<table>:<pk>" or "<table>"
   * @param {string} mode    - 'S' (shared) or 'X' (exclusive)
   */
  acquire(txnId, lockKey, mode) {
    return new Promise((resolve, reject) => {
      if (this._tryGrant(txnId, lockKey, mode)) {
        return resolve();
      }
      // Queue the request
      if (!this._queue.has(lockKey)) this._queue.set(lockKey, []);
      const request = { txnId, mode, resolve, reject };
      this._queue.get(lockKey).push(request);
      // Update wait-for graph
      this._addWaitEdges(txnId, lockKey);
      // Check for deadlock
      if (this._detectCycle(txnId)) {
        this._removeWaitEdges(txnId, lockKey);
        this._queue.get(lockKey).splice(
          this._queue.get(lockKey).findIndex(r => r === request), 1
        );
        return reject(new Error(`Deadlock detected for transaction ${txnId}`));
      }
      // Set timeout
      const timer = setTimeout(() => {
        this._removeWaitEdges(txnId, lockKey);
        const q = this._queue.get(lockKey) || [];
        const idx = q.findIndex(r => r === request);
        if (idx !== -1) q.splice(idx, 1);
        reject(new Error(`Lock timeout for ${lockKey} (txn: ${txnId})`));
      }, this.lockTimeout);
      request._timer = timer;
    });
  }

  /**
   * Try to grant a lock immediately. Returns true if granted.
   */
  _tryGrant(txnId, lockKey, mode) {
    const existing = this._locks.get(lockKey);
    if (!existing) {
      this._locks.set(lockKey, { mode, holders: new Set([txnId]) });
      return true;
    }
    // Same txn already holds this lock
    if (existing.holders.has(txnId)) {
      // Upgrade S -> X if no other holders
      if (mode === 'X' && existing.mode === 'S' && existing.holders.size === 1) {
        existing.mode = 'X';
      }
      return true;
    }
    // Shared lock can be shared with other shared holders
    if (mode === 'S' && existing.mode === 'S') {
      existing.holders.add(txnId);
      return true;
    }
    return false;
  }

  /**
   * Release all locks held by a transaction.
   * @param {string} txnId
   */
  releaseAll(txnId) {
    for (const [lockKey, lock] of this._locks.entries()) {
      if (lock.holders.has(txnId)) {
        lock.holders.delete(txnId);
        if (lock.holders.size === 0) {
          this._locks.delete(lockKey);
          // Wake up queued requests for this key
          this._processQueue(lockKey);
        }
      }
    }
    this._waitFor.delete(txnId);
  }

  /** Process the queue for a lock key after it is released */
  _processQueue(lockKey) {
    const queue = this._queue.get(lockKey);
    if (!queue || queue.length === 0) return;

    // Try to grant the first request
    const next = queue[0];
    if (this._tryGrant(next.txnId, lockKey, next.mode)) {
      queue.shift();
      this._removeWaitEdges(next.txnId, lockKey);
      if (next._timer) clearTimeout(next._timer);
      next.resolve();
      // If mode is S, also try to grant subsequent S requests
      if (next.mode === 'S') {
        while (queue.length > 0 && queue[0].mode === 'S') {
          const sharedNext = queue[0];
          if (this._tryGrant(sharedNext.txnId, lockKey, 'S')) {
            queue.shift();
            this._removeWaitEdges(sharedNext.txnId, lockKey);
            if (sharedNext._timer) clearTimeout(sharedNext._timer);
            sharedNext.resolve();
          } else break;
        }
      }
    }
  }

  /** Add wait-for edges from txnId to all current lock holders */
  _addWaitEdges(txnId, lockKey) {
    const lock = this._locks.get(lockKey);
    if (!lock) return;
    if (!this._waitFor.has(txnId)) this._waitFor.set(txnId, new Set());
    for (const holder of lock.holders) {
      if (holder !== txnId) this._waitFor.get(txnId).add(holder);
    }
  }

  _removeWaitEdges(txnId, lockKey) {
    const lock = this._locks.get(lockKey);
    if (!lock || !this._waitFor.has(txnId)) return;
    for (const holder of lock.holders) {
      this._waitFor.get(txnId).delete(holder);
    }
  }

  /**
   * DFS cycle detection starting from startTxn.
   * Returns true if startTxn is reachable from itself (deadlock).
   */
  _detectCycle(startTxn) {
    const visited = new Set();
    const stack   = [startTxn];
    while (stack.length > 0) {
      const txn = stack.pop();
      if (visited.has(txn)) return true;
      visited.add(txn);
      const waitingFor = this._waitFor.get(txn) || new Set();
      for (const t of waitingFor) {
        if (t === startTxn) return true;
        stack.push(t);
      }
    }
    return false;
  }

  /** Return current lock table snapshot (for diagnostics) */
  snapshot() {
    const result = {};
    for (const [key, lock] of this._locks.entries()) {
      result[key] = { mode: lock.mode, holders: [...lock.holders] };
    }
    return result;
  }
}

module.exports = LockManager;
