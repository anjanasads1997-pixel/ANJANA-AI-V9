'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const ContextStore=require('../src/core/brain/context-store');

test('context is isolated by user and conversation',()=>{
 const store=new ContextStore();
 store.append('user-a','chat_123456','hello','hi');
 assert.equal(store.get('user-a','chat_123456').length,2);
 assert.equal(store.get('user-b','chat_123456').length,0);
});
test('context enforces retention limits and sanitizes roles',()=>{
 const store=new ContextStore({maxMessages:4,maxConversations:1});
 store.append('u','chat_123456','a','b');
 store.append('u','chat_123456','c','d');
 store.append('u','chat_abcdef','e','f');
 assert.equal(store.get('u','chat_123456').length,0);
 assert.equal(store.get('u','chat_abcdef').length,2);
});
test('context persists and reloads from a private data file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'anjana-brain-'));
 const file=path.join(dir,'context.json');
 const first=new ContextStore({filePath:file,encryptionKey:'test-secret'});
 first.append('u','chat_123456','question','answer');
 const second=new ContextStore({filePath:file,encryptionKey:'test-secret'});
 assert.deepEqual(second.get('u','chat_123456'),[
  {role:'user',content:'question'},{role:'assistant',content:'answer'}
 ]);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('invalid conversation identifiers are rejected',()=>{
 const store=new ContextStore();
 assert.throws(()=>store.get('u','bad id'),/Invalid conversation identifier/);
});

test('context is not written as plaintext when an encryption key is absent',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'anjana-brain-no-key-'));
 const file=path.join(dir,'context.json');
 const store=new ContextStore({filePath:file});
 store.append('u','chat_123456','secret question','secret answer');
 assert.equal(fs.existsSync(file),false);
 assert.equal(store.getStatus().persistence,false);
 fs.rmSync(dir,{recursive:true,force:true});
});
