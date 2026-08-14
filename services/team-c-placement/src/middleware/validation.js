const { ValidationError } = require('../../../../shared/errors');

/**
 * Basic JSON body schema validation middleware.
 * @param {object} requiredFields - Map of field names to their expected types.
 */
function validateBody(requiredFields) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, type] of Object.entries(requiredFields)) {
      if (req.body[field] === undefined) {
        errors.push({ field, message: `Missing required field: ${field}` });
      } else if (typeof req.body[field] !== type) {
        // Special handling for array
        if (type === 'array' && !Array.isArray(req.body[field])) {
           errors.push({ field, message: `Field ${field} must be of type array` });
        } else if (type !== 'array' && typeof req.body[field] !== type) {
           errors.push({ field, message: `Field ${field} must be of type ${type}` });
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Invalid request body', errors));
    }
    next();
  };
}

module.exports = { validateBody };
