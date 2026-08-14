// Team A — Sequential AND-Chain Rule Strategy
// All rules must pass (AND). Stops at first failure.

class SequentialANDChain {
  constructor(rules) {
    // rules: Array of { name, evaluate(student, drive) => boolean }
    this.rules = rules;
  }

  evaluate(student, drive) {
    const failed = [];
    for (const rule of this.rules) {
      if (!rule.evaluate(student, drive)) {
        failed.push(rule.name);
        break; // short-circuit
      }
    }
    return {
      result: failed.length === 0 ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      failed_rules: failed,
      strategy: 'SEQUENTIAL_AND',
    };
  }
}

module.exports = SequentialANDChain;
