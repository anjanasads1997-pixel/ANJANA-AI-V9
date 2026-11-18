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
        scriptSrc: ["'self'", 'https:', "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'blob:']
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

  function normalizeBaseUrl(value, fallback = 'https://api.openai.com/v1') {
    const raw = String(value || fallback).trim().replace(/\/+$/, '');
    let parsed;
    try { parsed = new URL(raw); } catch { throw new Error('OPENAI_BASE_URL is not a valid URL'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('OPENAI_BASE_URL must use HTTPS');
    if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      throw new Error('OPENAI_BASE_URL must use HTTPS');
    }
    if (parsed.search || parsed.hash) throw new Error('OPENAI_BASE_URL must not contain query parameters or fragments');
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (parsed.hostname === 'api.openai.com' && !pathname) pathname = '/v1';
    pathname = pathname.replace(/\/chat\/completions$/i, '');
    return `${parsed.origin}${pathname}`;
  }

  // Detect the old Render layout where OPENAI_* actually held Gemini-compatible settings.
  // In that layout the real OpenAI key/model live in BACKUP_OPENAI_*.
  function hasLegacyGeminiConfig() {
    try {
      const host = new URL(String(process.env.OPENAI_BASE_URL || '')).hostname.toLowerCase();
      return host === 'generativelanguage.googleapis.com' || host.endsWith('.googleapis.com');
    } catch { return false; }
  }

  function openAiConfig() {
    const legacyGemini = hasLegacyGeminiConfig();
    return {
      apiKey: legacyGemini
        ? (process.env.BACKUP_OPENAI_API_KEY || '')
        : (process.env.OPENAI_API_KEY || process.env.BACKUP_OPENAI_API_KEY || ''),
      baseUrl: legacyGemini
        ? (process.env.BACKUP_OPENAI_BASE_URL || 'https://api.openai.com/v1')
        : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
      model: legacyGemini
        ? (process.env.BACKUP_OPENAI_MODEL || 'gpt-5.4-mini')
        : (process.env.OPENAI_MODEL || process.env.BACKUP_OPENAI_MODEL || 'gpt-5.4-mini')
    };
  }

  function hasGeminiCredentials() {
    return Boolean(process.env.GEMINI_API_KEY || (hasLegacyGeminiConfig() && process.env.OPENAI_API_KEY));
  }

  function redactProviderText(value) {
    return String(value || '')
      .replace(/(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})/g, '[redacted]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, 320);
  }

  async function openAiCompatibleChat(message, language, config) {
    const apiKey = String(config.apiKey || '').trim();
    if (!apiKey) throw new Error(`${config.label || 'OpenAI-compatible'} API key is not configured`);
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const model = String(config.model || 'gpt-4.1-mini').trim();
    if (!model) throw new Error('OPENAI_MODEL is empty');

    const maxAttempts = 2;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 45000)),
          body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
              { role: 'system', content: language === 'si'
                ? 'ඔබ ANJANA AI ය. පැහැදිලි, ප්‍රයෝජනවත් සිංහලෙන් පිළිතුරු දෙන්න. අවශ්‍ය විට ඉංග්‍රීසි තාක්ෂණික පද භාවිත කරන්න.'
                : 'You are ANJANA AI. Give clear, helpful answers in English.' },
              { role: 'user', content: message }
            ]
          })
        });
      } catch (error) {
        const reason = error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'request timed out' : redactProviderText(error.message);
        lastError = new Error(`${config.label || 'OpenAI'} network error: ${reason}`);
        if (attempt < maxAttempts) { await new Promise(resolve => setTimeout(resolve, 900)); continue; }
        throw lastError;
      }

      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { data = { message: raw.slice(0, 320) }; }

      if (response.ok) {
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (!reply) throw new Error(`${config.label || 'OpenAI'} returned an empty response (HTTP ${response.status})`);
        return { reply, model: data.model || model, provider: config.provider || 'openai-compatible' };
      }

      const providerError = data.error || {};
      const detail = redactProviderText(
        providerError.message || data.message || data.detail || raw || response.statusText
      );
      const code = redactProviderText(providerError.code || providerError.type || data.code || '');
      const requestId = redactProviderText(response.headers.get('x-request-id') || response.headers.get('request-id') || '');
      const status = response.status;
      const retryable = [408, 429, 500, 502, 503, 504].includes(status);
      lastError = new Error(
        `${config.label || 'OpenAI'} HTTP ${status}${code ? ` (${code})` : ''}: ${detail || response.statusText || 'Provider returned an error'}${requestId ? ` [request ${requestId}]` : ''}`
      );
      lastError.status = status;
      lastError.retryable = retryable;
      if (retryable && attempt < maxAttempts) {
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        const delay = Math.min(2500, Math.max(900, retryAfter > 0 ? retryAfter * 1000 : 900));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw lastError;
    }
    throw lastError || new Error('OpenAI request failed');
  }

  async function openAiChat(message, language) {
    // Prefer the new OPENAI_* layout. If an older Render service still stores
    // Gemini in OPENAI_* and paid OpenAI in BACKUP_OPENAI_*, route each key correctly.
    const config = openAiConfig();
    return openAiCompatibleChat(message, language, {
      ...config,
      label: 'OpenAI', provider: 'openai'
    });
  }

  async function primaryCloudChat(message, language) {
    return openAiChat(message, language);
  }

  async function geminiChat(message, language) {
    // Legacy Render compatibility: OPENAI_API_KEY may still contain the Gemini key
    // when OPENAI_BASE_URL points to Google's OpenAI-compatible endpoint.
    const legacyGemini = hasLegacyGeminiConfig();
    const apiKey = process.env.GEMINI_API_KEY || (legacyGemini ? process.env.OPENAI_API_KEY : '');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = process.env.GEMINI_MODEL || (legacyGemini ? process.env.OPENAI_MODEL : '') || 'gemini-3.8-flash';
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
    const provider = String(process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();
    if (provider === 'gemini') return geminiChat(message, language);
    if (provider === 'openai') return openAiChat(message, language);
    if (provider === 'ollama' || provider === 'local') return { ...(await ai.chat(message)), provider: 'ollama' };

    const failures = [];
    try {
      return await openAiChat(message, language);
    } catch (error) {
      failures.push(`OpenAI: ${redactProviderText(error.message)}`);
      console.warn('OpenAI unavailable; trying Gemini:', redactProviderText(error.message));
    }

    if (hasGeminiCredentials()) {
      try {
        return await geminiChat(message, language);
      } catch (error) {
        failures.push(`Gemini: ${redactProviderText(error.message)}`);
        console.warn('Gemini unavailable; trying local Ollama:', redactProviderText(error.message));
      }
    } else {
      failures.push('Gemini: GEMINI_API_KEY is not configured');
    }

    try {
      return { ...(await ai.chat(message)), provider: 'ollama' };
    } catch (error) {
      failures.push(`Ollama: ${redactProviderText(error.message)}`);
    }

    const diagnostic = failures.join(' | ').slice(0, 850);
    const unavailable = new Error(`සියලු AI Engine අසාර්ථකයි. ${diagnostic}`);
    unavailable.providerFailures = failures;
    throw unavailable;
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok', service: 'ANJANA AI', version: '10.2.7',
      core: core.getStatus(),
      features: {
        authentication: true, hybridAi: true,
        liveAvatar: Boolean(process.env.LIVEAVATAR_API_KEY),
        liveAvatarAvatarId: Boolean(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID),
        textToSpeech: Boolean(process.env.OPENAI_TTS_API_KEY || process.env.BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
        liveAvatarSandbox: String(process.env.LIVEAVATAR_SANDBOX || 'false').toLowerCase() === 'true'
      }
    });
  });

  app.get('/api/ai/status', async (req, res) => {
    try {
      const ollama = await ai.status();
      res.json({
        version: '10.2.7',
        provider: process.env.AI_PROVIDER || 'hybrid',
        openaiModel: openAiConfig().model,
        geminiModel: process.env.GEMINI_MODEL || (hasLegacyGeminiConfig() ? process.env.OPENAI_MODEL : '') || 'gemini-3.8-flash',
        geminiConfigured: hasGeminiCredentials(),
        openaiConfigured: Boolean(openAiConfig().apiKey),
        ollama,
        onlineReady: Boolean(openAiConfig().apiKey || hasGeminiCredentials())
      });
    } catch (error) {
      res.status(503).json({ error: 'AI status unavailable' });
    }
  });

  app.post('/api/ai/test', requireAuth, chatLimiter, async (req, res) => {
    try {
      const result = await openAiChat('Reply with exactly: ANJANA AI OpenAI connection OK.', 'en');
      return res.json({ ok: true, provider: result.provider, model: result.model, reply: result.reply });
    } catch (error) {
      const diagnostic = redactProviderText(error.message || 'Unknown OpenAI error');
      const status = Number(error.status) || 503;
      console.error('OpenAI connection test failed:', diagnostic);
      let hint = 'Render Environment හි OPENAI_API_KEY, OPENAI_BASE_URL=https://api.openai.com/v1 සහ OPENAI_MODEL පරීක්ෂා කරන්න.';
      if (status === 401 || status === 403) hint = 'OpenAI API key එක වැරදිද, අවලංගුද, හෝ project permissions ප්‍රමාණවත්ද පරීක්ෂා කරන්න.';
      else if (status === 404) hint = 'OPENAI_MODEL නම සහ API endpoint එක පරීක්ෂා කරන්න. OPENAI_BASE_URL සාමාන්‍යයෙන් https://api.openai.com/v1 විය යුතුයි.';
      else if (status === 429) hint = 'OpenAI billing, quota සහ rate limits පරීක්ෂා කරන්න.';
      else if ([500, 502, 503, 504].includes(status)) hint = 'OpenAI සේවාවේ තාවකාලික server/availability ගැටලුවක් විය හැක. පද්ධතිය එක් වරක් නැවත උත්සාහ කරයි; පසුව නැවත පරීක්ෂා කරන්න.';
      return res.status(503).json({ ok: false, error: 'OpenAI connection failed', providerStatus: status, diagnostic, hint });
    }
  });

  app.get('/api/avatar/status', requireAuth, (req, res) => {
    res.json({
      configured: Boolean(process.env.LIVEAVATAR_API_KEY),
      avatarIdConfigured: Boolean(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID),
      ttsConfigured: Boolean(process.env.OPENAI_TTS_API_KEY || process.env.BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      mode: String(process.env.LIVEAVATAR_MODE || 'LITE').toUpperCase(),
      sandbox: String(process.env.LIVEAVATAR_SANDBOX || 'false').toLowerCase() === 'true'
    });
  });

  app.post('/api/avatar/session', requireAuth, avatarLimiter, async (req, res) => {
    const apiKey = String(process.env.LIVEAVATAR_API_KEY || '').trim();
    const avatarId = String(process.env.LIVEAVATAR_AVATAR_ID || process.env.ANJANA_LIVEAVATAR_ID || '').trim();
    const avatarMode = String(process.env.LIVEAVATAR_MODE || 'LITE').trim().toUpperCase();
    const sandboxValue = String(process.env.LIVEAVATAR_SANDBOX ?? 'false').trim().toLowerCase();
    const isSandbox = sandboxValue === 'true';
    if (!apiKey) return res.status(503).json({ error: 'Render හි LIVEAVATAR_API_KEY සකසා නැත.' });
    if (!avatarId) return res.status(503).json({ error: 'Render හි ඔබගේ ගිණුමට අයත් LIVEAVATAR_AVATAR_ID සකසා නැත.' });
    if (avatarMode !== 'LITE') return res.status(400).json({ error: 'LIVEAVATAR_MODE අගය LITE විය යුතුයි.' });
    if (!['true', 'false'].includes(sandboxValue)) return res.status(400).json({ error: 'LIVEAVATAR_SANDBOX අගය true හෝ false විය යුතුයි.' });

    try {
      const response = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ mode: 'LITE', avatar_id: avatarId, is_sandbox: isSandbox })
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw_message: raw.slice(0, 500) }; }
      if (!response.ok) {
        const providerMessage = data?.data?.[0]?.message || data?.data?.message || data?.error?.message || data?.error || data?.message || data?.raw_message || 'LiveAvatar provider rejected the request';
        const providerCode = data?.data?.[0]?.code || data?.code || data?.error?.code || '';
        // Log diagnostics only. Never log API keys, session tokens, or full request headers.
        console.error('LiveAvatar token request failed:', JSON.stringify({
          status: response.status,
          code: String(providerCode).slice(0, 80),
          message: String(providerMessage).slice(0, 400),
          avatarIdConfigured: Boolean(avatarId),
          avatarIdLooksLikeUuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(avatarId),
          sandbox: isSandbox,
          mode: avatarMode
        }));
        return res.status(502).json({
          error: `LiveAvatar API දෝෂය (${response.status}): ${String(providerMessage).slice(0, 240)}`,
          provider_status: response.status,
          provider_code: String(providerCode).slice(0, 80) || undefined,
          hint: response.status === 400
            ? isSandbox ? 'මෙම Avatar ID එක Sandbox mode සඳහා සහාය නොදක්වයි. Render හි LIVEAVATAR_SANDBOX=false ලෙස සකසා, ඔබගේ ගිණුමේ Live mode අවසරය සහ Avatar ID පරීක්ෂා කරන්න.' : 'Avatar ID එක එම LiveAvatar ගිණුමට අයත්ද සහ Live mode සඳහා අවසර තිබේද පරීක්ෂා කරන්න.'
            : response.status === 401 || response.status === 403
              ? 'LIVEAVATAR_API_KEY සහ එහි account permissions පරීක්ෂා කරන්න.'
              : undefined
        });
      }
      const sessionToken = data?.data?.session_token;
      const sessionId = data?.data?.session_id;
      if (!sessionToken || !sessionId) {
        console.error('LiveAvatar returned incomplete token response:', JSON.stringify({ hasData: Boolean(data?.data), keys: Object.keys(data?.data || {}) }));
        return res.status(502).json({ error: 'LiveAvatar ප්‍රතිචාරයේ session_token හෝ session_id නොමැත.' });
      }
      return res.json({ session_token: sessionToken, session_id: sessionId, mode: avatarMode, sandbox: isSandbox });
    } catch (error) {
      console.error('LiveAvatar session error:', error.message);
      return res.status(502).json({ error: 'LiveAvatar සේවාවට සම්බන්ධ විය නොහැක. Render Logs පරීක්ෂා කරන්න.' });
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
      // Return a bounded diagnostic so the UI can distinguish invalid keys,
      // quota/model errors and an unavailable local fallback without exposing secrets.
      const diagnostic = redactProviderText(error.message || 'Unknown provider error');
      return res.status(503).json({
        error: 'AI providers are unavailable.',
        diagnostic,
        hint: 'Render Environment හි OpenAI key/base URL/model පරීක්ෂා කරන්න. පැරණි Gemini OPENAI_* configuration එකක් තිබේ නම් V10.2.7 එය හඳුනාගෙන BACKUP_OPENAI_* OpenAI key එක භාවිත කරයි.'
      });
    }
  });

  app.post('/api/tts', requireAuth, chatLimiter, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 3500) return res.status(400).json({ error: 'Text must contain 1-3500 characters.' });
    const openAiBaseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiKey = process.env.OPENAI_TTS_API_KEY || process.env.BACKUP_OPENAI_API_KEY || (openAiBaseUrl === 'https://api.openai.com/v1' ? process.env.OPENAI_API_KEY : '');
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
