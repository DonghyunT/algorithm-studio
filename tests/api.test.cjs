const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
const {verifyFirebaseToken}=require('../server/firebase-token.cjs');
const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const key={...pair.publicKey.export({format:'jwk'}),kid:'test-key'};
const base={sub:'student',aud:'test-project',iss:'https://securetoken.google.com/test-project',iat:Math.floor(Date.now()/1000)-1,auth_time:Math.floor(Date.now()/1000)-2,exp:Math.floor(Date.now()/1000)+3600};
function token(claims=base,header={alg:'RS256',kid:'test-key'}){
  const data=[header,claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');
}
test('Firebase token requires signature, audience, issuer and unexpired time',async()=>{
  const fetcher=async()=>({ok:true,json:async()=>({keys:[key]})});
  assert.equal((await verifyFirebaseToken(token(),'test-project',fetcher)).sub,'student');
  for(const bad of [token({...base,aud:'other'}),token({...base,iss:'bad'}),token({...base,exp:1}),token({...base,iat:base.exp}),token(base,{alg:'none',kid:'test-key'}),token().slice(0,-20)+'forged']) await assert.rejects(verifyFirebaseToken(bad,'test-project',fetcher));
});
function handlerHarness({valid=true,upstreamOk=true,quota=true}={}){
  const calls=[];
  const context={module:{exports:{}},require:()=>({reserveAiQuota:async()=>{if(quota instanceof Error)throw quota;return quota;},verifyFirebaseToken:async t=>{if(!valid||!t)throw Error('invalid');return {sub:'u'};}}),process:{env:{UPSTAGE_API_KEY:'test-only'}},Map,Date,AbortSignal,fetch:async(url,options)=>{calls.push({url,options});return {ok:upstreamOk,json:async()=>({choices:[{message:{content:'hint'}}]})};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/chat.js'),'utf8'),context);
  async function request(body={messages:[{role:'user',content:'help'}]},authorization='Bearer test',method='POST'){
    const result={};const res={setHeader:()=>{},status:status=>{result.status=status;return res;},json:body=>{result.body=body;return result;}};
    await context.module.exports({method,headers:{authorization},body},res);return result;
  }
  return {request,calls};
}
test('API rejects unauthenticated, oversized and invalid role requests without upstream calls',async()=>{
  const h=handlerHarness();
  assert.equal((await h.request(undefined,'')).status,401);
  assert.equal((await h.request({messages:[{role:'tool',content:'x'}]})).status,400);
  assert.equal((await h.request({messages:[{role:'user',content:'x'.repeat(32001)}]})).status,400);
  assert.equal((await h.request(undefined,undefined,'GET')).status,405);
  assert.equal(h.calls.length,0);
});
test('API fixes model/token budget and limits bursts; upstream failure is not a pass',async()=>{
  const h=handlerHarness();
  assert.equal((await h.request({messages:[{role:'user',content:'help'}],model:'untrusted',max_tokens:999999})).status,200);
  const sent=JSON.parse(h.calls[0].options.body);assert.equal(sent.model,'solar-pro4');assert.equal(sent.max_tokens,800);
  for(let i=1;i<10;i++)assert.equal((await h.request()).status,200);
  assert.equal((await h.request()).status,429);assert.equal(h.calls.length,10);
  const failure=handlerHarness({upstreamOk:false});assert.equal((await failure.request()).status,502);
});
test('daily AI limit and quota outages fail closed without upstream charges',async()=>{
  for(const [quota,status] of [[false,429],[Error('offline'),503]]){
    const h=handlerHarness({quota});assert.equal((await h.request()).status,status);assert.equal(h.calls.length,0);
  }
});
