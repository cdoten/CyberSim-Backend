// migrations/20260313000300_backfill_scenario_id.js
//
// Migration 3 of 4: Multi-scenario support
//
// Backfills scenario_id = (id of 'cso' scenario) on all existing rows.
// All data that exists today was imported for the CSO scenario, so this
// is semantically correct.

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

const JOIN_TABLES = [
  'injection_response',
  'action_role',
];

const ALL_TABLES = [...STATIC_TABLES, ...JOIN_TABLES, 'game'];

exports.up = async (knex) => {
  const scenario = await knex('scenario').where({ slug: 'cso' }).first();

  if (!scenario) {
    throw new Error(
      'Backfill failed: could not find scenario with slug "cso". ' +
      'Ensure migration 20260313000100 ran successfully.',
    );
  }

  for (const table of ALL_TABLES) {
    const tableExists = await knex.schema.hasTable(table);
    if (!tableExists) continue;

    await knex(table)
      .whereNull('scenario_id')
      .update({ scenario_id: scenario.id });
  }
};

// Rolling back this migration re-nullifies all scenario_id values, returning
// the database to the same state as after Migration 2 ran.
exports.down = async (knex) => {
  for (const table of ALL_TABLES) {
    const tableExists = await knex.schema.hasTable(table);
    if (!tableExists) continue;

    await knex(table).update({ scenario_id: null });
  }
};
