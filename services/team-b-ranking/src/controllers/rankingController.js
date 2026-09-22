const { sendSuccess } = require('../../../../shared/response');
const { ValidationError } = require('../../../../shared/errors');

class RankingController {
  /**
   * @param {import('../services/rankingService')} rankingService
   */
  constructor(rankingService) {
    this.rankingService = rankingService;
  }

  // POST /api/v1/rankings/compute
  computeRanking = async (req, res, next) => {
    try {
      const result = await this.rankingService.computeRanking(req.body || {});
      sendSuccess(res, result, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/rankings/:rankingId
  getRanking = (req, res, next) => {
    try {
      const { rankingId } = req.params;
      if (!rankingId) {
        throw new ValidationError('rankingId path parameter is required');
      }
      const record = this.rankingService.getRanking(rankingId);
      sendSuccess(res, record, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /internal/v1/shortlist-index/:key
  getShortlistIndex = (req, res, next) => {
    try {
      const { key } = req.params;
      if (!key) {
        throw new ValidationError('key path parameter is required');
      }
      const indexResult = this.rankingService.searchIndex(key);
      sendSuccess(res, indexResult, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /internal/v1/shortlist-cache/invalidate
  invalidateCache = (req, res, next) => {
    try {
      const result = this.rankingService.invalidateCache();
      sendSuccess(res, result, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RankingController;
