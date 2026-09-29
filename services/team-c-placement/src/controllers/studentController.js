const { sendSuccess } = require('../../../../shared/response');
const { v4: uuidv4 } = require('uuid');

class StudentController {
  constructor(db) {
    this.db = db;
  }

  // POST /api/v1/students
  create = async (req, res, next) => {
    try {
      const studentId = uuidv4();
      const student = { student_id: studentId, ...req.body, created_at: new Date().toISOString() };
      const created = await this.db.table('students').insert(student);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/students
  list = (req, res, next) => {
    try {
      let students = this.db.table('students').all();
      if (req.query.branch) {
        students = students.filter(s => s.branch === req.query.branch);
      }
      sendSuccess(res, students, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/students/:studentId
  get = (req, res, next) => {
    try {
      const { studentId } = req.params;
      const student = this.db.table('students').findById(studentId);
      if (!student) {
        const { NotFoundError } = require('../../../../shared/errors');
        throw new NotFoundError('Student', studentId);
      }
      sendSuccess(res, student, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // PUT /api/v1/students/:studentId
  update = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const existing = this.db.table('students').findById(studentId);
      if (!existing) {
        const { NotFoundError } = require('../../../../shared/errors');
        throw new NotFoundError('Student', studentId);
      }

      const allowed = ['name', 'email', 'branch', 'cgpa', 'backlogs', 'skills', 'attendance'];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }
      updates.updated_at = new Date().toISOString();

      const updated = await this.db.table('students').update(studentId, updates);
      sendSuccess(res, updated, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = StudentController;
