const { sendSuccess } = require('../../../../shared/response');

class ApplicationController {
  constructor(applicationService) {
    this.applicationService = applicationService;
  }

  // POST /api/v1/applications
  create = async (req, res, next) => {
    try {
      const { student_id, drive_id, resume_version, consent, idempotency_key } = req.body;
      const correlationId = req.correlationId;

      const app = await this.applicationService.createApplication({
        student_id,
        drive_id,
        resume_version,
        consent,
        idempotency_key: idempotency_key || req.idempotencyKey,
        correlationId
      });

      sendSuccess(res, app, correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/applications/:applicationId
  get = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const app = this.applicationService.getApplication(applicationId);
      sendSuccess(res, app, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/applications/:applicationId/withdraw
  withdraw = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const actor = req.user ? req.user.id : 'unknown';
      const correlationId = req.correlationId;

      const app = await this.applicationService.withdrawApplication(applicationId, actor, correlationId);
      sendSuccess(res, app, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ApplicationController;
