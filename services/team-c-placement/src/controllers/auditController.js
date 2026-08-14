const { sendSuccess } = require('../../../../shared/response');

class AuditController {
  constructor(auditService) {
    this.auditService = auditService;
  }

  // GET /api/v1/audit
  query = async (req, res, next) => {
    try {
      const { correlation_id, record_id, table_name, actor, from_date, to_date, limit, offset } = req.query;

      const result = await this.auditService.query({
        correlationId: correlation_id,
        recordId: record_id,
        tableName: table_name,
        actor,
        fromDate: from_date,
        toDate: to_date,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0
      });

      sendSuccess(res, result, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuditController;
