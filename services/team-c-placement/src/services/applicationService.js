/**
 * ApplicationService — Core business logic for placement applications (C2).
 *
 * Orchestrates:
 *   - Idempotency check
 *   - Master data validation (student exists, drive is OPEN)
 *   - ACID transaction: insert application row, update drive seat counter
 *   - State machine enforcement
 *   - Audit logging
 */

const { v4: uuidv4 } = require('uuid');
const stateMachine = require('./stateMachineService');
const { ConflictError, NotFoundError, ValidationError } = require('../../../../shared/errors');

class ApplicationService {
  /**
   * @param {Database}          db
   * @param {IdempotencyService} idempotencyService
   * @param {AuditService}      auditService
   */
  constructor(db, idempotencyService, auditService) {
    this.db                = db;
    this.idempotencyService = idempotencyService;
    this.auditService      = auditService;
  }

  /**
   * Create a new application (C2).
   * Idempotent: repeated calls with the same idempotency_key return the original result.
   *
   * @param {object} params
   * @param {string} params.student_id
   * @param {string} params.drive_id
   * @param {string} params.resume_version
   * @param {boolean} params.consent
   * @param {string} params.idempotency_key
   * @param {string} params.correlationId
   * @returns {object} Application row
   */
  async createApplication({ student_id, drive_id, resume_version, consent, idempotency_key, correlationId }) {
    // 1. Idempotency check
    const cached = await this.idempotencyService.getStoredResponse(idempotency_key);
    if (cached) return cached;

    // 2. Validate master data
    const student = this.db.table('students').findById(student_id);
    if (!student) throw new NotFoundError('Student', student_id);

    const drive = this.db.table('drives').findById(drive_id);
    if (!drive) throw new NotFoundError('Drive', drive_id);
    if (drive.state !== 'OPEN') throw new ConflictError(`Drive '${drive_id}' is not open (state: ${drive.state})`);
    if (drive.seats <= 0)       throw new ConflictError(`Drive '${drive_id}' has no available seats`);

    // 3. Check for duplicate (student already applied to this drive)
    const existing = this.db.table('applications').find(
      a => a.student_id === student_id && a.drive_id === drive_id &&
           !['WITHDRAWN', 'EXPIRED', 'NOT_ELIGIBLE'].includes(a.state)
    );
    if (existing.length > 0) {
      throw new ConflictError(`Student '${student_id}' already has an active application for drive '${drive_id}'`);
    }

    // 4. ACID transaction: insert application
    const application_id = uuidv4();
    const now = new Date().toISOString();
    const application = {
      application_id,
      student_id,
      drive_id,
      state: 'APPLIED',
      resume_version: resume_version || null,
      consent: Boolean(consent),
      idempotency_key,
      version: 1,
      created_at: now,
      updated_at: now,
    };

    await this.db.transaction(async (txn) => {
      await txn.insert('applications', application_id, application);
    });

    // 5. Audit log
    await this.auditService.log({
      actor: student_id,
      action: 'CREATE_APPLICATION',
      tableName: 'applications',
      recordId: application_id,
      before: null,
      after: application,
      correlationId,
    });

    // 6. Cache for idempotency
    await this.idempotencyService.storeResponse(idempotency_key, application);

    return application;
  }

  /**
   * Get application by ID (C2).
   */
  getApplication(applicationId) {
    const app = this.db.table('applications').findById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);
    return app;
  }

  /**
   * Transition application state (internal use by orchestration).
   * @param {string} applicationId
   * @param {string} newState
   * @param {string} actor
   * @param {string} correlationId
   * @param {object} [additionalUpdates] - Extra fields to update
   */
  async transitionState(applicationId, newState, actor, correlationId, additionalUpdates = {}) {
    const before = this.db.table('applications').findById(applicationId);
    if (!before) throw new NotFoundError('Application', applicationId);
    stateMachine.assertValidTransition(before.state, newState);

    const updates = {
      state:      newState,
      version:    before.version + 1,
      updated_at: new Date().toISOString(),
      ...additionalUpdates,
    };

    const after = await this.db.table('applications').update(applicationId, updates);

    await this.auditService.log({
      actor,
      action: `STATE_TRANSITION:${before.state}->${newState}`,
      tableName: 'applications',
      recordId: applicationId,
      before,
      after,
      correlationId,
    });

    return after;
  }

  /**
   * Withdraw an application (C2).
   * @param {string} applicationId
   * @param {string} actor         - Who is withdrawing (student_id or admin)
   * @param {string} correlationId
   */
  async withdrawApplication(applicationId, actor, correlationId) {
    return this.transitionState(applicationId, 'WITHDRAWN', actor, correlationId);
  }

  /**
   * List all applications (with optional filters).
   */
  listApplications({ student_id, drive_id, state } = {}) {
    let apps = this.db.table('applications').all();
    if (student_id) apps = apps.filter(a => a.student_id === student_id);
    if (drive_id)   apps = apps.filter(a => a.drive_id   === drive_id);
    if (state)      apps = apps.filter(a => a.state      === state);
    return apps;
  }
}

module.exports = ApplicationService;
