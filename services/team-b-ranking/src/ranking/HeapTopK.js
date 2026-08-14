// Team B — Heap Top-K Ranking Algorithm
// Uses a min-heap to efficiently find top-K candidates

class HeapTopK {
  compute(candidates, driveRequirements, graph, k = candidates.length) {
    // Score each candidate first (same scoring as WeightedScore)
    const scored = candidates.map(candidate => {
      let total = 0, maxPossible = 0;
      for (const req of driveRequirements.required_skills) {
        maxPossible += req.weight;
        const edges = graph.getNeighbors ? graph.getNeighbors(candidate.student_id) : [];
        const match = edges.find(e => e.to === req.name);
        total += (match ? match.weight : 0) * req.weight;
      }
      return { student_id: candidate.student_id, total_score: maxPossible > 0 ? total / maxPossible : 0 };
    });

    // Use min-heap to keep top-K
    const heap = [];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (heap[i].total_score < heap[p].total_score) {
          [heap[i], heap[p]] = [heap[p], heap[i]]; i = p;
        } else break;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let s = i, l = 2*i+1, r = 2*i+2;
          if (l < heap.length && heap[l].total_score < heap[s].total_score) s = l;
          if (r < heap.length && heap[r].total_score < heap[s].total_score) s = r;
          if (s !== i) { [heap[i], heap[s]] = [heap[s], heap[i]]; i = s; } else break;
        }
      }
      return top;
    };

    for (const item of scored) {
      push(item);
      if (heap.length > k) pop(); // evict lowest scorer
    }

    // Extract remaining in order (highest score = last popped from min-heap)
    const result = [];
    while (heap.length > 0) result.unshift(pop());
    return result.map((s, i) => ({ ...s, rank: i + 1, algorithm: 'HEAP_TOPK' }));
  }
}

module.exports = HeapTopK;
