// migrations/20260313000100_create_scenario_table.js
//
// Migration 1 of 4: Multi-scenario support
//
// Creates the `scenario` table, which becomes the parent for all static
// scenario content (injections, mitigations, systems, etc.).
//
// A single seed row is inserted here for the existing 'cso' scenario so
// that subsequent migrations can use it as the backfill target.

exports.up = async (knex) => {
  await knex.schema.createTable('scenario', (tbl) => {
    tbl.increments('id').primary();

    // slug is the URL-safe identifier used in API routes: /scenarios/cso/...
    // and detected from the frontend hostname: cso.cybersim.app -> 'cso'
    tbl.string('slug').notNullable().unique();

    tbl.string('name').notNullable();
    tbl.text('description');

    // Allows hiding a scenario from the UI without deleting its data.
    // Not used in Phase 1 logic, but cheap to add now.
    tbl.boolean('is_active').notNullable().defaultTo(true);

    tbl.timestamps(true, true); // adds created_at and updated_at
  });

  // Seed the one scenario that exists today.
  // All existing static data will be backfilled to this row in Migration 3.
  await knex('scenario').insert({
    slug: 'cso',
    name: 'CSO Scenario',
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('scenario');
};
