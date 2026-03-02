const db = require('../src/models/db');
const resetGameTables = require('./resetGameTables');

describe('Data Integrity', () => {
  beforeEach(async () => {
    // Keep this consistent with the rest of the suite:
    // ensures game_* tables are cleared so no test pollution leaks in.
    await resetGameTables();
  });

  afterAll(async (done) => {
    await db.destroy();
    done();
  });

  test('all mitigations have a non-null cost', async () => {
    const rows = await db('mitigation').select('id').whereNull('cost');
    expect(rows).toHaveLength(0);
  });

  test('all responses have a non-null cost', async () => {
    const rows = await db('response').select('id').whereNull('cost');
    expect(rows).toHaveLength(0);
  });
});