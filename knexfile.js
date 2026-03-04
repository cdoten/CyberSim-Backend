require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: {
    connectionString: process.env.DB_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  },

  migrations: {
    directory: './migrations',
  },

  seeds: {
    directory: './seeds',
  },
};
