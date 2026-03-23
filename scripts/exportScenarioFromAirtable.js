// scripts/exportScenarioFromAirtable.js
//
// Export the CURRENT DB content into a versioned dataset folder under:
//   seeds/datasets/<scenario>/<revision>/data/*.json
//
// Usage:
//   node -r dotenv/config scripts/exportScenarioFromAirtable.js --tag cso@2026-03-03.1
//
// Notes:
// - Run AFTER your Airtable /migrate has populated the DB
// - Uses DB_URL from your environment (likely .env)
// - Writes a manifest.json capturing Airtable base id, git commit, migration, counts

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const db = require('../src/models/db');
const { getAirtableBaseId } = require('../src/util/airtable');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tag') {
      out.tag = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function parseSeedTag(tag) {
  if (!tag || typeof tag !== 'string' || !tag.includes('@')) {
    throw new Error(
      'Missing/invalid --tag. Example: npm run dataset:export -- --tag cso@2026-03-03.1',
    );
  }
  const [scenario, revision] = tag.split('@');
  if (!scenario || !revision) {
    throw new Error(
      `Invalid tag format: "${tag}". Expected "scenario@revision".`,
    );
  }
  return { scenario, revision };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(p, data) {
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function safeGitCommit() {
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

async function latestMigrationId() {
  // knex stores applied migrations in knex_migrations table
  // column name is usually "name"
  try {
    const row = await db('knex_migrations')
      .select('name')
      .orderBy('id', 'desc')
      .first();
    return row?.name || null;
  } catch {
    return null;
  }
}

function normalizeRow(row) {
  const out = { ...row };

  // Strip scenario_id — it is an internal DB integer that is meaningless
  // outside the source database. The dataset seed re-creates it on import.
  delete out.scenario_id;

  // Knex/pg sometimes returns numeric as string. Normalize the few known ones.
  if (out.poll_change != null) out.poll_change = Number(out.poll_change);
  if (out.poll_increase != null) out.poll_increase = Number(out.poll_increase);

  return out;
}

async function exportTable(tableName, orderBy = 'id') {
  const rows = await db(tableName).select('*').orderBy(orderBy);
  return rows.map(normalizeRow);
}

(async () => {
  const args = parseArgs(process.argv);
  const { scenario, revision } = parseSeedTag(args.tag);

  const rootDir = path.join(__dirname, '..');
  const datasetDir = path.join(
    rootDir,
    'seeds',
    'datasets',
    scenario,
    revision,
  );
  const dataDir = path.join(datasetDir, 'data');

  ensureDir(dataDir);

  try {
    // Export static content tables
    const system = await exportTable('system', 'id');
    const role = await exportTable('role', 'id');
    const mitigation = await exportTable('mitigation', 'id');
    const response = await exportTable('response', 'id');
    const injection = await exportTable('injection', 'id');
    const action = await exportTable('action', 'id');
    const curveball = await exportTable('curveball', 'id');

    // Optional dictionary table
    let dictionary = null;
    const hasDictionary = await db.schema.hasTable('dictionary');
    if (hasDictionary) {
      dictionary = await exportTable('dictionary', 'id');
    }

    // Join tables usually have integer id PK
    const actionRole = await exportTable('action_role', 'id');
    const injectionResponse = await exportTable('injection_response', 'id');

    // Write JSON files
    writeJson(path.join(dataDir, 'system.json'), system);
    writeJson(path.join(dataDir, 'role.json'), role);
    writeJson(path.join(dataDir, 'mitigation.json'), mitigation);
    writeJson(path.join(dataDir, 'response.json'), response);
    writeJson(path.join(dataDir, 'injection.json'), injection);
    writeJson(path.join(dataDir, 'action.json'), action);
    writeJson(path.join(dataDir, 'curveball.json'), curveball);
    writeJson(path.join(dataDir, 'action_role.json'), actionRole);
    writeJson(path.join(dataDir, 'injection_response.json'), injectionResponse);

    if (dictionary) {
      writeJson(path.join(dataDir, 'dictionary.json'), dictionary);
    }

    // Look up the scenario name from the DB to include in the manifest.
    // The dataset seed uses this to create the scenario row on import.
    const scenarioRow = await db('scenario').where({ slug: scenario }).first();

    // Manifest
    const manifest = {
      tag: args.tag,
      scenario,
      revision,
      name: scenarioRow?.name || scenario,
      exported_at: new Date().toISOString(),
      airtable: {
        base_id: (() => {
          try {
            return getAirtableBaseId(scenario);
          } catch (_) {
            return null;
          }
        })(),
      },
      db: {
        latest_migration: await latestMigrationId(),
      },
      git: {
        commit: safeGitCommit(),
      },
      counts: {
        system: system.length,
        role: role.length,
        mitigation: mitigation.length,
        response: response.length,
        injection: injection.length,
        action: action.length,
        curveball: curveball.length,
        action_role: actionRole.length,
        injection_response: injectionResponse.length,
        ...(dictionary ? { dictionary: dictionary.length } : {}),
      },
    };

    writeJson(path.join(datasetDir, 'manifest.json'), manifest);

    // eslint-disable-next-line no-console
    console.log(`Exported dataset: ${args.tag}`);
    // eslint-disable-next-line no-console
    console.log(`Wrote: ${datasetDir}`);
  } finally {
    await db.destroy();
  }
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
