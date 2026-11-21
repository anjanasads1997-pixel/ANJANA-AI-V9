 'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/app-v10.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
test('guest users can create avatar sessions and receive TTS without account login', () => {
  assert.match(app, /app\.post\('\/api\/avatar\/session', optionalAssistantUser, avatarLimiter/);
  assert.match(app, /app\.post\('\/api\/tts', optionalAssistantUser, chatLimiter/);
  assert.match(app, /app\.post\('\/api\/ai\/test', optionalAssistantUser, chatLimiter/);
  assert.match(app, /app\.post\('\/api\/chat', optionalAssistantUser/);
});
test('one user gesture starts live microphone and avatar together', () => {
  assert.match(js, /startLiveVoice\(\);\s*startLiveAvatar\(\)/);
  assert.match(html, /කතාබහ ආරම්භ කරන්න/);
  assert.match(js, /await speakReply\(reply\)/);
});
test('voice recognition pauses while assistant speaks to avoid echo loops', () => {
  assert.match(js, /try\{rec\.stop\(\);\}catch\(e\)\{\}/);
  assert.match(js, /if\(liveVoiceOn\)\{try\{rec\.start\(\);\}/);
});
test('account login UI is hidden but privileged research and tool endpoints remain protected', () => {
  assert.match(html, /#accountButton,#authPanel,#accountDialog\{display:none!important\}/);
  assert.match(app, /app\.post\('\/api\/research\/search', requireAuth/);
  assert.match(app, /app\.get\('\/api\/brain\/tools', requireAuth/);
});
