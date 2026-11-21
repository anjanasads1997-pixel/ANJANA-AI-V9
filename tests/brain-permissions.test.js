'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const PermissionManager=require('../src/core/brain/permission-manager');
const ToolRegistry=require('../src/core/brain/tool-registry');

test('permission policy allows read-only and denies unknown actions',()=>{
 const pm=new PermissionManager();
 assert.equal(pm.authorize('read_status').allowed,true);
 assert.equal(pm.authorize('execute_shell').allowed,false);
 assert.equal(pm.authorize('device_control').requiresConfirmation,true);
});
test('tool registry exposes only bounded read-only tools',async()=>{
 const pm=new PermissionManager();
 const tools=new ToolRegistry({permissionManager:pm,getRuntimeStatus:()=>({ok:true})});
 assert.deepEqual((await tools.execute('list_available_modules')).modules.includes('conversation'),true);
 assert.deepEqual(await tools.execute('get_runtime_status'),{ok:true});
 await assert.rejects(()=>tools.execute('run_command'),/Unknown or unavailable tool/);
});
