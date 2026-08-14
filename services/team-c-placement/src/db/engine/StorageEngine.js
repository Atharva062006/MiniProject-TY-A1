/**
 * StorageEngine — Core persistence layer for the custom DBMS.
 *
 * Each table is stored as a single JSON file at:
 *   <dataDir>/tables/<tableName>.json
 *
 * File format:
 *   { "rows": { "<primaryKey>": { ...rowData } }, "meta": { "count": N, "lastModified": "ISO" } }
 *
 * Atomic writes: we write to a temp file first then rename to prevent corruption.
 */

const fs   = require('fs');
const path = require('path');

class StorageEngine {
  /**
   * @param {string} dataDir - Absolute path to the data directory
   */
  constructor(dataDir) {
    this.dataDir   = dataDir;
    this.tablesDir = path.join(dataDir, 'tables');
    // In-memory page cache: tableName -> { rows: {}, meta: {} }
    this._cache = new Map();
    this._dirty = new Set(); // tables that need flushing
  }

  /** Ensure the tables directory exists */
  initialize() {
    if (!fs.existsSync(this.dataDir))   fs.mkdirSync(this.dataDir,   { recursive: true });
    if (!fs.existsSync(this.tablesDir)) fs.mkdirSync(this.tablesDir, { recursive: true });
  }

  /** Return the file path for a given table */
  _tablePath(tableName) {
    return path.join(this.tablesDir, `${tableName}.json`);
  }

  /**
   * Load a table from disk into the cache.
   * Returns { rows, meta } object.
   */
  _loadTable(tableName) {
    const filePath = this._tablePath(tableName);
    if (!fs.existsSync(filePath)) {
      const empty = { rows: {}, meta: { count: 0, lastModified: new Date().toISOString() } };
      this._cache.set(tableName, empty);
      return empty;
    }
    try {
      const raw  = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      this._cache.set(tableName, data);
      return data;
    } catch (err) {
      throw new Error(`StorageEngine: failed to read table '${tableName}': ${err.message}`);
    }
  }

  /**
   * Get the in-memory table object (load from disk if not cached).
   */
  _getTable(tableName) {
    if (!this._cache.has(tableName)) {
      this._loadTable(tableName);
    }
    return this._cache.get(tableName);
  }

  /**
   * Atomically write the table cache to disk.
   * Uses write-to-temp-then-rename pattern.
   */
  flushTable(tableName) {
    const data     = this._cache.get(tableName);
    if (!data) return;
    const filePath = this._tablePath(tableName);
    const tmpPath  = filePath + '.tmp';
    try {
      data.meta.lastModified = new Date().toISOString();
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
      this._dirty.delete(tableName);
    } catch (err) {
      // Clean up temp file if it exists
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      throw new Error(`StorageEngine: failed to flush table '${tableName}': ${err.message}`);
    }
  }

  /** Flush all dirty tables to disk */
  flushAll() {
    for (const tableName of this._dirty) {
      this.flushTable(tableName);
    }
  }

  /**
   * Read all rows from a table.
   * @returns {object[]} Array of row objects
   */
  readTable(tableName) {
    const data = this._getTable(tableName);
    return Object.values(data.rows);
  }

  /**
   * Find rows matching a predicate.
   * @param {string}   tableName
   * @param {Function} predicate  - (row) => boolean
   * @returns {object[]}
   */
  findRows(tableName, predicate) {
    const data = this._getTable(tableName);
    return Object.values(data.rows).filter(predicate);
  }

  /**
   * Get a single row by primary key.
   * @param {string} tableName
   * @param {string} pk         - Primary key value
   * @returns {object|null}
   */
  getRow(tableName, pk) {
    const data = this._getTable(tableName);
    return data.rows[pk] || null;
  }

  /**
   * Insert a new row. Throws if the primary key already exists.
   * @param {string} tableName
   * @param {string} pk         - Primary key value
   * @param {object} row        - Row data (should include pk field)
   */
  insertRow(tableName, pk, row) {
    const data = this._getTable(tableName);
    if (data.rows[pk] !== undefined) {
      throw new Error(`StorageEngine: duplicate primary key '${pk}' in table '${tableName}'`);
    }
    data.rows[pk] = { ...row };
    data.meta.count++;
    this._dirty.add(tableName);
  }

