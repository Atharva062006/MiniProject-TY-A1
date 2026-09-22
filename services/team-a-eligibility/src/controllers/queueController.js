// Team A — Queue Controller
// GET /api/v1/drives/:driveId/queue

const { sendSuccess } = require('../../../../shared/response');
const { ValidationError } = require('../../../../shared/errors');
const requestService = require('../services/requestService');

exports.getDriveQueue = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    if (!driveId) {
      throw new ValidationError('driveId parameter is required');
    }

    const queueData = requestService.getDriveQueue(driveId);
    sendSuccess(res, queueData, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};
