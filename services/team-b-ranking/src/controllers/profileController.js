const { sendSuccess } = require('../../../../shared/response');
const { ValidationError } = require('../../../../shared/errors');

class ProfileController {
  /**
   * @param {import('../profiles/ProfileRegistry')} profileRegistry
   */
  constructor(profileRegistry) {
    this.profileRegistry = profileRegistry;
  }

  // PUT /internal/v1/profiles/students/:studentId
  updateStudentProfile = (req, res, next) => {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        throw new ValidationError('studentId path parameter is required');
      }
      const updated = this.profileRegistry.registerStudent(studentId, req.body || {});
      sendSuccess(res, updated, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // PUT /internal/v1/profiles/drives/:driveId
  updateDriveProfile = (req, res, next) => {
    try {
      const { driveId } = req.params;
      if (!driveId) {
        throw new ValidationError('driveId path parameter is required');
      }
      const updated = this.profileRegistry.registerDrive(driveId, req.body || {});
      sendSuccess(res, updated, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/profiles
  getProfiles = (req, res, next) => {
    try {
      const profiles = this.profileRegistry.getAllProfiles();
      sendSuccess(res, profiles, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProfileController;
