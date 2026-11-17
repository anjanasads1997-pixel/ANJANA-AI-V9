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

const LIVEAVATAR_API = 'https://api.liveavatar.com';

function createApp() {
  const app = express();

  // Render reverse proxy: trust the single proxy hop in front of this service.
  app.set('trust proxy', 1);
  const isProduction = process.env.NODE_ENV === 'production';
  const dataDir = path.resolve(process.env.DATA_DIR || './data');

  const auth = new AuthManager();
  const sessions = new SessionManager({
    ttlMs: Number(process.env.SESSION_TTL_MS || 1800000),
    filePath: path.join(dataDir, 'sessions.json')
  });
  const users = new UserStore(path.join(dataDir, 'users.json'));
  const core = new AnjanaCore();
  const ai = new OllamaClient({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 12000)
  });

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'https:', 'wss:']
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: '1mb' }));
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
  const avatarLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
  });

  function requireAuth(req, res, next) {
    try {
      const token = req.cookies?.anjana_session;
      const session = sessions.get(token);
      if (!session) return res.status(401).json({ error: 'Please log in first' });
      const user = users.findById(session.userId);
      if (!user) return res.status(401).json({ error: 'User account not found' });
      req.user = { id: user.id, username: user.username };
      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      return res.status(500).json({ error: 'Authentication service unavailable' });
    }
  }

  async function openAiChat(message, language) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: language === 'si'
            ? 'ඔබ ANJANA AI ය. පැහැදිලි, ප්‍රයෝජනවත් සිංහලෙන් පිළිතුරු දෙන්න. අවශ්‍ය විට ඉංග්‍රීසි තාක්ෂණික පද භාවිත කරන්න.'
            : 'You are ANJANA AI. Give clear, helpful answers in English.' },
          { role: 'user', content: message }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `OpenAI request failed (${response.status})`);
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('The AI provider returned an empty response');
    return { reply, model: data.model || process.env.OPENAI_MODEL || 'gpt-4o-mini', provider: 'openai' };
  }

  async function geminiChat(message, language) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const system = language === 'si'
      ? 'ඔබ ANJANA AI ය. පැහැදිලි, නිවැරදි, ප්‍රයෝජනවත් සිංහලෙන් පිළිතුරු දෙන්න.'
      : 'You are ANJANA AI. Give clear, accurate and helpful English answers.';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: message }] }], generationConfig: { temperature: 0.7 } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Gemini request failed (${response.status})`);
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) throw new Error('Gemini returned an empty response');
    return { reply, model, provider: 'gemini' };
  }

  async function hybridChat(message, language) {
    const provider = String(process.env.AI_PROVIDER || 'hybrid').toLowerCase();
    if (provider === 'gemini') return geminiChat(message, language);
    if (provider === 'openai') return openAiChat(message, language);
    if (provider === 'ollama' || provider === 'local') return { ...(await ai.chat(message)), provider: 'ollama' };
    // Default hybrid order: Gemini primary, OpenAI backup, then local Ollama.
    if (process.env.GEMINI_API_KEY) {
      try { return await geminiChat(message, language); }
      catch (error) { console.warn('Gemini unavailable; trying OpenAI:', error.message); }
    }
    if (process.env.OPENAI_API_KEY) {
      try { return await openAiChat(message, language); }
      catch (error) { console.warn('OpenAI unavailable; trying local Ollama:', error.message); }
    }
    return { ...(await ai.chat(message)), provider: 'ollama' };
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok', service: 'ANJANA AI', version: '10.2.0',
      core: core.getStatus(),
      features: {
        authentication: true, hybridAi: true,
        liveAvatar: Boolean(process.env.LIVEAVATAR_API_KEY),
        liveAvatarAvatarId: Boolean(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID),
        textToSpeech: Boolean(process.env.OPENAI_API_KEY)
      }
    });
  });

  app.get('/api/ai/status', async (req, res) => {
    try {
      const ollama = await ai.status();
      res.json({
        provider: process.env.AI_PROVIDER || 'hybrid',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        ollama,
        onlineReady: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
      });
    } catch (error) {
      res.status(503).json({ error: 'AI status unavailable' });
    }
  });

  app.get('/api/avatar/status', requireAuth, (req, res) => {
    res.json({
      configured: Boolean(process.env.LIVEAVATAR_API_KEY),
      avatarIdConfigured: Boolean(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID),
      ttsConfigured: Boolean(process.env.OPENAI_TTS_API_KEY || process.env.BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      mode: String(process.env.LIVEAVATAR_MODE || 'LITE').toUpperCase(),
      sandbox: String(process.env.LIVEAVATAR_SANDBOX || 'true').toLowerCase() === 'true'
    });
  });

  app.post('/api/avatar/session', requireAuth, avatarLimiter, async (req, res) => {
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID ||
      process.env.ANJANA_LIVEAVATAR_ID || '245c5ef6-fea0-4095-9894-79ff8f3947be';
    const avatarMode = String(process.env.LIVEAVATAR_MODE || 'LITE').toUpperCase();
    const isSandbox = String(process.env.LIVEAVATAR_SANDBOX || 'true').toLowerCase() === 'true';
    if (avatarMode !== 'LITE') {
      return res.status(400).json({ error: 'This ANJANA AI integration is configured for LiveAvatar LITE mode.' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'LiveAvatar API key is not configured in Render Environment.' });
    }
    try {
      const response = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ mode: avatarMode, avatar_id: avatarId, is_sandbox: isSandbox })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('LiveAvatar token request failed:', response.status, data?.message || data?.error || 'provider error');
        return res.status(502).json({ error: 'LiveAvatar could not create a session. Check API key, avatar ID and account access.' });
      }
      const sessionToken = data?.data?.session_token;
      const sessionId = data?.data?.session_id;
      if (!sessionToken || !sessionId) {
        return res.status(502).json({ error: 'LiveAvatar returned an incomplete session response.' });
      }
      return res.json({ session_token: sessionToken, session_id: sessionId, mode: avatarMode, sandbox: isSandbox });
    } catch (error) {
      console.error('LiveAvatar session error:', error.message);
      return res.status(502).json({ error: 'Unable to contact LiveAvatar right now.' });
    }
  });

  app.post('/api/chat', requireAuth, chatLimiter, async (req, res) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!core.validateMessage(message)) return res.status(400).json({ error: 'Invalid message' });
      const request = core.createRequest(message);
      const result = await hybridChat(request.message, request.language);
      return res.json({ ...result, language: request.language });
    } catch (error) {
      console.error('AI chat error:', error.message);
      return res.status(503).json({ error: 'AI providers are unavailable. Check Gemini/OpenAI credentials or the local Ollama connection.' });
    }
  });

  app.post('/api/tts', requireAuth, chatLimiter, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 3500) return res.status(400).json({ error: 'Text must contain 1-3500 characters.' });
    const apiKey = process.env.OPENAI_TTS_API_KEY || process.env.BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Text-to-speech is not configured. Add OPENAI_TTS_API_KEY or BACKUP_OPENAI_API_KEY in Render.' });
    const allowedVoices = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar']);
    const requestedVoice = typeof req.body?.voice === 'string' ? req.body.voice : '';
    const voice = allowedVoices.has(requestedVoice) ? requestedVoice : (process.env.OPENAI_TTS_VOICE || 'coral');
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
          voice, input: text, response_format: 'pcm',
          instructions: 'Speak clearly and naturally in the same language as the input. For Sinhala, use clear Sri Lankan Sinhala pronunciation.'
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TTS provider error:', response.status, errorData?.error?.message || 'provider error');
        return res.status(502).json({ error: 'Voice generation failed. Check OpenAI TTS access and settings.' });
      }
      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length || audio.length > 12 * 1024 * 1024) return res.status(502).json({ error: 'Voice provider returned invalid audio data.' });
      return res.json({ audio: audio.toString('base64'), format: 'pcm_s16le', sample_rate: 24000, channels: 1 });
    } catch (error) {
      console.error('TTS error:', error.message);
      return res.status(502).json({ error: 'Unable to generate voice audio.' });
    }
  });

  app.use('/api/auth', authLimiter, createAuthRouter({
    authManager: auth, sessionManager: sessions, userStore: users, isProduction
  }));

  app.use(express.static(path.join(__dirname, '..', 'public'), {
    etag: true, maxAge: isProduction ? '1h' : 0
  }));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('Application error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
