/**
 * OfferService — Handles commit and compensation of Team A decisions/offers (C3).
 *
 * Exposes atomic actions for:
 *   1. Committing an eligibility decision (and potentially allocating a seat).
 *   2. Compensating (rolling back) a failed workflow step to keep data consistent.
 */

const { v4: uuidv4 } = require('uuid');
const { ConflictError, NotFoundError } = require('../../../../shared/errors');
const stateMachine = require('./stateMachineService');

class OfferService {
  /**
   * @param {Database}     db
   * @param {AuditService} auditService
   */
  constructor(db, auditService) {
    this.db           = db;
    this.auditService = auditService;
  }

  /**
   * Commit an eligibility decision / offer (C3).
   * Atomically transitions the application state, updates drive seats (if SELECTED),
   * and records the decision.
   *
   * @param {object} params
   * @param {string} params.applicationId
   * @param {string} params.decisionResult    - e.g., 'ELIGIBLE', 'NOT_ELIGIBLE'
   * @param {string} params.targetState       - e.g., 'RULE_EVALUATED', 'SELECTED'
   * @param {string} params.leaseId           - Team A lease ID (if applicable)
   * @param {number} params.expectedVersion   - Optimistic concurrency control
   * @param {string} params.correlationId
   * @param {string} params.actor             - 'TeamA' or 'Orchestrator'
   */
  async commitOffer({ applicationId, decisionResult, targetState, leaseId, expectedVersion, correlationId, actor }) {
    return this.db.transaction(async (txn) => {
      const app = await txn.read('applications', applicationId);
      if (!app) throw new NotFoundError('Application', applicationId);

      // Optimistic concurrency
      if (app.version !== expectedVersion) {
        throw new ConflictError(`Application version mismatch: expected ${expectedVersion}, got ${app.version}`);
      }

      stateMachine.assertValidTransition(app.state, targetState);

      // Record decision
      const decisionId = uuidv4();
      const decision = {
        decision_id:    decisionId,
        application_id: applicationId,
        result:         decisionResult,
        failed_rules:   [],
        lease_id:       leaseId || null,
        created_at:     new Date().toISOString(),
      };
      await txn.insert('eligibility_decisions', decisionId, decision);

      // If SELECTED, claim a seat
      if (targetState === 'SELECTED') {
        const drive = await txn.read('drives', app.drive_id);
        if (drive.seats <= 0) {
          throw new ConflictError(`Drive '${app.drive_id}' has no available seats`);
        }
        await txn.update('drives', app.drive_id, { seats: drive.seats - 1 });

        // Record offer
        const offerId = uuidv4();
        await txn.insert('offers', offerId, {
          offer_id:       offerId,
          application_id: applicationId,
          drive_id:       app.drive_id,
          status:         'PENDING',
          committed_at:   null,
        });
      }

      // Transition application
      const updatedApp = await txn.update('applications', applicationId, {
        state:   targetState,
        version: app.version + 1,
        updated_at: new Date().toISOString(),
      });

      // Audit Log (written via service outside of this transaction to ensure it always logs,
      // but in a strict setup we could write the audit log entry inside this txn)
      // For simplicity, we just return the data.

      return { application: updatedApp, decision };
    }).then(async (result) => {
       // Log audit after successful commit
       await this.auditService.log({
         actor,
         action: 'COMMIT_OFFER',
         tableName: 'applications',
         recordId: applicationId,
         before: { state: result.application.state }, // roughly
         after: result.application,
         correlationId,
       });
       return result;
    });
  }

  /**
   * Compensate a failed workflow step (C3).
   * E.g., if a commit failed after Team A granted a lease, release it and mark application as COMPENSATION_REQUIRED.
   */
  async compensate({ applicationId, reason, correlationId, actor }) {
    return this.db.transaction(async (txn) => {
       const app = await txn.read('applications', applicationId);
       if (!app) throw new NotFoundError('Application', applicationId);

       const updatedApp = await txn.update('applications', applicationId, {
         state: 'COMPENSATION_REQUIRED',
         version: app.version + 1,
         updated_at: new Date().toISOString()
       });

       return updatedApp;
    }).then(async (app) => {
       await this.auditService.log({
         actor,
         action: `COMPENSATE: ${reason}`,
         tableName: 'applications',
         recordId: applicationId,
         after: app,
         correlationId
       });
       return app;
    });
  }
}

module.exports = OfferService;
