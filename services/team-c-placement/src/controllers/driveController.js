const { v4: uuidv4 } = require('uuid');
const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError } = require('../../../../shared/errors');

class DriveController {
  constructor(db) {
    this.db = db;
  }

  // POST /api/v1/drives
  create = async (req, res, next) => {
    try {
      const driveId = uuidv4();
      const now = new Date().toISOString();
      const drive = {
        drive_id:   driveId,
        ...req.body,
        state:      req.body.state || 'DRAFT',
        version:    1,
        created_at: now,
        updated_at: now,
        // Serialize criteria object to JSON string if provided as object
        criteria_json: req.body.criteria_json
          ? (typeof req.body.criteria_json === 'object'
              ? JSON.stringify(req.body.criteria_json)
              : req.body.criteria_json)
          : null,
      };
      const created = await this.db.table('drives').insert(drive);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives
  list = (req, res, next) => {
    try {
      let drives = this.db.table('drives').all();
      // Optional filter by state
      if (req.query.state) {
        drives = drives.filter(d => d.state === req.query.state);
      }
      sendSuccess(res, drives, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives/:driveId
  get = (req, res, next) => {
    try {
      const { driveId } = req.params;
      const drive = this.db.table('drives').findById(driveId);
      if (!drive) throw new NotFoundError('Drive', driveId);
      sendSuccess(res, drive, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives/:driveId/criteria
  getCriteria = (req, res, next) => {
    try {
      const { driveId } = req.params;
      const drive = this.db.table('drives').findById(driveId);
      if (!drive) throw new NotFoundError('Drive', driveId);
      
      const criteria = drive.criteria_json ? JSON.parse(drive.criteria_json) : {};
      sendSuccess(res, {
        drive_id: drive.drive_id,
        seats: drive.seats,
        criteria
      }, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /internal/v1/drives/:driveId
  update = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const updates = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };
      const drive = await this.db.table('drives').update(driveId, updates);
      sendSuccess(res, drive, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DriveController;
