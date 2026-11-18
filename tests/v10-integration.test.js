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
  assert.ok(html.includes('src="/app-v10.js"'));
  assert.ok(js.includes("credentials:'same-origin'"));
  assert.ok(js.includes('JSON.stringify({message:q})'));
});

test('V10 frontend exposes the existing session authentication flow', () => {
  const html = read('public/index.html');
  const js = read('public/app-v10.js');
  for (const id of ['authLogin', 'authRegister', 'authLogout']) assert.ok(html.includes(`id="${id}"`));
  for (const route of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']) assert.ok(js.includes(route));
});

test('V10.2.3 hybrid provider order is OpenAI, Gemini, then Ollama', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('async function openAiChat'));
  assert.ok(app.includes('async function geminiChat'));
  assert.ok(app.includes('V10.2.3 default order: OpenAI (primary) -> Gemini (secondary) -> Ollama (offline)'));
  assert.ok(app.indexOf('return await openAiChat(message, language);') < app.indexOf('return await geminiChat(message, language);'));
  assert.ok(app.includes('process.env.OPENAI_API_KEY || process.env.BACKUP_OPENAI_API_KEY'));
  assert.ok(app.includes("provider: 'ollama'"));
});

test('health endpoint reports V10.2.3 and provider readiness without exposing secrets', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("version: '10.2.3'"));
  assert.ok(app.includes('openaiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.BACKUP_OPENAI_API_KEY)'));
});

test('environment example keeps OpenAI, Gemini and Ollama configuration separate', () => {
  const env = read('.env.example');
  assert.ok(env.includes('OPENAI_BASE_URL=https://api.openai.com/v1'));
  assert.ok(env.includes('GEMINI_API_KEY='));
  assert.ok(env.includes('OLLAMA_BASE_URL='));
});
