const db = require('./db');

const getResponseWithCost = (responseWithMitigationCosts) => {
  const { mitCost, ...response } = responseWithMitigationCosts;
  if (response.cost !== null) {
    return response;
  }

  return { ...response, cost: mitCost || 0 };
};

const getResponsesById = async (responseIds) => {
  const responses = await db('response')
    .select('response.*', 'mitigation.cost as mitCost')
    .leftOuterJoin('mitigation', 'response.mitigation_id', 'mitigation.id')
    .whereIn('response.id', responseIds);

  return responses.map((response) => getResponseWithCost(response));
};

const getResponses = async () => {
  const records = await db('response')
    .select('response.*', 'mitigation.cost as mitCost')
    .leftOuterJoin('mitigation', 'response.mitigation_id', 'mitigation.id');
  return records.map((response) => getResponseWithCost(response));
};

const getResponsesByScenarioId = async (scenarioId) => {
  const records = await db('response')
    .select('response.*', 'mitigation.cost as mitCost')
    .leftOuterJoin('mitigation', 'response.mitigation_id', 'mitigation.id')
    .where({ 'response.scenario_id': scenarioId });

  return records.map((response) => getResponseWithCost(response));
};

module.exports = {
  getResponses,
  getResponsesById,
  getResponsesByScenarioId,
};
