// Team A — Rule Engine
// Evaluates candidate academic profiles against drive criteria using pluggable strategies:
// 1. SEQUENTIAL_AND
// 2. WEIGHTED_PRIORITY
// 3. DECISION_TREE

const { v4: uuidv4 } = require('uuid');
const SequentialANDChain = require('./SequentialANDChain');
const WeightedPriority   = require('./WeightedPriority');
const DecisionTree       = require('./DecisionTree');

/**
 * Extracts and normalizes eligibility criteria from drive or explicit rule_set.
 */
function extractCriteria(drive, rule_set) {
  if (rule_set && typeof rule_set === 'object') {
    return rule_set;
  }
  if (drive) {
    if (drive.criteria && typeof drive.criteria === 'object') {
      return drive.criteria;
    }
    if (drive.criteria_json) {
      if (typeof drive.criteria_json === 'string') {
        try {
          return JSON.parse(drive.criteria_json);
        } catch (e) {
          // fallback
        }
      } else if (typeof drive.criteria_json === 'object') {
        return drive.criteria_json;
      }
    }
  }
  return {};
}

/**
 * Builds standard rule predicates based on normalized criteria.
 */
function buildRules(criteria) {
  const minCgpa = criteria.min_cgpa !== undefined ? Number(criteria.min_cgpa) : 0;
  const maxBacklogs = criteria.max_backlogs !== undefined ? Number(criteria.max_backlogs) : Infinity;
  const branches = criteria.branches || criteria.allowed_branches || [];
  const minAttendance = criteria.min_attendance !== undefined ? Number(criteria.min_attendance) : 0;
  const requiredSkills = criteria.required_skills || [];

  return {
    cgpaRule: {
      name: 'CGPA_CUTOFF',
      weight: 40,
      evaluate: (student) => Number(student.cgpa || 0) >= minCgpa,
    },
    backlogRule: {
      name: 'BACKLOG_LIMIT',
      weight: 30,
      evaluate: (student) => Number(student.backlogs || 0) <= maxBacklogs,
    },
    branchRule: {
      name: 'BRANCH_ALLOWLIST',
      weight: 10,
      evaluate: (student) => {
        if (!Array.isArray(branches) || branches.length === 0) return true;
        return branches.includes(student.branch);
      },
    },
    attendanceRule: {
      name: 'ATTENDANCE_REQUIREMENT',
      weight: 10,
      evaluate: (student) => Number(student.attendance || 0) >= minAttendance,
    },
    skillsRule: {
      name: 'REQUIRED_SKILLS',
      weight: 20,
      evaluate: (student) => {
        if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) return true;
        const studentSkills = Array.isArray(student.skills) ? student.skills : [];
        return requiredSkills.every((req) =>
          studentSkills.some((s) => s.toLowerCase() === req.toLowerCase())
        );
      },
    },
  };
}

/**
 * Executes rule evaluation with telemetry and metrics.
 * @param {Object} params
 * @param {Object} params.student - Student academic snapshot
 * @param {Object} params.drive - Drive metadata with criteria
 * @param {string} [params.strategy='SEQUENTIAL_AND'] - Chaining strategy
 * @param {Object} [params.rule_set] - Optional override rule set
 * @param {string} [params.rule_set_version='v1.0'] - Version identifier
 * @returns {Object}
 */
function evaluateRules({ student = {}, drive = {}, strategy = 'SEQUENTIAL_AND', rule_set = null, rule_set_version = 'v1.0' }) {
  const startTime = process.hrtime.bigint();
  const criteria = extractCriteria(drive, rule_set);
  const rules = buildRules(criteria);

  let result = 'NOT_ELIGIBLE';
  let failedRules = [];
  let rulesChecked = 0;

  const normalizedStrategy = (strategy || 'SEQUENTIAL_AND').toUpperCase();

  switch (normalizedStrategy) {
    case 'WEIGHTED_PRIORITY': {
      // CGPA (40%), backlogs (30%), attendance (10%), skills (20%)
      const wpRules = [rules.cgpaRule, rules.backlogRule, rules.attendanceRule, rules.skillsRule];
      rulesChecked = wpRules.length;
      const wpEngine = new WeightedPriority(wpRules);
      const wpResult = wpEngine.evaluate(student, drive);
      result = wpResult.result;
      failedRules = wpResult.failed_rules;
      break;
    }

    case 'DECISION_TREE': {
      // Tree: checks branch -> checks CGPA -> checks backlogs & attendance
      const backlogsAndAttendanceRule = {
        name: 'BACKLOGS_AND_ATTENDANCE',
        evaluate: (s, d) => rules.backlogRule.evaluate(s, d) && rules.attendanceRule.evaluate(s, d),
      };

      const leafBacklogsAndAttendance = {
        rule: backlogsAndAttendanceRule,
        pass: null,
        fail: null,
      };

      const nodeCgpa = {
        rule: rules.cgpaRule,
        pass: leafBacklogsAndAttendance,
        fail: null,
      };

      const rootBranch = {
        rule: rules.branchRule,
        pass: nodeCgpa,
        fail: null,
      };

      const dtEngine = new DecisionTree(rootBranch);
      const dtResult = dtEngine.evaluate(student, drive);
      result = dtResult.result;
      failedRules = dtResult.failed_rules;
      rulesChecked = dtResult.path ? dtResult.path.length : 1;
      break;
    }

    case 'SEQUENTIAL_AND':
    default: {
      // Sequential AND chain: CGPA cutoff, backlog limit, branch allow-list, attendance, required skills
      const seqRules = [
        rules.cgpaRule,
        rules.backlogRule,
        rules.branchRule,
        rules.attendanceRule,
        rules.skillsRule,
      ];
      const seqEngine = new SequentialANDChain(seqRules);
      const seqResult = seqEngine.evaluate(student, drive);
      result = seqResult.result;
      failedRules = seqResult.failed_rules;
      // Rules checked is stopped at first failure or all
      if (failedRules.length > 0) {
        const failedIndex = seqRules.findIndex((r) => r.name === failedRules[0]);
        rulesChecked = failedIndex >= 0 ? failedIndex + 1 : 1;
      } else {
        rulesChecked = seqRules.length;
      }
      break;
    }
  }

  const endTime = process.hrtime.bigint();
  const evaluationTimeMs = Number(endTime - startTime) / 1e6;

  return {
    decision_id: `dec_${uuidv4()}`,
    eligibility_result: result,
    failed_rules: failedRules,
    rule_set_version: rule_set_version || 'v1.0',
    decision_metrics: {
      evaluation_time_ms: Math.max(0.01, parseFloat(evaluationTimeMs.toFixed(3))),
      rules_checked: rulesChecked,
      strategy: normalizedStrategy,
    },
  };
}

module.exports = {
  extractCriteria,
  buildRules,
  evaluateRules,
};

