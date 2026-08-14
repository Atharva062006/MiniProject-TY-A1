const { sendSuccess } = require('../../../../shared/response');

/**
 * Middleware to check idempotency key before passing to controller.
 * @param {IdempotencyService} idempotencyService
 */
function idempotencyMiddleware(idempotencyService) {
  return async (req, res, next) => {
    // Only apply to POST/PUT/PATCH
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

    const key = req.headers['idempotency-key'] || req.body.idempotency_key;
    if (!key) {
      // For strict compliance, we might reject requests without a key.
      // We'll let the schema validation catch it if it's required in the body,
      // or we can enforce it here.
      return next();
    }

    try {
      const cachedResponse = await idempotencyService.getStoredResponse(key);
      if (cachedResponse) {
        // Return cached response immediately
        return sendSuccess(res, cachedResponse, req.correlationId, 200);
      }
      // Attach key to request for controller to use
      req.idempotencyKey = key;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = idempotencyMiddleware;
