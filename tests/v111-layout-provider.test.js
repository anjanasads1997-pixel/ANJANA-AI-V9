'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V11.1.1 stacks the avatar and conversation workspace for tablet and mobile widths', () => {
  const html = read('public/index.html');
  assert.ok(html.includes('@media(max-width:1024px)'));
  assert.ok(html.includes('grid-template-columns:minmax(0,1fr)'));
  assert.ok(html.includes('grid-template-rows:minmax(220px,32dvh) minmax(480px,1fr)'));
});

test('V11.1.1 retries a missing Gemini model with the configured fallback model', () => {
  const app = read('src/app.js');
  const env = read('.env.example');
  assert.ok(app.includes('GEMINI_FALLBACK_MODEL'));
  assert.ok(app.includes('const modelUnavailable = response.status === 404'));
  assert.ok(app.includes('retrying with ${models[index + 1]}'));
  assert.ok(env.includes('GEMINI_FALLBACK_MODEL=gemini-3.8-flash'));
});
