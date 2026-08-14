/**
 * Standard response envelopes for all APNILEAP services.
 * Format:
 *   Success: { data: {...}, meta: { correlation_id, api_version, timestamp } }
 *   Error:   { error: { code, message, details }, meta: { correlation_id } }
 */

const API_VERSION = 'v1';

/**
 * Send a successful JSON response.
 * @param {object} res - Express response object
 * @param {object} data - Payload to include in data field
 * @param {string} correlationId - X-Correlation-ID
 * @param {number} [statusCode=200] - HTTP status code
 */
function sendSuccess(res, data, correlationId, statusCode = 200) {
  return res.status(statusCode).json({
    data,
    meta: {
      correlation_id: correlationId,
      api_version: API_VERSION,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send an error JSON response.
 * @param {object} res - Express response object
 * @param {string} code - Machine-readable error code (from ERROR_CODES)
 * @param {string} message - Human-readable error message
 * @param {string} correlationId - X-Correlation-ID
 * @param {number} [statusCode=500] - HTTP status code
 * @param {Array}  [details=[]] - Optional list of field-level errors
 */
function sendError(res, code, message, correlationId, statusCode = 500, details = []) {
  return res.status(statusCode).json({
    error: { code, message, details },
    meta: {
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { sendSuccess, sendError };
