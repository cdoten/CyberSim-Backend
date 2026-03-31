// tests/admin.test.js

const request = require('supertest');

// Mock logger before app loads
jest.mock('../src/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(() => mockLogger),
  };
  return mockLogger;
});

jest.mock('../src/config', () => ({
  migrationPassword: 'test-admin-password',
}));

jest.mock('../src/models/scenario', () => ({
  getScenarioBySlug: jest.fn(),
  listScenariosWithCounts: jest.fn(),
  deleteScenarioBySlug: jest.fn(),
}));

jest.mock('../src/models/game', () => ({
  createGame: jest.fn(),
  getGame: jest.fn(),
  changeMitigation: jest.fn(),
  performAction: jest.fn(),
  startSimulation: jest.fn(),
  pauseSimulation: jest.fn(),
  makeResponses: jest.fn(),
  deliverGameInjection: jest.fn(),
  makeNonCorrectInjectionResponse: jest.fn(),
  performCurveball: jest.fn(),
  listGames: jest.fn(),
  finishGame: jest.fn(),
  deleteGame: jest.fn(),
}));

jest.mock('../src/services/scenario/loadScenarioRevision', () => ({
  loadScenarioRevision: jest.fn(),
}));

jest.mock('../src/services/scenario/listAvailableRevisions', () => ({
  listAvailableRevisions: jest.fn(),
}));

// Stub modules used by other routes so the app loads cleanly
jest.mock('../src/models/db', () => {
  const fn = jest.fn(() => fn);
  fn.raw = jest.fn();
  fn.transaction = jest.fn();
  return fn;
});
jest.mock('../src/models/response', () => ({
  getResponsesByScenarioId: jest.fn(),
}));
jest.mock('../src/models/injection', () => ({
  getInjectionsByScenarioId: jest.fn(),
}));
jest.mock('../src/models/action', () => ({
  getActionsByScenarioId: jest.fn(),
}));
jest.mock('../src/util/importScenarioFromAirtable', () => jest.fn());
jest.mock('../src/util/airtable', () => ({ getAirtableBaseId: jest.fn() }));

const app = require('../src/app');
const {
  listScenariosWithCounts,
  deleteScenarioBySlug,
} = require('../src/models/scenario');
const { listGames, finishGame, deleteGame } = require('../src/models/game');
const {
  loadScenarioRevision,
} = require('../src/services/scenario/loadScenarioRevision');
const {
  listAvailableRevisions,
} = require('../src/services/scenario/listAvailableRevisions');

const ADMIN_PASSWORD = 'test-admin-password';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /admin/scenarios
// ---------------------------------------------------------------------------

