const db = require('./db');

// Look up a scenario by its URL slug (e.g. 'cso', 'campaign').
// Throws a descriptive error if the slug doesn't exist, so callers
// get a clear message rather than a null-reference error later.
const getScenarioBySlug = async (slug) => {
  const scenario = await db('scenario').where({ slug }).first();
  if (!scenario) {
    const err = new Error(`Scenario not found: "${slug}"`);
    err.statusCode = 404;
    err.code = 'SCENARIO_NOT_FOUND';
    throw err;
  }
  return scenario;
};

// Return all scenarios with per-scenario content counts and active game count.
const listScenariosWithCounts = async () => {
  const scenarios = await db('scenario').select('*').orderBy('slug');

  return Promise.all(
    scenarios.map(async (scenario) => {
      const { id, slug, name, revision } = scenario;

      const [
        systemCount,
        injectionCount,
        mitigationCount,
        responseCount,
        actionCount,
        roleCount,
        curveballCount,
        activeGameCount,
      ] = await Promise.all([
        db('system').where({ scenario_id: id }).count('id as c').first(),
        db('injection').where({ scenario_id: id }).count('id as c').first(),
        db('mitigation').where({ scenario_id: id }).count('id as c').first(),
        db('response').where({ scenario_id: id }).count('id as c').first(),
        db('action').where({ scenario_id: id }).count('id as c').first(),
        db('role').where({ scenario_id: id }).count('id as c').first(),
        db('curveball').where({ scenario_id: id }).count('id as c').first(),
        db('game')
          .where({ scenario_id: id })
          .whereIn('state', ['PREPARATION', 'SIMULATION'])
          .count('id as c')
          .first(),
      ]);

      return {
        id,
        slug,
        name,
        revision: revision || null,
        counts: {
          systems: Number(systemCount.c),
          injections: Number(injectionCount.c),
          mitigations: Number(mitigationCount.c),
          responses: Number(responseCount.c),
          actions: Number(actionCount.c),
          roles: Number(roleCount.c),
          curveballs: Number(curveballCount.c),
        },
        activeGames: Number(activeGameCount.c),
      };
    }),
  );
};

// Delete a scenario and all its static content from the DB.
// Blocked if any PREPARATION/SIMULATION games exist for this scenario.
// Disk seed files are never touched — the revision can be reloaded at any time.
const deleteScenarioBySlug = async (slug) => {
  const scenario = await db('scenario').where({ slug }).first();
  if (!scenario) {
    const err = new Error(`Scenario not found: "${slug}"`);
    err.statusCode = 404;
    err.code = 'SCENARIO_NOT_FOUND';
    throw err;
  }

  const { id: scenarioId } = scenario;

  const activeCount = await db('game')
    .where({ scenario_id: scenarioId })
    .whereIn('state', ['PREPARATION', 'SIMULATION'])
    .count('id as c')
    .first();

  if (Number(activeCount.c) > 0) {
    const err = new Error(
      `Cannot delete scenario "${slug}" while ${activeCount.c} active game(s) exist.`,
    );
    err.statusCode = 409;
    err.code = 'ACTIVE_GAMES_EXIST';
    err.activeGames = Number(activeCount.c);
    throw err;
  }

  const historicalCount = await db('game')
    .where({ scenario_id: scenarioId })
    .count('id as c')
    .first();

  if (Number(historicalCount.c) > 0) {
    const err = new Error(
      `Cannot delete scenario "${slug}" while ${historicalCount.c} historical game(s) exist. Delete the games first via the admin dashboard.`,
    );
    err.statusCode = 409;
    err.code = 'HISTORICAL_GAMES_EXIST';
    err.gameCount = Number(historicalCount.c);
    throw err;
  }

  await db.transaction(async (trx) => {
    // Delete static content in FK-safe order (mirrors replaceScenarioContent)
    await trx('action_role').where({ scenario_id: scenarioId }).delete();
    await trx('injection_response').where({ scenario_id: scenarioId }).delete();
    await trx('curveball').where({ scenario_id: scenarioId }).delete();
    await trx('action').where({ scenario_id: scenarioId }).delete();
    await trx('injection')
      .where({ scenario_id: scenarioId })
      .update({ followup_injection: null });
    await trx('injection').where({ scenario_id: scenarioId }).delete();
    await trx('response').where({ scenario_id: scenarioId }).delete();
    await trx('mitigation').where({ scenario_id: scenarioId }).delete();
    await trx('role').where({ scenario_id: scenarioId }).delete();
    await trx('dictionary').where({ scenario_id: scenarioId }).delete();
    await trx('location').where({ scenario_id: scenarioId }).delete();
    await trx('system').where({ scenario_id: scenarioId }).delete();
    await trx('scenario').where({ id: scenarioId }).delete();
  });

  return { deleted: true, slug };
};

module.exports = {
  getScenarioBySlug,
  listScenariosWithCounts,
  deleteScenarioBySlug,
};
