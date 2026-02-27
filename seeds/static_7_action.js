const action = require('./v0/7_action.json');

exports.seed = (knex) => knex('action').insert(action);
