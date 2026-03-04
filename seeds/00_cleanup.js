exports.seed = async (knex) => {
  // Child/join tables first
  await knex('injection_response').del();
  await knex('action_role').del();

  // Then parent tables
  await knex('injection').del();
  await knex('response').del();
  await knex('mitigation').del();
  await knex('curveball').del();
  await knex('system').del();
  await knex('action').del();
  await knex('role').del();

  // Optional: if you have dictionary/location tables seeded elsewhere,
  // add them here too.
};
