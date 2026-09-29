/**
 * AuthService — Authentication and User Management for APNILEAP (Team C).
 *
 * Uses:
 *   - bcryptjs for salted, adaptive password hashing
 *   - jsonwebtoken for signed, stateless bearer session tokens
 *   - Team C's Database engine for persistent storage in users.json and students.json
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} = require('../../../../shared/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'apnileap-jwt-secret-key-academic-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  /**
   * @param {Database}     db
   * @param {AuditService} auditService
   */
  constructor(db, auditService) {
    this.db = db;
    this.auditService = auditService;
    this.jwtSecret = JWT_SECRET;
  }

  /**
   * Register a new user (student, faculty, or admin).
   *
   * @param {object} params
   * @param {string} params.username
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.role - 'student' | 'faculty' | 'admin'
   * @param {string} params.name
   * @param {object} [params.studentData] - { branch, cgpa, backlogs, attendance, skills }
   * @param {string} [params.correlationId]
   * @returns {Promise<{ user: object, token: string, student: object|null }>}
   */
  async register({ username, email, password, role = 'student', name, studentData = {}, correlationId }) {
    if (!username || !email || !password || !name) {
      throw new ValidationError('Registration requires username, email, password, and name');
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail    = String(email).trim().toLowerCase();

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    const validRoles = ['student', 'faculty', 'admin'];
    if (!validRoles.includes(role)) {
      throw new ValidationError(`Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check uniqueness against users table
    const existingUser = this.db.table('users').find(
      u => u.username === normalizedUsername || u.email === normalizedEmail
    );
    if (existingUser.length > 0) {
      const match = existingUser[0];
      if (match.username === normalizedUsername) {
        throw new ConflictError(`Username '${normalizedUsername}' is already taken`);
      }
      throw new ConflictError(`Email '${normalizedEmail}' is already registered`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let assignedStudentId = null;
    let createdStudent = null;

    // If role is student, create or link student record
    if (role === 'student') {
      assignedStudentId = studentData.student_id || `STU-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Check if student record already exists (e.g. pre-seeded student linking)
      const existingStudent = this.db.table('students').findById(assignedStudentId);
      if (!existingStudent) {
        createdStudent = {
          student_id: assignedStudentId,
          name: name,
          email: normalizedEmail,
          branch: studentData.branch || 'CSE',
          cgpa: Number(studentData.cgpa != null ? studentData.cgpa : 8.0),
          backlogs: Number(studentData.backlogs != null ? studentData.backlogs : 0),
          attendance: Number(studentData.attendance != null ? studentData.attendance : 85),
          skills: Array.isArray(studentData.skills)
            ? studentData.skills
            : (studentData.skills ? String(studentData.skills).split(',').map(s => s.trim()).filter(Boolean) : ['JavaScript', 'DSA']),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        this.db.table('students').insert(createdStudent);

        if (this.auditService) {
          await this.auditService.log({
            actor: normalizedUsername,
            action: 'STUDENT_REGISTERED',
            tableName: 'students',
            recordId: assignedStudentId,
            afterValue: createdStudent,
            correlationId,
          });
        }
      } else {
        createdStudent = existingStudent;
      }
    }

    // Create user record
    const userId = uuidv4();
    const newUser = {
      user_id: userId,
      username: normalizedUsername,
      email: normalizedEmail,
      password_hash: passwordHash,
      role,
      student_id: assignedStudentId,
      name,
      created_at: new Date().toISOString(),
    };

    this.db.table('users').insert(newUser);

    if (this.auditService) {
      await this.auditService.log({
        actor: normalizedUsername,
        action: 'USER_REGISTERED',
        tableName: 'users',
        recordId: userId,
        afterValue: { user_id: userId, username: normalizedUsername, email: normalizedEmail, role, student_id: assignedStudentId },
        correlationId,
      });
    }

    const sanitizedUser = this._sanitizeUser(newUser);
    const token = this.generateToken(sanitizedUser);

    return { user: sanitizedUser, token, student: createdStudent };
  }

  /**
   * Authenticate user with username/email and password.
   *
   * @param {object} params
   * @param {string} params.username - username or email
   * @param {string} params.password
   * @param {string} [params.correlationId]
   * @returns {Promise<{ user: object, token: string, student: object|null }>}
   */
  async login({ username, password, correlationId }) {
    if (!username || !password) {
      throw new ValidationError('Username/email and password are required');
    }

    const query = String(username).trim().toLowerCase();
    const matches = this.db.table('users').find(
      u => u.username === query || u.email === query
    );

    if (matches.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = matches[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    let student = null;
    if (user.student_id) {
      student = this.db.table('students').findById(user.student_id) || null;
    }

    const sanitizedUser = this._sanitizeUser(user);
    const token = this.generateToken(sanitizedUser);

    if (this.auditService) {
      await this.auditService.log({
        actor: user.username,
        action: 'USER_LOGIN',
        tableName: 'users',
        recordId: user.user_id,
        afterValue: { role: user.role },
        correlationId,
      });
    }

    return { user: sanitizedUser, token, student };
  }

  /**
   * Verify a JWT token and return associated user and student profiles.
   *
   * @param {string} token
   * @returns {Promise<{ user: object, student: object|null }>}
   */
  async verifyToken(token) {
    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    let payload;
    try {
      payload = jwt.verify(token, this.jwtSecret);
    } catch (err) {
      throw new UnauthorizedError(`Invalid token: ${err.message}`);
    }

    const user = this.db.table('users').findById(payload.id);
    if (!user) {
      throw new UnauthorizedError('User referenced in token no longer exists');
    }

    let student = null;
    if (user.student_id) {
      student = this.db.table('students').findById(user.student_id) || null;
    }

    return { user: this._sanitizeUser(user), student };
  }

  /**
   * Generate a JWT token.
   *
   * @param {object} user - Sanitized user object
   * @returns {string} JWT Bearer token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.user_id,
        username: user.username,
        role: user.role,
        student_id: user.student_id,
        name: user.name,
      },
      this.jwtSecret,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Remove sensitive fields (password_hash) from user object before returning.
   *
   * @private
   */
  _sanitizeUser(user) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = AuthService;

