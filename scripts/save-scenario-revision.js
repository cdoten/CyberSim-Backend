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

(async () => {
  try {
    const args = parseArgs(process.argv);
    const { scenarioSlug, scenarioRevision } = parseScenarioTag(args.tag);

    const result = await saveScenarioRevision({
      scenarioSlug,
      scenarioRevision,
    });

    console.log(
      `Saved scenario revision: ${result.scenarioSlug}@${result.scenarioRevision}`,
    );
    console.log(`Wrote: ${result.outputDir}`);
  } finally {
    await db.destroy();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});