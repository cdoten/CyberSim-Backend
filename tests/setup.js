// tests/setup.js
require('dotenv/config');

if (!process.env.DB_URL || !process.env.DB_URL.includes('cybersim_test')) {
  throw new Error(
    `Refusing to run tests against non-test DB_URL: ${process.env.DB_URL}`,
  );
}

const db = require('../src/models/db');
const resetAllTables = require('./resetAllTables');
const seedTestData = require('./seedTestData');

module.exports = async () => {
  await db.migrate.rollback({}, true);
  await db.migrate.latest();

  await resetAllTables();
  await seedTestData(db);

  await db.destroy();
};
