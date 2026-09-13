const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {createLocalPreviewService}=require('../tools/local-preview-service.cjs');
test('missing opt-in local login adapter fails closed instead of entering password-free demo',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const context={window:{LOCAL_PREVIEW_CONFIG:{token:'test'}},location:{hostname:'127.0.0.1',search:'?demo=1'},URLSearchParams};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/core/auth-service.js'),'utf8'),context);
 await assert.rejects(context.window.authService.teacher(),/새로고침/);
 await assert.rejects(context.window.authService.existingTeacher(),/새로고침/);
});
function harness(){
 let now=100000;const calls=[];
 const service=createLocalPreviewService({password:'test-password-only',apiKey:'public-config',now:()=>now,fetcher:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>url.includes('signUp')?{idToken:'server-only-token',expiresIn:'3600'}:{choices:[{message:{content:'[판정: 통과]\n입력과 출력이 일치합니다.'}}]}};
 }});
 async function request(path,body,headers={},method='POST'){
  const req=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);req.method=method;req.headers={origin:'http://127.0.0.1:4174','x-local-preview-token':service.nonce,'content-type':'application/json',...headers};
  const result={};const res={writeHead(status){result.status=status;},end(value){result.body=JSON.parse(value);}};
  await service.handle(req,res,path,'http://127.0.0.1:4174');return result;
 }
 return {service,request,calls,advance:n=>now+=n};
}
test('local bridge rejects foreign origins, missing capability, methods and oversized requests before remote calls',async()=>{
 const h=harness(),body={messages:[{role:'user',content:'test'}]};
 assert.equal((await h.request('/api/local-chat',body,{origin:'https://other.example'})).status,403);
 assert.equal((await h.request('/api/local-chat',body,{'x-local-preview-token':''})).status,403);
 assert.equal((await h.request('/api/local-chat',body,{},'GET')).status,405);
 assert.equal((await h.request('/api/local-chat','x'.repeat(32001))).status,413);
 assert.equal(h.calls.length,0);
});
test('local teacher checks password, expires sessions, and revokes on logout without Firebase calls',async()=>{
 const h=harness();assert.equal((await h.request('/api/local-teacher',{action:'login',password:'wrong'})).status,401);
 const login=await h.request('/api/local-teacher',{action:'login',password:'test-password-only'}),headers={authorization:'Bearer '+login.body.session};
 assert.equal(login.status,200);assert.equal((await h.request('/api/local-teacher',{action:'status'},headers)).body.authenticated,true);
 await h.request('/api/local-teacher',{action:'logout'},headers);assert.equal((await h.request('/api/local-teacher',{action:'status'},headers)).body.authenticated,false);
 const next=await h.request('/api/local-teacher',{action:'login',password:'test-password-only'});h.advance(8*3600000+1);
 assert.equal((await h.request('/api/local-teacher',{action:'status'},{authorization:'Bearer '+next.body.session})).body.authenticated,false);assert.equal(h.calls.length,0);
});
test('real AI relay reuses server token and only returns text, never credentials or arbitrary destinations',async()=>{
 const h=harness(),body={messages:[{role:'system',content:'review'},{role:'user',content:'input/output'}],url:'https://untrusted.example'};
 const a=await h.request('/api/local-chat',body);await h.request('/api/local-chat',body);
 assert.equal(a.status,200);assert.deepEqual(Object.keys(a.body),['content']);assert.equal(h.calls.length,3);
 assert.ok(h.calls[1].url==='https://algorithm-studio-ten.vercel.app/api/chat');assert.equal(h.calls[1].options.headers.Authorization,'Bearer server-only-token');
 assert.deepEqual(JSON.parse(h.calls[1].options.body),{messages:body.messages});
});
test('local AI and login bursts are limited before paid requests',async()=>{
 const h=harness(),body={messages:[{role:'user',content:'test'}]};
 for(let i=0;i<5;i++)assert.equal((await h.request('/api/local-chat',body)).status,200);
 assert.equal((await h.request('/api/local-chat',body)).status,429);assert.equal(h.calls.length,6);
 for(let i=0;i<5;i++)await h.request('/api/local-teacher',{action:'login',password:'wrong'});
 assert.equal((await h.request('/api/local-teacher',{action:'login',password:'test-password-only'})).status,429);
});
