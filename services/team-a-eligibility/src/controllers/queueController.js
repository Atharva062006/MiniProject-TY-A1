// Team A — Queue Controller
// GET /api/v1/drives/:driveId/queue
const { sendSuccess } = require('../../../../shared/response');

exports.getDriveQueue = async (req, res, next) => {
  try {
    // TODO: Return ordered queue with estimated evaluation times for a drive
    sendSuccess(res, { driveId: req.params.driveId, queue: [], stub: true }, req.correlationId);
  } catch (err) { next(err); }
};
