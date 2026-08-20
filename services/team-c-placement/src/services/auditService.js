/**
 * AuditService — Append-only audit logging for all data mutations.
 *
 * Every create/update/withdraw/offer transition must be logged with:
 *   actor, action, table_name, record_id, before_value, after_value,
 *   correlation_id, timestamp
 *
 * Uses the B-tree index on timestamp for range queries and hash index
 * on correlation_id for cross-service tracing.
 */

const { v4: uuidv4 } = require('uuid');
const sseService      = require('./sseService');

class AuditService {
  /**
   * @param {Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Log an audit event.
   * @param {object} params
   * @param {string} params.actor          - Who performed the action (user_id or service name)
   * @param {string} params.action         - Action name (e.g. 'CREATE_APPLICATION', 'STATE_TRANSITION')
   * @param {string} params.tableName      - Table affected
   * @param {string} params.recordId       - PK of the affected record
   * @param {object} [params.before]       - State before the change
   * @param {object} [params.after]        - State after the change
   * @param {string} [params.correlationId]- X-Correlation-ID
   */
  async log({ actor, action, tableName, recordId, before = null, after = null, correlationId = null }) {
    const auditId = uuidv4();
    const entry = {
      audit_id:       auditId,
      actor,
      action,
      table_name:     tableName,
      record_id:      String(recordId),
      before_value:   before,
      after_value:    after,
      correlation_id: correlationId,
      timestamp:      new Date().toISOString(),
    };
    await this.db.table('audit_log').insert(entry);

    // Broadcast to all connected SSE clients (Team D live dashboard)
    sseService.broadcast('audit', {
      audit_id:       entry.audit_id,
      actor:          entry.actor,
      action:         entry.action,
      table_name:     entry.table_name,
      record_id:      entry.record_id,
      correlation_id: entry.correlation_id,
      timestamp:      entry.timestamp,
    });

    return entry;
  }

  /**
   * Query audit log entries.
   * @param {object} filters
   * @param {string} [filters.correlationId] - Filter by correlation ID
   * @param {string} [filters.recordId]      - Filter by record ID
   * @param {string} [filters.tableName]     - Filter by table name
   * @param {string} [filters.actor]         - Filter by actor
   * @param {string} [filters.fromDate]      - ISO date string
   * @param {string} [filters.toDate]        - ISO date string
   * @param {number} [filters.limit=100]     - Max results
   * @param {number} [filters.offset=0]      - Pagination offset
   * @returns {{ entries: object[], total: number }}
   */
  async query({ correlationId, recordId, tableName, actor, fromDate, toDate, limit = 100, offset = 0 } = {}) {
    let pks;

    // Use indexes when possible for efficient filtering
    if (correlationId) {
      pks = this.db.index('audit_log_correlation_id_hash').lookup(correlationId);
    } else if (recordId) {
      pks = this.db.index('audit_log_record_id_hash').lookup(recordId);
    } else if (fromDate || toDate) {
      pks = this.db.index('audit_log_timestamp_btree').rangeQuery(fromDate || null, toDate || null);
    }

    let entries;
    if (pks !== undefined) {
      // Fetch only the matched rows
      entries = [...pks].map(pk => this.db.table('audit_log').findById(pk)).filter(Boolean);
    } else {
      entries = this.db.table('audit_log').all();
    }

    // Apply remaining filters
    if (tableName) entries = entries.filter(e => e.table_name === tableName);
    if (actor)     entries = entries.filter(e => e.actor === actor);

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      entries: entries.slice(offset, offset + limit),
      total:   entries.length,
    };
  }
}

module.exports = AuditService;
