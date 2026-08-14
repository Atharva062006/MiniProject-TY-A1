const { sendSuccess } = require('../../../../shared/response');

class OfferController {
  constructor(offerService) {
    this.offerService = offerService;
  }

  // POST /internal/v1/offers/commit
  commit = async (req, res, next) => {
    try {
      const { application_id, decision_result, target_state, lease_id, expected_version } = req.body;
      const correlationId = req.correlationId;
      const actor = req.user ? req.user.id : 'system';

      const result = await this.offerService.commitOffer({
        applicationId: application_id,
        decisionResult: decision_result,
        targetState: target_state,
        leaseId: lease_id,
        expectedVersion: expected_version,
        correlationId,
        actor
      });

      sendSuccess(res, result, correlationId, 200);
    } catch (err) {
      next(err);
    }
  };

  // POST /internal/v1/offers/compensate
  compensate = async (req, res, next) => {
    try {
      const { application_id, reason } = req.body;
      const correlationId = req.correlationId;
      const actor = req.user ? req.user.id : 'system';

      const result = await this.offerService.compensate({
        applicationId: application_id,
        reason,
        correlationId,
        actor
      });

      sendSuccess(res, result, correlationId, 200);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = OfferController;
