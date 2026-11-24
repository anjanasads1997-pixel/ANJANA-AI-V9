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
        scriptSrc: ["'self'", "https://esm.sh"],
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

  async function geminiChat(message, language) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const systemInstruction = language === 'si'
      ? 'ඔබ ANJANA AI ය. පැහැදිලි, ප්‍රයෝජනවත් ශ්‍රී ලාංකික සිංහලෙන් පිළිතුරු දෙන්න. අවශ්‍ය විට English technical terms භාවිත කරන්න.'
      : 'You are ANJANA AI. Give clear, useful answers in English.';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Gemini request failed (${response.status})`);
    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '').join('').trim();
    if (!reply) throw new Error('Gemini returned no text. The response may have been blocked.');
    return { reply, model, provider: 'gemini' };
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

  async function hybridChat(message, language) {
    const failures = [];
    const providerOrder = String(process.env.AI_PROVIDER_ORDER || 'gemini,openai,ollama')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);

    for (const provider of providerOrder) {
      try {
        if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
          return await geminiChat(message, language);
        }
        if (provider === 'openai' && process.env.OPENAI_API_KEY) {
          return await openAiChat(message, language);
        }
        if (provider === 'ollama') {
          const localStatus = await ai.status();
          if (localStatus.online) {
            const result = await ai.chat(message);
            if (result.reply) return { ...result, provider: 'ollama' };
            throw new Error('Ollama returned an empty response');
          }
        }
      } catch (error) {
        failures.push(`${provider}: ${error.message}`);
        console.warn(`${provider} unavailable; trying next AI provider:`, error.message);
      }
    }

    const configured = [
      process.env.GEMINI_API_KEY && 'Gemini',
      process.env.OPENAI_API_KEY && 'OpenAI'
    ].filter(Boolean);
    const localStatus = await ai.status();
    if (localStatus.online) configured.push('Ollama');
    if (!configured.length) {
      throw new Error('No AI provider is configured. Add GEMINI_API_KEY (primary), OPENAI_API_KEY (backup), or connect a reachable Ollama server.');
    }
    throw new Error(`Configured AI providers could not answer. ${failures.join(' | ') || 'Check provider keys, model access, quota and Ollama network access.'}`);
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok', service: 'ANJANA AI', version: '9.3.0',
      core: core.getStatus(),
      features: {
        authentication: false, hybridAi: true,
        gemini: Boolean(process.env.GEMINI_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        liveAvatar: Boolean(process.env.LIVEAVATAR_API_KEY),
        textToSpeech: Boolean(process.env.OPENAI_API_KEY)
      }
    });
  });

  app.get('/api/ai/status', async (req, res) => {
    const ollama = await ai.status();
    const providers = {
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
      ollama: { configured: ollama.online, model: ollama.model, online: ollama.online }
    };
    const available = Object.entries(providers).filter(([, value]) => value.configured).map(([name]) => name);
    res.json({
      provider: process.env.AI_PROVIDER || 'hybrid',
      providerOrder: process.env.AI_PROVIDER_ORDER || 'gemini,openai,ollama',
      providers,
      available,
      onlineReady: available.length > 0,
      geminiConfigured: providers.gemini.configured,
      openaiConfigured: providers.openai.configured,
      ollama
    });
  });

  app.get('/api/avatar/status', (req, res) => {
    res.json({
      configured: Boolean(process.env.LIVEAVATAR_API_KEY),
      avatarIdConfigured: Boolean(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID),
      ttsConfigured: Boolean(process.env.OPENAI_API_KEY),
      mode: 'LITE'
    });
  });

  app.post('/api/avatar/session', avatarLimiter, async (req, res) => {
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID ||
      process.env.ANJANA_LIVEAVATAR_ID || '245c5ef6-fea0-4095-9894-79ff8f3947be';
    if (!apiKey) {
      return res.status(503).json({ error: 'LiveAvatar API key is not configured in Render Environment.' });
    }
    try {
      const response = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ mode: 'LITE', avatar_id: avatarId })
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
      return res.json({ session_token: sessionToken, session_id: sessionId, mode: 'LITE' });
    } catch (error) {
      console.error('LiveAvatar session error:', error.message);
      return res.status(502).json({ error: 'Unable to contact LiveAvatar right now.' });
    }
  });

  app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!core.validateMessage(message)) return res.status(400).json({ error: 'Invalid message' });
      const request = core.createRequest(message);
      const result = await hybridChat(request.message, request.language);
      return res.json({ ...result, language: request.language });
    } catch (error) {
      console.error('AI chat error:', error.message);
      return res.status(503).json({ error: error.message || 'AI providers are unavailable. Check server provider configuration.' });
    }
  });

  app.post('/api/tts', chatLimiter, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 3500) return res.status(400).json({ error: 'Text must contain 1-3500 characters.' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Text-to-speech is not configured. Add OPENAI_API_KEY in Render.' });
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
