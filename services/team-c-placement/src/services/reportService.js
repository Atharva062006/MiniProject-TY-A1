/**
 * ReportService — Generates placement performance and cohort analytics (C4).
 *
 * Reports include:
 *   - Overall totals (applications, offers, selected)
 *   - Per-drive stats (applications, offers, seats remaining, package)
 *   - Branch-level breakdown (applications, selected count, conversion %)
 *   - Package distribution (min, max, average across SELECTED applications)
 */

class ReportService {
  /**
   * @param {Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate aggregated placement performance analytics.
   * @param {object} filters
   * @param {string} [filters.branch]   - Filter students by branch
   * @param {string} [filters.drive_id] - Restrict to a specific drive
   */
  async generatePlacementPerformanceReport(filters = {}) {
    const { branch: branchFilter, drive_id: driveIdFilter } = filters;

    const allDrives   = this.db.table('drives').all();
    const allStudents = this.db.table('students').all();
    const allApps     = this.db.table('applications').all();
    const allOffers   = this.db.table('offers').all();

    // ── Apply optional filters ────────────────────────────────────────────────

    // Build a set of student_ids in the filtered branch (if branch filter given)
    let filteredStudentIds = null;
    if (branchFilter) {
      const branchStudents = allStudents.filter(s => s.branch === branchFilter);
      filteredStudentIds = new Set(branchStudents.map(s => s.student_id));
    }

    let apps = allApps;
    if (filteredStudentIds) {
      apps = apps.filter(a => filteredStudentIds.has(a.student_id));
    }
    if (driveIdFilter) {
      apps = apps.filter(a => a.drive_id === driveIdFilter);
    }

    const offers  = driveIdFilter ? allOffers.filter(o => o.drive_id === driveIdFilter) : allOffers;
    const drives  = driveIdFilter ? allDrives.filter(d => d.drive_id === driveIdFilter) : allDrives;

    // ── Overall totals ────────────────────────────────────────────────────────
    const selectedApps  = apps.filter(a => ['SELECTED', 'OFFER_ISSUED'].includes(a.state));
    const totalSelected = selectedApps.length;

    // ── Per-drive stats ───────────────────────────────────────────────────────
    const driveStats = drives.map(d => {
      const driveApps    = apps.filter(a => a.drive_id === d.drive_id);
      const driveOffers  = offers.filter(o => o.drive_id === d.drive_id);
      const driveSelected = driveApps.filter(a => ['SELECTED', 'OFFER_ISSUED'].includes(a.state));
      return {
        drive_id:        d.drive_id,
        title:           d.title,
        company_id:      d.company_id,
        state:           d.state,
        seats_total:     d.seats + driveSelected.length, // original seat count
        seats_remaining: d.seats,
        applications:    driveApps.length,
        selected:        driveSelected.length,
        offers_issued:   driveOffers.filter(o => o.status === 'COMMITTED').length,
        package_lpa:     d.package || null,
        conversion_rate: driveApps.length > 0
          ? `${((driveSelected.length / driveApps.length) * 100).toFixed(1)}%`
          : '0%',
      };
    });

    // ── Branch breakdown ──────────────────────────────────────────────────────
    const branches = [...new Set(allStudents.map(s => s.branch))].filter(Boolean);
    const branchStats = branches.map(b => {
      const branchStudentIds = new Set(
        allStudents.filter(s => s.branch === b).map(s => s.student_id)
      );
      const branchApps     = apps.filter(a => branchStudentIds.has(a.student_id));
      const branchSelected = branchApps.filter(a => ['SELECTED', 'OFFER_ISSUED'].includes(a.state));
      return {
        branch:          b,
        total_students:  branchStudentIds.size,
        applications:    branchApps.length,
        selected:        branchSelected.length,
        conversion_rate: branchApps.length > 0
          ? `${((branchSelected.length / branchApps.length) * 100).toFixed(1)}%`
          : '0%',
      };
    });

    // ── Package distribution (across drives with COMMITTED offers) ────────────
    const packages = drives
      .filter(d => d.package != null)
      .map(d => d.package);
    const packageDistribution = packages.length > 0 ? {
      min_lpa:  Math.min(...packages),
      max_lpa:  Math.max(...packages),
      avg_lpa:  parseFloat((packages.reduce((s, v) => s + v, 0) / packages.length).toFixed(2)),
      count:    packages.length,
    } : null;

    return {
      generated_at:         new Date().toISOString(),
      filters_applied:      { branch: branchFilter || null, drive_id: driveIdFilter || null },
      totals: {
        total_applications:  apps.length,
        total_selected:      totalSelected,
        total_offers_issued: offers.filter(o => o.status === 'COMMITTED').length,
        overall_conversion:  apps.length > 0
          ? `${((totalSelected / apps.length) * 100).toFixed(1)}%`
          : '0%',
      },
      drive_stats:          driveStats,
      branch_stats:         branchStats,
      package_distribution: packageDistribution,
    };
  }
}

module.exports = ReportService;
