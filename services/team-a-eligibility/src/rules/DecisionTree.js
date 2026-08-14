// Team A — Decision Tree Rule Strategy
// Traverses a tree of conditions, each node has a rule and branches

class DecisionTree {
  constructor(root) {
    // root: { rule: { name, evaluate }, pass: node|null, fail: node|null }
    this.root = root;
  }

  evaluate(student, drive) {
    let node = this.root;
    const path = [];
    while (node) {
      const passed = node.rule.evaluate(student, drive);
      path.push({ rule: node.rule.name, passed });
      node = passed ? node.pass : node.fail;
    }
    const lastStep = path[path.length - 1];
    return {
      result: lastStep && lastStep.passed ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      failed_rules: path.filter(p => !p.passed).map(p => p.rule),
      path,
      strategy: 'DECISION_TREE',
    };
  }
}

module.exports = DecisionTree;
