// migrations/20260313000200_add_scenario_id_nullable.js
//
// Migration 2 of 4: Multi-scenario support
//
// Adds a nullable `scenario_id` column to all static content tables and the
// game table. No foreign key or NOT NULL constraint yet — those come after the
// backfill in Migration 3.
//
// Static content tables: the scenario a row of game data belongs to.
// Join tables (injection_response, action_role): denormalized for simpler
//   per-scenario cleanup on import (DELETE WHERE scenario_id = ?).
// game: every game instance belongs to exactly one scenario.

const STATIC_TABLES = [
  'system',
  'mitigation',
  'injection',
  'response',
  'action',
  'curveball',
  'location',
  'dictionary',
  'role',
];

const JOIN_TABLES = ['injection_response', 'action_role'];

const ALL_TABLES = [...STATIC_TABLES, ...JOIN_TABLES, 'game'];

exports.up = async (knex) => {
  await ALL_TABLES.reduce(async (prev, table) => {
    await prev;
    const hasColumn = await knex.schema.hasColumn(table, 'scenario_id');
    if (!hasColumn) {
      await knex.schema.alterTable(table, (tbl) => {
        tbl.integer('scenario_id').nullable();
        tbl.index('scenario_id', `idx_${table}_scenario_id`);
      });
    }
  }, Promise.resolve());
};

exports.down = async (knex) => {
  await ALL_TABLES.reduce(async (prev, table) => {
    await prev;
    const hasColumn = await knex.schema.hasColumn(table, 'scenario_id');
    if (hasColumn) {
      await knex.schema.alterTable(table, (tbl) => {
        tbl.dropIndex('scenario_id', `idx_${table}_scenario_id`);
        tbl.dropColumn('scenario_id');
      });
    }
  }, Promise.resolve());
};
