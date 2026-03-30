// migrations/20260330000000_scenario_tables_composite_pk.js
//
// dictionary, location, and role use Airtable record IDs as their primary key.
// After multi-scenario support was added, two scenarios can share entries
// with the same Airtable IDs (e.g. shared reference tables in Airtable).
// Change their PKs to (id, scenario_id) so each scenario can have its own copy.
//
// dictionary and location: no FK references from other tables — simple PK swap.
//
// role: referenced by action_role.role_id. action_role already has scenario_id,
// so we can upgrade that FK to reference the composite PK (role_id, scenario_id).

exports.up = async (knex) => {
  // Simple PK swap — no FK references to update
  await ['dictionary', 'location'].reduce(async (prev, table) => {
    await prev;
    await knex.schema.alterTable(table, (tbl) => {
      tbl.dropPrimary();
      tbl.primary(['id', 'scenario_id']);
    });
  }, Promise.resolve());

  // role: drop old single-column FK on action_role, swap role PK, add composite FK
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.dropForeign('role_id');
  });
  await knex.schema.alterTable('role', (tbl) => {
    tbl.dropPrimary();
    tbl.primary(['id', 'scenario_id']);
  });
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl
      .foreign(['role_id', 'scenario_id'])
      .references(['id', 'scenario_id'])
      .inTable('role');
  });
};

exports.down = async (knex) => {
  // Reverse role changes
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.dropForeign(['role_id', 'scenario_id']);
  });
  await knex.schema.alterTable('role', (tbl) => {
    tbl.dropPrimary();
    tbl.primary(['id']);
  });
  await knex.schema.alterTable('action_role', (tbl) => {
    tbl.foreign('role_id').references('id').inTable('role');
  });

  // Reverse dictionary and location
  await ['dictionary', 'location'].reduce(async (prev, table) => {
    await prev;
    await knex.schema.alterTable(table, (tbl) => {
      tbl.dropPrimary();
      tbl.primary(['id']);
    });
  }, Promise.resolve());
};
