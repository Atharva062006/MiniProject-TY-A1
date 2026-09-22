// Team B — Analytics Service
// Computes cohort placement analytics, department trends, skill distributions,
// and benchmarks data structure / algorithm performance (AdjList vs AdjMatrix, HeapTopK vs MergeSort).

const HeapTopK = require('../ranking/HeapTopK');
const MergeSort = require('../ranking/MergeSort');

class AnalyticsService {
  /**
   * @param {import('../profiles/ProfileRegistry')} profileRegistry
   * @param {import('./rankingService')} rankingService
   */
  constructor(profileRegistry, rankingService) {
    this.profileRegistry = profileRegistry;
    this.rankingService = rankingService;
    this.lastBenchmark = null;
  }

  /**
   * Perform comprehensive cohort and performance analytics.
   * @param {object} options
   */
  async analyseCohort({ drive_id, candidates } = {}) {
    const allProfiles = this.profileRegistry.getAllProfiles();
    const students = Array.isArray(candidates) && candidates.length > 0
      ? candidates
      : allProfiles.students;

    const drive = drive_id
      ? (this.profileRegistry.getDrive(drive_id) || allProfiles.drives[0])
      : allProfiles.drives[0] || { required_skills: [] };

    // 1. Department Placement Trends
    const deptStats = {};
    for (const s of students) {
      const branch = s.branch || 'OTHER';
      if (!deptStats[branch]) {
        deptStats[branch] = {
          student_count: 0,
          total_cgpa: 0,
          skills_count: 0,
          skill_frequency: {},
          zero_backlog_count: 0,
        };
      }
      const st = deptStats[branch];
      st.student_count++;
      st.total_cgpa += (s.cgpa || 0);
      const sSkills = Array.isArray(s.skills) ? s.skills : [];
      st.skills_count += sSkills.length;
      if (!s.backlogs || s.backlogs === 0) st.zero_backlog_count++;

      for (const sk of sSkills) {
        const name = typeof sk === 'string' ? sk : (sk.name || sk.skill);
        if (name) {
          st.skill_frequency[name] = (st.skill_frequency[name] || 0) + 1;
        }
      }
    }

    const department_trends = Object.entries(deptStats).map(([branch, data]) => ({
      branch,
      student_count: data.student_count,
      avg_cgpa: data.student_count > 0 ? Number((data.total_cgpa / data.student_count).toFixed(2)) : 0,
      avg_skills_per_student: data.student_count > 0 ? Number((data.skills_count / data.student_count).toFixed(1)) : 0,
      zero_backlog_percentage: data.student_count > 0 ? Number(((data.zero_backlog_count / data.student_count) * 100).toFixed(1)) : 0,
      top_skills: Object.entries(data.skill_frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count })),
    }));

    // 2. Skill Match Distributions
    const reqSkills = drive && drive.required_skills ? drive.required_skills : [];
    const skillFrequencies = {};
    let highMatchCount = 0;
    let moderateMatchCount = 0;
    let lowMatchCount = 0;

    for (const s of students) {
      const sSkills = Array.isArray(s.skills) ? s.skills.map(sk => (typeof sk === 'string' ? sk : sk.name).toLowerCase()) : [];
      let matchedCount = 0;

      for (const req of reqSkills) {
        const reqName = (req.name || req).toLowerCase();
        if (sSkills.includes(reqName)) {
          matchedCount++;
          skillFrequencies[req.name || req] = (skillFrequencies[req.name || req] || 0) + 1;
        }
      }

      const matchRatio = reqSkills.length > 0 ? matchedCount / reqSkills.length : 0;
      if (matchRatio >= 0.7) highMatchCount++;
      else if (matchRatio >= 0.4) moderateMatchCount++;
      else lowMatchCount++;
    }

    const totalStudents = students.length || 1;
    const skill_match_distribution = {
      target_drive_id: drive ? drive.drive_id : null,
      required_skills_count: reqSkills.length,
      student_distribution: {
        high_match_pct: Number(((highMatchCount / totalStudents) * 100).toFixed(1)),
        moderate_match_pct: Number(((moderateMatchCount / totalStudents) * 100).toFixed(1)),
        low_match_pct: Number(((lowMatchCount / totalStudents) * 100).toFixed(1)),
      },
      skill_coverage: Object.entries(skillFrequencies).map(([skill, count]) => ({
        skill,
        student_count: count,
        coverage_pct: Number(((count / totalStudents) * 100).toFixed(1)),
      })),
    };

    // 3. Conversion Rates
    const minCgpa = drive && drive.min_cgpa ? drive.min_cgpa : 0;
    const maxBacklogs = drive && drive.max_backlogs !== undefined ? drive.max_backlogs : 999;
    const eligibleStudents = students.filter(s => (s.cgpa || 0) >= minCgpa && (s.backlogs || 0) <= maxBacklogs);
    const seats = drive && drive.seats ? drive.seats : 10;
    const shortlistedCount = Math.min(eligibleStudents.length, seats * 2);

    const conversion_rates = {
      total_candidates: students.length,
      eligible_candidates: eligibleStudents.length,
      eligibility_rate_pct: Number(((eligibleStudents.length / totalStudents) * 100).toFixed(1)),
      shortlisted_estimate: shortlistedCount,
      shortlist_conversion_rate_pct: eligibleStudents.length > 0
        ? Number(((shortlistedCount / eligibleStudents.length) * 100).toFixed(1))
        : 0,
      projected_seat_fill_rate_pct: seats > 0
        ? Number((Math.min(100, (shortlistedCount / seats) * 100)).toFixed(1))
        : 100,
    };

    // 4. Package Tier Breakdown
    const drives = allProfiles.drives;
    let tierSuperDream = 0; // > 10 LPA / > 1,000,000
    let tierDream = 0;      // 5-10 LPA / 500,000 - 1,000,000
    let tierRegular = 0;    // < 5 LPA / < 500,000

    for (const d of drives) {
      const pkg = Number(d.package) || 0;
      // Handle both LPA format (e.g. 12.5) and absolute rupee format (e.g. 600000)
      const normalizedPkgLpa = pkg > 1000 ? pkg / 100000 : pkg;
      if (normalizedPkgLpa >= 10) tierSuperDream++;
      else if (normalizedPkgLpa >= 5) tierDream++;
      else tierRegular++;
    }

    const package_tier_breakdown = {
      total_drives: drives.length,
      tiers: [
        { tier: 'SUPER_DREAM (>= 10 LPA)', drive_count: tierSuperDream },
        { tier: 'DREAM (5 - 10 LPA)', drive_count: tierDream },
        { tier: 'REGULAR (< 5 LPA)', drive_count: tierRegular },
      ],
    };

    // 5. Algorithm Benchmark Comparison
    const benchmark = this.runAlgorithmBenchmark(students, drive);
    this.lastBenchmark = benchmark;

    return {
      department_trends,
      skill_match_distribution,
      conversion_rates,
      package_tier_breakdown,
      algorithm_benchmark: benchmark,
      algorithm_benchmarks: benchmark,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Run traversal and sorting benchmarks.
   * Compares AdjacencyList vs AdjacencyMatrix and HeapTopK vs MergeSort.
   */
  runAlgorithmBenchmark(candidates = [], drive = {}) {
    const adjList = this.profileRegistry.getAdjacencyList();
    const adjMatrix = this.profileRegistry.getAdjacencyMatrix();

    // Ensure candidates exist in registry
    const testPool = candidates.length > 0 ? candidates : this.profileRegistry.getAllProfiles().students;
    const reqs = drive && drive.required_skills && drive.required_skills.length > 0
      ? drive
      : { required_skills: [{ name: 'Python', weight: 2 }, { name: 'JavaScript', weight: 1 }] };

    const iterations = 50;

    // Benchmark 1: Graph Traversal (AdjacencyList vs AdjacencyMatrix)
    const startListHr = process.hrtime.bigint();
    for (let iter = 0; iter < iterations; iter++) {
      for (const c of testPool) {
        adjList.getNeighbors(c.student_id);
      }
    }
    const endListHr = process.hrtime.bigint();
    const listTimeUs = Number((endListHr - startListHr) / 1000n);

    const startMatrixHr = process.hrtime.bigint();
    for (let iter = 0; iter < iterations; iter++) {
      for (const c of testPool) {
        adjMatrix.getNeighbors(c.student_id);
      }
    }
    const endMatrixHr = process.hrtime.bigint();
    const matrixTimeUs = Number((endMatrixHr - startMatrixHr) / 1000n);

    // Benchmark 2: Ranking Algorithms (HeapTopK vs MergeSort)
    const memBeforeHeap = process.memoryUsage().heapUsed;
    const startHeapHr = process.hrtime.bigint();
    const heapAlgo = new HeapTopK();
    for (let iter = 0; iter < iterations; iter++) {
      heapAlgo.compute(testPool, reqs, adjList, testPool.length);
    }
    const endHeapHr = process.hrtime.bigint();
    const heapTimeUs = Number((endHeapHr - startHeapHr) / 1000n);
    const memAfterHeap = process.memoryUsage().heapUsed;

    const memBeforeMerge = process.memoryUsage().heapUsed;
    const startMergeHr = process.hrtime.bigint();
    const mergeAlgo = new MergeSort();
    for (let iter = 0; iter < iterations; iter++) {
      mergeAlgo.compute(testPool, reqs, adjList);
    }
    const endMergeHr = process.hrtime.bigint();
    const mergeTimeUs = Number((endMergeHr - startMergeHr) / 1000n);
    const memAfterMerge = process.memoryUsage().heapUsed;

    return {
      iterations,
      candidate_sample_size: testPool.length,
      graph_traversal: {
        adjacency_list: {
          execution_time_us: listTimeUs,
          avg_per_op_us: Number((listTimeUs / (iterations * (testPool.length || 1))).toFixed(3)),
          time_complexity: 'O(V + E)',
        },
        adjacency_matrix: {
          execution_time_us: matrixTimeUs,
          avg_per_op_us: Number((matrixTimeUs / (iterations * (testPool.length || 1))).toFixed(3)),
          time_complexity: 'O(V^2)',
        },
        faster_structure: listTimeUs <= matrixTimeUs ? 'AdjacencyList' : 'AdjacencyMatrix',
      },
      ranking_algorithms: {
        heap_top_k: {
          execution_time_us: heapTimeUs,
          avg_per_run_us: Number((heapTimeUs / iterations).toFixed(2)),
          time_complexity: 'O(N log K)',
          heap_used_delta_bytes: Math.max(0, memAfterHeap - memBeforeHeap),
        },
        merge_sort: {
          execution_time_us: mergeTimeUs,
          avg_per_run_us: Number((mergeTimeUs / iterations).toFixed(2)),
          time_complexity: 'O(N log N)',
          heap_used_delta_bytes: Math.max(0, memAfterMerge - memBeforeMerge),
        },
        faster_algorithm: heapTimeUs <= mergeTimeUs ? 'HeapTopK' : 'MergeSort',
      },
    };
  }

  /**
   * Return ranking service and graph metrics.
   */
  getMetrics() {
    const rankingMetrics = this.rankingService.getRankingMetrics();
    const adjList = this.profileRegistry.getAdjacencyList();
    const adjMatrix = this.profileRegistry.getAdjacencyMatrix();

    let totalEdges = 0;
    for (const [, edges] of adjList.edges) {
      totalEdges += edges.length;
    }

    return {
      service: 'team-b-ranking',
      ranking: rankingMetrics,
      graph: {
        graph_version: this.profileRegistry.getGraphVersion(),
        adjacency_list_vertices: adjList.vertices.size,
        adjacency_list_edges: totalEdges,
        adjacency_matrix_vertices: adjMatrix.vertices.length,
        total_students: this.profileRegistry.students.size,
        total_drives: this.profileRegistry.drives.size,
      },
      last_benchmark: this.lastBenchmark || null,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = AnalyticsService;
