const db = require('../../src/models/db');
const resetGameTables = require('../resetGameTables');
const { changeMitigation } = require('../../src/models/game');
const {
  dummyGame,
  dummyGameMitigations,
  dummyGameInjections,
} = require('../testData');
const GameStates = require('../../src/constants/GameStates');

describe('Change Mitigation', () => {
  beforeEach(async () => {
    await resetGameTables();
    await db('game').insert(dummyGame);
    await db('game_mitigation').insert(dummyGameMitigations);
    await db('game_injection').insert(dummyGameInjections);
  });

  afterAll(async () => {
    await db.destroy();
  });

  const gameId = dummyGame.id;

  test('should change mitigation state', async () => {
    const { mitigation_id: mitigationId, state } = dummyGameMitigations[0];

    const { mitigations } = await changeMitigation({
      mitigationId,
      mitigationValue: !state,
      gameId,
    });

    const changedMitigation = mitigations.find(
      (m) => m.mitigation_id === mitigationId,
    );

    expect(changedMitigation).toBeDefined();
    expect(changedMitigation.state).toBe(!state);
  });

  test('should reduce game budget by mitigation cost', async () => {
    const { budget } = await db('game')
      .select('budget')
      .where({ id: gameId })
      .first();

    const { mitigation_id: mitigationId, state } = dummyGameMitigations[0];

    const { cost } = await db('mitigation')
      .select('cost')
      .where({ id: mitigationId })
      .first();

    const { budget: newBudget } = await changeMitigation({
      mitigationId,
      mitigationValue: !state,
      gameId,
    });

    expect(newBudget).toBe(budget - (cost || 0));
  });

  test('should not reduce game budget if mitigation value is false', async () => {
    const { budget } = await db('game')
      .select('budget')
      .where({ id: gameId })
      .first();

    const { mitigation_id: mitigationId } = dummyGameMitigations[0];

    const { budget: newBudget } = await changeMitigation({
      mitigationId,
      mitigationValue: false,
      gameId,
    });

    expect(budget).toBe(newBudget);
  });

  test(`should skip injections if game state is not ${GameStates.PREPARATION}`, async () => {
    await db('game')
      .where({ id: gameId })
      .update({ state: GameStates.SIMULATION });

    const { mitigation_id: mitigationId, state } = dummyGameMitigations[0];

    await changeMitigation({
      mitigationId,
      mitigationValue: !state,
      gameId,
    });

    const gameInjection = await db('game_injection')
      .where({
        game_id: gameId,
        injection_id: 'I1',
        prevented: true,
      })
      .first();

    expect(gameInjection).toBeTruthy();
  });

  test(`should log if game state is not ${GameStates.PREPARATION}`, async () => {
    await db('game')
      .where({ id: gameId })
      .update({ state: GameStates.SIMULATION });

    const { mitigation_id: mitigationId, state } = dummyGameMitigations[0];

    await changeMitigation({
      mitigationId,
      mitigationValue: !state,
      gameId,
    });

    const gameLog = await db('game_log')
      .where({
        game_id: gameId,
        type: 'Budget Item Purchase',
        mitigation_id: mitigationId,
      })
      .first();

    expect(gameLog).toBeTruthy();
  });

  test('should throw if game budget < mitigation cost', async () => {
    await db('game').where({ id: gameId }).update({ budget: 0 });

    const { mitigation_id: mitigationId, state } = dummyGameMitigations[0];

    // Force this mitigation to have a non-zero cost so the budget check is meaningful
    await db('mitigation').where({ id: mitigationId }).update({ cost: 1 });

    await expect(
      changeMitigation({
        mitigationId,
        mitigationValue: !state,
        gameId,
      }),
    ).rejects.toThrowError(/Not enough budget/);
  });
});
