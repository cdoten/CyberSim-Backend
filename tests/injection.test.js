const db = require('../src/models/db');
const { getInjections } = require('../src/models/injection');
const { staticInjections } = require('./testData');

const resetAllTables = require('./resetAllTables');
const seedTestData = require('./seedTestData');

describe('Get Injections', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedTestData(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('injection table should return with responses', async () => {
    const injectionsFromDb = await getInjections();
    expect(injectionsFromDb).toMatchObject(staticInjections);
  });
});