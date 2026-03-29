/**
 * CLI wrapper for loading a versioned scenario revision from disk into the
 * database.
 *
 * What it does:
 * - Accepts a scenario revision tag in the form "scenario@revision"
 * - Calls the scenario load service to import the selected scenario's static
 *   content from `seeds/scenarios/<scenario>/<revision>/`
 * - Prints row counts on success
 *
 * Important notes:
 * - This is a thin command-line entrypoint only. The real load logic lives in
 *   `src/services/scenario/loadScenarioRevision.js`.
 * - `--tag` takes precedence over `SCENARIO_TAG` if both are provided.
 * - Only the target scenario's data is replaced; other scenarios are untouched.
 * - The script always destroys the shared Knex connection before exit.
 */

const db = require('../src/models/db');
const {
  loadScenarioRevision,
} = require('../src/services/scenario/loadScenarioRevision');
const {
  parseScenarioTag,
} = require('../src/services/scenario/saveScenarioRevision');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tag') {
      out.tag = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main(argv = process.argv) {
  try {
    const args = parseArgs(argv);
    const scenarioTag = args.tag || process.env.SCENARIO_TAG;
    const { scenarioSlug, scenarioRevision } = parseScenarioTag(scenarioTag);

    const result = await loadScenarioRevision({
      scenarioSlug,
      scenarioRevision,
    });

    // eslint-disable-next-line no-console
    console.log(
      `Loaded scenario revision: ${result.scenarioSlug}@${result.scenarioRevision}`,
    );
    // eslint-disable-next-line no-console
    console.log('Row counts:', result.counts);
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
