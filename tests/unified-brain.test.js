'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ContextStore=require('../src/core/brain/context-store');
const PermissionManager=require('../src/core/brain/permission-manager');
const ToolRegistry=require('../src/core/brain/tool-registry');
const UnifiedBrain=require('../src/core/brain/unified-brain');

test('unified brain routes context to provider and stores assistant exchange',async()=>{
 const store=new ContextStore();
 let received=[];
 const pm=new PermissionManager();
 const registry=new ToolRegistry({permissionManager:pm});
 const brain=new UnifiedBrain({
  contextStore:store,permissionManager:pm,toolRegistry:registry,
  providerRouter:async(message,language,context)=>{
   received=context;
   return {reply:'response '+message,provider:'mock'};
  }
 });
 const first=await brain.respond({userId:'u',conversationId:'chat_123456',message:'first',language:'en'});
 assert.equal(first.reply,'response first');
 const second=await brain.respond({userId:'u',conversationId:'chat_123456',message:'second',language:'en'});
 assert.equal(received.length,2);
 assert.equal(received[0].content,'first');
 assert.equal(second.contextMessages,4);
});
test('unified brain rejects incomplete requests and empty provider responses',async()=>{
 const pm=new PermissionManager(), registry=new ToolRegistry({permissionManager:pm});
 const make=provider=>new UnifiedBrain({contextStore:new ContextStore(),permissionManager:pm,toolRegistry:registry,providerRouter:provider});
 await assert.rejects(()=>make(async()=>({reply:'ok'})).respond({}),/required/);
 await assert.rejects(()=>make(async()=>({reply:' '})).respond({userId:'u',conversationId:'chat_123456',message:'x'}),/empty response/);
});

test('server and frontend connect chat requests to the same conversation identifier',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../public/app-v10.js'),'utf8');
 assert.ok(app.includes("req.body?.conversationId"));
 assert.ok(app.includes("brain.respond({"));
 assert.ok(client.includes("JSON.stringify({message:q,conversationId:activeSessionId})"));
});
test('all three provider adapters accept conversation context',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const ollama=fs.readFileSync(path.join(__dirname,'../src/core/ollama-client.js'),'utf8');
 assert.ok(app.includes('async function geminiChat(message, language, context = [])'));
 assert.ok(app.includes('async function openAiCompatibleChat(message, language, config, context = [])'));
 assert.ok(ollama.includes('async chat(message, context = [])'));
});
