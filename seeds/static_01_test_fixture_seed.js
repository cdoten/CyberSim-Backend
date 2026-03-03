// seeds/static_01_test_fixture_seed.js
//
// This seed loads the same deterministic fixture data used by Jest,
// so devs can run `npm run reset-db` without Airtable and without v0 drift.

const seedTestData = require('../tests/seedTestData');

exports.seed = async (knex) => {
  await seedTestData(knex);
};
