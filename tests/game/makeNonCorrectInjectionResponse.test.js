const db = require('../../src/models/db');
const resetGameTables = require('../resetGameTables');
const { makeNonCorrectInjectionResponse } = require('../../src/models/game');
const { dummyGame, dummyGameInjections } = require('../testData');

// Create a per-file copy so we don't mutate shared fixtures used by other tests
const gameRow = { ...dummyGame, started_at: db.fn.now(), paused: false };

const gameId = gameRow.id;
const injectionId = dummyGameInjections[0].injection_id;

describe('Make Non Correct Injection Response', () => {
  beforeAll(async () => {
    await resetGameTables();
    await db('game').insert(gameRow);
    await db('game_injection').insert(dummyGameInjections);
  });

  afterAll(async (done) => {
    await db.destroy();
    done();
  });

  test('should set response time', async () => {
    const { startedAt } = await db('game')
      .select('started_at as startedAt')
      .where({ id: gameId })
      .first();

    const dateBeforeTest = Date.now() - new Date(startedAt).getTime();
    await makeNonCorrectInjectionResponse({ gameId, injectionId });
    const dateAfterTest = Date.now() - new Date(startedAt).getTime();

    const { responseMadeAt } = await db('game_injection')
      .select('response_made_at as responseMadeAt')
      .where({ game_id: gameId, injection_id: injectionId })
      .first();

    expect(responseMadeAt).not.toBeNull();
    expect(responseMadeAt).toBeGreaterThanOrEqual(dateBeforeTest);
    expect(responseMadeAt).toBeLessThan(dateAfterTest);
  });

  test('should update custom response', async () => {
    await makeNonCorrectInjectionResponse({
      gameId,
      injectionId,
      customResponse: 'ASDFGH',
    });

    const { customResponse } = await db('game_injection')
      .select('custom_response as customResponse')
      .where({
        game_id: gameId,
        injection_id: injectionId,
      })
      .first();

    expect(customResponse).toEqual('ASDFGH');
  });
});
