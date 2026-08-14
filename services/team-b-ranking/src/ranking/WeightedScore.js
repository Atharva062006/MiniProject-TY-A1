// Team B — Weighted Score Ranking Algorithm
// Computes a score for each candidate using edge weights from the skill graph

class WeightedScore {
  /**
   * @param {object[]} candidates - Array of { student_id, skills: [] }
   * @param {object}   driveRequirements - { required_skills: [{name, weight}] }
   * @param {object}   graph - AdjacencyList or AdjacencyMatrix
   */
  compute(candidates, driveRequirements, graph) {
    const scores = candidates.map(candidate => {
      let total = 0;
      let maxPossible = 0;
      for (const req of driveRequirements.required_skills) {
        maxPossible += req.weight;
        const edgeKey = `${candidate.student_id}::${req.name}`;
        const weight = graph.getWeight
          ? graph.getWeight(candidate.student_id, req.name)
          : (graph.getNeighbors(candidate.student_id).find(e => e.to === req.name)?.weight || 0);
        total += weight * req.weight;
      }
      return {
        student_id: candidate.student_id,
        total_score: maxPossible > 0 ? total / maxPossible : 0,
        algorithm: 'WEIGHTED_SCORE',
      };
    });

    // Sort descending by score
    scores.sort((a, b) => b.total_score - a.total_score);
    return scores.map((s, i) => ({ ...s, rank: i + 1 }));
  }
}

module.exports = WeightedScore;
