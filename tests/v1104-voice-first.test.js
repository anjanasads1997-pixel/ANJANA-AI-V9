'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
const js=fs.readFileSync(path.join(root,'public/app-v10.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
test('chat, diagnostics, avatar and TTS support a guest assistant session',()=>{
 for(const route of ["app.post('/api/chat', optionalAssistantUser, chatLimiter","app.post('/api/ai/diagnostics', optionalAssistantUser, chatLimiter","app.post('/api/tts', optionalAssistantUser, chatLimiter","app.post('/api/avatar/session', optionalAssistantUser, avatarLimiter"]) assert.ok(app.includes(route),route);
 assert.ok(app.includes('guest:${guestId}'));
 assert.ok(app.includes('limit: 8'));
 assert.ok(app.includes("res.cookie('anjana_guest'"));
});
test('microphone input automatically sends recognized speech and assistant speaks replies',()=>{
 assert.ok(js.includes("$('#voiceIn').onclick"));
 assert.ok(js.includes('send();'));
 assert.ok(js.includes('speakReply(reply)'));
 assert.ok(js.includes('speechSynthesis.speak(u)'));
});
test('account modal and responsive layout bootstrap run from CSP-allowed external module',()=>{
 assert.ok(html.includes('<script src="/app-v10.js?v=11.1.1" type="module"></script>'));
 assert.ok(!/<script>/.test(html));
 assert.ok(js.includes('dialog.showModal()'));
 assert.ok(js.includes('initialiseAssistantLayout()'));
});
