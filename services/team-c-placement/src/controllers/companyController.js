const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError } = require('../../../../shared/errors');
const { v4: uuidv4 } = require('uuid');

class CompanyController {
  constructor(db) {
    this.db = db;
  }

  // POST /api/v1/companies
  create = async (req, res, next) => {
    try {
      const companyId = uuidv4();
      const company = {
        company_id: companyId,
        ...req.body,
        created_at: new Date().toISOString(),
      };
      const created = await this.db.table('companies').insert(company);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/companies
  list = (req, res, next) => {
    try {
      const companies = this.db.table('companies').all();
      sendSuccess(res, companies, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/companies/:companyId
  get = (req, res, next) => {
    try {
      const { companyId } = req.params;
      const company = this.db.table('companies').findById(companyId);
      if (!company) throw new NotFoundError('Company', companyId);
      sendSuccess(res, company, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = CompanyController;
