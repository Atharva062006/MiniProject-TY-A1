const { sendError } = require('../../../../shared/response');
const { ERROR_CODES, UnauthorizedError, ForbiddenError } = require('../../../../shared/errors');

/**
 * Very simple mock Auth Middleware.
 * In a real scenario, this would verify a JWT.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new UnauthorizedError('Missing Authorization header'));
  }

  // Very naive parsing for demonstration: "Bearer <role>_<userId>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
     return next(new UnauthorizedError('Invalid Authorization header format'));
  }

  const tokenParts = parts[1].split('_');
  if (tokenParts.length < 1) {
      return next(new UnauthorizedError('Invalid token content'));
  }

  req.user = {
      role: tokenParts[0],
      id: tokenParts[1] || 'unknown_user'
  };

  next();
}

/**
 * Role-based authorization guard.
 * @param {string[]} allowedRoles
 */
function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
       return next(new ForbiddenError(`Requires one of roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
}

module.exports = { authMiddleware, requireRoles };
