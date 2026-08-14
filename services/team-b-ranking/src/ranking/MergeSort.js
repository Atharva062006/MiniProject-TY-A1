// Team B — Merge Sort Ranking Algorithm
// Deterministic sort for reproducible rankings

class MergeSort {
  compute(candidates, driveRequirements, graph) {
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

    const sorted = this._mergeSort(scored);
    return sorted.map((s, i) => ({ ...s, rank: i + 1, algorithm: 'MERGE_SORT' }));
  }

  _mergeSort(arr) {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    return this._merge(this._mergeSort(arr.slice(0, mid)), this._mergeSort(arr.slice(mid)));
  }

  _merge(left, right) {
    const result = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      // Sort descending by score; tie-break by student_id (lexicographic)
      if (left[i].total_score > right[j].total_score ||
         (left[i].total_score === right[j].total_score && left[i].student_id < right[j].student_id)) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }
    return result.concat(left.slice(i)).concat(right.slice(j));
  }
}

module.exports = MergeSort;
