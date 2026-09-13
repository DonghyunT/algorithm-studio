const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const policy=require('../js/core/assessment-policy.js');

function field(value){
  if(Array.isArray(value))return {arrayValue:{values:value.map(field)}};
  if(value&&typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,field(item)]))}};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number')return {integerValue:String(value)};
  return {stringValue:value};
}

function harness(role){
  const calls=[],quotaCalls=[];
  const answer={plan:{current:'현재',goal:'목표',conditions:'조건',steps:[]},blocks:[],connections:[]};
  const criteria=policy.ASSESSMENT_RUBRIC.map(item=>({id:item.id,score:5,evidence:'제출 근거'}));
  const ctx={
    module:{exports:{}},
    require:path=>path.includes('policy')?policy:path.includes('quota')?{reserveAiQuota:async()=>{quotaCalls.push(true);return true;}}:{verifyFirebaseToken:async()=>({sub:'scoped-teacher'})},
    process:{env:{UPSTAGE_API_KEY:'test-only'}},AbortSignal,Date,JSON,
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.includes('upstage.ai'))return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({criteria,uncertainties:[]})}}]})};
      const data=url.includes('/teachers/')?role:url.includes('/students/')?{status:'submitted',attemptId:'round-3',answers:{part3:answer}}:{questionVersion:3,attemptId:'round-3'};
      return {ok:true,json:async()=>({fields:field(data).mapValue.fields})};
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/assessment.js'),'utf8'),ctx);
  return {
    calls,quotaCalls,
    async request(classId){
      const result={},res={setHeader(){},status(code){result.status=code;return this;},json(body){result.body=body;return result;}};
      await ctx.module.exports({method:'POST',headers:{authorization:'Bearer test'},body:{purpose:'review',classId,studentNum:'01'}},res);
      return result;
    }
  };
}

test('instructor can review only assigned classes 2-10 and 2-11',async()=>{
  for(const classId of ['2-10','2-11']){
    const h=harness({enabled:true,classIds:['2-10','2-11']});
    assert.equal((await h.request(classId)).status,200);
    assert.equal(h.quotaCalls.length,1);
  }
  const denied=harness({enabled:true,classIds:['2-10','2-11']});
  assert.equal((await denied.request('2-1')).status,403);
  assert.deepEqual(denied.calls.map(call=>call.url.includes('/teachers/')?'teacher':call.url.includes('/students/')?'student':call.url.includes('/classrooms/')?'classroom':'paid'),['teacher']);
  assert.equal(denied.quotaCalls.length,0);
});

test('owner allClasses role can review every valid class',async()=>{
  const h=harness({enabled:true,allClasses:true});
  assert.equal((await h.request('2-1')).status,200);
  assert.equal(h.quotaCalls.length,1);
});

test('missing class scope and disabled roles fail before answer reads or paid calls',async()=>{
  for(const role of [{enabled:true},{enabled:false,allClasses:true},{enabled:false,classIds:['2-10','2-11']}]){
    const h=harness(role);
    assert.equal((await h.request('2-10')).status,403);
    assert.ok(!h.calls.some(call=>call.url.includes('/students/')||call.url.includes('/classrooms/')||call.url.includes('upstage.ai')));
    assert.equal(h.quotaCalls.length,0);
  }
});

test('Firestore rules require the same class scope for teacher paths and preserve anonymous lobby reads',()=>{
  const rules=fs.readFileSync(require.resolve('../firestore.rules'),'utf8');
  assert.match(rules,/function teacherForClass\(classId\)/);
  assert.match(rules,/teacherRole\(\)\.allClasses == true/);
  assert.match(rules,/classId in teacherRole\(\)\.classIds/);
  assert.match(rules,/allow get: if anonymousStudent\(\) \|\| teacherForClass\(classId\);/);
  assert.match(rules,/allow create: if anonymousStudent\(\) && classId\.matches/);
  assert.match(rules,/allow get: if teacherForClass\(classId\) \|\| \(anonymousStudent\(\)/);
  for(const line of rules.split(/\r?\n/).filter(line=>/allow (?:list|read|create|update|delete)/.test(line)&&line.includes('teacher'))){
    assert.ok(line.includes('teacherForClass(classId)'),line.trim());
  }
  assert.doesNotMatch(rules,/\bteacher\(\)/);
});
