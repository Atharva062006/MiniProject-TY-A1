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
}

module.exports = StudentController;
