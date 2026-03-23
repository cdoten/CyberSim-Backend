const helmet = require('helmet');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const expressPino = require('express-pino-logger');

const crypto = require('crypto');
const logger = require('./logger');
const db = require('./models/db');
const { getResponses } = require('./models/response');
const { getInjections } = require('./models/injection');
const { getActions } = require('./models/action');
const importScenarioFromAirtable = require('./util/importScenarioFromAirtable');
const { getAirtableBaseId } = require('./util/airtable');
const config = require('./config');
const { transformValidationErrors } = require('./util/errors');

const app = express();

logger.info({ commit: process.env.GIT_COMMIT || 'unknown' }, 'App loaded');

app.use(helmet());
app.use(expressPino({ logger }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

const allowedOrigins = (process.env.UI_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests like curl or health checks with no Origin header
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

app.get('/', async (req, res) => {
  try {
    await db.raw('SELECT 1;');
  } catch (_) {
    res.status(500);
    res.send({ status: 'not ok' });
    return;
  }
  res.status(200);
  res.send({
    status: 'ok',
  });
});

app.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1;');
    res.status(200).send({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).send({ status: 'not ok' });
  }
});

app.get('/health/airtable', async (req, res) => {
  try {
    const token = process.env.AIRTABLE_ACCESS_TOKEN;
    const baseIdsRaw = process.env.AIRTABLE_BASE_IDS || '';

    if (!token || !baseIdsRaw) {
      return res.status(500).json({
        ok: false,
        message: 'Missing AIRTABLE_ACCESS_TOKEN or AIRTABLE_BASE_IDS',
      });
    }

    // Use the first configured base as a connectivity sanity check.
    const firstEntry = baseIdsRaw.split(',')[0].trim();
    const baseId = firstEntry.split(':')[1];

    const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: 'Airtable meta API check failed',
        status: response.status,
        error: body?.error,
      });
    }

    return res.json({
      ok: true,
      baseId,
      tables: (body?.tables || []).map((t) => ({
        id: t.id,
        name: t.name,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err?.message || 'Unexpected error',
    });
  }
});

// health: database connectivity check
app.get('/health/db', async (req, res) => {
  try {
    // db is your knex instance from src/models/db
    // If you already have it in this file, reuse it.
    const result = await db.raw('select 1 as ok');

    // knex raw returns slightly different shapes depending on driver;
    // for pg it’s usually { rows: [...] }
    const ok = result?.rows?.[0]?.ok === 1 || result?.rows?.[0]?.ok === '1';
    return res.json({
      ok,
      message: 'Database reachable',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: 'Database not reachable',
      error: err?.message,
    });
  }
});

// STATIC DB data is exposed via REST api
app.get('/mitigations', async (req, res) => {
  const records = await db('mitigation');
  res.json(records);
});

app.get('/locations', async (req, res) => {
  const records = await db('location');
  res.json(records);
});

app.get('/dictionary', async (req, res) => {
  const records = await db('dictionary').select('word', 'synonym');
  res.json(records);
});

app.get('/systems', async (req, res) => {
  const records = await db('system');
  res.json(records);
});

app.get('/injections', async (req, res) => {
  const records = await getInjections();
  res.json(records);
});

app.get('/responses', async (req, res) => {
  const records = await getResponses();
  res.json(records);
});

app.get('/actions', async (req, res) => {
  const records = await getActions();
  res.json(records);
});

app.get('/curveballs', async (req, res) => {
  const records = await db('curveball');
  res.json(records);
});

app.post('/scenario/import', async (req, res) => {
  const { password, scenarioSlug = 'cso' } = req.body;

  // Ensure there is in fact some password set.
  const configuredPassword = config.migrationPassword;
  if (!config.migrationPassword) {
    return res.status(500).send({ message: 'Migration disabled.' });
  }

  if (password !== configuredPassword) {
    return res.status(400).json({ password: 'Invalid migration password' });
  }

  const accessToken = process.env.AIRTABLE_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).send({
      message: 'Server is missing Airtable configuration (AIRTABLE_ACCESS_TOKEN).',
    });
  }

  let baseId;
  try {
    baseId = getAirtableBaseId(scenarioSlug);
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }

  try {
    await importScenarioFromAirtable(accessToken, baseId, scenarioSlug);
    return res.send();
  } catch (err) {
    if (err.error === 'AUTHENTICATION_REQUIRED') {
      return res.status(400).send({
        message: 'Invalid Airtable access token (server configuration).',
      });
    }

    if (err.error === 'NOT_FOUND') {
      return res.status(400).send({
        message: 'Invalid Airtable base id (server configuration).',
      });
    }

    if (err.error === 'NOT_AUTHORIZED') {
      return res.status(400).send({
        validation: true,
        message:
          'Airtable authorization error. Check the base access and token scopes (data.records:read, schema.bases:read).',
        errors: [
          {
            message:
              'Token does not have access to this base or lacks required scopes.',
          },
        ],
      });
    }

    if (err.validation) {
      const errors = transformValidationErrors(err);
      return res.status(400).send({
        validation: true,
        message: err.message,
        errors,
      });
    }

    logger.error({ message: err.message, stack: err.stack }, 'Import failed');
    return res.status(500).send({
      message:
        'There was an internal server error during the migration! Please contact the developers to fix it.',
    });
  }
});

// Final error handler (must be after routes)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;

  // Always log full details + stack
  logger.error({
    msg: 'Unhandled error',
    status,
    method: req.method,
    path: req.originalUrl,
    err: err?.stack || err,
  });

  // Client-safe response
  res.status(status).json({
    error: err.code || 'INTERNAL_ERROR',
    message: status < 500 ? err.message : 'Server error',
  });
});

module.exports = app;
