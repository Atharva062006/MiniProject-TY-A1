// Team A — Weighted Priority Rule Strategy
// Rules have weights; weighted score determines ELIGIBLE/CONDITIONAL/NOT_ELIGIBLE

class WeightedPriority {
  constructor(rules) {
    // rules: Array of { name, weight, evaluate(student, drive) => boolean }
    this.rules = rules;
    this.totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
  }

  evaluate(student, drive) {
    let passed = 0;
    const failed = [];
    for (const rule of this.rules) {
      if (rule.evaluate(student, drive)) {
        passed += rule.weight;
      } else {
        failed.push(rule.name);
      }
    }
    const score = this.totalWeight > 0 ? passed / this.totalWeight : 0;
    let result;
    if (score === 1) result = 'ELIGIBLE';
    else if (score >= 0.7) result = 'CONDITIONAL';
    else result = 'NOT_ELIGIBLE';

    return { result, score, failed_rules: failed, strategy: 'WEIGHTED_PRIORITY' };
  }
}

module.exports = WeightedPriority;
