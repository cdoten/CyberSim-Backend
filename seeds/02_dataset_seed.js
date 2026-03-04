// seeds/02_dataset_seed.js
//
// Loads a versioned dataset from:
//   seeds/datasets/<scenario>/<revision>/data/*.json
//
// Choose dataset via env var:
//   SEED_TAG="scenario@revision"  (e.g., "cso@2026-03-03.1")

const fs = require('fs');
const path = require('path');

function formatBullets(items) {
  if (!items || items.length === 0) return '  (none found)';
  return items.map((x) => `  - ${x}`).join('\n');
}

function parseSeedTag(tag) {
  if (!tag || typeof tag !== 'string' || !tag.includes('@')) {
    throw new Error(
      'SEED_TAG must be set to "scenario@revision" (e.g., SEED_TAG="cso@2026-03-03.1")',
    );
  }

  const [scenario, revision] = tag.split('@');

  if (!scenario || !revision) {
    throw new Error(
      `Invalid SEED_TAG format: "${tag}". Expected "scenario@revision".`,
    );
  }

  return { scenario, revision };
}

function listDirs(absDir) {
  try {
    return fs
      .readdirSync(absDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function readJson(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  return JSON.parse(raw);
}

function loadDatasetJson(datasetDir, filename) {
  const absPath = path.join(datasetDir, 'data', filename);
  if (!fs.existsSync(absPath)) return null;
  return readJson(absPath);
}

function verifyManifestMatchesTag({ scenario, revision }, manifest) {
  const mScenario = manifest?.scenario;
  const mRevision = manifest?.revision;

  if (mScenario !== scenario || mRevision !== revision) {
    throw new Error(
      [
        'Dataset manifest mismatch.',
        `- SEED_TAG:  ${scenario}@${revision}`,
        `- Manifest:  ${mScenario}@${mRevision}`,
        '',
        'The dataset folder does not match its manifest.',
        'This usually means the dataset was copied or renamed incorrectly.',
      ].join('\n'),
    );
  }
}

async function getDbLatestMigration(knex) {
  const row = await knex('knex_migrations')
    .select('name')
    .orderBy('id', 'desc')
    .first();
  return row?.name || null;
}

async function verifyMigrationMatches(knex, manifest) {
  const dbLatest = await getDbLatestMigration(knex);
  const datasetLatest = manifest?.db?.latest_migration || null;

  // If either is missing, don't block seeding.
  if (!dbLatest || !datasetLatest) return;

  if (dbLatest !== datasetLatest) {
    throw new Error(
      [
        'Dataset migration mismatch.',
        `- DB latest migration:       ${dbLatest}`,
        `- Dataset expects migration: ${datasetLatest}`,
        '',
        'Fix:',
        '1) Run `npm run reset-db:dataset` (rebuild schema), OR',
        '2) Re-export the dataset under the current schema.',
      ].join('\n'),
    );
  }
}

exports.seed = async (knex) => {
  // Only run dataset seeding when explicitly requested.
  if (!process.env.SEED_TAG) {
    return;
  }

  const { scenario, revision } = parseSeedTag(process.env.SEED_TAG);

  // This file lives in `seeds/`, so datasets are in `seeds/datasets/...`
  const datasetsRoot = path.join(__dirname, 'datasets');
  const datasetDir = path.join(datasetsRoot, scenario, revision);
  const manifestPath = path.join(datasetDir, 'manifest.json');

  if (!fs.existsSync(datasetDir)) {
    const scenarios = listDirs(datasetsRoot);
    const revisions = listDirs(path.join(datasetsRoot, scenario));

    throw new Error(
      [
        'Dataset not found for SEED_TAG.',
        `- SEED_TAG: ${scenario}@${revision}`,
        `- Expected folder: ${datasetDir}`,
        '',
        'Available scenarios under seeds/datasets:',
        formatBullets(scenarios),
        '',
        `Available revisions for scenario "${scenario}" (if it exists):`,
        formatBullets(revisions),
        '',
        'Fix:',
        '1) Choose one of the available scenario@revision tags above, OR',
        '2) Export a dataset:',
        `   npm run dataset:export -- --tag ${scenario}@${revision}`,
      ].join('\n'),
    );
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      [
        'Dataset manifest.json not found.',
        `- SEED_TAG: ${scenario}@${revision}`,
        `- Expected: ${manifestPath}`,
        '',
        'This usually means the dataset export is incomplete.',
      ].join('\n'),
    );
  }

  const manifest = readJson(manifestPath);

  console.log(`Loading dataset ${scenario}@${revision} from ${datasetDir}`);

  verifyManifestMatchesTag({ scenario, revision }, manifest);
  await verifyMigrationMatches(knex, manifest);

  // Load tables (missing file => empty array, except dictionary which is optional)
  const system = loadDatasetJson(datasetDir, 'system.json') || [];
  const role = loadDatasetJson(datasetDir, 'role.json') || [];
  const mitigation = loadDatasetJson(datasetDir, 'mitigation.json') || [];
  const response = loadDatasetJson(datasetDir, 'response.json') || [];
  const injection = loadDatasetJson(datasetDir, 'injection.json') || [];
  const action = loadDatasetJson(datasetDir, 'action.json') || [];
  const curveball = loadDatasetJson(datasetDir, 'curveball.json') || [];
  const dictionary = loadDatasetJson(datasetDir, 'dictionary.json'); // optional

  const actionRole = loadDatasetJson(datasetDir, 'action_role.json') || [];
  const injectionResponse =
    loadDatasetJson(datasetDir, 'injection_response.json') || [];

  // Insert parents first

  await knex.transaction(async (trx) => {
    if (system.length) await trx('system').insert(system);
    if (role.length) await trx('role').insert(role);
    if (mitigation.length) await trx('mitigation').insert(mitigation);
    if (response.length) await trx('response').insert(response);

    // injection has self-FK followup_injection; do a safe two-pass insert
    if (injection.length) {
      const withoutFollowups = injection.map((row) => ({
        ...row,
        followup_injection: null,
      }));

      await trx('injection').insert(withoutFollowups);

      const followups = injection
        .filter((row) => row.followup_injection)
        .map((row) => ({
          id: row.id,
          followup_injection: row.followup_injection,
        }));

      /* eslint-disable no-await-in-loop */
      /* eslint-disable no-restricted-syntax */
      for (const row of followups) {
        await trx('injection')
          .where({ id: row.id })
          .update({ followup_injection: row.followup_injection });
      }
      /* eslint-enable no-restricted-syntax */
      /* eslint-enable no-await-in-loop */
    }

    if (action.length) await trx('action').insert(action);
    if (curveball.length) await trx('curveball').insert(curveball);
    if (dictionary && dictionary.length)
      await trx('dictionary').insert(dictionary);

    // Insert joins last
    if (actionRole.length) await trx('action_role').insert(actionRole);
    if (injectionResponse.length)
      await trx('injection_response').insert(injectionResponse);
  });
};
