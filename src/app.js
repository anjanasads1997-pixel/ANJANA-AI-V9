
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
  const dataDir = path.resolve(
    process.env.DATA_DIR || './data'
  );

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

  // Authentication middleware
  function requireAuth(req, res, next) {
    try {
      const token = req.cookies?.anjana_session;
      const session = sessions.get(token);

      if (!session) {
        return res.status(401).json({
          error: 'Please log in first'
        });
      }

      const user = users.findById(session.userId);

      if (!user) {
        return res.status(401).json({
          error: 'User account not found'
        });
      }

      req.user = {
        id: user.id,
        username: user.username
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error.message);

      return res.status(500).json({
        error: 'Authentication service unavailable'
      });
    }
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ANJANA AI',
      version: core.version,
      core: core.getStatus()
    });
  });

  // Local AI status
  app.get('/api/ai/status', async (req, res) => {
    try {
      res.json(await ai.status());
    } catch {
      res.status(503).json({
        error: 'AI service unavailable'
      });
    }
  });

  // Protected AI chat
  app.post(
    '/api/chat',
    requireAuth,
    chatLimiter,
    async (req, res) => {
      try {
        const message =
          typeof req.body?.message === 'string'
            ? req.body.message.trim()
            : '';

        if (!core.validateMessage(message)) {
          return res.status(400).json({
            error: 'Invalid message'
          });
        }

        const request = core.createRequest(message);
        const result = await ai.chat(request.message);

        return res.json({
          ...result,
          language: request.language
        });
      } catch (error) {
        console.error('AI chat error:', error.message);

        return res.status(503).json({
          error: 'Local AI service unavailable'
        });
      }
    }
  );

  // Authentication routes
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

  // Frontend
  app.use(express.static(
    path.join(__dirname, '..', 'public')
  ));

  // Error handler
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    console.error('Application error:', err.message);

    res.status(500).json({
      error: 'Internal server error'
    });
  });

  return app;
}

module.exports = { createApp };
