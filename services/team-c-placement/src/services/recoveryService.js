/**
 * RecoveryService — Utilities for verifying and triggering WAL crash recovery (C4).
 */

class RecoveryService {
  /**
   * @param {Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Manually trigger WAL recovery verification.
   * Useful for testing RPO/RTO without fully restarting the service.
   */
  async verifyRecovery() {
    const startTime = Date.now();

    // 1. Flush any pending memory changes
    this.db.storage.flushAll();

    // 2. Read WAL and replay
    const replayedCount = this.db.wal.recover(this.db.storage);

    const endTime = Date.now();

    return {
      status: 'SUCCESS',
      replayed_transactions: replayedCount,
      recovery_time_ms: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = RecoveryService;
