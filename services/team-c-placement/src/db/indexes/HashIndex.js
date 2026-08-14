/**
 * HashIndex — Open-addressing hash map for O(1) equality lookups.
 *
 * Used for:
 *   - Primary key lookups     (student_id, application_id, drive_id)
 *   - Idempotency key dedup   (idempotency_keys table)
 *   - Correlation ID search   (audit_log)
 *
 * Collision strategy: linear probing with tombstone deletion.
 * Load factor threshold: 0.75 — rehashes when exceeded.
 *
 * Each slot: { key, pks: Set<string>, deleted: boolean }
 *
 * Persistence: serialize() / deserialize()
 */

class HashIndex {
  /**
   * @param {string} indexName
   * @param {number} initialCapacity - Must be a power of 2
   */
  constructor(indexName = 'unnamed', initialCapacity = 16) {
    this.indexName = indexName;
    this.capacity  = initialCapacity;
    this.count     = 0;       // number of live entries
    this.table     = new Array(initialCapacity).fill(null);
  }

  // ─── Hashing ───────────────────────────────────────────────────────────────

  /** djb2 hash function */
  _hash(key) {
    const str = String(key);
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h & 0xFFFFFFFF; // force 32-bit
    }
    return Math.abs(h) % this.capacity;
  }

  // ─── Insert ───────────────────────────────────────────────────────────────

  /**
   * Insert a (key, pk) pair.
   * If key already exists, adds pk to its Set (multi-value).
   */
  insert(key, pk) {
    if (this.count / this.capacity >= 0.75) this._rehash();
    let idx = this._hash(key);
    let firstDeleted = -1;
    for (let i = 0; i < this.capacity; i++) {
      const pos  = (idx + i) % this.capacity;
      const slot = this.table[pos];
      if (slot === null) {
        // Empty slot — insert here (or at first deleted slot)
        const insertAt = firstDeleted !== -1 ? firstDeleted : pos;
        this.table[insertAt] = { key: String(key), pks: new Set([pk]), deleted: false };
        this.count++;
        return;
      }
      if (slot.deleted) {
        if (firstDeleted === -1) firstDeleted = pos;
        continue;
      }
      if (slot.key === String(key)) {
        slot.pks.add(pk);
        return; // key already exists, just add pk
      }
    }
    // Table is full (shouldn't happen with 0.75 load factor + rehash)
    this._rehash();
    this.insert(key, pk);
  }

  // ─── Lookup ───────────────────────────────────────────────────────────────

  /**
   * Look up all PKs for a given key.
   * @returns {Set<string>} Set of primary keys, or empty Set
   */
  lookup(key) {
    let idx = this._hash(key);
    for (let i = 0; i < this.capacity; i++) {
      const pos  = (idx + i) % this.capacity;
      const slot = this.table[pos];
      if (slot === null) return new Set();    // empty slot = key not present
      if (slot.deleted) continue;             // skip tombstones
      if (slot.key === String(key)) return slot.pks;
    }
    return new Set();
  }

  /**
   * Check if a key exists.
   */
  has(key) {
    return this.lookup(key).size > 0;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Remove a specific (key, pk) pair.
   * If it was the last pk for that key, marks the slot as a tombstone.
   */
  delete(key, pk) {
    let idx = this._hash(key);
    for (let i = 0; i < this.capacity; i++) {
      const pos  = (idx + i) % this.capacity;
      const slot = this.table[pos];
      if (slot === null) return false;
      if (slot.deleted) continue;
      if (slot.key === String(key)) {
        slot.pks.delete(pk);
        if (slot.pks.size === 0) {
          slot.deleted = true;
          this.count--;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all PKs for a key entirely.
   */
  deleteKey(key) {
    let idx = this._hash(key);
    for (let i = 0; i < this.capacity; i++) {
      const pos  = (idx + i) % this.capacity;
      const slot = this.table[pos];
      if (slot === null) return false;
      if (slot.deleted) continue;
      if (slot.key === String(key)) {
        this.count -= slot.pks.size;
        slot.deleted = true;
        return true;
      }
    }
    return false;
  }

  // ─── Rehash ───────────────────────────────────────────────────────────────

  _rehash() {
    const oldTable    = this.table;
    this.capacity    *= 2;
    this.table        = new Array(this.capacity).fill(null);
    this.count        = 0;
    for (const slot of oldTable) {
      if (slot && !slot.deleted) {
        for (const pk of slot.pks) {
          this.insert(slot.key, pk);
        }
      }
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  loadFactor() {
    return this.count / this.capacity;
  }

  stats() {
    let collisions = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.table[i] && !this.table[i].deleted) {
        const expected = this._hash(this.table[i].key);
        if (expected !== i) collisions++;
      }
    }
    return { capacity: this.capacity, count: this.count, loadFactor: this.loadFactor(), collisions };
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  serialize() {
    return JSON.stringify({
      indexName: this.indexName,
      capacity:  this.capacity,
      count:     this.count,
      table:     this.table.map(slot =>
        slot ? { key: slot.key, pks: [...slot.pks], deleted: slot.deleted } : null
      ),
    });
  }

  static deserialize(json) {
    const data  = typeof json === 'string' ? JSON.parse(json) : json;
    const index = new HashIndex(data.indexName, data.capacity);
    index.count = data.count;
    index.table = data.table.map(slot =>
      slot ? { key: slot.key, pks: new Set(slot.pks), deleted: slot.deleted } : null
    );
    return index;
  }
}

module.exports = HashIndex;
