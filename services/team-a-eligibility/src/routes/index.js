// Team A — Routing Index
// Mounts public API v1 endpoints and internal v1 endpoints (with /api/v1/internal alias)

const express = require('express');
const eligibilityController = require('../controllers/eligibilityController');
const lockController        = require('../controllers/lockController');
const queueController       = require('../controllers/queueController');
const metricsController     = require('../controllers/metricsController');

const router = express.Router();

// ── Public API v1 Router ───────────────────────────────────────────────────────
const apiRouter = express.Router();

// A1: Request intake & lifecycle
apiRouter.post('/eligibility/requests', eligibilityController.createRequest);
apiRouter.get('/eligibility/requests/:requestId', eligibilityController.getRequest);

// A1: Drive queue inspection
apiRouter.get('/drives/:driveId/queue', queueController.getDriveQueue);

// A2: Decision retrieval
apiRouter.get('/eligibility/decisions/:decisionId', eligibilityController.getDecision);

// A4: Telemetry metrics & live SSE stream
apiRouter.get('/metrics/eligibility', metricsController.getMetrics);
apiRouter.get('/stream/eligibility', metricsController.streamEligibility);

// ── Internal v1 Router ────────────────────────────────────────────────────────
const internalRouter = express.Router();

// A2: Direct rule evaluation
internalRouter.post('/rules/evaluate', eligibilityController.evaluateDirect);

// A3: Mutex slot lock management
internalRouter.post('/locks/acquire', lockController.acquireLock);
internalRouter.get('/locks', lockController.listLocks);
internalRouter.delete('/locks/:leaseId', lockController.releaseLock);

// A3: Wait-For Graph deadlock analysis & resolution
internalRouter.post('/deadlocks/analyse', lockController.analyseDeadlocks);

// ── Mount on Main Router ───────────────────────────────────────────────────────
router.use('/api/v1', apiRouter);
router.use('/internal/v1', internalRouter);
router.use('/api/v1/internal', internalRouter); // Alias for consistency across services

module.exports = router;

