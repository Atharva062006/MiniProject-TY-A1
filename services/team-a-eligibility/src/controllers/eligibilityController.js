// Team A — Eligibility Request Controller
// POST /api/v1/eligibility/requests
// GET  /api/v1/eligibility/requests/:requestId
// POST /internal/v1/rules/evaluate
// GET  /api/v1/eligibility/decisions/:decisionId

const { sendSuccess } = require('../../../../shared/response');
const { ValidationError, NotFoundError } = require('../../../../shared/errors');
const requestService = require('../services/requestService');
const { evaluateRules } = require('../rules/ruleEngine');
const { getStudent, getDrive } = require('../services/teamCClient');

/**
 * Creates and enqueues an eligibility evaluation request.
 */
exports.createRequest = async (req, res, next) => {
  try {
    const { request_id, student_id, drive_id, rule_set_version, priority, strategy, student, drive } = req.body || {};

    if (!student_id) {
      throw new ValidationError('student_id is required');
    }
    if (!drive_id) {
      throw new ValidationError('drive_id is required');
    }

    const result = requestService.createRequest({
      request_id,
      student_id,
      drive_id,
      rule_set_version,
      priority,
      strategy,
      student,
      drive,
      correlation_id: req.correlationId,
    });

    sendSuccess(res, result, req.correlationId, 202);
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves request lifecycle state, queue position, and evaluation decision.
 */
exports.getRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = requestService.getRequest(requestId);

    if (!request) {
      throw new NotFoundError('EligibilityRequest', requestId);
    }

    sendSuccess(res, request, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Evaluates rules synchronously using the requested strategy.
 * POST /internal/v1/rules/evaluate
 */
exports.evaluateDirect = async (req, res, next) => {
  try {
    const {
      student_id,
      drive_id,
      strategy = 'SEQUENTIAL_AND',
      rule_set,
      rule_set_version = 'v1.0',
    } = req.body || {};

    let student = req.body?.student;
    let drive = req.body?.drive;

    // Fetch from Team C if not directly provided
    if (!student && student_id) {
      student = await getStudent(student_id, req.correlationId);
    }
    if (!drive && drive_id) {
      drive = await getDrive(drive_id, req.correlationId);
    }

    // Default mock snapshots if not found/offline
    if (!student) {
      student = {
        student_id: student_id || 'STU_ANON',
        cgpa: 7.5,
        backlogs: 0,
        branch: 'CSE',
        attendance: 80,
        skills: [],
      };
    }
    if (!drive) {
      drive = {
        drive_id: drive_id || 'DRV_ANON',
        criteria: { min_cgpa: 7.0, max_backlogs: 1, min_attendance: 75 },
      };
    }

    const decision = evaluateRules({
      student,
      drive,
      strategy,
      rule_set,
      rule_set_version,
    });

    // Store in decision registry for lookup
    requestService.storeDecision(decision);

    sendSuccess(res, decision, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves an evaluated decision by decisionId.
 * GET /api/v1/eligibility/decisions/:decisionId
 */
exports.getDecision = async (req, res, next) => {
  try {
    const { decisionId } = req.params;
    const decision = requestService.getDecision(decisionId);

    if (!decision) {
      throw new NotFoundError('EligibilityDecision', decisionId);
    }

    sendSuccess(res, decision, req.correlationId, 200);
  } catch (err) {
    next(err);
  }
};
