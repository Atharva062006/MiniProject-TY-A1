const { sendError } = require('../../../../shared/response');
const { ERROR_CODES, UnauthorizedError, ForbiddenError } = require('../../../../shared/errors');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'apnileap-jwt-secret-key-academic-2026';

/**
 * Auth Middleware supporting signed JWTs and legacy mock tokens.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new UnauthorizedError('Missing Authorization header'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new UnauthorizedError('Invalid Authorization header format. Expected Bearer <token>'));
  }

  const rawToken = parts[1];

  // 1. Try decoding as real signed JWT
  try {
    const payload = jwt.verify(rawToken, JWT_SECRET);
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      student_id: payload.student_id || null,
      name: payload.name,
    };
    return next();
  } catch (err) {
    // 2. Fallback to legacy mock parsing: "Bearer <role>_<userId>"
    if (rawToken.includes('_')) {
      const tokenParts = rawToken.split('_');
      req.user = {
        role: tokenParts[0],
        id: tokenParts[1] || 'unknown_user',
        username: tokenParts[1] || 'unknown_user',
        student_id: tokenParts[0] === 'student' ? (tokenParts[1] || null) : null,
      };
      return next();
    }
    return next(new UnauthorizedError(`Authentication failed: ${err.message}`));
  }
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
