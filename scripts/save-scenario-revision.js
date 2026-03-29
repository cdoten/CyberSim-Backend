/**
 * CLI wrapper for saving the current database-backed scenario content as a
 * versioned scenario revision on disk.
 *
 * What it does:
 * - Accepts a scenario revision tag in the form "scenario@revision"
 * - Calls the scenario save service to export the selected scenario's static
 *   content into `seeds/scenarios/<scenario>/<revision>/`
 * - Prints the output location on success
 *
 * Important notes:
 * - This is a thin command-line entrypoint only. The real save logic lives in
 *   `src/services/scenario/saveScenarioRevision.js`.
 * - `--tag` takes precedence over `SCENARIO_TAG` if both are provided.
 * - The script always destroys the shared Knex connection before exit.
 */

const db = require('../src/models/db');
const {
  saveScenarioRevision,
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

    const result = await saveScenarioRevision({
      scenarioSlug,
      scenarioRevision,
    });

    // eslint-disable-next-line no-console
    console.log(
      `Saved scenario revision: ${result.scenarioSlug}@${result.scenarioRevision}`,
    );
    // eslint-disable-next-line no-console
    console.log(`Wrote: ${result.outputDir}`);
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
