'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/app-v10.js'), 'utf8');

test('V11.0 Phase 02 presents the avatar and chat as the primary workspace', () => {
  for (const id of ['assistantWorkspace', 'avatarColumn', 'conversationColumn', 'anjanaAvatar', 'chat', 'prompt', 'send']) assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  assert.ok(html.includes('id="avatarFrame"'));
  assert.ok(html.includes('id="startLiveAvatar"'));
  assert.ok(html.includes('#avatarColumn .live-avatar-controls{display:flex!important'));
});
test('legacy panels remain in DOM for runtime compatibility but are hidden', () => {
  assert.ok(html.includes('#advancedSettings,.tabs,#personalSettings{display:none!important}'));
  for (const id of ['hybridTab','localTab','liveTab','toolsTab','loadLocal','authLogin','authRegister']) assert.ok(html.includes(`id="${id}"`), `runtime dependency ${id} removed`);
});
test('account login is available through a compact dialog', () => {
  for (const id of ['accountButton','accountDialog','accountContent','closeAccount']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(js.includes('target.appendChild(panel)'));
  assert.ok(html.includes('app-v10.js?v=11.1.1'));
  assert.ok(!/<script>/.test(html), 'no inline scripts blocked by strict CSP');
});
test('chat supports new conversations and selectable history', () => {
  for (const id of ['newChat','historyToggle','historyPanel','historyList']) assert.ok(html.includes(`id="${id}"`));
  for (const symbol of ['SESSIONS_STORE','ACTIVE_SESSION_STORE','function startNewChat()','function openSession(id)','function renderHistoryList()']) assert.ok(js.includes(symbol));
});
test('session history is capped and migrates the previous single-thread store', () => {
  assert.ok(js.includes('sessions=sessions.slice(0,50)'));
  assert.ok(js.includes('localStorage.setItem(SESSIONS_STORE,JSON.stringify(sessions))'));
  assert.ok(js.includes('const legacy=JSON.parse(localStorage.getItem(STORE)||'));
});
test('voice and file attachment controls remain available in the composer', () => {
  for (const id of ['attachFile','voiceIn','documentFile']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(js.includes("$('#voiceIn').onclick"));
});
