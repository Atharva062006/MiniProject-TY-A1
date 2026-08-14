/**
 * Migrations — Schema versioning for the custom DBMS.
 *
 * Each migration is a named function that receives the Database instance
 * and performs structural changes (e.g., creating tables, adding columns).
 *
 * The migration state is persisted in data/schema_version.json.
 */

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    description: 'Create all core tables',
    up: async (db) => {
      const tables = [
        'students', 'companies', 'drives', 'applications',
        'eligibility_decisions', 'offers', 'audit_log', 'idempotency_keys',
      ];
      for (const table of tables) {
        db.storage.createTableIfNotExists(table);
      }
      console.log('[Migration v1] All tables created.');
    },
  },
  // Future migrations:
  // {
  //   version: 2,
  //   name: 'add_ranking_id_to_applications',
  //   up: async (db) => { ... }
  // },
];

module.exports = { migrations };
