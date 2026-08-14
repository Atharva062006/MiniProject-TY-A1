const { sendSuccess } = require('../../../../shared/response');

class ReportController {
  constructor(reportService, recoveryService) {
    this.reportService = reportService;
    this.recoveryService = recoveryService;
  }

  // GET /api/v1/reports/placement-performance
  getPlacementPerformance = async (req, res, next) => {
    try {
      const result = await this.reportService.generatePlacementPerformanceReport(req.query);
      sendSuccess(res, result, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /internal/v1/recovery/verify
  verifyRecovery = async (req, res, next) => {
    try {
      const result = await this.recoveryService.verifyRecovery();
      sendSuccess(res, result, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ReportController;
