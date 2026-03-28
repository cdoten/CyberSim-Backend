/**
 * Prevent scenario imports from overwriting static content while active games
 * are still running for that scenario.
 *
 * What it does:
 * - Checks for games in active states for a specific scenario
 * - Throws a structured ACTIVE_GAMES_EXIST error if any are found
 *
 * Important notes:
 * - This uses scenario_id, not slug, because game rows are linked by foreign key.
 * - Assessment-state games are treated as completed and do not block import.
 */

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