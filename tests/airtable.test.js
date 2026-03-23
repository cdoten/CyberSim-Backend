// tests/airtable.test.js

const { getAirtableBaseId } = require('../src/util/airtable');

describe('getAirtableBaseId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the base ID for a known scenario slug', () => {
    process.env.AIRTABLE_BASE_IDS = 'cso:appAAAAAAA,tnr:appBBBBBBB';
    expect(getAirtableBaseId('cso')).toBe('appAAAAAAA');
  });

  it('returns the correct base ID when multiple scenarios are configured', () => {
    process.env.AIRTABLE_BASE_IDS = 'cso:appAAAAAAA,tnr:appBBBBBBB,eoeoq:appCCCCCCC';
    expect(getAirtableBaseId('tnr')).toBe('appBBBBBBB');
    expect(getAirtableBaseId('eoeoq')).toBe('appCCCCCCC');
  });

  it('handles spaces around entries', () => {
    process.env.AIRTABLE_BASE_IDS = 'cso:appAAAAAAA, tnr:appBBBBBBB';
    expect(getAirtableBaseId('tnr')).toBe('appBBBBBBB');
  });

  it('throws a clear error for an unknown scenario slug', () => {
    process.env.AIRTABLE_BASE_IDS = 'cso:appAAAAAAA,tnr:appBBBBBBB';
    expect(() => getAirtableBaseId('blurgle')).toThrow(
      'No Airtable base ID configured for scenario "blurgle"',
    );
  });

  it('throws a clear error when AIRTABLE_BASE_IDS is not set', () => {
    delete process.env.AIRTABLE_BASE_IDS;
    expect(() => getAirtableBaseId('cso')).toThrow(
      'No Airtable base ID configured for scenario "cso"',
    );
  });

  it('does not match a slug that is a prefix of another', () => {
    process.env.AIRTABLE_BASE_IDS = 'cso:appAAAAAAA,cso-extended:appBBBBBBB';
    expect(getAirtableBaseId('cso')).toBe('appAAAAAAA');
    expect(getAirtableBaseId('cso-extended')).toBe('appBBBBBBB');
  });
});