describe('GET /admin/scenarios', () => {
  it('returns scenario list with counts', async () => {
    const fixture = [
      {
        id: 1,
        slug: 'cso',
        name: 'CSO Scenario',
        revision: '2026-03-19.1',
        counts: {
          systems: 2,
          injections: 3,
          mitigations: 2,
          responses: 2,
          actions: 2,
          roles: 2,
          curveballs: 3,
        },
        activeGames: 0,
      },
    ];
    listScenariosWithCounts.mockResolvedValue(fixture);

    const res = await request(app).get('/admin/scenarios');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scenarios: fixture });
    expect(listScenariosWithCounts).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/scenarios/available
// ---------------------------------------------------------------------------

describe('GET /admin/scenarios/available', () => {
  it('returns revision tags from disk', async () => {
    const tags = ['cso@2026-03-03.1', 'cso@2026-03-19.1', 'tnr@2026-03-19.1'];
    listAvailableRevisions.mockReturnValue(tags);

    const res = await request(app).get('/admin/scenarios/available');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tags });
    expect(listAvailableRevisions).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /admin/scenarios/load
// ---------------------------------------------------------------------------

describe('POST /admin/scenarios/load', () => {
  it('loads a revision and returns counts', async () => {
    loadScenarioRevision.mockResolvedValue({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-19.1',
      counts: { system: 2, injection: 3 },
    });

    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', ADMIN_PASSWORD)
      .send({ tag: 'cso@2026-03-19.1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.scenarioSlug).toBe('cso');
    expect(loadScenarioRevision).toHaveBeenCalledWith({
      scenarioSlug: 'cso',
      scenarioRevision: '2026-03-19.1',
    });
  });

  it('returns 400 when tag is missing', async () => {
    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', ADMIN_PASSWORD)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TAG_REQUIRED');
  });

  it('returns 400 when tag has no @ separator', async () => {
    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', ADMIN_PASSWORD)
      .send({ tag: 'cso-2026-03-19' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TAG_FORMAT');
  });

  it('returns 409 when active games exist', async () => {
    const err = new Error('Active games exist');
    err.code = 'ACTIVE_GAMES_EXIST';
    err.activeGames = 2;
    loadScenarioRevision.mockRejectedValue(err);

    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', ADMIN_PASSWORD)
      .send({ tag: 'cso@2026-03-19.1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ACTIVE_GAMES_EXIST');
    expect(res.body.activeGames).toBe(2);
  });

  it('returns 400 on manifest/migration mismatch', async () => {
    loadScenarioRevision.mockRejectedValue(
      new Error('Scenario revision manifest mismatch.'),
    );

    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', ADMIN_PASSWORD)
      .send({ tag: 'cso@2026-03-19.1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('LOAD_ERROR');
  });

  it('returns 401 when password header is missing', async () => {
    const res = await request(app)
      .post('/admin/scenarios/load')
      .send({ tag: 'cso@2026-03-19.1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('PASSWORD_REQUIRED');
  });

  it('returns 401 when password is wrong', async () => {
    const res = await request(app)
      .post('/admin/scenarios/load')
      .set('x-admin-password', 'wrong-password')
      .send({ tag: 'cso@2026-03-19.1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_PASSWORD');
  });
});

// ---------------------------------------------------------------------------
// DELETE /admin/scenarios/:slug
// ---------------------------------------------------------------------------

describe('DELETE /admin/scenarios/:slug', () => {
  it('deletes a scenario and returns confirmation', async () => {
    deleteScenarioBySlug.mockResolvedValue({ deleted: true, slug: 'cso' });

    const res = await request(app)
      .delete('/admin/scenarios/cso')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, slug: 'cso' });
    expect(deleteScenarioBySlug).toHaveBeenCalledWith('cso');
  });

  it('returns 404 when scenario not found', async () => {
    const err = new Error('Scenario not found: "unknown"');
    err.code = 'SCENARIO_NOT_FOUND';
    deleteScenarioBySlug.mockRejectedValue(err);

    const res = await request(app)
      .delete('/admin/scenarios/unknown')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('SCENARIO_NOT_FOUND');
  });

  it('returns 409 when active games exist', async () => {
    const err = new Error('Cannot delete scenario while active games exist.');
    err.code = 'ACTIVE_GAMES_EXIST';
    err.activeGames = 1;
    deleteScenarioBySlug.mockRejectedValue(err);

    const res = await request(app)
      .delete('/admin/scenarios/cso')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ACTIVE_GAMES_EXIST');
    expect(res.body.activeGames).toBe(1);
  });

  it('returns 409 when historical (finished) games exist', async () => {
    const err = new Error(
      'Cannot delete scenario while 3 historical game(s) exist.',
    );
    err.code = 'HISTORICAL_GAMES_EXIST';
    err.gameCount = 3;
    deleteScenarioBySlug.mockRejectedValue(err);

    const res = await request(app)
      .delete('/admin/scenarios/cso')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('HISTORICAL_GAMES_EXIST');
    expect(res.body.gameCount).toBe(3);
  });

  it('returns 401 when password is missing', async () => {
    const res = await request(app).delete('/admin/scenarios/cso');
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is wrong', async () => {
    const res = await request(app)
      .delete('/admin/scenarios/cso')
      .set('x-admin-password', 'wrong');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/games
// ---------------------------------------------------------------------------

describe('GET /admin/games', () => {
  it('returns list of games', async () => {
    const fixture = [
      {
        id: 'game-1',
        state: 'PREPARATION',
        poll: 55,
        budget: 6000,
        scenarioSlug: 'cso',
        scenarioName: 'CSO',
      },
    ];
    listGames.mockResolvedValue(fixture);

    const res = await request(app)
      .get('/admin/games')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ games: fixture });
    expect(listGames).toHaveBeenCalledWith({ scenarioSlug: undefined });
  });

  it('passes scenarioSlug filter through', async () => {
    listGames.mockResolvedValue([]);

    await request(app)
      .get('/admin/games?scenarioSlug=cso')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(listGames).toHaveBeenCalledWith({ scenarioSlug: 'cso' });
  });

  it('returns 401 when password is missing', async () => {
    const res = await request(app).get('/admin/games');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /admin/games/:id/finish
// ---------------------------------------------------------------------------

describe('POST /admin/games/:id/finish', () => {
  it('finishes a game and returns updated game', async () => {
    const updatedGame = { id: 'game-1', state: 'ASSESSMENT' };
    finishGame.mockResolvedValue(updatedGame);

    const res = await request(app)
      .post('/admin/games/game-1/finish')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, game: updatedGame });
    expect(finishGame).toHaveBeenCalledWith('game-1');
  });

  it('returns 404 when game not found', async () => {
    const err = new Error('Game "missing" not found.');
    err.code = 'GAME_NOT_FOUND';
    finishGame.mockRejectedValue(err);

    const res = await request(app)
      .post('/admin/games/missing/finish')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });

  it('returns 401 when password is missing', async () => {
    const res = await request(app).post('/admin/games/game-1/finish');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /admin/games/:id
// ---------------------------------------------------------------------------

describe('DELETE /admin/games/:id', () => {
  it('deletes a game and returns confirmation', async () => {
    deleteGame.mockResolvedValue({ deleted: true, id: 'game-1' });

    const res = await request(app)
      .delete('/admin/games/game-1')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, id: 'game-1' });
    expect(deleteGame).toHaveBeenCalledWith('game-1');
  });

  it('returns 404 when game not found', async () => {
    const err = new Error('Game "missing" not found.');
    err.code = 'GAME_NOT_FOUND';
    deleteGame.mockRejectedValue(err);

    const res = await request(app)
      .delete('/admin/games/missing')
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });

  it('returns 401 when password is missing', async () => {
    const res = await request(app).delete('/admin/games/game-1');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// HTTPS enforcement
// ---------------------------------------------------------------------------

describe('HTTPS enforcement (production)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('rejects plain HTTP requests to admin endpoints with 403', async () => {
    const res = await request(app)
      .get('/admin/scenarios')
      // No x-forwarded-proto header — simulates plain HTTP behind the LB
      .set('x-admin-password', ADMIN_PASSWORD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('HTTPS_REQUIRED');
  });

  it('allows requests with x-forwarded-proto: https', async () => {
    listScenariosWithCounts.mockResolvedValue([]);

    const res = await request(app)
      .get('/admin/scenarios')
      .set('x-forwarded-proto', 'https');

    expect(res.status).toBe(200);
  });
});
