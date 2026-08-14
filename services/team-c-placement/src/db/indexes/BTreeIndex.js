/**
 * BTreeIndex — Order-t B-tree for range queries and sorted lookups.
 *
 * Used for:
 *   - CGPA range queries   (students table)
 *   - Date range queries   (drives, audit_log)
 *   - State-based lookups  (applications.state)
 *
 * Each key maps to a Set of primary keys (one-to-many support).
 *
 * Persistence: serialize() / deserialize() for saving to disk.
 */

class BTreeNode {
  constructor(isLeaf = true, order = 5) {
    this.order    = order;       // max keys per node = order - 1
    this.isLeaf   = isLeaf;
    this.keys     = [];          // sorted key values
    this.values   = [];          // parallel array of Set<pk> (leaf nodes only)
    this.children = [];          // child BTreeNode references (internal nodes only)
  }

  isFull() {
    return this.keys.length >= this.order - 1;
  }
}

class BTreeIndex {
  /**
   * @param {string} indexName - Name for serialization
   * @param {number} order     - B-tree order (max children per node = order)
   */
  constructor(indexName = 'unnamed', order = 5) {
    this.indexName = indexName;
    this.order     = order;
    this.root      = new BTreeNode(true, order);
    this.size      = 0; // total number of key-pk pairs
  }

  // ─── Insert ───────────────────────────────────────────────────────────────

