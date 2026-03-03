const response = require('../v0/3_response.json');

exports.seed = (knex) => knex('response').insert(response);
