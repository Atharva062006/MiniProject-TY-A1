// Team B — Ranking Service
// Orchestrates ranking algorithms: WEIGHTED_SCORE, HEAP_TOPK, MERGE_SORT
// Benchmarks execution time, manages shortlist cache, and maintains AVL Tree Index

const { v4: uuidv4 } = require('uuid');
const WeightedScore = require('../ranking/WeightedScore');
const HeapTopK = require('../ranking/HeapTopK');
const MergeSort = require('../ranking/MergeSort');
const AVLTreeIndex = require('../index/AVLTreeIndex');
const { NotFoundError, ValidationError } = require('../../../../shared/errors');

class RankingService {
  /**
   * @param {import('../profiles/ProfileRegistry')} profileRegistry
   */
  constructor(profileRegistry) {
    this.profileRegistry = profileRegistry;
    this.cache = new Map();     // cacheKey -> rankingResult
    this.rankings = new Map();  // rankingId -> rankingResult
    this.avlIndex = new AVLTreeIndex();

    // Metrics tracking
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.latenciesUs = [];
    this.totalComputations = 0;
  }

  /**
   * Normalize required_skills to array of { name: string, weight: number }
   */
  _normalizeRequirements(reqs = {}) {
    let raw = reqs.required_skills || [];
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [raw];
      }
    }
    const normalizedSkills = raw.map(s => {
      if (typeof s === 'string') return { name: s, weight: 1 };
      return {
        name: s.name || s.skill || '',
        weight: s.weight != null ? Number(s.weight) : 1,
      };
    }).filter(s => Boolean(s.name));

    return {
      ...reqs,
      required_skills: normalizedSkills,
    };
  }

  /**
   * Fetch drive requirements from Team C if not present in registry
   */
  async _fetchDriveFromTeamC(driveId) {
    try {
      const res = await fetch(`http://localhost:3003/api/v1/drives/${driveId}/criteria`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const body = await res.json();
        const payload = body.data || body;
        const criteria = payload.criteria || {};
        return this.profileRegistry.registerDrive(driveId, {
          drive_id: driveId,
          seats: payload.seats,
          min_cgpa: criteria.min_cgpa,
          max_backlogs: criteria.max_backlogs,
          required_skills: criteria.required_skills,
        });
      }
    } catch {
      // Team C offline or unreachable; will handle missing drive below
    }
    return null;
  }

  /**
   * Fetch student candidates from Team C if none in registry
   */
  async _fetchStudentsFromTeamC() {
    try {
      const res = await fetch('http://localhost:3003/api/v1/students', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const body = await res.json();
        const list = body.data || [];
        for (const s of list) {
          this.profileRegistry.registerStudent(s.student_id, s);
        }
        return list;
      }
    } catch {
      // Team C offline or unreachable
    }
    return [];
  }

  /**
   * Compute candidate rankings for a drive.
   * @param {object} options
   * @param {string} options.drive_id
   * @param {string} [options.algorithm='WEIGHTED_SCORE'] - 'WEIGHTED_SCORE' | 'HEAP_TOPK' | 'MERGE_SORT'
   * @param {number} [options.k] - top-K cutoff
   * @param {Array} [options.candidates] - explicit candidate list or IDs
   * @param {object} [options.requirements] - explicit drive requirements
   */
  async computeRanking({ drive_id, algorithm = 'WEIGHTED_SCORE', k, candidates, requirements, criteria } = {}) {
    if (!drive_id) {
      throw new ValidationError('drive_id is required');
    }

    const algo = (algorithm || 'WEIGHTED_SCORE').toUpperCase();
    if (!['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT'].includes(algo)) {
      throw new ValidationError(`Unsupported algorithm '${algorithm}'. Use WEIGHTED_SCORE, HEAP_TOPK, or MERGE_SORT.`);
    }

    const graphVersion = this.profileRegistry.getGraphVersion();
    const cacheKey = `${drive_id}:${graphVersion}:${algo}`;

    // Check cache
    if (!candidates && !requirements && !criteria && this.cache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.cache.get(cacheKey);
      return { ...cached, from_cache: true };
    }
    this.cacheMisses++;

    // Resolve Drive Requirements
    let driveReqs = requirements || criteria;
    if (!driveReqs) {
      driveReqs = this.profileRegistry.getDrive(drive_id);
    }
    if (!driveReqs) {
      driveReqs = await this._fetchDriveFromTeamC(drive_id);
    }
    if (!driveReqs) {
      throw new NotFoundError('Drive requirements', drive_id);
    }
    driveReqs = this._normalizeRequirements(driveReqs);

    // Resolve Candidate Pool
    let candidatePool = [];
    if (Array.isArray(candidates) && candidates.length > 0) {
      for (const item of candidates) {
        if (typeof item === 'string') {
          let s = this.profileRegistry.getStudent(item);
          if (s) candidatePool.push(s);
          else candidatePool.push({ student_id: item, skills: [] });
        } else if (typeof item === 'object' && item.student_id) {
          this.profileRegistry.registerStudent(item.student_id, item);
          candidatePool.push(item);
        }
      }
    } else {
      const stored = this.profileRegistry.getAllProfiles().students;
      if (stored.length > 0) {
        candidatePool = stored;
      } else {
        const fetched = await this._fetchStudentsFromTeamC();
        candidatePool = fetched.length > 0 ? fetched : this.profileRegistry.getAllProfiles().students;
      }
    }

    if (candidatePool.length === 0) {
      throw new ValidationError('No candidates found to rank for this drive');
    }

    // Ensure candidates and skills are registered in the graph
    const graph = this.profileRegistry.getAdjacencyList();
    for (const c of candidatePool) {
      if (!this.profileRegistry.getStudent(c.student_id)) {
        this.profileRegistry.registerStudent(c.student_id, c);
      }
    }

    // Benchmark algorithm execution time in microseconds
    const startHr = process.hrtime.bigint();
    let rawResults = [];

    if (algo === 'HEAP_TOPK') {
      const topKCount = k && k > 0 ? Number(k) : candidatePool.length;
      const heapAlgo = new HeapTopK();
      rawResults = heapAlgo.compute(candidatePool, driveReqs, graph, topKCount);
    } else if (algo === 'MERGE_SORT') {
      const mergeAlgo = new MergeSort();
      rawResults = mergeAlgo.compute(candidatePool, driveReqs, graph);
      if (k && k > 0) rawResults = rawResults.slice(0, Number(k));
    } else {
      const weightedAlgo = new WeightedScore();
      rawResults = weightedAlgo.compute(candidatePool, driveReqs, graph);
      if (k && k > 0) rawResults = rawResults.slice(0, Number(k));
    }

    const endHr = process.hrtime.bigint();
    const executionTimeUs = Number((endHr - startHr) / 1000n);

    // Break ties deterministically: sort descending by total_score, tie-break by student_id or cgpa
    rawResults.sort((a, b) => {
      if (Math.abs(b.total_score - a.total_score) > 1e-9) {
        return b.total_score - a.total_score;
      }
      const profA = this.profileRegistry.getStudent(a.student_id) || {};
      const profB = this.profileRegistry.getStudent(b.student_id) || {};
      if (profA.cgpa !== undefined && profB.cgpa !== undefined && profA.cgpa !== profB.cgpa) {
        return profB.cgpa - profA.cgpa;
      }
      return String(a.student_id).localeCompare(String(b.student_id));
    });

    // Populate metadata and re-rank
    const finalRankings = rawResults.map((r, idx) => {
      const prof = this.profileRegistry.getStudent(r.student_id) || {};
      const record = {
        rank: idx + 1,
        student_id: r.student_id,
        name: prof.name || null,
        branch: prof.branch || null,
        cgpa: prof.cgpa !== undefined ? prof.cgpa : null,
        total_score: Number(r.total_score.toFixed(4)),
        algorithm: algo,
      };

      // Insert into AVL tree index for fast score/percentile and student lookups
      this.avlIndex.insert(record.total_score, record);
      this.avlIndex.insert(record.student_id, record);

      return record;
    });

    const rankingId = uuidv4();
    const resultRecord = {
      ranking_id: rankingId,
      drive_id,
      algorithm: algo,
      graph_version: graphVersion,
      candidates_count: candidatePool.length,
      shortlisted_count: finalRankings.length,
      execution_time_us: executionTimeUs,
      created_at: new Date().toISOString(),
      rankings: finalRankings,
      ordered_candidates: finalRankings,
    };

    // Store in-memory and cache
    this.rankings.set(rankingId, resultRecord);
    this.cache.set(cacheKey, resultRecord);

    // Update tracking metrics
    this.totalComputations++;
    this.latenciesUs.push(executionTimeUs);
    if (this.latenciesUs.length > 1000) {
      this.latenciesUs.shift();
    }

    return { ...resultRecord, from_cache: false };
  }

  /**
   * Retrieve a previous ranking computation by ID.
   */
  getRanking(rankingId) {
    const record = this.rankings.get(rankingId);
    if (!record) {
      throw new NotFoundError('Ranking', rankingId);
    }
    return record;
  }

  /**
   * Search AVL Tree index by score or student key.
   */
  searchIndex(key) {
    let searchKey = key;
    if (!isNaN(Number(key))) {
      searchKey = Number(key);
    }
    const result = this.avlIndex.search(searchKey);
    return {
      query: key,
      found: Boolean(result),
      result: result || null,
      tree_stats: this.avlIndex.getStats(),
      index_statistics: this.avlIndex.getStats(),
    };
  }

  /**
   * Invalidate ranking shortlist cache.
   */
  invalidateCache() {
    const count = this.cache.size;
    this.cache.clear();
    return {
      invalidated: true,
      cleared_entries: count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Compute p95 latency of ranking computations in microseconds.
   */
  getP95LatencyUs() {
    if (this.latenciesUs.length === 0) return 0;
    const sorted = [...this.latenciesUs].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    return sorted[p95Idx];
  }

  /**
   * Return ranking service metrics.
   */
  getRankingMetrics() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? Number((this.cacheHits / totalRequests).toFixed(4)) : 0;

    return {
      total_computations: this.totalComputations,
      cache_hit_rate: hitRate,
      cache_hits: this.cacheHits,
      cache_misses: this.cacheMisses,
      cached_rankings: this.cache.size,
      p95_latency_us: this.getP95LatencyUs(),
      avl_tree_size: this.avlIndex.getSize(),
      avl_tree_height: this.avlIndex.getHeight(),
    };
  }
}

module.exports = RankingService;
