const { sendSuccess } = require('../../../../shared/response');
const { UnauthorizedError } = require('../../../../shared/errors');

class AuthController {
  /**
   * @param {AuthService} authService
   * @param {Database}    db
   */
  constructor(authService, db) {
    this.authService = authService;
    this.db = db;
  }

  // POST /api/v1/auth/register
  register = async (req, res, next) => {
    try {
      const result = await this.authService.register({
        ...req.body,
        correlationId: req.correlationId,
      });
      sendSuccess(res, result, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/auth/login
  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const result = await this.authService.login({
        username,
        password,
        correlationId: req.correlationId,
      });
      sendSuccess(res, result, req.correlationId, 200);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/auth/me
  me = async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.query.token) {
        token = req.query.token;
      }

      if (!token) {
        throw new UnauthorizedError('Missing authentication token');
      }

      const result = await this.authService.verifyToken(token);
      sendSuccess(res, result, req.correlationId, 200);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/auth/users (Admin / audit inspect)
  listUsers = (req, res, next) => {
    try {
      const users = this.db.table('users').all().map(u => {
        const { password_hash, ...safe } = u;
        return safe;
      });
      sendSuccess(res, users, req.correlationId, 200);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuthController;

