// migrations/20260330000200_remaining_tables_composite_pk.js
//
// system, mitigation, response, injection, action, and curveball all use
// Airtable record IDs as single-column primary keys. After multi-scenario
// support was added, loading a second scenario that shares Airtable IDs with
// the first fails with a duplicate-key violation (e.g. "mitigation_pkey").
//
// This is the same root cause as dictionary/location/role (fixed in
// 20260330000000). The fix is the same: upgrade to composite (id, scenario_id)
// PKs so each scenario can have its own copy of a row.
//
// FK handling:
//
// Game runtime tables (game_mitigation, game_system, game_injection, game_log)
// do NOT have scenario_id, so composite FKs from them to these tables cannot
// be expressed. Those FKs are dropped without replacement. Correctness is
// maintained at the application layer:
//   - createGame seeds runtime rows only from the correct scenario's static data
//   - deleteScenarioBySlug blocks deletion if ANY game (even finished) exists
//     for the scenario, so runtime rows can never point to a deleted static row.
//
// Static-to-static FKs (both sides have scenario_id) are upgraded to composite:
//   - response(mitigation_id, scenario_id) → mitigation(id, scenario_id)
//   - injection(followup_injection, scenario_id) → injection(id, scenario_id)
//   - injection_response(injection_id, scenario_id) → injection(id, scenario_id)
//   - injection_response(response_id, scenario_id) → response(id, scenario_id)
//   - action_role(action_id, scenario_id) → action(id, scenario_id)

exports.up = async (knex) => {
  // Phase 1: Drop FK constraints from game runtime tables → static tables.
  // These tables have no scenario_id so composite FKs cannot replace them.
  await knex.schema.alterTable('game_mitigation', (tbl) => {
    tbl.dropForeign('mitigation_id');
  });
  await knex.schema.alterTable('game_system', (tbl) => {
    tbl.dropForeign('system_id');
  });
  await knex.schema.alterTable('game_injection', (tbl) => {
    tbl.dropForeign('injection_id');
  });
  await knex.schema.alterTable('game_log', (tbl) => {
    tbl.dropForeign('mitigation_id');
    tbl.dropForeign('response_id');
    tbl.dropForeign('action_id');
    tbl.dropForeign('curveball_id');
  });

  // Phase 2: Drop static-to-static FKs (will recreate as composite below).
  await knex.schema.alterTable('response', (tbl) => {
    tbl.dropForeign('mitigation_id');
  });
  await knex.schema.alterTable('injection', (tbl) => {
    tbl.dropForeign('followup_injection');
  });
  await knex.schema.alterTable('injection_response', (tbl) => {
    tbl.dropForeign('injection_id');
    tbl.dropForeign('response_id');
  });
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.dropForeign('action_id');
  });

  // Phase 3: Swap single-column PKs to composite (id, scenario_id).
  // Order: leaves first (no intra-group deps), then tables that are referenced.
  await [
    'system',
    'curveball',
    'mitigation',
    'action',
    'response',
    'injection',
  ].reduce(async (prev, table) => {
    await prev;
    await knex.schema.alterTable(table, (tbl) => {
      tbl.dropPrimary();
      tbl.primary(['id', 'scenario_id']);
    });
  }, Promise.resolve());

  // Phase 4: Recreate static-to-static FKs as composite.
  await knex.schema.alterTable('response', (tbl) => {
    tbl
      .foreign(['mitigation_id', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('mitigation');
  });
  await knex.schema.alterTable('injection', (tbl) => {
    tbl
      .foreign(['followup_injection', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('injection');
  });
  await knex.schema.alterTable('injection_response', (tbl) => {
    tbl
      .foreign(['injection_id', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('injection');
    tbl
      .foreign(['response_id', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('response');
  });
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl
      .foreign(['action_id', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('action');
  });
};

exports.down = async (knex) => {
  // Phase 1: Drop composite static-to-static FKs.
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.dropForeign(['action_id', 'scenario_id']);
  });
  await knex.schema.alterTable('injection_response', (tbl) => {
    tbl.dropForeign(['injection_id', 'scenario_id']);
    tbl.dropForeign(['response_id', 'scenario_id']);
  });
  await knex.schema.alterTable('injection', (tbl) => {
    tbl.dropForeign(['followup_injection', 'scenario_id']);
  });
  await knex.schema.alterTable('response', (tbl) => {
    tbl.dropForeign(['mitigation_id', 'scenario_id']);
  });

  // Phase 2: Revert composite PKs to single-column (reverse order).
  await [
    'injection',
    'response',
    'action',
    'mitigation',
    'curveball',
    'system',
  ].reduce(async (prev, table) => {
    await prev;
    await knex.schema.alterTable(table, (tbl) => {
      tbl.dropPrimary();
      tbl.primary(['id']);
    });
  }, Promise.resolve());

  // Phase 3: Restore original single-column static-to-static FKs.
  await knex.schema.alterTable('response', (tbl) => {
    tbl.foreign('mitigation_id').references('id').inTable('mitigation');
  });
  await knex.schema.alterTable('injection', (tbl) => {
    tbl.foreign('followup_injection').references('id').inTable('injection');
  });
  await knex.schema.alterTable('injection_response', (tbl) => {
    tbl.foreign('injection_id').references('id').inTable('injection');
    tbl.foreign('response_id').references('id').inTable('response');
  });
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.foreign('action_id').references('id').inTable('action');
  });

  // Phase 4: Restore game runtime → static FKs.
  await knex.schema.alterTable('game_log', (tbl) => {
    tbl.foreign('mitigation_id').references('id').inTable('mitigation');
    tbl.foreign('response_id').references('id').inTable('response');
    tbl.foreign('action_id').references('id').inTable('action');
    tbl.foreign('curveball_id').references('id').inTable('curveball');
  });
  await knex.schema.alterTable('game_injection', (tbl) => {
    tbl.foreign('injection_id').references('id').inTable('injection');
  });
  await knex.schema.alterTable('game_system', (tbl) => {
    tbl.foreign('system_id').references('id').inTable('system');
  });
  await knex.schema.alterTable('game_mitigation', (tbl) => {
    tbl.foreign('mitigation_id').references('id').inTable('mitigation');
  });
};