  /**
   * Update an existing row (partial update — merges fields).
   * @param {string} tableName
   * @param {string} pk
   * @param {object} updates - Fields to merge into the row
   * @returns {object} Updated row
   */
  updateRow(tableName, pk, updates) {
    const data = this._getTable(tableName);
    if (data.rows[pk] === undefined) {
      throw new Error(`StorageEngine: row '${pk}' not found in table '${tableName}'`);
    }
    data.rows[pk] = { ...data.rows[pk], ...updates };
    this._dirty.add(tableName);
    return data.rows[pk];
  }

  /**
   * Replace an existing row entirely.
   * @param {string} tableName
   * @param {string} pk
   * @param {object} row - New complete row
   */
  replaceRow(tableName, pk, row) {
    const data = this._getTable(tableName);
    if (data.rows[pk] === undefined) {
      throw new Error(`StorageEngine: row '${pk}' not found in table '${tableName}'`);
    }
    data.rows[pk] = { ...row };
    this._dirty.add(tableName);
    return data.rows[pk];
  }

  /**
   * Delete a row by primary key.
   * @param {string} tableName
   * @param {string} pk
   */
  deleteRow(tableName, pk) {
    const data = this._getTable(tableName);
    if (data.rows[pk] === undefined) {
      throw new Error(`StorageEngine: row '${pk}' not found in table '${tableName}'`);
    }
    delete data.rows[pk];
    data.meta.count--;
    this._dirty.add(tableName);
  }

  /** Count rows in a table */
  countRows(tableName) {
    const data = this._getTable(tableName);
    return data.meta.count;
  }

  /**
   * Apply a set of mutations atomically to the in-memory cache.
   * Used by TransactionManager on commit.
   * @param {object[]} mutations - [{ op, tableName, pk, row, updates }]
   */
  applyMutations(mutations) {
    for (const m of mutations) {
      switch (m.op) {
        case 'INSERT': this.insertRow(m.tableName, m.pk, m.row);         break;
        case 'UPDATE': this.updateRow(m.tableName, m.pk, m.updates);     break;
        case 'REPLACE': this.replaceRow(m.tableName, m.pk, m.row);       break;
        case 'DELETE': this.deleteRow(m.tableName, m.pk);                break;
        default: throw new Error(`StorageEngine: unknown mutation op '${m.op}'`);
      }
    }
    // Flush all changed tables
    this.flushAll();
  }

  /**
   * Apply inverse mutations (for rollback).
   * @param {object[]} undoLog - [{ op, tableName, pk, before }]
   */
  applyUndo(undoLog) {
    // Process in reverse order
    for (let i = undoLog.length - 1; i >= 0; i--) {
      const u = undoLog[i];
      const data = this._getTable(u.tableName);
      if (u.op === 'INSERT') {
        // Undo an insert = delete the row
        delete data.rows[u.pk];
        if (data.meta.count > 0) data.meta.count--;
      } else if (u.op === 'UPDATE' || u.op === 'REPLACE') {
        // Undo an update = restore before value
        data.rows[u.pk] = { ...u.before };
      } else if (u.op === 'DELETE') {
        // Undo a delete = re-insert the before value
        data.rows[u.pk] = { ...u.before };
        data.meta.count++;
      }
      this._dirty.add(u.tableName);
    }
    this.flushAll();
  }

  /** Invalidate the cache for a table (force reload from disk on next access) */
  invalidateCache(tableName) {
    this._cache.delete(tableName);
  }

  /** Create an empty table file if it doesn't exist */
  createTableIfNotExists(tableName) {
    const filePath = this._tablePath(tableName);
    if (!fs.existsSync(filePath)) {
      const empty = { rows: {}, meta: { count: 0, lastModified: new Date().toISOString() } };
      fs.writeFileSync(filePath, JSON.stringify(empty, null, 2), 'utf8');
      this._cache.set(tableName, empty);
    }
  }
}

module.exports = StorageEngine;
