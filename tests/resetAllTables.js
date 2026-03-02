const db = require('../src/models/db');

module.exports = async () => {
  // clear in dependency order (children first)
  await db('injection_response').del();
  await db('game_injection').del();
  await db('game_system').del();
  await db('game_mitigation').del();
  await db('game_log').del();
  await db('game').del();

  await db('response').del();
  await db('injection').del();
  await db('mitigation').del();
  await db('system').del();
  await db('role').del();
  await db('action_role').del();
  await db('action').del();
  await db('curveball').del();
  // plus anything else you seed
};