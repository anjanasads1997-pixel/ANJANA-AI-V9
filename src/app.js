
'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('node:path');

const AuthManager = require('./auth/auth-manager');
const SessionManager = require('./auth/session-manager');
const UserStore = require('./auth/store');
const createAuthRouter = require('./auth/auth-routes');
const AnjanaCore = require('./core/engine');
const OllamaClient = require('./core/ollama-client');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const dataDir = path.resolve(process.env.DATA_DIR || './data');

  const auth = new AuthManager();

  const sessions = new SessionManager({
    ttlMs: Number(process.env.SESSION_TTL_MS || 1800000),
    filePath: path.join(dataDir, 'sessions.json')
  });

  const users = new UserStore(
    path.join(dataDir, 'users.json')
  );

  const core = new AnjanaCore();

  const ai = new OllamaClient({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 120000)
  });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  const chatLimiter = rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ANJANA AI',
      version: core.version,
      core: core.getStatus()
    });
  });

  app.get('/api/ai/status', async (req, res) => {
    res.json(await ai.status());
  });

  app.post('/api/chat', chatLimiter, async (req, res) => {
    const message =
      typeof req.body?.message === 'string'
        ? req.body.message.trim()
        : '';

    if (!message) {
      return res.status(400).json({
        error: 'Please enter a message'
      });
    }

    if (message.length > 8000) {
      return res.status(413).json({
        error: 'Message is too long'
      });
    }

    try {
      const result = await ai.chat(message);
      res.json(result);
    } catch (error) {
      res.status(503).json({
        error: error.message || 'Local AI unavailable'
      });
    }
  });

  app.use(
    '/api/auth',
    authLimiter,
    createAuthRouter({
      authManager: auth,
      sessionManager: sessions,
      userStore: users,
      isProduction
    })
  );

  app.use(express.static(
    path.join(__dirname, '..', 'public')
  ));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    console.error(err.message);

    res.status(500).json({
      error: 'Internal server error'
    });
  });

  return app;
}

module.exports = { createApp };
