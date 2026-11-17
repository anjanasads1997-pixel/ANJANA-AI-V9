
'use strict';

const express = require('express');

function createAuthRouter({
  authManager,
  sessionManager,
  userStore,
  isProduction = false
}) {
  const router = express.Router();

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60 * 1000
  };

  router.post('/register', async (req, res) => {
    try {
      const username = String(req.body?.username || '')
        .trim()
        .toLowerCase();

      const password = req.body?.password;

      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({
          error: 'Invalid username'
        });
      }

      if (typeof password !== 'string' ||
          password.length < 10 ||
          password.length > 128) {
        return res.status(400).json({
          error: 'Password must be 10-128 characters'
        });
      }

      if (userStore.findByUsername(username)) {
        return res.status(409).json({
          error: 'Username already exists'
        });
      }

      const passwordHash =
        await authManager.hashPassword(password);

      const user = userStore.create({
        id: authManager.createId(),
        username,
        passwordHash
      });

      return res.status(201).json({
        message: 'Registration successful',
        user
      });
    } catch (error) {
      console.error('Registration error:', error.message);

      return res.status(500).json({
        error: 'Registration failed'
      });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '')
        .trim()
        .toLowerCase();

      const password = req.body?.password;

      if (typeof password !== 'string' ||
          !username ||
          password.length > 128) {
        return res.status(400).json({
          error: 'Invalid login details'
        });
      }

      const user = userStore.findByUsername(username);

      if (!user || !await authManager.verifyPassword(
        password,
        user.passwordHash
      )) {
        return res.status(401).json({
          error: 'Invalid username or password'
        });
      }

      const session = sessionManager.create(user.id);

      res.cookie('anjana_session', session.token, {
        ...cookieOptions,
        maxAge: Math.max(0, session.expiresAt - Date.now())
      });

      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Login error:', error.message);

      return res.status(500).json({
        error: 'Login failed'
      });
    }
  });

  router.post('/logout', (req, res) => {
    const token = req.cookies?.anjana_session;

    if (token) {
      sessionManager.revoke(token);
    }

    res.clearCookie('anjana_session', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/'
    });

    return res.json({
      message: 'Logout successful'
    });
  });

  router.get('/me', (req, res) => {
    const token = req.cookies?.anjana_session;
    const session = sessionManager.get(token);

    if (!session) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    const user = userStore.findById(session.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username
      }
    });
  });

  return router;
}

module.exports = createAuthRouter;
