const injection = require('../v0/1_injection.json');

exports.seed = (knex) => knex('injection').insert(injection);
