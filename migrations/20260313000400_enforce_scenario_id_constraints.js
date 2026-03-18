// migrations/20260313000400_enforce_scenario_id_constraints.js
//
// Migration 4 of 4: Multi-scenario support
//
// Now that all rows are backfilled, we can safely enforce:
//   - NOT NULL on scenario_id
//   - Foreign key references to scenario.id
//
// Foreign key behavior:
//   - Static tables: ON DELETE RESTRICT — prevent deleting a scenario while
//     static content rows reference it. Cleanup must be done explicitly in
//     the import code before removing a scenario.
//   - game: ON DELETE RESTRICT — never implicitly destroy game history.
//   - Join tables: ON DELETE CASCADE is fine because they're derived from
//     their parent injection/action rows anyway.

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

exports.up = async (knex) => {
  // Enforce NOT NULL + FK on static content tables
  for (const table of STATIC_TABLES) {
    await knex.schema.alterTable(table, (tbl) => {
      tbl.integer('scenario_id').notNullable().alter();
      tbl
        .foreign('scenario_id')
        .references('id')
        .inTable('scenario')
        .onDelete('RESTRICT');
    });
  }

  // Join tables get CASCADE — their rows exist only to connect parent rows
  for (const table of JOIN_TABLES) {
    await knex.schema.alterTable(table, (tbl) => {
      tbl.integer('scenario_id').notNullable().alter();
      tbl
        .foreign('scenario_id')
        .references('id')
        .inTable('scenario')
        .onDelete('CASCADE');
    });
  }

  // game table: RESTRICT — preserve game history even if a scenario is retired
  await knex.schema.alterTable('game', (tbl) => {
    tbl.integer('scenario_id').notNullable().alter();
    tbl
      .foreign('scenario_id')
      .references('id')
      .inTable('scenario')
      .onDelete('RESTRICT');
  });
};

exports.down = async (knex) => {
  const allTables = [...STATIC_TABLES, ...JOIN_TABLES, 'game'];

  for (const table of allTables) {
    await knex.schema.alterTable(table, (tbl) => {
      // Drop the FK constraint (Knex generates the name as tablename_columnname_foreign)
      tbl.dropForeign('scenario_id');
      tbl.integer('scenario_id').nullable().alter();
    });
  }
};
