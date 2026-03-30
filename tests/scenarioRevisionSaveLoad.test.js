/**
 * Tests for scenario revision save/load tooling.
 *
 * What this covers:
 * - saving one scenario revision from DB content
 * - the CLI wrapper for saving scenario revisions
 * - loading a saved scenario revision via the destructive scenario seed
 *
 * Important notes:
 * - These tests use mocks and temporary filesystem state.
 * - The wrapper test is intentionally thin; most behavior belongs to the
 *   underlying service.
 * - The seed test focuses on scenario revision loading behavior, not on full
 *   end-to-end database realism.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('saveScenarioRevision service', () => {
  let db;
  let saveScenarioRevision;
  let parseScenarioTag;
  let tempRoot;

  beforeEach(() => {
    jest.resetModules();

    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cybersim-save-scenario-test-'),
    );

    jest.doMock('../src/models/db', () => {
      const makeQuery = (tableName, dataStore) => {
        let selected = dataStore[tableName] || [];

        const api = {
          where(criteria) {
            selected = selected.filter((row) =>
              Object.entries(criteria).every(
                ([key, value]) => row[key] === value,
              ),
            );
            return api;
          },
          orderBy(column) {
            selected = [...selected].sort((a, b) => {
              if (a[column] < b[column]) return -1;
              if (a[column] > b[column]) return 1;
              return 0;
            });
            return api;
          },
          select() {
            return api;
          },
          first() {
            return Promise.resolve(selected[0]);
          },
          then(resolve, reject) {
            return Promise.resolve(selected).then(resolve, reject);
          },
        };

        return api;
      };

      const dataStore = {
        scenario: [],
        system: [],
        location: [],
        role: [],
        mitigation: [],
        response: [],
        injection: [],
        action: [],
        curveball: [],
        dictionary: [],
        action_role: [],
        injection_response: [],
        knex_migrations: [],
      };

      const mockedDb = (tableName) => makeQuery(tableName, dataStore);

      mockedDb.setData = (tableName, rows) => {
        dataStore[tableName] = rows;
      };

      mockedDb.schema = {
        hasTable: jest.fn(async (tableName) => tableName === 'dictionary'),
      };

      return mockedDb;
    });

    jest.doMock('../src/util/airtable', () => ({
      getAirtableBaseId: jest.fn(() => 'appTESTBASE'),
    }));

    jest.doMock('child_process', () => ({
      execSync: jest.fn(() => Buffer.from('abcdef1234567890')),
    }));

    // eslint-disable-next-line global-require
    db = require('../src/models/db');

    // eslint-disable-next-line global-require
    const scenarioSaveService = require('../src/services/scenario/saveScenarioRevision');

    ({ saveScenarioRevision, parseScenarioTag } = scenarioSaveService);

    db.setData('scenario', [
      { id: 1, slug: 'cso', name: 'CSO Scenario' },
      { id: 2, slug: 'parl', name: 'Parliament Scenario' },
    ]);

    db.setData('system', [
      { id: 'sys1', name: 'Email', type: 'hq', scenario_id: 1 },
      { id: 'sys2', name: 'CRM', type: 'local', scenario_id: 2 },
    ]);

    db.setData('location', [
      { id: 'loc1', name: 'HQ', type: 'hq', scenario_id: 1 },
      { id: 'loc2', name: 'Field', type: 'local', scenario_id: 2 },
    ]);

    db.setData('role', [
      { id: 'role1', name: 'Comms', scenario_id: 1 },
      { id: 'role2', name: 'Ops', scenario_id: 2 },
    ]);

    db.setData('mitigation', [
      { id: 'mit1', description: 'MFA', scenario_id: 1 },
      { id: 'mit2', description: 'Backups', scenario_id: 2 },
    ]);

    db.setData('response', [
      { id: 'resp1', description: 'Reset password', scenario_id: 1 },
      { id: 'resp2', description: 'Notify users', scenario_id: 2 },
    ]);

    db.setData('injection', [
      {
        id: 'inj1',
        title: 'Phish',
        description: 'Bad email',
        poll_change: '2.5',
        scenario_id: 1,
      },
      {
        id: 'inj2',
        title: 'Leak',
        description: 'Bad leak',
        poll_change: '1.25',
        scenario_id: 2,
      },
    ]);

    db.setData('action', [
      {
        id: 'act1',
        description: 'Press release',
        poll_increase: '3.5',
        scenario_id: 1,
      },
      {
        id: 'act2',
        description: 'Volunteer call',
        poll_increase: '1.5',
        scenario_id: 2,
      },
    ]);

    db.setData('curveball', [
      { id: 'cb1', description: 'Power outage', scenario_id: 1 },
      { id: 'cb2', description: 'Printer jam', scenario_id: 2 },
    ]);

    db.setData('dictionary', [
      { id: 'dict1', word: 'poll', synonym: 'support', scenario_id: 1 },
      { id: 'dict2', word: 'budget', synonym: 'funds', scenario_id: 2 },
    ]);

    db.setData('action_role', [
      { id: 1, action_id: 'act1', role_id: 'role1', scenario_id: 1 },
      { id: 2, action_id: 'act2', role_id: 'role2', scenario_id: 2 },
    ]);

    db.setData('injection_response', [
      { id: 1, injection_id: 'inj1', response_id: 'resp1', scenario_id: 1 },
      { id: 2, injection_id: 'inj2', response_id: 'resp2', scenario_id: 2 },
    ]);

    db.setData('knex_migrations', [
      {
        id: 1,
        name: '20260313000400_enforce_scenario_id_constraints.js',
      },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('parses a scenario tag', () => {
    expect(parseScenarioTag('cso@2026-03-28.1')).toEqual({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-28.1',
    });
  });

  it('saves only the selected scenario rows and writes manifest + location.json', async () => {
    const result = await saveScenarioRevision({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-28.1',
      rootDir: tempRoot,
    });

    expect(result.scenarioSlug).toBe('cso');
    expect(result.scenarioRevision).toBe('2026-03-28.1');

    const dataDir = path.join(result.outputDir, 'data');

    const system = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'system.json'), 'utf8'),
    );
    const location = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'location.json'), 'utf8'),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(result.outputDir, 'manifest.json'), 'utf8'),
    );

    expect(system).toEqual([{ id: 'sys1', name: 'Email', type: 'hq' }]);
    expect(location).toEqual([{ id: 'loc1', name: 'HQ', type: 'hq' }]);

    expect(manifest.scenario).toBe('cso');
    expect(manifest.revision).toBe('2026-03-28.1');
    expect(manifest.name).toBe('CSO Scenario');
    expect(manifest.counts.system).toBe(1);
    expect(manifest.counts.location).toBe(1);
  });

  it('throws a clear error for an unknown scenario slug', async () => {
    await expect(
      saveScenarioRevision({
        scenarioSlug: 'unknown',
        scenarioRevision: '2026-03-28.1',
      }),
    ).rejects.toThrow('Scenario not found: "unknown"');
  });
});

describe('save-scenario-revision wrapper', () => {
  let db;
  let service;
  let originalArgv;
  let originalEnv;
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    jest.resetModules();

    originalArgv = process.argv;
    originalEnv = process.env;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    jest.doMock('../src/models/db', () => ({
      destroy: jest.fn(async () => undefined),
    }));

    jest.doMock('../src/services/scenario/saveScenarioRevision', () => ({
      saveScenarioRevision: jest.fn(
        async ({ scenarioSlug, scenarioRevision }) => ({
          scenarioSlug,
          scenarioRevision,
          outputDir: '/tmp/fake-output',
        }),
      ),
      parseScenarioTag: jest.fn((tag) => {
        const [scenarioSlug, scenarioRevision] = tag.split('@');
        return { scenarioSlug, scenarioRevision };
      }),
    }));

    // eslint-disable-next-line global-require
    db = require('../src/models/db');
    // eslint-disable-next-line global-require
    service = require('../src/services/scenario/saveScenarioRevision');

    process.env = { ...originalEnv };
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('prefers --tag over SCENARIO_TAG', async () => {
    process.env.SCENARIO_TAG = 'envscenario@2026-03-28.1';
    process.argv = [
      'node',
      'scripts/save-scenario-revision.js',
      '--tag',
      'argvscenario@2026-03-28.2',
    ];

    // eslint-disable-next-line global-require
    const { main } = require('../scripts/save-scenario-revision');
    await main(process.argv);

    expect(service.parseScenarioTag).toHaveBeenCalledWith(
      'argvscenario@2026-03-28.2',
    );
    expect(service.saveScenarioRevision).toHaveBeenCalledWith({
      scenarioSlug: 'argvscenario',
      scenarioRevision: '2026-03-28.2',
    });
    expect(db.destroy).toHaveBeenCalled();
  });
});

describe('loadScenarioRevision service', () => {
  let tempRoot;
  let loadScenarioRevision;
  let mockDb;
  let mockReplaceScenarioContent;
  let mockAssertNoActiveGames;

  beforeEach(() => {
    jest.resetModules();

    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cybersim-load-scenario-test-'),
    );

    mockReplaceScenarioContent = jest.fn(async () => undefined);
    mockAssertNoActiveGames = jest.fn(async () => undefined);

    const insertApi = {
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockReturnThis(),
      returning: jest.fn(async () => [
        { id: 42, slug: 'cso', name: 'CSO Scenario' },
      ]),
    };

    const knexMigrationsApi = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn(async () => ({
        name: '20260313000400_enforce_scenario_id_constraints.js',
      })),
    };

    mockDb = jest.fn((tableName) => {
      if (tableName === 'knex_migrations') return knexMigrationsApi;
      return { insert: jest.fn(() => insertApi) };
    });
    mockDb.transaction = jest.fn(async (fn) => fn(mockDb));

    jest.doMock('../src/models/db', () => mockDb);
    jest.doMock(
      '../src/services/scenario/replaceScenarioContent',
      () => mockReplaceScenarioContent,
    );
    jest.doMock(
      '../src/services/scenario/assertNoActiveGames',
      () => mockAssertNoActiveGames,
    );

    ({
      loadScenarioRevision,
      // eslint-disable-next-line global-require
    } = require('../src/services/scenario/loadScenarioRevision'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function writeRevision(
    scenariosRoot,
    scenario,
    revision,
    manifest,
    data = {},
  ) {
    const scenarioDir = path.join(scenariosRoot, scenario, revision);
    const dataDir = path.join(scenarioDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(
      path.join(scenarioDir, 'manifest.json'),
      JSON.stringify({
        scenario,
        revision,
        name: manifest.name || scenario,
        ...manifest,
      }),
    );

    const tables = [
      'system',
      'role',
      'mitigation',
      'response',
      'injection',
      'action',
      'curveball',
      'action_role',
      'injection_response',
      'location',
    ];
    tables.forEach((t) => {
      fs.writeFileSync(
        path.join(dataDir, `${t}.json`),
        JSON.stringify(data[t] || []),
      );
    });
  }

  it('loads JSON files, upserts scenario row, and calls replaceScenarioContent', async () => {
    const scenariosRoot = path.join(tempRoot, 'scenarios');
    writeRevision(
      scenariosRoot,
      'cso',
      '2026-03-28.1',
      {
        name: 'CSO Scenario',
        db: {
          latest_migration: '20260313000400_enforce_scenario_id_constraints.js',
        },
      },
      {
        location: [{ id: 'loc1', name: 'HQ', type: 'hq' }],
      },
    );

    const result = await loadScenarioRevision({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-28.1',
      rootDir: scenariosRoot,
    });

    expect(result.scenarioSlug).toBe('cso');
    expect(result.scenarioRevision).toBe('2026-03-28.1');
    expect(result.counts.location).toBe(1);

    expect(mockAssertNoActiveGames).toHaveBeenCalledWith({
      scenarioId: 42,
      scenarioSlug: 'cso',
    });

    expect(mockReplaceScenarioContent).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: 42,
        locations: [{ id: 'loc1', name: 'HQ', type: 'hq', scenario_id: 42 }],
      }),
    );
  });

  it('throws for a missing scenario directory', async () => {
    const scenariosRoot = path.join(tempRoot, 'scenarios');

    await expect(
      loadScenarioRevision({
        scenarioSlug: 'unknown',
        scenarioRevision: '2026-03-28.1',
        rootDir: scenariosRoot,
      }),
    ).rejects.toThrow('Scenario revision not found');
  });

  it('throws on manifest mismatch', async () => {
    const scenariosRoot = path.join(tempRoot, 'scenarios');
    writeRevision(scenariosRoot, 'cso', '2026-03-28.1', {
      scenario: 'other',
      revision: '2026-03-28.1',
      db: {
        latest_migration: '20260313000400_enforce_scenario_id_constraints.js',
      },
    });

    await expect(
      loadScenarioRevision({
        scenarioSlug: 'cso',
        scenarioRevision: '2026-03-28.1',
        rootDir: scenariosRoot,
      }),
    ).rejects.toThrow('Scenario revision manifest mismatch');
  });

  it('throws on migration mismatch', async () => {
    const scenariosRoot = path.join(tempRoot, 'scenarios');
    writeRevision(scenariosRoot, 'cso', '2026-03-28.1', {
      name: 'CSO Scenario',
      db: { latest_migration: 'some_old_migration.js' },
    });

    await expect(
      loadScenarioRevision({
        scenarioSlug: 'cso',
        scenarioRevision: '2026-03-28.1',
        rootDir: scenariosRoot,
      }),
    ).rejects.toThrow('Scenario revision migration mismatch');
  });

  it('throws when active games exist', async () => {
    const scenariosRoot = path.join(tempRoot, 'scenarios');
    writeRevision(scenariosRoot, 'cso', '2026-03-28.1', {
      name: 'CSO Scenario',
      db: {
        latest_migration: '20260313000400_enforce_scenario_id_constraints.js',
      },
    });

    const activeGamesErr = new Error('active games');
    activeGamesErr.code = 'ACTIVE_GAMES_EXIST';
    mockAssertNoActiveGames.mockRejectedValue(activeGamesErr);

    await expect(
      loadScenarioRevision({
        scenarioSlug: 'cso',
        scenarioRevision: '2026-03-28.1',
        rootDir: scenariosRoot,
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_GAMES_EXIST' });
  });
});

describe('load-scenario-revision wrapper', () => {
  let db;
  let service;
  let originalArgv;
  let originalEnv;
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    jest.resetModules();

    originalArgv = process.argv;
    originalEnv = process.env;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    jest.doMock('../src/models/db', () => ({
      destroy: jest.fn(async () => undefined),
    }));

    jest.doMock('../src/services/scenario/loadScenarioRevision', () => ({
      loadScenarioRevision: jest.fn(
        async ({ scenarioSlug, scenarioRevision }) => ({
          scenarioSlug,
          scenarioRevision,
          counts: {},
        }),
      ),
    }));

    jest.doMock('../src/services/scenario/saveScenarioRevision', () => ({
      parseScenarioTag: jest.fn((tag) => {
        const [scenarioSlug, scenarioRevision] = tag.split('@');
        return { scenarioSlug, scenarioRevision };
      }),
    }));

    // eslint-disable-next-line global-require
    db = require('../src/models/db');
    // eslint-disable-next-line global-require
    service = require('../src/services/scenario/loadScenarioRevision');

    process.env = { ...originalEnv };
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('prefers --tag over SCENARIO_TAG', async () => {
    process.env.SCENARIO_TAG = 'envscenario@2026-03-28.1';
    process.argv = [
      'node',
      'scripts/load-scenario-revision.js',
      '--tag',
      'argvscenario@2026-03-28.2',
    ];

    // eslint-disable-next-line global-require
    const { main } = require('../scripts/load-scenario-revision');
    await main(process.argv);

    expect(service.loadScenarioRevision).toHaveBeenCalledWith({
      scenarioSlug: 'argvscenario',
      scenarioRevision: '2026-03-28.2',
    });
    expect(db.destroy).toHaveBeenCalled();
  });

  it('falls back to SCENARIO_TAG when no --tag arg', async () => {
    process.env.SCENARIO_TAG = 'cso@2026-03-28.1';
    process.argv = ['node', 'scripts/load-scenario-revision.js'];

    // eslint-disable-next-line global-require
    const { main } = require('../scripts/load-scenario-revision');
    await main(process.argv);

    expect(service.loadScenarioRevision).toHaveBeenCalledWith({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-28.1',
    });
    expect(db.destroy).toHaveBeenCalled();
  });
});

describe('02_scenario_seed', () => {
  let seedModule;
  let tempRoot;

  beforeEach(() => {
    jest.resetModules();

    // eslint-disable-next-line global-require
    seedModule = require('../seeds/02_scenario_seed');
    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cybersim-seed-scenario-test-'),
    );
    process.env.SCENARIO_SEED_ROOT = path.join(tempRoot, 'scenarios');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.SCENARIO_TAG;
    delete process.env.SCENARIO_SEED_ROOT;
  });

  it('throws a clear error when SCENARIO_TAG is missing', async () => {
    delete process.env.SCENARIO_TAG;

    await expect(seedModule.seed(jest.fn())).rejects.toThrow(
      'SCENARIO_TAG is not set. Use: SCENARIO_TAG="scenario@revision" npm run seed:scenario',
    );
  });

  it('loads location.json and inserts tagged location rows', async () => {
    process.env.SCENARIO_TAG = 'cso@2026-03-28.1';

    const scenarioDir = path.join(
      process.env.SCENARIO_SEED_ROOT,
      'cso',
      '2026-03-28.1',
    );
    const dataDir = path.join(scenarioDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    fs.writeFileSync(
      path.join(scenarioDir, 'manifest.json'),
      JSON.stringify({
        scenario: 'cso',
        revision: '2026-03-28.1',
        name: 'CSO Scenario',
        db: {
          latest_migration: '20260313000400_enforce_scenario_id_constraints.js',
        },
      }),
    );

    fs.writeFileSync(path.join(dataDir, 'system.json'), JSON.stringify([]));
    fs.writeFileSync(
      path.join(dataDir, 'location.json'),
      JSON.stringify([{ id: 'loc1', name: 'HQ', type: 'hq' }]),
    );
    fs.writeFileSync(path.join(dataDir, 'role.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'mitigation.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'response.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'injection.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'action.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'curveball.json'), JSON.stringify([]));
    fs.writeFileSync(
      path.join(dataDir, 'action_role.json'),
      JSON.stringify([]),
    );
    fs.writeFileSync(
      path.join(dataDir, 'injection_response.json'),
      JSON.stringify([]),
    );

    const calls = [];

    function makeTableApi(tableName) {
      return {
        delete: jest.fn(async () => {
          calls.push({ table: tableName, op: 'delete' });
        }),
        update: jest.fn(async (payload) => {
          calls.push({ table: tableName, op: 'update', payload });
        }),
        insert: jest.fn((rows) => {
          calls.push({ table: tableName, op: 'insert', rows });

          if (tableName === 'scenario') {
            return {
              returning: jest.fn(async () => [
                { id: 101, slug: rows.slug, name: rows.name },
              ]),
            };
          }

          return Promise.resolve(rows);
        }),
        select: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            first: jest.fn(async () => ({
              name: '20260313000400_enforce_scenario_id_constraints.js',
            })),
          })),
        })),
      };
    }

    const knex = jest.fn((tableName) => makeTableApi(tableName));
    knex.transaction = async (fn) => fn(knex);

    await seedModule.seed(knex);

    const locationInsert = calls.find(
      (call) => call.table === 'location' && call.op === 'insert',
    );

    expect(locationInsert).toBeTruthy();
    expect(locationInsert.rows).toEqual([
      { id: 'loc1', name: 'HQ', type: 'hq', scenario_id: 101 },
    ]);
  });
});
