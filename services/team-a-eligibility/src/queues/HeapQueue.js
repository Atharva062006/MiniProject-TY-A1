// Team A — Heap Queue (alias: max-heap variant for Team A scheduling experiments)
const PriorityQueue = require('./PriorityQueue');

// Max-heap: higher priority value = dequeued first
class HeapQueue extends PriorityQueue {
  constructor() {
    super((a, b) => b.priority - a.priority); // max-heap
  }
}

module.exports = HeapQueue;
