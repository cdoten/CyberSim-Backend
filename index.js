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

(async () => {
  try {
    // Validate env first (before importing modules that may open handles)
    await checkEnvironment();

    const db = require('./src/models/db');
    const app = require('./src/app');
    const createSocket = require('./src/socketio');

    // DB sanity via migrations (and reset in test)
    try {
      if (process.env.NODE_ENV === 'test') {
        await db.migrate.rollback({}, true);
        await db.migrate.latest();
        await db.seed.run();
        logger.info('Database successfully reset');
      } else {
        await db.migrate.latest();
      }
    } catch (e) {
      throw new AggregateError(
        [
          new Error(
            `Database migration/connection failed: ${e?.message || String(e)}`,
          ),
        ],
        'Environment validation failed',
      );
    }

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
