'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V11.0.1 environment example uses real line breaks for Brain settings', () => {
  const env = read('.env.example');
  assert.match(env, /AI_TIMEOUT_MS=45000\r?\n\r?\n# Unified Brain/);
  assert.ok(!env.includes('45000\\n'));
  assert.ok(env.includes('BRAIN_ENCRYPTION_KEY='));
});

test('V11.0.1 uses consistent 45-second AI timeout for Ollama', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('timeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000)'));
});

test('OpenAI request omits unsupported custom sampling parameter', () => {
  const app = read('src/app.js');
  const openAiSection = app.slice(app.indexOf('async function openAiCompatibleChat'), app.indexOf('async function openAiChat'));
  assert.ok(!openAiSection.includes('temperature:'));
  assert.ok(openAiSection.includes('model,\n            messages:'));
});

test('LiveAvatar failed startup is cleaned up and pagehide releases session', () => {
  const js = read('public/app-v10.js');
  assert.ok(js.includes('if(pendingSession){try{await pendingSession.stop();}'));
  assert.ok(js.includes("window.addEventListener('pagehide'"));
});

test('Brain encryption status does not claim encryption without a key', () => {
  const source = read('src/core/brain/context-store.js');
  assert.ok(source.includes("this.encryptionKey ? 'AES-256-GCM' : 'disabled; process-memory only'"));
});
