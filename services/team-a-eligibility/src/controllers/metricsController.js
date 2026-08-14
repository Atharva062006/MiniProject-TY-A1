// Team A — Metrics Controller
// GET /api/v1/metrics/eligibility
// GET /api/v1/stream/eligibility  (SSE)
const { sendSuccess } = require('../../../../shared/response');

exports.getMetrics = async (req, res, next) => {
  try {
    // TODO: Return rule evaluation throughput, wait/turnaround times, deadlock indicators
    sendSuccess(res, { stub: true, queue_depth: 0, throughput: 0 }, req.correlationId);
  } catch (err) { next(err); }
};

exports.streamEligibility = (req, res) => {
  // TODO: Server-Sent Events stream of state changes
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('data: {"type":"connected","stub":true}\n\n');
  // Keep alive ping
  const interval = setInterval(() => res.write(':ping\n\n'), 30000);
  req.on('close', () => clearInterval(interval));
};
