/**
 * SchemaManager — Table definitions, constraint enforcement, and migrations.
 *
 * Defines the 3NF-normalised schema for Team C's placement database:
 *   students, companies, drives, applications,
 *   eligibility_decisions, offers, audit_log, idempotency_keys
 *
 * Constraint types enforced at write time:
 *   NOT_NULL, UNIQUE, FOREIGN_KEY, CHECK, ENUM
 */

const { ValidationError } = require('../../../../../shared/errors');

/** Master schema definition */
const SCHEMA = {
  students: {
    primaryKey: 'student_id',
    columns: {
      student_id:  { type: 'string',  notNull: true },
      name:        { type: 'string',  notNull: true },
      email:       { type: 'string',  notNull: true },
      branch:      { type: 'string',  notNull: true },
      cgpa:        { type: 'number',  notNull: true, check: v => v >= 0 && v <= 10 },
      backlogs:    { type: 'number',  notNull: true, check: v => v >= 0 },
      attendance:  { type: 'number',  notNull: false, check: v => v == null || (v >= 0 && v <= 100) },
      skills:      { type: 'array',   notNull: false },
      created_at:  { type: 'string',  notNull: false },
      updated_at:  { type: 'string',  notNull: false },
    },
    unique: ['email'],
  },

  companies: {
    primaryKey: 'company_id',
    columns: {
      company_id:  { type: 'string', notNull: true },
      name:        { type: 'string', notNull: true },
      industry:    { type: 'string', notNull: false },
      website:     { type: 'string', notNull: false },
      created_at:  { type: 'string', notNull: false },
    },
    unique: ['name'],
  },

  drives: {
    primaryKey: 'drive_id',
    columns: {
      drive_id:      { type: 'string', notNull: true },
      company_id:    { type: 'string', notNull: true },  // FK -> companies
      title:         { type: 'string', notNull: true },
      criteria_json: { type: 'string', notNull: false }, // JSON-encoded criteria
      seats:         { type: 'number', notNull: true, check: v => v > 0 },
      package:       { type: 'number', notNull: false, check: v => v == null || v >= 0 },
      state:         { type: 'string', notNull: true, enum: ['DRAFT','OPEN','SCREENING','CLOSED','CANCELLED'] },
      version:       { type: 'number', notNull: true },
      created_at:    { type: 'string', notNull: false },
      updated_at:    { type: 'string', notNull: false },
    },
    foreignKeys: [{ column: 'company_id', refTable: 'companies', refColumn: 'company_id' }],
  },

  applications: {
    primaryKey: 'application_id',
    columns: {
      application_id:   { type: 'string', notNull: true },
      student_id:       { type: 'string', notNull: true },  // FK -> students
      drive_id:         { type: 'string', notNull: true },  // FK -> drives
      state:            { type: 'string', notNull: true, enum: [
        'APPLIED','SCREENING','RULE_EVALUATED','SHORTLISTED',
        'INTERVIEW_SCHEDULED','SELECTED','OFFER_ISSUED',
        'NOT_ELIGIBLE','WAITLISTED','WITHDRAWN','EXPIRED','COMPENSATION_REQUIRED',
      ]},
      resume_version:   { type: 'string', notNull: false },
      consent:          { type: 'boolean', notNull: true },
      idempotency_key:  { type: 'string', notNull: true },
      version:          { type: 'number', notNull: true },
      created_at:       { type: 'string', notNull: false },
      updated_at:       { type: 'string', notNull: false },
    },
    unique: ['idempotency_key'],
    foreignKeys: [
      { column: 'student_id', refTable: 'students',  refColumn: 'student_id' },
      { column: 'drive_id',   refTable: 'drives',    refColumn: 'drive_id'   },
    ],
  },

  eligibility_decisions: {
    primaryKey: 'decision_id',
    columns: {
      decision_id:      { type: 'string', notNull: true },
      application_id:   { type: 'string', notNull: true },  // FK -> applications
      result:           { type: 'string', notNull: true, enum: ['ELIGIBLE','CONDITIONAL','NOT_ELIGIBLE'] },
      failed_rules:     { type: 'array',  notNull: false },
      rule_set_version: { type: 'string', notNull: false },
      lease_id:         { type: 'string', notNull: false },
      metrics:          { type: 'object', notNull: false },
      created_at:       { type: 'string', notNull: false },
    },
    foreignKeys: [{ column: 'application_id', refTable: 'applications', refColumn: 'application_id' }],
  },

  offers: {
    primaryKey: 'offer_id',
    columns: {
      offer_id:       { type: 'string',  notNull: true },
      application_id: { type: 'string',  notNull: true },  // FK -> applications
      drive_id:       { type: 'string',  notNull: true },  // FK -> drives
      status:         { type: 'string',  notNull: true, enum: ['PENDING','COMMITTED','COMPENSATED'] },
      committed_at:   { type: 'string',  notNull: false },
    },
    foreignKeys: [
      { column: 'application_id', refTable: 'applications', refColumn: 'application_id' },
      { column: 'drive_id',       refTable: 'drives',       refColumn: 'drive_id'       },
    ],
  },

  audit_log: {
    primaryKey: 'audit_id',
    columns: {
      audit_id:       { type: 'string', notNull: true },
      actor:          { type: 'string', notNull: true },
      action:         { type: 'string', notNull: true },
      table_name:     { type: 'string', notNull: true },
      record_id:      { type: 'string', notNull: true },
      before_value:   { type: 'object', notNull: false },
      after_value:    { type: 'object', notNull: false },
      correlation_id: { type: 'string', notNull: false },
      timestamp:      { type: 'string', notNull: true },
    },
  },

  idempotency_keys: {
    primaryKey: 'key',
    columns: {
      key:        { type: 'string', notNull: true },
      response:   { type: 'object', notNull: true },
      created_at: { type: 'string', notNull: false },
      expires_at: { type: 'string', notNull: false },
    },
  },
};

