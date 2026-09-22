/**
 * Team D — UI / BFF API Routes
 *
 * Exposes tailored REST and SSE endpoints for the frontend single-page application.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const orchestrator = require('../services/portalOrchestrator');
const { sendSuccess, sendError } = require(path.resolve(__dirname, '../../../../../shared/response'));
const { ERROR_CODES } = require(path.resolve(__dirname, '../../../../../shared/constants'));

// In-memory active session state (fallback for unauthenticated dev mode)
let activeSession = {
  role: 'student',
  student_id: 'STU001',
  name: 'Alice Sharma',
  branch: 'CSE',
  email: 'alice@rit.edu',
};

/**
 * Authentication extraction middleware.
 * Inspects Authorization header for a Bearer JWT.
 */
async function extractUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const verified = await orchestrator.verifyToken(token, req.correlationId);
      req.user = verified?.user || null;
      req.student = verified?.student || null;
      return next();
    } catch (err) {
      // Invalid or expired token - proceed unauthenticated
    }
  }
  req.user = null;
  req.student = null;
  next();
}

router.use(extractUser);

// ── Auth Endpoints ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/ui/auth/register
 * Register new student or faculty account.
 */
router.post('/auth/register', async (req, res, next) => {
  try {
    const result = await orchestrator.registerUser(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ui/auth/login
 * Authenticate with credentials and receive JWT.
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const result = await orchestrator.loginUser(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/ui/auth/me
 * Validate current JWT session and return profile.
 */
router.get('/auth/me', async (req, res, next) => {
  try {
    if (req.user) {
      return sendSuccess(res, { user: req.user, student: req.student }, req.correlationId);
    }
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Not authenticated', req.correlationId, 401);
    }
    const token = authHeader.substring(7);
    const result = await orchestrator.verifyToken(token, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Session & Backwards Compatibility ──────────────────────────────────────────

/**
 * POST /api/v1/ui/session
 * Set role ('student' | 'faculty' | 'admin') and optional active student ID.
 */
router.post('/session', (req, res) => {
  const { role, student_id, name, branch, email } = req.body;
  if (!role || !['student', 'faculty', 'admin'].includes(role)) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Invalid role. Must be student, faculty, or admin', req.correlationId, 400);
  }

  activeSession.role = role;
  if (role === 'student' && student_id) {
    activeSession.student_id = student_id;
    if (name) activeSession.name = name;
    if (branch) activeSession.branch = branch;
    if (email) activeSession.email = email;
  }

  sendSuccess(res, activeSession, req.correlationId);
});

/**
 * GET /api/v1/ui/me
 * Get current session details.
 */
router.get('/me', (req, res) => {
  if (req.user) {
    return sendSuccess(res, {
      role: req.user.role,
      student_id: req.user.student_id,
      name: req.user.name,
      email: req.user.email,
      username: req.user.username,
      user_id: req.user.user_id,
      student: req.student,
    }, req.correlationId);
  }
  sendSuccess(res, activeSession, req.correlationId);
});

/**
 * GET /api/v1/ui/students
 * List students for role switching.
 */
router.get('/students', async (req, res, next) => {
  try {
    const students = await orchestrator._request(`${orchestrator.teamCUrl}/api/v1/students`, {}, req.correlationId);
    sendSuccess(res, students || [], req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Drives ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ui/drives
 * Fetch drives enriched with criteria and queue lengths.
 */
router.get('/drives', async (req, res, next) => {
  try {
    const drives = await orchestrator.getDrives(req.correlationId);
    sendSuccess(res, drives, req.correlationId);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/ui/drives/:driveId
 * Update drive fields/criteria (Admin action).
 */
router.patch('/drives/:driveId', async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const updated = await orchestrator.updateDrive(driveId, req.body, req.correlationId);
    sendSuccess(res, updated, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Applications ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/ui/applications
 * Apply to drive with full orchestration (Team C -> Team A -> Team B).
 */
router.post('/applications', async (req, res, next) => {
  try {
    const { student_id, drive_id, consent, resume_version, idempotency_key } = req.body;
    
    // Strict scoping: if authenticated as student, cannot apply as another student
    let effectiveStudentId = student_id;
    if (req.user && req.user.role === 'student') {
      effectiveStudentId = req.user.student_id;
    } else if (!effectiveStudentId) {
      effectiveStudentId = activeSession.student_id;
    }

    if (!effectiveStudentId) {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'student_id is required', req.correlationId, 400);
    }
    if (!drive_id) {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'drive_id is required', req.correlationId, 400);
    }

    const idempotencyKey = req.headers['idempotency-key'] || idempotency_key;

    const result = await orchestrator.applyToDrive({
      student_id: effectiveStudentId,
      drive_id,
      consent: consent === true || consent === 'true',
      resume_version: resume_version || 'v1.0',
      idempotency_key: idempotencyKey,
    }, req.correlationId);

    sendSuccess(res, result, req.correlationId, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/ui/applications
 * List applications (strictly filtered by student if logged in as student).
 */
router.get('/applications', async (req, res, next) => {
  try {
    let studentIdFilter = req.query.student_id;
    if (req.user && req.user.role === 'student') {
      studentIdFilter = req.user.student_id;
    } else if (!studentIdFilter && activeSession.role === 'student') {
      studentIdFilter = activeSession.student_id;
    }
    const driveIdFilter = req.query.drive_id;
    const stateFilter = req.query.state;

    const queryParams = new URLSearchParams();
    if (studentIdFilter) queryParams.append('student_id', studentIdFilter);
    if (driveIdFilter) queryParams.append('drive_id', driveIdFilter);
    if (stateFilter) queryParams.append('state', stateFilter);

    const qs = queryParams.toString();
    const url = `${orchestrator.teamCUrl}/api/v1/applications${qs ? '?' + qs : ''}`;
    const apps = await orchestrator._request(url, {}, req.correlationId);

    // Enrich with drive title & student name
    const [drives, students] = await Promise.all([
      orchestrator._request(`${orchestrator.teamCUrl}/api/v1/drives`, {}, req.correlationId).catch(() => []),
      orchestrator._request(`${orchestrator.teamCUrl}/api/v1/students`, {}, req.correlationId).catch(() => []),
    ]);

    const driveMap = new Map((drives || []).map(d => [d.drive_id, d]));
    const studentMap = new Map((students || []).map(s => [s.student_id, s]));

    const enriched = (apps || []).map(app => ({
      ...app,
      drive_title: driveMap.get(app.drive_id)?.title || app.drive_id,
      student_name: studentMap.get(app.student_id)?.name || app.student_id,
      branch: studentMap.get(app.student_id)?.branch || '-',
    }));

    sendSuccess(res, enriched, req.correlationId);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/ui/applications/:applicationId
 * Detailed application view.
 */
router.get('/applications/:applicationId', async (req, res, next) => {
  try {
    const detail = await orchestrator.getApplication(req.params.applicationId, req.correlationId);
    sendSuccess(res, detail, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Dashboard & Live Stream ────────────────────────────────────────────────────

/**
 * GET /api/v1/ui/dashboard
 * Aggregated dashboard metrics across Team A, B, and C.
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboardData = await orchestrator.getDashboard(req.correlationId);
    sendSuccess(res, dashboardData, req.correlationId);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/ui/stream
 * SSE proxy stream relaying live mutations from Team C.
 */
router.get('/stream', (req, res) => {
  orchestrator.subscribeStream(req, res);
});

// ── Rankings ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ui/rankings
 * Fetch rankings for a drive.
 */
router.get('/rankings', async (req, res, next) => {
  try {
    const driveId = req.query.drive_id || 'DRV001';
    const algorithm = req.query.algorithm || 'WEIGHTED_SCORE';
    const preview = await orchestrator.previewRankings({ drive_id: driveId, algorithm }, req.correlationId);
    sendSuccess(res, preview, req.correlationId);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ui/rankings/preview
 * Interactive algorithm comparator (Weighted Score vs Heap Top-K vs Merge Sort).
 */
router.post('/rankings/preview', async (req, res, next) => {
  try {
    const { drive_id, algorithm, candidates } = req.body;
    const result = await orchestrator.previewRankings({
      drive_id: drive_id || 'DRV001',
      algorithm: algorithm || 'WEIGHTED_SCORE',
      candidates,
    }, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ui/reports/placement-performance
 * Aggregated placement report and cohort analytics.
 */
router.get('/reports/placement-performance', async (req, res, next) => {
  try {
    const reports = await orchestrator.getReports(req.correlationId);
    sendSuccess(res, reports, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Candidate Selection & Offer Lifecycle ──────────────────────────────────────

router.post('/candidates/select', async (req, res, next) => {
  try {
    const result = await orchestrator.selectCandidate(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/candidates/issue-offer', async (req, res, next) => {
  try {
    const result = await orchestrator.issueOffer(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/candidates/compensate', async (req, res, next) => {
  try {
    const result = await orchestrator.compensateCandidate(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/offers/accept', async (req, res, next) => {
  try {
    const result = await orchestrator.acceptOffer(req.body.application_id, req.user, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/offers/decline', async (req, res, next) => {
  try {
    const result = await orchestrator.declineOffer(req.body.application_id, req.user, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Companies & Drives Management ─────────────────────────────────────────────

router.get('/companies', async (req, res, next) => {
  try {
    const result = await orchestrator.getCompanies(req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/companies', async (req, res, next) => {
  try {
    const result = await orchestrator.createCompany(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/drives', async (req, res, next) => {
  try {
    const result = await orchestrator.createDrive(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId, 201);
  } catch (err) {
    next(err);
  }
});

// ── Student Self-Service & Profile ────────────────────────────────────────────

router.put('/students/:studentId', async (req, res, next) => {
  try {
    const result = await orchestrator.updateStudent(req.params.studentId, req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/applications/:applicationId/withdraw', async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.replace(/^Bearer\s+/, '') || req.user?.student_id;
    const result = await orchestrator.withdrawApplication(req.params.applicationId, token, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Interview Scheduling & Mutex Locks (Team A) ────────────────────────────────

router.post('/interviews/schedule', async (req, res, next) => {
  try {
    const result = await orchestrator.scheduleInterview(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.get('/locks', async (req, res, next) => {
  try {
    const result = await orchestrator.getLocks(req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.post('/deadlocks/analyse', async (req, res, next) => {
  try {
    const result = await orchestrator.runDeadlockAnalysis(req.body?.edges, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Ranking Leaderboard Batch & AVL Index (Team B) ────────────────────────────

router.post('/rankings/batch-shortlist', async (req, res, next) => {
  try {
    const result = await orchestrator.batchCommitShortlist(req.body, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.get('/rankings/search-index', async (req, res, next) => {
  try {
    const key = req.query.key || '';
    const result = await orchestrator.searchShortlistIndex(key, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

// ── Recovery & Audit (Team C) ──────────────────────────────────────────────────

router.post('/recovery/verify', async (req, res, next) => {
  try {
    const result = await orchestrator.verifyRecovery(req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const result = await orchestrator.getFilteredAudit(req.query, req.correlationId);
    sendSuccess(res, result, req.correlationId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
