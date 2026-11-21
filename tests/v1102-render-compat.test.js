'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V11.0.3 preserves legacy Gemini/OpenAI Render variable routing', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('function hasLegacyGeminiConfig()'));
  assert.ok(app.includes('process.env.BACKUP_OPENAI_API_KEY'));
  assert.ok(app.includes('process.env.GEMINI_API_KEY'));
});

test('Tavily research route is authenticated and keeps key server-side', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("app.post('/api/research/search', requireAuth, chatLimiter"));
  assert.ok(app.includes('process.env.TAVILY_API_KEY'));
  assert.ok(app.includes("api_key: apiKey"));
  assert.ok(!app.includes('TAVILY_API_KEY: apiKey'));
});

test('HeyGen key is not incorrectly substituted for LiveAvatar key', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('process.env.LIVEAVATAR_API_KEY'));
  assert.ok(!app.includes('process.env.HEYGEN_API_KEY || process.env.LIVEAVATAR_API_KEY'));
  const env = read('.env.example');
  assert.ok(env.includes('HEYGEN_API_KEY='));
  assert.ok(env.includes('LIVEAVATAR_API_KEY='));
});

test('V11.0.3 Render compatibility notes document unsupported custom owner variables', () => {
  const doc = read('docs/V11.0.2-RENDER-COMPATIBILITY-SI.md');
  assert.ok(doc.includes('ANJANA_ACCESS'));
  assert.ok(doc.includes('ANJANA_OWNER_'));
});
