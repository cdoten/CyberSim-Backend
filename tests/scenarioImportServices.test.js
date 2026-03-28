/**
 * Tests for scenario import service helpers.
 *
 * What this covers:
 * - blocking imports when active games exist for a scenario
 *
 * Important notes:
 * - This file focuses on import-side service behavior, not route behavior.
 */

jest.mock('../src/models/db', () => {
  let rows = [];

  const api = {
    where: jest.fn(() => api),
    whereIn: jest.fn(() => api),
    count: jest.fn(() => api),
    first: jest.fn(async () => rows[0]),
  };

  const db = jest.fn(() => api);

  db.setRows = (nextRows) => {
    rows = nextRows;
  };

  return db;
});

const db = require('../src/models/db');
const assertNoActiveGames = require('../src/services/scenario/assertNoActiveGames');

describe('assertNoActiveGames', () => {
  beforeEach(() => {
    db.setRows([]);
    jest.clearAllMocks();
  });

  it('does not throw when no active games exist', async () => {
    db.setRows([{ count: '0' }]);

    await expect(
      assertNoActiveGames({ scenarioId: 1, scenarioSlug: 'cso' }),
    ).resolves.toBeUndefined();
  });

  it('throws ACTIVE_GAMES_EXIST when active games are present', async () => {
    db.setRows([{ count: '2' }]);

    await expect(
      assertNoActiveGames({ scenarioId: 1, scenarioSlug: 'cso' }),
    ).rejects.toMatchObject({
      code: 'ACTIVE_GAMES_EXIST',
      activeGameCount: 2,
    });
  });
});
