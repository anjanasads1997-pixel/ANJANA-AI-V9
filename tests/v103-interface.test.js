'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../public/app-v10.js'),'utf8');
test('V10.4 reference-style full-screen avatar and chat layout is present',()=>{
 assert.match(html,/id="assistantWorkspace"/);
 assert.match(html,/id="avatarColumn"/);
 assert.match(html,/id="conversationColumn"/);
 assert.match(html,/id="avatarFrame"/);
 assert.match(html,/id="liveAvatarVideo"/);
 assert.match(html,/id="chatComposer"/);
 assert.match(html,/id="attachFile"/);
 assert.match(html,/grid-template-columns:minmax\(0,1\.08fr\)/);
 assert.match(html,/@media\(max-width:760px\)/);
 assert.match(js,/classList\.add\('live-connected'\)/);
 assert.match(js,/classList\.remove\('live-connected'\)/);
});
test('existing account, offline engine, and AI controls remain available',()=>{
 for(const id of ['authPanel','localPanel','hybridTab','liveTab','toolsPanel','voiceIn','documentFile']) assert.ok(html.includes('id="'+id+'"'),id+' preserved');
});

test('V11 starts a clean chat-history namespace without deleting V10 history',()=>{
 assert.ok(js.includes("const STORE='anjana_ai_v11_history_v1'"));
 assert.ok(!js.includes("const STORE='anjana_ai_full_history_v2'"));
 assert.ok(html.includes('app-v10.js?v=11.0.3'));
});
