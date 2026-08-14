// Team A — FIFO Queue Implementation
// Uses a linked-list-style array with head/tail pointers for O(1) enqueue/dequeue

class FIFOQueue {
  constructor() {
    this.items = [];
    this.head = 0;
  }

  /** Enqueue an item */
  enqueue(item) {
    this.items.push(item);
  }

  /** Dequeue the front item. Returns null if empty. */
  dequeue() {
    if (this.isEmpty()) return null;
    const item = this.items[this.head];
    this.head++;
    // Compact memory every 100 dequeues
    if (this.head > 100) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  peek() {
    return this.isEmpty() ? null : this.items[this.head];
  }

  isEmpty() {
    return this.head >= this.items.length;
  }

  size() {
    return this.items.length - this.head;
  }

  toArray() {
    return this.items.slice(this.head);
  }
}

module.exports = FIFOQueue;
