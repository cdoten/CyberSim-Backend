// migrations/20260319000100_text_columns_for_long_fields.js
//
// Several static-content columns were defined as string (varchar(255)) but
// hold free-text content from Airtable that can exceed 255 characters.
// Postgres raises "value too long for type character varying(255)" on import
// when that happens. Changing them to text (unlimited length) fixes this.
//
// Affected columns:
//   injection   — description, title, recommendations
//   response    — description
//   mitigation  — description
//   action      — description
//   curveball   — description
//   game_log    — description

const STATIC_COLUMNS = [
  { table: 'injection', columns: ['description', 'title', 'recommendations'] },
  { table: 'response', columns: ['description'] },
  { table: 'mitigation', columns: ['description'] },
  { table: 'action', columns: ['description'] },
  { table: 'curveball', columns: ['description'] },
];

const RUNTIME_COLUMNS = [{ table: 'game_log', columns: ['description'] }];

const ALL_CHANGES = [...STATIC_COLUMNS, ...RUNTIME_COLUMNS];

exports.up = async (knex) => {
  await ALL_CHANGES.reduce(
    (chain, { table, columns }) =>
      chain.then(() =>
        knex.schema.alterTable(table, (tbl) => {
          columns.forEach((col) => tbl.text(col).alter());
        }),
      ),
    Promise.resolve(),
  );
};

exports.down = async (knex) => {
  await ALL_CHANGES.reduce(
    (chain, { table, columns }) =>
      chain.then(() =>
        knex.schema.alterTable(table, (tbl) => {
          columns.forEach((col) => tbl.string(col).alter());
        }),
      ),
    Promise.resolve(),
  );
};
