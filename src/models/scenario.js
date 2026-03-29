const db = require('./db');

// Look up a scenario by its URL slug (e.g. 'cso', 'campaign').
// Throws a descriptive error if the slug doesn't exist, so callers
// get a clear message rather than a null-reference error later.
const getScenarioBySlug = async (slug) => {
  const scenario = await db('scenario').where({ slug }).first();
  if (!scenario) {
    const err = new Error(`Scenario not found: "${slug}"`);
    err.statusCode = 404;
    throw err;
  }
  return scenario;
};

module.exports = { getScenarioBySlug };
