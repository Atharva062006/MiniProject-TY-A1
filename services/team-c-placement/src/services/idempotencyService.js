/**
 * IdempotencyService — Prevents duplicate side effects for repeated requests.
 *
 * Uses the idempotency_keys table (hash-indexed) to store and retrieve
 * the original response for any given idempotency key.
 *
 * TTL: 24 hours by default.
 */

class IdempotencyService {
  /**
   * @param {Database} db
   */
  constructor(db) {
    this.db  = db;
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours in ms
  }

  /**
   * Check if an idempotency key has already been processed.
   * @param {string} key
   * @returns {object|null} Stored response, or null if not found / expired
   */
  async getStoredResponse(key) {
    const row = this.db.table('idempotency_keys').findById(key);
    if (!row) return null;
    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await this.db.table('idempotency_keys').delete(key).catch(() => {});
      return null;
    }
    return row.response;
  }

  /**
   * Store the response for an idempotency key.
   * @param {string} key
   * @param {object} response - The response payload to cache
   */
  async storeResponse(key, response) {
    const now = new Date();
    const row = {
      key,
      response,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + this.ttl).toISOString(),
    };
    await this.db.table('idempotency_keys').insert(row);
  }

  /**
   * Check if a key is still valid (not expired).
   * @param {string} key
   * @returns {boolean}
   */
  isValid(key) {
    const row = this.db.table('idempotency_keys').findById(key);
    if (!row) return false;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
    return true;
  }
}

module.exports = IdempotencyService;
