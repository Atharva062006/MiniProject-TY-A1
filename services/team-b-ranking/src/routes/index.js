// Team B — Routes
const express = require('express');

function buildRoutes({ profileController, rankingController, analyticsController }) {
  const router = express.Router();
  const internalRouter = express.Router();

  // Profiles (Public & Internal)
  router.get('/profiles', profileController.getProfiles);
  internalRouter.put('/profiles/students/:studentId', profileController.updateStudentProfile);
  internalRouter.put('/profiles/drives/:driveId', profileController.updateDriveProfile);

  // Rankings
  router.post('/rankings/compute', rankingController.computeRanking);
  router.get('/rankings/:rankingId', rankingController.getRanking);

  // Shortlist Index & Cache Management (Internal)
  internalRouter.get('/shortlist-index/:key', rankingController.getShortlistIndex);
  internalRouter.post('/shortlist-cache/invalidate', rankingController.invalidateCache);

  // Analytics & Metrics
  router.post('/analytics/analyse', analyticsController.analyseCohort);
  router.get('/metrics/ranking', analyticsController.getMetrics);

  // Mount internalRouter under /internal on the main /api/v1 router
  // This allows /api/v1/internal/* to work seamlessly as an alias for /internal/v1/*
  router.use('/internal', internalRouter);

  return { router, internalRouter };
}

function setupRoutes(app, controllers) {
  const { router, internalRouter } = buildRoutes(controllers);
  app.use('/api/v1', router);
  app.use('/internal/v1', internalRouter);
  return { router, internalRouter };
}

module.exports = { buildRoutes, setupRoutes };
