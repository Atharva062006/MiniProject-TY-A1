const { sendSuccess } = require('../../../../shared/response');

class AnalyticsController {
  /**
   * @param {import('../services/analyticsService')} analyticsService
   */
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  // POST /api/v1/analytics/analyse
  analyseCohort = async (req, res, next) => {
    try {
      const report = await this.analyticsService.analyseCohort(req.body || {});
      sendSuccess(res, report, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/metrics/ranking
  getMetrics = (req, res, next) => {
    try {
      const metrics = this.analyticsService.getMetrics();
      sendSuccess(res, metrics, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AnalyticsController;
