const pino = require('pino');
const config = require('./config');

const isTest = config.environment === 'test';
const isProd = config.environment === 'production';

const logger = pino({
  enabled: !isTest,
  level: process.env.LOG_LEVEL ?? (isProd ? 'error' : 'info'),
  transport: !isProd
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

module.exports = logger;
