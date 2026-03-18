const db = require('../src/models/db');

module.exports = async () => {
  // Join tables / children first
  await db('injection_response').del();
  await db('action_role').del();

  // Game child tables
  await db('game_injection').del();
  await db('game_system').del();
  await db('game_mitigation').del();
  await db('game_log').del();
  await db('dictionary').del();

  // Game parent
  await db('game').del();

  // Content tables (parents after their join tables)
  await db('response').del();
  await db('injection').del();

  await db('action').del();
  await db('role').del();

  await db('mitigation').del();
  await db('system').del();
  await db('curveball').del();
  await db('location').del();

  // scenario is the root parent — truncate last.
  // RESTART IDENTITY resets the auto-increment sequence to 1, so that
  // seedTestData always produces scenario.id = 1. Without this, the sequence
  // would keep incrementing (DELETE does not reset sequences in PostgreSQL),
  // and dummyGame.scenario_id = 1 in testData.js would fail FK validation.
  // CASCADE is required because other tables FK-reference scenario.
  // Since we already deleted all child rows above, CASCADE only truncates
  // already-empty tables — no data loss risk. RESTART IDENTITY resets the
  // sequence so seedTestData always produces scenario.id = 1.
  await db.raw('TRUNCATE TABLE scenario RESTART IDENTITY CASCADE');
};
