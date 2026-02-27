exports.up = async function up(knex) {
  await knex.schema.alterTable('injection', (t) => {
    t.text('skipper_mitigation_type');
  });

  await knex.schema.alterTable('mitigation', (t) => {
    t.integer('hq_cost');
    t.integer('local_cost');
    t.boolean('is_hq').notNullable().defaultTo(false);
    t.boolean('is_local').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('response', (t) => {
    t.text('location');
    t.text('mitigation_type');
    t.text('required_mitigation_type');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('response', (t) => {
    t.dropColumn('required_mitigation_type');
    t.dropColumn('mitigation_type');
    t.dropColumn('location');
  });

  await knex.schema.alterTable('mitigation', (t) => {
    t.dropColumn('is_local');
    t.dropColumn('is_hq');
    t.dropColumn('local_cost');
    t.dropColumn('hq_cost');
  });

  await knex.schema.alterTable('injection', (t) => {
    t.dropColumn('skipper_mitigation_type');
  });
};
