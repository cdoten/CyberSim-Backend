const curveball = require('./v0/9_curveball.json');

exports.seed = (knex) => knex('curveball').insert(curveball);
