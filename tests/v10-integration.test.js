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
  assert.match(html, /value="\/api\/chat"/);
  assert.match(html, /src="\/app-v10\.js"/);
  assert.match(js, /credentials:'same-origin'/);
  assert.match(js, /JSON\.stringify\(\{message:q\}\)/);
});

test('V10 frontend exposes the existing session authentication flow', () => {
  const html = read('public/index.html');
  const js = read('public/app-v10.js');
  for (const id of ['authLogin', 'authRegister', 'authLogout']) assert.ok(html.includes(`id="${id}"`));
  for (const route of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']) assert.ok(js.includes(route));
});

test('Hybrid provider order supports Gemini, OpenAI, then Ollama', () => {
  const app = read('src/app.js');
  assert.match(app, /async function geminiChat/);
  assert.match(app, /try \{ return await geminiChat\(message, language\); \}/);
  assert.match(app, /try \{ return await openAiChat\(message, language\); \}/);
  assert.match(app, /return \{ \.\.\.\(await ai\.chat\(message\)\), provider: 'ollama' \}/);
});
