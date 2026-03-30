/**
 * Replace all static content for a single scenario inside an existing database
 * transaction.
 *
 * What it does:
 * - Deletes existing static rows for one scenario in foreign-key-safe order
 * - Reinserts the supplied validated rows for that scenario
 * - Handles injection.followup_injection in a two-pass insert/update flow
 *
 * Important notes:
 * - This function only replaces static scenario content. It does not touch
 *   runtime game tables.
 * - Callers are responsible for validating rows and blocking imports when
 *   active games exist.
 * - This function must be called inside an open transaction.
 */
async function replaceScenarioContent({
  trx,
  scenarioId,
  locations = [],
  dictionary = [],
  injections = [],
  mitigations = [],
  responses = [],
  systems = [],
  roles = [],
  actions = [],
  curveballs = [],
  injectionResponse = [],
  actionRole = [],
}) {
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

  if (locations.length) await trx('location').insert(locations);
  if (dictionary.length) await trx('dictionary').insert(dictionary);
  if (mitigations.length) await trx('mitigation').insert(mitigations);
  if (responses.length) await trx('response').insert(responses);
  if (systems.length) await trx('system').insert(systems);
  if (roles.length) await trx('role').insert(roles);

  if (injections.length) {
    const withoutFollowups = injections.map((row) => ({
      ...row,
      followup_injection: null,
    }));

    await trx('injection').insert(withoutFollowups);

    const followups = injections
      .filter((row) => row.followup_injection)
      .map((row) => ({
        id: row.id,
        followup_injection: row.followup_injection,
      }));

    const followupUpdates = followups.map((row) =>
      trx('injection')
        .where({ id: row.id, scenario_id: scenarioId })
        .update({ followup_injection: row.followup_injection }),
    );

    await Promise.all(followupUpdates);
  }

  if (actions.length) await trx('action').insert(actions);
  if (curveballs.length) await trx('curveball').insert(curveballs);
  if (injectionResponse.length) {
    // Strip auto-increment id — let Postgres assign fresh IDs so rows from
    // different scenarios don't collide in the shared id sequence.
    await trx('injection_response').insert(
      injectionResponse.map(({ id: _id, ...rest }) => rest),
    );
  }
  if (actionRole.length) {
    await trx('action_role').insert(
      actionRole.map(({ id: _id, ...rest }) => rest),
    );
  }
}

module.exports = replaceScenarioContent;
