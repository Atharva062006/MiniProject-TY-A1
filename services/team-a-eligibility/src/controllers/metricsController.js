// Team A — Metrics & Telemetry Controller
// GET /api/v1/metrics/eligibility
// GET /api/v1/stream/eligibility  (SSE)

const { sendSuccess } = require('../../../../shared/response');
const requestService = require('../services/requestService');
const { slotLockManager } = require('../locks/SlotLockManager');
const sseService = require('../services/sseService');

exports.getMetrics = async (req, res, next) => {
  try {
    const metrics = requestService.getMetrics(slotLockManager);
    sendSuccess(res, metrics, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};

exports.streamEligibility = (req, res) => {
  sseService.addClient(res, req);
};
