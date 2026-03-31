// migrations/20260330000100_scenario_revision_column.js
//
// Add a `revision` column to the `scenario` table so the admin dashboard
// can display which revision is currently loaded for each scenario.

exports.up = async (knex) => {
  await knex.schema.alterTable('scenario', (tbl) => {
    tbl.string('revision').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('scenario', (tbl) => {
    tbl.dropColumn('revision');
  });
};
