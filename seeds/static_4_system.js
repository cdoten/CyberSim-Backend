const system = require('./v0/4_system.json');

exports.seed = (knex) => knex('system').insert(system);
