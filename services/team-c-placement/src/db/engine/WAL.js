/**
 * Write-Ahead Log (WAL) — crash recovery for the custom DBMS.
 *
 * Log file format (one JSON line per entry):
 *   { txn_id, seq, op, table, pk, before, after, timestamp, committed }
 *
 * Recovery procedure on startup:
 *   1. Read the WAL file.
 *   2. Find all transactions with committed=true.
 *   3. Re-apply their 'after' values to the storage engine.
 *   4. Discard incomplete (uncommitted) transactions.
 *   5. Truncate/checkpoint the WAL.
 */

const fs   = require('fs');
const path = require('path');

class WAL {
  /**
   * @param {string} walDir - Directory for WAL files
   */
  constructor(walDir) {
    this.walDir  = walDir;
    this.walPath = path.join(walDir, 'wal.log');
    this._buffer = []; // in-memory buffer before flush
    this._seq    = 0;
  }

  /** Ensure WAL directory exists */
  initialize() {
    if (!fs.existsSync(this.walDir)) fs.mkdirSync(this.walDir, { recursive: true });
    if (!fs.existsSync(this.walPath)) fs.writeFileSync(this.walPath, '', 'utf8');
    // Load current seq number from existing log
    this._loadSeq();
  }

  _loadSeq() {
    try {
      const lines = fs.readFileSync(this.walPath, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]);
        this._seq = last.seq || 0;
      }
    } catch { this._seq = 0; }
  }

  /**
   * Append a log entry for a mutation within a transaction.
   * @param {string} txnId  - Transaction ID
   * @param {string} op     - 'INSERT' | 'UPDATE' | 'REPLACE' | 'DELETE'
   * @param {string} table  - Table name
   * @param {string} pk     - Primary key
   * @param {object} before - Row state before mutation (null for INSERT)
   * @param {object} after  - Row state after mutation (null for DELETE)
   */
  logMutation(txnId, op, table, pk, before, after) {
    this._seq++;
    const entry = {
      txn_id:    txnId,
      seq:       this._seq,
      op,
      table,
      pk,
      before:    before ? { ...before } : null,
      after:     after  ? { ...after  } : null,
      timestamp: new Date().toISOString(),
      committed: false,
    };
    this._buffer.push(entry);
    this._appendToFile(entry);
    return entry;
  }

  /**
   * Mark all entries for a transaction as committed.
   * @param {string} txnId
   */
  commit(txnId) {
    const marker = {
      txn_id:    txnId,
      seq:       ++this._seq,
      op:        'COMMIT',
      table:     null,
      pk:        null,
      before:    null,
      after:     null,
      timestamp: new Date().toISOString(),
      committed: true,
    };
    this._appendToFile(marker);
    // Remove buffered entries for this txn
    this._buffer = this._buffer.filter(e => e.txn_id !== txnId);
  }

  /**
   * Log a rollback marker (uncommitted entries are simply discarded).
   * @param {string} txnId
   */
  abort(txnId) {
    const marker = {
      txn_id:    txnId,
      seq:       ++this._seq,
      op:        'ABORT',
      table:     null, pk: null, before: null, after: null,
      timestamp: new Date().toISOString(),
      committed: false,
    };
    this._appendToFile(marker);
    this._buffer = this._buffer.filter(e => e.txn_id !== txnId);
  }

  /** Append a single log entry to the WAL file (synchronous for durability) */
  _appendToFile(entry) {
    fs.appendFileSync(this.walPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  /**
   * Read the WAL and return { committed: Map<txnId, entries[]>, aborted: Set<txnId> }
   */
  readLog() {
    const lines = fs.readFileSync(this.walPath, 'utf8').trim().split('\n').filter(Boolean);
    const entries   = new Map(); // txnId -> entries[]
    const committed = new Set();
    const aborted   = new Set();

    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (e.op === 'COMMIT') {
          committed.add(e.txn_id);
        } else if (e.op === 'ABORT') {
          aborted.add(e.txn_id);
        } else {
          if (!entries.has(e.txn_id)) entries.set(e.txn_id, []);
          entries.get(e.txn_id).push(e);
        }
      } catch { /* skip malformed lines */ }
    }

    return { entries, committed, aborted };
  }

  /**
   * Recover committed transactions by replaying their mutations
   * against the provided StorageEngine instance.
   * Returns the count of replayed transactions.
   * @param {StorageEngine} storage
   */
  recover(storage) {
    const { entries, committed } = this.readLog();
    let replayed = 0;

    for (const txnId of committed) {
      const txnEntries = entries.get(txnId) || [];
      for (const e of txnEntries) {
        try {
          switch (e.op) {
            case 'INSERT':
              if (!storage.getRow(e.table, e.pk)) {
                storage.insertRow(e.table, e.pk, e.after);
              }
              break;
            case 'UPDATE':
            case 'REPLACE':
              if (storage.getRow(e.table, e.pk)) {
                storage.replaceRow(e.table, e.pk, e.after);
              }
              break;
            case 'DELETE':
              if (storage.getRow(e.table, e.pk)) {
                storage.deleteRow(e.table, e.pk);
              }
              break;
          }
        } catch { /* best effort during recovery */ }
      }
      replayed++;
    }

    if (replayed > 0) storage.flushAll();
    return replayed;
  }

  /**
   * Checkpoint: truncate the WAL (move processed entries to an archive).
   * Call periodically after successful flushes.
   */
  checkpoint() {
    const archivePath = path.join(this.walDir, `wal.${Date.now()}.archive`);
    if (fs.existsSync(this.walPath)) {
      fs.renameSync(this.walPath, archivePath);
      fs.writeFileSync(this.walPath, '', 'utf8');
      this._seq = 0;
    }
  }
}

module.exports = WAL;
