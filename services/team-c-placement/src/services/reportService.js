/**
 * ReportService — Generates placement performance and cohort analytics (C4).
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
   * @param {object} filters (optional) branch, drive_id, etc.
   */
  async generatePlacementPerformanceReport(filters = {}) {
    const drives = this.db.table('drives').all();
    const apps   = this.db.table('applications').all();
    const offers = this.db.table('offers').all();

    // Basic aggregations
    let totalApplications = apps.length;
    let totalOffers       = offers.length;
    let driveStats = drives.map(d => {
      const driveApps = apps.filter(a => a.drive_id === d.drive_id);
      const driveOffers = offers.filter(o => o.drive_id === d.drive_id);
      return {
        drive_id: d.drive_id,
        title: d.title,
        company_id: d.company_id,
        applications: driveApps.length,
        offers_issued: driveOffers.length,
        seats_remaining: d.seats
      };
    });

    return {
      total_applications: totalApplications,
      total_offers: totalOffers,
      drive_stats: driveStats,
      generated_at: new Date().toISOString()
    };
  }
}

module.exports = ReportService;
