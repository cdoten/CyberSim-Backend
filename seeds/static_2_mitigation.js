const mitigation = require('./v0/2_mitigation.json');

exports.seed = (knex) => knex('mitigation').insert(mitigation);
