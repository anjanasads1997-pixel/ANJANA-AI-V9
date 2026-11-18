'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('LiveAvatar LITE uses server-side credentials and requires an explicit account avatar ID', () => {
  const app = read('src/app.js');
  assert.match(app, /process\.env\.LIVEAVATAR_API_KEY/);
  assert.match(app, /process\.env\.LIVEAVATAR_AVATAR_ID/);
  assert.match(app, /process\.env\.ANJANA_LIVEAVATAR_ID \|\| ''/);
  assert.match(app, /LIVEAVATAR_AVATAR_ID සකසා නැත/);
  assert.match(app, /is_sandbox: isSandbox/);
  assert.match(app, /\/v1\/sessions\/token/);
});

test('Frontend starts official LiveAvatar SDK session and attaches live video', () => {
  const js = read('public/app-v10.js');
  const html = read('public/index.html');
  assert.match(js, /@heygen\/liveavatar-web-sdk@0\.0\.20/);
  assert.match(js, /new sdk\.LiveAvatarSession/);
  assert.match(js, /await session\.start\(\)/);
  assert.match(js, /await session\.attach\(video\)/);
  assert.match(html, /id="liveAvatarVideo"/);
  assert.match(html, /id="startLiveAvatar"/);
  assert.match(html, /id="stopLiveAvatar"/);
});

test('LiveAvatar speech uses server TTS PCM and has browser speech fallback', () => {
  const js = read('public/app-v10.js');
  const app = read('src/app.js');
  assert.match(js, /fetch\('\/api\/tts'/);
  assert.match(js, /liveAvatarSession\.repeatAudio/);
  assert.match(js, /speakText\(text\)/);
  assert.match(app, /OPENAI_TTS_API_KEY \|\| process\.env\.BACKUP_OPENAI_API_KEY/);
});