class SchemaManager {
  constructor() {
    this.schema = SCHEMA;
  }

  /** Return the schema definition for a table */
  getTableSchema(tableName) {
    const s = this.schema[tableName];
    if (!s) throw new Error(`SchemaManager: unknown table '${tableName}'`);
    return s;
  }

  /** Return all defined table names */
  getTableNames() {
    return Object.keys(this.schema);
  }

  /**
   * Validate a row against the table schema.
   * Throws ValidationError if constraints are violated.
   * @param {string} tableName
   * @param {object} row
   * @param {boolean} isUpdate - If true, skip NOT_NULL checks for missing fields (partial update)
   */
  validate(tableName, row, isUpdate = false) {
    const tableSchema = this.getTableSchema(tableName);
    const errors = [];

    for (const [colName, colDef] of Object.entries(tableSchema.columns)) {
      const value = row[colName];
      const missing = value === undefined || value === null;

      // NOT NULL check
      if (colDef.notNull && missing && !isUpdate) {
        errors.push({ field: colName, message: `${colName} is required` });
        continue;
      }
      if (missing) continue;

      // Type check
      if (colDef.type === 'array'  && !Array.isArray(value))         errors.push({ field: colName, message: `${colName} must be an array` });
      if (colDef.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) errors.push({ field: colName, message: `${colName} must be an object` });
      if (colDef.type === 'number' && typeof value !== 'number')      errors.push({ field: colName, message: `${colName} must be a number` });
      if (colDef.type === 'string' && typeof value !== 'string')      errors.push({ field: colName, message: `${colName} must be a string` });
      if (colDef.type === 'boolean' && typeof value !== 'boolean')    errors.push({ field: colName, message: `${colName} must be a boolean` });

      // ENUM check
      if (colDef.enum && !colDef.enum.includes(value)) {
        errors.push({ field: colName, message: `${colName} must be one of: ${colDef.enum.join(', ')}` });
      }

      // CHECK constraint
      if (colDef.check && !colDef.check(value)) {
        errors.push({ field: colName, message: `${colName} failed check constraint (value: ${value})` });
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Schema validation failed for '${tableName}'`, errors);
    }
  }

  /**
   * Validate UNIQUE constraints for a row being inserted.
   * @param {string}        tableName
   * @param {object}        row
   * @param {StorageEngine} storage
   */
  validateUnique(tableName, row, storage) {
    const tableSchema = this.getTableSchema(tableName);
    if (!tableSchema.unique) return;
    for (const col of tableSchema.unique) {
      const existing = storage.findRows(tableName, r => r[col] === row[col] && r[tableSchema.primaryKey] !== row[tableSchema.primaryKey]);
      if (existing.length > 0) {
        throw new ValidationError(`UNIQUE constraint violated for ${tableName}.${col}`, [{ field: col, message: `Value '${row[col]}' already exists` }]);
      }
    }
  }

  /**
   * Validate FOREIGN KEY constraints for a row being inserted or updated.
   * @param {string}        tableName
   * @param {object}        row
   * @param {StorageEngine} storage
   */
  validateForeignKeys(tableName, row, storage) {
    const tableSchema = this.getTableSchema(tableName);
    if (!tableSchema.foreignKeys) return;
    for (const fk of tableSchema.foreignKeys) {
      const value = row[fk.column];
      if (value == null) continue; // nullable FK
      const refRow = storage.getRow(fk.refTable, value);
      if (!refRow) {
        throw new ValidationError(`FOREIGN KEY constraint violated: ${tableName}.${fk.column} = '${value}' not found in ${fk.refTable}`, [
          { field: fk.column, message: `Referenced ${fk.refTable} '${value}' does not exist` }
        ]);
      }
    }
  }

  /** Return the primary key field name for a table */
  getPrimaryKey(tableName) {
    return this.getTableSchema(tableName).primaryKey;
  }
}

module.exports = { SchemaManager, SCHEMA };
