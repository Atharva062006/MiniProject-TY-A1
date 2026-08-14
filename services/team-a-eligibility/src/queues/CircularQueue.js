// Team A — Circular Queue (fixed-capacity ring buffer)

class CircularQueue {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this._size = 0;
  }

  enqueue(item) {
    if (this.isFull()) throw new Error('CircularQueue is full');
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this._size++;
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this._size--;
    return item;
  }

  peek() {
    return this.isEmpty() ? null : this.buffer[this.head];
  }

  isEmpty() { return this._size === 0; }
  isFull()  { return this._size === this.capacity; }
  size()    { return this._size; }

  toArray() {
    const result = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }
}

module.exports = CircularQueue;
