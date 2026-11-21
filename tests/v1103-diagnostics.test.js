'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V11.0.3 provides authenticated real connection checks for Gemini, OpenAI and Ollama', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("app.post('/api/ai/diagnostics', requireAuth, chatLimiter"));
  assert.ok(app.includes("safeCheck('gemini'"));
  assert.ok(app.includes("safeCheck('openai'"));
  assert.ok(app.includes('await ai.chat('));
  assert.ok(app.includes('connectionVerified: false'));
});

test('V11.0.3 frontend distinguishes configured keys from verified providers', () => {
  const js = read('public/app-v10.js');
  const html = read('public/index.html');
  assert.ok(js.includes('KEYS CONFIGURED'));
  assert.ok(js.includes("fetch('/api/ai/diagnostics'"));
  assert.ok(html.includes('Test AI Engines (Gemini + OpenAI + Ollama)'));
});

test('V11.0.3 does not hide authentication failures by switching to offline fallback', () => {
  const js = read('public/app-v10.js');
  assert.ok(js.includes('Login අවශ්‍යයි. ANJANA AI ගිණුමට නැවත Login වන්න.'));
  assert.ok(js.includes('[401,403].includes(err.status)'));
});
