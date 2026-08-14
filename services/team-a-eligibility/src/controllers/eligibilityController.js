// Team A — Eligibility Request Controller
// POST /api/v1/eligibility/requests
// GET  /api/v1/eligibility/requests/:requestId
const { sendSuccess, sendError } = require('../../../../shared/response');

exports.createRequest = async (req, res, next) => {
  try {
    // TODO: Team A implements eligibility request intake
    // 1. Validate rule_set_version availability
    // 2. Enqueue atomically (FIFO/priority queue based on policy)
    // 3. Return queue_position, estimated_evaluation_time, correlation_id
    sendSuccess(res, { stub: true }, req.correlationId, 202);
  } catch (err) { next(err); }
};

exports.getRequest = async (req, res, next) => {
  try {
    // TODO: Return request lifecycle state and decision result
    sendSuccess(res, { requestId: req.params.requestId, stub: true }, req.correlationId);
  } catch (err) { next(err); }
};