  /**
   * Insert a (key, pk) pair.
   * @param {*}      key - Comparable value (number, string, ISO date string)
   * @param {string} pk  - Primary key of the record
   */
  insert(key, pk) {
    const root = this.root;
    if (root.isFull()) {
      const newRoot = new BTreeNode(false, this.order);
      newRoot.children.push(this.root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
    }
    this._insertNonFull(this.root, key, pk);
    this.size++;
  }

  _insertNonFull(node, key, pk) {
    let i = node.keys.length - 1;
    if (node.isLeaf) {
      // Find insertion point
      while (i >= 0 && this._cmp(key, node.keys[i]) < 0) i--;
      const insertAt = i + 1;
      // Check if key already exists at this position
      if (insertAt < node.keys.length && node.keys[insertAt] === key) {
        node.values[insertAt].add(pk);
        this.size--; // don't double-count the increment in insert()
        return;
      }
      node.keys.splice(insertAt, 0, key);
      node.values.splice(insertAt, 0, new Set([pk]));
    } else {
      while (i >= 0 && this._cmp(key, node.keys[i]) < 0) i--;
      i++;
      if (node.children[i].isFull()) {
        this._splitChild(node, i);
        if (this._cmp(key, node.keys[i]) > 0) i++;
      }
      this._insertNonFull(node.children[i], key, pk);
    }
  }

  _splitChild(parent, childIdx) {
    const t     = Math.floor(this.order / 2);
    const child = parent.children[childIdx];
    const sibling = new BTreeNode(child.isLeaf, this.order);

    // Move upper half keys to sibling
    sibling.keys   = child.keys.splice(t);
    if (child.isLeaf) {
      sibling.values = child.values.splice(t);
    } else {
      sibling.children = child.children.splice(t + 1);
      const promotedKey = child.keys.splice(t - 1, 1)[0];
      parent.keys.splice(childIdx, 0, promotedKey);
      parent.children.splice(childIdx + 1, 0, sibling);
      return;
    }

    const promotedKey = sibling.keys[0]; // for leaf: copy up
    parent.keys.splice(childIdx, 0, promotedKey);
    parent.children.splice(childIdx + 1, 0, sibling);
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  /**
   * Exact lookup — returns Set<pk> for the given key, or empty Set.
   */
  search(key) {
    return this._search(this.root, key);
  }

  _search(node, key) {
    let i = 0;
    while (i < node.keys.length && this._cmp(key, node.keys[i]) > 0) i++;
    if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) {
      return node.isLeaf ? node.values[i] : this._search(node.children[i + 1], key);
    }
    if (node.isLeaf) return new Set();
    return this._search(node.children[i], key);
  }

  /**
   * Range query — returns all PKs where minKey <= key <= maxKey.
   * Pass null for unbounded ends.
   * @param {*} minKey
   * @param {*} maxKey
   * @returns {Set<string>}
   */
  rangeQuery(minKey, maxKey) {
    const result = new Set();
    this._rangeTraverse(this.root, minKey, maxKey, result);
    return result;
  }

  _rangeTraverse(node, minKey, maxKey, result) {
    for (let i = 0; i < node.keys.length; i++) {
      const key = node.keys[i];
      // Visit left child first (internal nodes)
      if (!node.isLeaf && node.children[i]) {
        if (minKey === null || this._cmp(key, minKey) >= 0) {
          this._rangeTraverse(node.children[i], minKey, maxKey, result);
        }
      }
      // Check if this key is in range
      const aboveMin = minKey === null || this._cmp(key, minKey) >= 0;
      const belowMax = maxKey === null || this._cmp(key, maxKey) <= 0;
      if (aboveMin && belowMax && node.isLeaf) {
        for (const pk of node.values[i]) result.add(pk);
      }
    }
    // Visit rightmost child
    if (!node.isLeaf && node.children[node.keys.length]) {
      this._rangeTraverse(node.children[node.keys.length], minKey, maxKey, result);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Remove a (key, pk) pair from the index.
   * If the key has no remaining PKs, removes the key entry entirely.
   */
  delete(key, pk) {
    this._delete(this.root, key, pk);
    if (!this.root.isLeaf && this.root.keys.length === 0) {
      this.root = this.root.children[0];
    }
    this.size = Math.max(0, this.size - 1);
  }

  _delete(node, key, pk) {
    let i = 0;
    while (i < node.keys.length && this._cmp(key, node.keys[i]) > 0) i++;
    if (node.isLeaf) {
      if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) {
        node.values[i].delete(pk);
        if (node.values[i].size === 0) {
          node.keys.splice(i, 1);
          node.values.splice(i, 1);
        }
      }
      return;
    }
    if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) {
      i++; // found in key; go to right child
    }
    if (node.children[i]) this._delete(node.children[i], key, pk);
  }

  // ─── Comparison ────────────────────────────────────────────────────────────

  _cmp(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const sa = String(a), sb = String(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  serialize() {
    return JSON.stringify({ indexName: this.indexName, order: this.order, size: this.size, root: this._serializeNode(this.root) });
  }

  _serializeNode(node) {
    return {
      isLeaf:   node.isLeaf,
      keys:     node.keys,
      values:   node.isLeaf ? node.values.map(s => [...s]) : [],
      children: node.isLeaf ? [] : node.children.map(c => this._serializeNode(c)),
    };
  }

  static deserialize(json) {
    const data  = typeof json === 'string' ? JSON.parse(json) : json;
    const index = new BTreeIndex(data.indexName, data.order);
    index.size  = data.size;
    index.root  = BTreeIndex._deserializeNode(data.root, data.order);
    return index;
  }

  static _deserializeNode(data, order) {
    const node    = new BTreeNode(data.isLeaf, order);
    node.keys     = data.keys;
    node.values   = data.isLeaf ? data.values.map(arr => new Set(arr)) : [];
    node.children = data.isLeaf ? [] : data.children.map(c => BTreeIndex._deserializeNode(c, order));
    return node;
  }

  /** In-order traversal to get all key-pk pairs (useful for debugging) */
  toSortedArray() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  _inOrder(node, result) {
    if (!node) return;
    if (node.isLeaf) {
      for (let i = 0; i < node.keys.length; i++) {
        for (const pk of node.values[i]) result.push({ key: node.keys[i], pk });
      }
      return;
    }
    for (let i = 0; i < node.keys.length; i++) {
      if (node.children[i]) this._inOrder(node.children[i], result);
    }
    if (node.children[node.keys.length]) this._inOrder(node.children[node.keys.length], result);
  }
}

module.exports = BTreeIndex;
