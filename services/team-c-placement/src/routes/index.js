const express = require('express');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const idempotencyMiddleware = require('../middleware/idempotency');

module.exports = (controllers, idempotencyService) => {
  const router = express.Router();

  // Middleware setups
  const checkIdempotency = idempotencyMiddleware(idempotencyService);

  // POST /api/v1/students
  router.post('/students', validateBody({ name: 'string', email: 'string', branch: 'string', cgpa: 'number', backlogs: 'number' }), controllers.studentController.create);

  // GET /api/v1/drives
  router.get('/drives', controllers.driveController.list);

  // GET /api/v1/drives/:driveId/criteria
  router.get('/drives/:driveId/criteria', controllers.driveController.getCriteria);

  // PATCH /internal/v1/drives/:driveId
  // In reality, protect this via internal network rules or specialized role
  router.patch('/internal/drives/:driveId', controllers.driveController.update);

  // POST /api/v1/applications
  router.post(
    '/applications',
    validateBody({ student_id: 'string', drive_id: 'string', consent: 'boolean', idempotency_key: 'string' }),
    checkIdempotency,
    controllers.applicationController.create
  );

  // GET /api/v1/applications/:applicationId
  router.get('/applications/:applicationId', controllers.applicationController.get);

  // POST /api/v1/applications/:applicationId/withdraw
  router.post('/applications/:applicationId/withdraw', authMiddleware, controllers.applicationController.withdraw);

  // POST /internal/v1/offers/commit
  router.post('/internal/offers/commit', validateBody({ application_id: 'string', decision_result: 'string', target_state: 'string', expected_version: 'number' }), controllers.offerController.commit);

  // POST /internal/v1/offers/compensate
  router.post('/internal/offers/compensate', validateBody({ application_id: 'string', reason: 'string' }), controllers.offerController.compensate);

  // GET /api/v1/audit
  router.get('/audit', authMiddleware, requireRoles(['admin', 'auditor']), controllers.auditController.query);

  // GET /api/v1/reports/placement-performance
  router.get('/reports/placement-performance', authMiddleware, requireRoles(['admin', 'faculty']), controllers.reportController.getPlacementPerformance);

  // POST /internal/v1/recovery/verify
  router.post('/internal/recovery/verify', controllers.reportController.verifyRecovery);

  return router;
};
