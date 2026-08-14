const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError } = require('../../../../shared/errors');

class DriveController {
  constructor(db) {
    this.db = db;
  }

  // GET /api/v1/drives
  list = (req, res, next) => {
    try {
      const drives = this.db.table('drives').all();
      sendSuccess(res, drives, req.correlationId);
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
      const updates = req.body;
      const drive = await this.db.table('drives').update(driveId, updates);
      sendSuccess(res, drive, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DriveController;
