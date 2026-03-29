const pino = require('pino');
const config = require('./config');

const isTest = config.environment === 'test';
const isProd = config.environment === 'production';

const logger = pino({
  enabled: !isTest,
  level: process.env.LOG_LEVEL ?? (isProd ? 'error' : 'info'),
  // Keep req/res log output compact. express-pino-logger uses pino v6's
  // child() which only accepts one argument, so serializers must live here
  // on the parent logger — they're inherited by the child logger that
  // express-pino-logger creates, rather than being passed via options.
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
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
