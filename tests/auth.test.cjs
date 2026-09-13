const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness({user=null,enabled=true,error=null}={}) {
  const calls=[];
  const auth={currentUser:user,signInWithEmailAndPassword:async(email,password)=>{calls.push(['password',email,password]);if(error)throw error;return {user:auth.currentUser={uid:'temporary',isAnonymous:false}};},signInWithPopup:async()=>{calls.push(['google']);return {user:auth.currentUser={uid:'google',isAnonymous:false}};},signOut:async()=>{auth.currentUser=null;}};
  const ctx={window:{},location:{hostname:'production',search:''},URLSearchParams,firebase:{firestore:()=>({collection:()=>({doc:uid=>({get:async()=>{calls.push(['role',uid]);return {exists:enabled,data:()=>({enabled})};}})})}),auth:Object.assign(()=>auth,{GoogleAuthProvider:function(){}})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/core/auth-service.js'),'utf8'),ctx);
  const service=ctx.window.authService;service.ready=async()=>auth;
  return {service,auth,calls};
}
test('temporary login uses Firebase password authentication and verifies the resulting UID role',async()=>{
  const h=harness();assert.equal((await h.service.teacher({method:'temporary',password:'test-only'})).uid,'temporary');
  assert.deepEqual(h.calls,[['password',h.service.temporaryTeacherEmail,'test-only'],['role','temporary']]);
  assert.equal((await h.service.existingTeacher()).uid,'temporary');
});
test('missing login and missing teacher role never create an account or launch a popup implicitly',async()=>{
  const h=harness();assert.equal(await h.service.existingTeacher(),null);await assert.rejects(h.service.teacher());assert.equal(h.calls.length,0);
  const denied=harness({enabled:false});await assert.rejects(denied.service.teacher({method:'temporary',password:'test-only'}),/교사 권한/);
  assert.equal(denied.auth.currentUser,null);
  assert.equal(await denied.service.existingTeacher(),null);
});
test('password errors do not query a role or expose raw SDK errors',async()=>{
  const error={code:'auth/wrong-password',message:'INTERNAL INVALID_PASSWORD'};
  const h=harness({error});await assert.rejects(h.service.teacher({method:'temporary',password:'bad'}));
  assert.equal(h.calls.length,1);assert.match(h.service.teacherError(error),/비밀번호/);assert.ok(!h.service.teacherError(error).includes('INTERNAL'));
});
test('restored Google and temporary users are role checked without a new login, and signout clears identity',async()=>{
  for(const uid of ['google','temporary']) {
    const h=harness({user:{uid,isAnonymous:false}});assert.equal((await h.service.existingTeacher()).uid,uid);
    assert.equal((await h.service.teacher()).uid,uid);assert.ok(h.calls.every(c=>c[0]==='role'));
    await h.service.signOut();assert.equal(await h.service.existingTeacher(),null);
  }
});
