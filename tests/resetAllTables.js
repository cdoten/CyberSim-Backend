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
};