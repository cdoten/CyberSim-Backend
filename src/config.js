const config = {
  port: process.env.PORT,
  environment: process.env.NODE_ENV,
  migrationPassword: process.env.MIGRATION_PASSWORD ?? 'nothanks',
};

module.exports = config;
