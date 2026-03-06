/* eslint-disable global-require */

const { createServer } = require('http');
const logger = require('./src/logger');

const checkEnvironment = async () => {
  const failures = [];

  if (!process.env.NODE_ENV) failures.push(new Error('NODE_ENV must be set'));
  if (!process.env.DB_URL) failures.push(new Error('DB_URL must be set'));

  if (failures.length) {
    throw new AggregateError(failures, 'Environment validation failed');
  }
};

const formatDbConnectionError = (err) => {
  const message = err?.message || String(err);

  if (message.includes('ENOTFOUND')) {
    return 'Database host could not be resolved. Check the RDS endpoint in DB_URL.';
  }

  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('Timeout acquiring a connection') ||
    message.toLowerCase().includes('timeout')
  ) {
    return 'Database connection timed out or was refused. Check that Elastic Beanstalk can reach RDS on port 5432, and verify VPC and security group rules.';
  }

  if (message.includes('password authentication failed')) {
    return 'Database authentication failed. Check the username and password in DB_URL.';
  }

  if (message.includes('does not exist')) {
    return 'Database does not exist. Check the database name in DB_URL.';
  }

  if (message.toLowerCase().includes('ssl')) {
    return 'Database SSL connection failed. Check PostgreSQL SSL settings and DB_URL configuration.';
  }

  return `Database connection failed: ${message}`;
};

const checkDatabaseConnection = async (db) => {
  try {
    await db.raw('select 1');
    logger.info('Database connection successful');
  } catch (err) {
    throw new Error(formatDbConnectionError(err));
  }
};

const runDatabaseSetup = async (db) => {
  try {
    if (process.env.NODE_ENV === 'test') {
      await db.migrate.rollback({}, true);
      await db.migrate.latest();
      await db.seed.run();
      logger.info('Database successfully reset');
    } else {
      await db.migrate.latest();
      logger.info('Database migrations completed');
    }
  } catch (err) {
    throw new Error(
      `Database migration failed: ${err?.message || String(err)}`,
    );
  }
};

(async () => {
  try {
    // Validate env first (before importing modules that may open handles)
    await checkEnvironment();

    const db = require('./src/models/db');
    const app = require('./src/app');
    const createSocket = require('./src/socketio');

    // First confirm we can reach the database at all
    await checkDatabaseConnection(db);

    // Then run migrations / test reset
    await runDatabaseSetup(db);

    const port = process.env.PORT || 8080;
    const http = createServer(app);
    createSocket(http);

    const server = http.listen(port, () => {
      logger.info(`Server is running at port: ${port}`);
    });

    let shuttingDown = false;
    const gracefulShutdown = () => {
      logger.info('Got kill signal, starting graceful shutdown');
      if (shuttingDown) return;
      shuttingDown = true;

      const forceTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out; forcing exit');
        process.exit(1);
      }, 10000);

      server.close((err) => {
        clearTimeout(forceTimer);
        if (err) {
          logger.error({ err }, 'Error during graceful shutdown');
          process.exit(1);
        }
        logger.info('Graceful shutdown finished.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (err) {
    console.error('Startup failure:', err);

    logger.error({ err }, 'Startup failed');
    if (err instanceof AggregateError && Array.isArray(err.errors)) {
      err.errors.forEach((e, i) => {
        logger.error({ err: e }, `Failure #${i + 1}`);
      });
    }

    process.exit(1);
  }
})();
