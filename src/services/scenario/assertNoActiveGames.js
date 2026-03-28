// src/services/scenario/assertNoActiveGames.js
const db = require('../../models/db');

const ACTIVE_GAME_STATES = ['PREPARATION', 'SIMULATION'];

async function assertNoActiveGames({ scenarioId, scenarioSlug }) {
  const result = await db('game')
    .where({ scenario_id: scenarioId })
    .whereIn('state', ACTIVE_GAME_STATES)
    .count('* as count')
    .first();

  const activeGameCount = Number(result?.count || 0);

  if (activeGameCount > 0) {
    const err = new Error(
      `Cannot import scenario "${scenarioSlug}" while active games exist.`,
    );
    err.code = 'ACTIVE_GAMES_EXIST';
    err.activeGameCount = activeGameCount;
    throw err;
  }
}

module.exports = assertNoActiveGames;
