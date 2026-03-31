/**
 * List scenario revision tags available on disk under seeds/scenarios/.
 *
 * Returns an array of tag strings in "slug@revision" format,
 * e.g. ['cso@2026-03-03.1', 'cso@2026-03-19.1', 'tnr@2026-03-19.1']
 * sorted alphabetically within each scenario.
 *
 * Accepts an optional rootDir override for testing.
 */
const fs = require('fs');
const path = require('path');

function listAvailableRevisions(rootDir) {
  const scenariosRoot =
    rootDir || path.join(__dirname, '..', '..', '..', 'seeds', 'scenarios');

  if (!fs.existsSync(scenariosRoot)) return [];

  const tags = [];

  fs.readdirSync(scenariosRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .forEach((slug) => {
      const slugPath = path.join(scenariosRoot, slug);
      fs.readdirSync(slugPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .forEach((revision) => {
          tags.push(`${slug}@${revision}`);
        });
    });

  return tags;
}

module.exports = { listAvailableRevisions };
