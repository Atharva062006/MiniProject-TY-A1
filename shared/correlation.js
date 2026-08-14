const { v4: uuidv4 } = require('uuid');

/**
 * Express middleware: generates or propagates X-Correlation-ID.
 * Attaches correlation_id to req for use in controllers and logs.
 */
function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

module.exports = { correlationMiddleware };
