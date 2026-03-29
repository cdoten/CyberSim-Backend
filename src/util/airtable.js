// src/util/airtable.js
//
// Resolves Airtable configuration for a given scenario slug.
//
// AIRTABLE_BASE_IDS is a comma-separated list of slug:baseId pairs:
//   AIRTABLE_BASE_IDS=cso:appXXXXXX,tnr:appYYYYYY,eoeoq:appZZZZZZ
//
// AIRTABLE_ACCESS_TOKEN is a single PAT with access to all bases.

function getAirtableBaseId(scenarioSlug) {
  const mapping = process.env.AIRTABLE_BASE_IDS || '';

  const entry = mapping
    .split(',')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${scenarioSlug}:`));

  if (!entry) {
    throw new Error(
      `No Airtable base ID configured for scenario "${scenarioSlug}". ` +
        `Add "${scenarioSlug}:appXXXXXX" to the AIRTABLE_BASE_IDS environment variable.`,
    );
  }

  return entry.split(':')[1];
}

module.exports = { getAirtableBaseId };
