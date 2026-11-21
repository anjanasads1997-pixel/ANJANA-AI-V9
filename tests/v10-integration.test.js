'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V10 frontend uses the existing authenticated chat API', () => {
  const html = read('public/index.html');
  const js = read('public/app-v10.js');
  assert.ok(html.includes('value="/api/chat"'));
  assert.ok(html.includes('app-v10.js?v=11.0.5')); 
  assert.ok(js.includes("credentials:'same-origin'"));
  assert.ok(js.includes('JSON.stringify({message:q,conversationId:activeSessionId})'));
});

test('V10 frontend exposes the existing session authentication flow', () => {
  const html = read('public/index.html');
  const js = read('public/app-v10.js');
  for (const id of ['authLogin', 'authRegister', 'authLogout']) assert.ok(html.includes(`id="${id}"`));
  for (const route of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']) assert.ok(js.includes(route));
});

test('V11.0 hybrid provider order is Gemini, OpenAI backup, then Ollama', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('async function openAiChat'));
  assert.ok(app.includes('async function geminiChat'));
  assert.ok(app.includes('const failures = []'));
  assert.ok(app.indexOf('return await geminiChat(message, language, context);') < app.indexOf('return await openAiChat(message, language, context);'));
  assert.ok(app.includes("process.env.AI_PROVIDER || process.env.AI_MODE || 'hybrid'"));
  assert.ok(app.includes('process.env.OPENAI_API_KEY || process.env.BACKUP_OPENAI_API_KEY'));
  assert.ok(app.includes("provider: 'ollama'"));
});

test('health endpoint reports V11.0.5 and provider readiness without exposing secrets', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("version: '11.0.5'"));
  assert.ok(app.includes('openaiConfigured: Boolean(openAiConfig().apiKey)'));
});

test('environment example keeps OpenAI, Gemini and Ollama configuration separate', () => {
  const env = read('.env.example');
  assert.ok(env.includes('AI_PROVIDER=hybrid'));
  assert.ok(env.includes('GEMINI_API_KEY='));
  assert.ok(env.includes('OPENAI_BASE_URL=https://api.openai.com/v1'));
  assert.ok(env.includes('OLLAMA_MODEL=qwen2.5:3b'));
  assert.ok(env.includes('GEMINI_API_KEY='));
  assert.ok(env.includes('OLLAMA_BASE_URL='));
});


test('V10.3.0 allows WebAssembly and cache-busts the mobile client', () => {
  const app = read('src/app.js');
  const html = read('public/index.html');
  const sw = read('public/sw.js');
  assert.ok(app.includes("'wasm-unsafe-eval'"));
  assert.ok(html.includes('app-v10.js?v=11.0.5'));
  assert.ok(sw.includes('anjana-ai-v11.0.5-shell-v1'));
});

test('V10.3.0 defaults LiveAvatar to live mode and explains sandbox rejection', () => {
  const app = read('src/app.js');
  const env = read('.env.example');
  assert.ok(env.includes('LIVEAVATAR_SANDBOX=false'));
  assert.ok(app.includes("process.env.LIVEAVATAR_SANDBOX ?? 'false'"));
  assert.ok(app.includes('Sandbox mode සඳහා සහාය නොදක්වයි'));
});


test('V10.3.0 exposes a protected direct OpenAI connectivity test', () => {
  const app = read('src/app.js');
  const js = read('public/app-v10.js');
  const html = read('public/index.html');
  assert.ok(app.includes("app.post('/api/ai/test', optionalAssistantUser"));
  assert.ok(app.includes('ANJANA AI OpenAI connection OK.'));
  assert.ok(js.includes("fetch('/api/ai/diagnostics'"));
  assert.ok(js.includes("addEventListener('click',testOpenAIConnection)"));
  assert.ok(html.includes('id="testOpenAI"'));
});

test('V10.3.0 exposes status and avoids canned replies on hybrid backend failure', () => {
  const js = read('public/app-v10.js');
  const html = read('public/index.html');
  assert.ok(js.includes('AI_STATUS_URL'));
  assert.ok(js.includes("fetch(AI_STATUS_URL"));
  assert.ok(js.includes('Offline AI Model එක load කර නැත'));
  assert.ok(html.includes('id="connectionDetails"'));
});

test('LiveAvatar requires an explicitly configured account avatar ID', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("process.env.ANJANA_LIVEAVATAR_ID || '').trim()"));
  assert.ok(!app.includes('245c5ef6-fea0-4095-9894-79ff8f3947be'));
});


test('V10.3.0 retries transient OpenAI errors and exposes provider diagnostics', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('const maxAttempts = 2'));
  assert.ok(app.includes('[408, 429, 500, 502, 503, 504]'));
  assert.ok(app.includes('x-request-id'));
  assert.ok(app.includes('HTTP ${status}'));
  assert.ok(app.includes('providerStatus: status'));
});

test('V10.3.0 normalizes the official OpenAI base URL and validates secure URLs', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("if (parsed.hostname === 'api.openai.com' && !pathname) pathname = '/v1'"));
  assert.ok(app.includes('OPENAI_BASE_URL must use HTTPS'));
  assert.ok(app.includes('OPENAI_BASE_URL must not contain query parameters or fragments'));
});

test('V10.3.0 reports all hybrid provider failures instead of a misleading local canned reply', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('const failures = []'));
  assert.ok(app.includes('Gemini: GEMINI_API_KEY is not configured'));
  assert.ok(app.includes('Ollama: ${redactProviderText(error.message)}'));
  assert.ok(app.includes('සියලු AI Engine අසාර්ථකයි.'));
});

test('V10.3.0 does not label a configured API key as a verified live connection', () => {
  const js = read('public/app-v10.js');
  assert.ok(js.includes('API Keys තිබීම පමණක් සම්බන්ධතාව තහවුරු නොකරයි'));
  assert.ok(js.includes('OpenAI key සකසා ඇත'));
});


test('V11.0 preserves legacy Render Gemini endpoint compatibility and BACKUP OpenAI credentials', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('function hasLegacyGeminiConfig()'));
  assert.ok(app.includes("process.env.BACKUP_OPENAI_API_KEY || ''"));
  assert.ok(app.includes("process.env.OPENAI_API_KEY : ''"));
  assert.ok(app.includes('function hasGeminiCredentials()'));
  assert.ok(app.includes("|| 'gemini-3.8-flash'"));
});

test('V10.3.0 health status uses resolved legacy-compatible provider settings', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('openaiModel: openAiConfig().model'));
  assert.ok(app.includes('geminiConfigured: hasGeminiCredentials()'));
});

test('V11 frontend reads the Ollama status field returned by the backend', () => {
  const js = read('public/app-v10.js');
  assert.ok(js.includes('data.ollama?.online'));
  assert.ok(!js.includes('data.ollama?.available'));
});
