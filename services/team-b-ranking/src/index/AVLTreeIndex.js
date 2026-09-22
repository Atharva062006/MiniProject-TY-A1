// Team B — Self-Balancing AVL Tree Index
// Used for candidate ranking, percentile lookups, and fast range queries in O(log N)

class AVLNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.values = [value];
    this.height = 1;
    this.left = null;
    this.right = null;
  }
}

class AVLTreeIndex {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  _height(node) {
    return node ? node.height : 0;
  }

  _getBalance(node) {
    return node ? this._height(node.left) - this._height(node.right) : 0;
  }

  _updateHeight(node) {
    node.height = 1 + Math.max(this._height(node.left), this._height(node.right));
  }

  _compare(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    const sa = String(a);
    const sb = String(b);
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  _rotateRight(y) {
    const x = y.left;
    const T2 = x.right;

    x.right = y;
    y.left = T2;

    this._updateHeight(y);
    this._updateHeight(x);

    return x;
  }

  _rotateLeft(x) {
    const y = x.right;
    const T2 = y.left;

    y.left = x;
    x.right = T2;

    this._updateHeight(x);
    this._updateHeight(y);

    return y;
  }

  _insert(node, key, value) {
    if (!node) {
      this.size++;
      return new AVLNode(key, value);
    }

    const cmp = this._compare(key, node.key);
    if (cmp < 0) {
      node.left = this._insert(node.left, key, value);
    } else if (cmp > 0) {
      node.right = this._insert(node.right, key, value);
    } else {
      // Key collision: retain primary value and push to values array
      node.value = value;
      node.values.push(value);
      return node;
    }

    this._updateHeight(node);
    const balance = this._getBalance(node);

    // Left-Left Case
    if (balance > 1 && this._compare(key, node.left.key) < 0) {
      return this._rotateRight(node);
    }

    // Right-Right Case
    if (balance < -1 && this._compare(key, node.right.key) > 0) {
      return this._rotateLeft(node);
    }

    // Left-Right Case
    if (balance > 1 && this._compare(key, node.left.key) > 0) {
      node.left = this._rotateLeft(node.left);
      return this._rotateRight(node);
    }

    // Right-Left Case
    if (balance < -1 && this._compare(key, node.right.key) < 0) {
      node.right = this._rotateRight(node.right);
      return this._rotateLeft(node);
    }

    return node;
  }

  /**
   * Insert a key-value pair into the AVL tree.
   * @param {number|string} key
   * @param {*} value
   */
  insert(key, value) {
    this.root = this._insert(this.root, key, value);
  }

  /**
   * Search for a key in O(log N).
   * @param {number|string} key
   * @returns {*} Stored value or array of values, or null if not found
   */
  search(key) {
    let curr = this.root;
    while (curr) {
      const cmp = this._compare(key, curr.key);
      if (cmp === 0) {
        return curr.values.length > 1 ? curr.values : curr.value;
      }
      if (cmp < 0) {
        curr = curr.left;
      } else {
        curr = curr.right;
      }
    }
    return null;
  }

  /**
   * Find all values within [minKey, maxKey] range.
   */
  findRange(minKey, maxKey) {
    const results = [];
    this._findRange(this.root, minKey, maxKey, results);
    return results;
  }

  _findRange(node, minKey, maxKey, results) {
    if (!node) return;

    if (this._compare(minKey, node.key) < 0) {
      this._findRange(node.left, minKey, maxKey, results);
    }

    if (this._compare(node.key, minKey) >= 0 && this._compare(node.key, maxKey) <= 0) {
      results.push(...node.values);
    }

    if (this._compare(maxKey, node.key) > 0) {
      this._findRange(node.right, minKey, maxKey, results);
    }
  }

  /**
   * In-order traversal of all indexed entries.
   */
  getInOrder() {
    const results = [];
    this._inOrder(this.root, results);
    return results;
  }

  _inOrder(node, results) {
    if (!node) return;
    this._inOrder(node.left, results);
    results.push({
      key: node.key,
      value: node.value,
      values: node.values,
      height: node.height,
    });
    this._inOrder(node.right, results);
  }

  /**
   * Height of the AVL tree.
   */
  getHeight() {
    return this._height(this.root);
  }

  /**
   * Total indexed elements count.
   */
  getSize() {
    return this.size;
  }

  /**
   * Return tree diagnostic stats.
   */
  getStats() {
    const balanceFactors = [];
    let isBalanced = true;

    const traverse = (node) => {
      if (!node) return;
      traverse(node.left);
      const bf = this._getBalance(node);
      balanceFactors.push({ key: node.key, balanceFactor: bf });
      if (Math.abs(bf) > 1) isBalanced = false;
      traverse(node.right);
    };

    traverse(this.root);

    return {
      height: this.getHeight(),
      nodeCount: this.size,
      isBalanced,
      balanceFactors,
    };
  }

  /**
   * Clear tree.
   */
  clear() {
    this.root = null;
    this.size = 0;
  }
}

module.exports = AVLTreeIndex;
