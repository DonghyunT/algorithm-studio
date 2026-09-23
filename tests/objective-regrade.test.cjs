const test=require('node:test'),assert=require('node:assert/strict');
const {digest,validateExpansion,compareStudent,buildPlan,currentPatch}=require('../server/objective-regrade.cjs');
const {sourceKey,get}=require('../js/core/objective-correction.js');
const {applyPlan,restorePlan,verifyPlan}=require('../tools/apply-objective-regrade.cjs');
const {fields,decode,root,name}=require('../tools/firebase-admin.cjs');
const bank={version:4,part1:[],part2:[{id:'sample_question',title:'합성 검증 문항',desc:'합성 답안을 입력하세요.',teacherNote:'운영 문항과 무관한 검증 자료입니다.',difficulty:'easy',subType:'term',points:5,placeholder:'입력',answers:['검증 정답']}]};
const next=structuredClone(bank);next.part2[0].answers.push('검증 표현');
function fixture(){
  const session={name:name('classrooms/2-1'),updateTime:'round-original',data:{status:'ended',questionVersion:4,attemptId:'test-attempt'}};
  const student={name:name('classrooms/2-1/students/01'),updateTime:'student-original',data:{status:'submitted',attemptId:'test-attempt',submittedAt:'2026-01-01T00:00:00Z',answers:{part1:{},part2:{sample_question:'검증 표현'},part3:{plan:{goal:'학생 원문'}}},review:{confirmed:{criteria:[{id:'synthetic',score:8}]}}}};
  const snapshot={project:'donghyun-algo',rounds:[{classId:'2-1',archiveId:null,session,students:[student]}]};
  return {session,student,snapshot,plan:buildPlan(bank,next,snapshot,'v4-synthetic-test')};
}
function mockStore(f){
  const docs=new Map([f.session,f.student].map(row=>[row.name,{name:row.name,updateTime:row.updateTime,fields:fields(row.data)}]));
  const calls=[];let seq=0;
  const request=async(url,options={})=>{
    calls.push({url,...options});
    if(url.endsWith(':beginTransaction'))return {transaction:'transaction'};
    if(url.endsWith(':batchGet'))return options.body.documents.map(key=>docs.has(key)?{found:structuredClone(docs.get(key))}:{missing:key});
    if(url.endsWith(':rollback'))return {};
    if(url.endsWith(':commit')){
      const writes=options.body.writes;
      for(const w of writes){const old=docs.get(w.update.name);if(w.currentDocument?.exists===false&&old)throw Error('409 EXISTS');if(w.currentDocument?.updateTime&&w.currentDocument.updateTime!==old?.updateTime)throw Error('409 CHANGED');}
      for(const w of writes){const data=structuredClone(docs.get(w.update.name)?.fields||{});if(w.updateMask){for(const key of w.updateMask.fieldPaths){if(Object.hasOwn(w.update.fields,key))data[key]=w.update.fields[key];else delete data[key];}}else Object.assign(data,w.update.fields);docs.set(w.update.name,{name:w.update.name,fields:data,updateTime:'changed-'+(++seq)});}
      return {commitTime:'committed'};
    }
    const key=url.replace('https://firestore.googleapis.com/v1/','');
    if(!docs.has(key))throw Error('404 NOT_FOUND');return structuredClone(docs.get(key));
  };
  return {docs,calls,request,root,fields};
}
test('answer expansion preserves question content, old answers, original answers and Part 3',()=>{
  validateExpansion(bank,next);
  for(const change of [b=>b.part2[0].points++,b=>b.part2[0].answers.shift(),b=>b.part2[0].desc+='changed']){const b=structuredClone(next);change(b);assert.throws(()=>validateExpansion(bank,b));}
  const f=fixture(),original=structuredClone(f.student.data),row=f.plan.groups[0].students[0];
  assert.deepEqual(f.plan.summary,{rounds:1,records:1,changedRecords:1,changedAnswers:1,currentChanged:1,archivedChanged:0,unchanged:0,skipped:0,perClass:{'2-1':1}});
  assert.deepEqual({before:row.beforePart2,after:row.afterPart2,delta:row.delta},{before:0,after:5,delta:5});
  assert.deepEqual(Object.keys(currentPatch(original,{afterPart2:5})),['scores','objectiveCorrection']);
  assert.deepEqual(f.student.data,original);
  for(const scores of [{part2:20},{teacherOverride:70},{total:70}])assert.ok(compareStudent(bank,next,f.session.data,{...original,scores}).issue);
  assert.equal(compareStudent(bank,next,{...f.session.data,status:'in_progress'},original).skip,'ROUND_NOT_ENDED_V4');
  assert.equal(compareStudent(bank,next,f.session.data,{...original,attemptId:'different'}).issue,'ROUND_MISMATCH');
});
test('correction never transfers to changed answers, another attempt or a resubmission',()=>{
  const s=fixture().student.data;
  s.objectiveCorrection={attemptId:s.attemptId,sourceKey:sourceKey(s),beforePart2:0,afterPart2:5,delta:5};
  assert.equal(get(s).afterPart2,5);
  for(const change of [v=>v.answers.part2.sample_question='changed',v=>v.attemptId='different',v=>v.submittedAt='new submission',v=>v.status='in_progress',v=>v.objectiveCorrection.delta=30]){const v=structuredClone(s);change(v);assert.equal(get(v),null);}
});
test('plan rejects tampering and unsupported or foreign records',()=>{
  const f=fixture();verifyPlan(f.plan,f.plan.planHash);
  assert.throws(()=>verifyPlan({...f.plan,revision:'tampered'},f.plan.planHash));
  f.snapshot.rounds[0].students[0].name=name('classrooms/2-2/students/01');assert.throws(()=>buildPlan(bank,next,f.snapshot,'v4-synthetic-test'),/INVALID_STUDENT_PATH/);
});
test('apply creates atomic immutable audit, is repeat-safe and preserves all unrelated student data',async()=>{
  const f=fixture(),store=mockStore(f),plan=f.plan;
  await applyPlan(plan,store,plan.planHash);
  const current=decode({mapValue:{fields:store.docs.get(f.student.name).fields}});
  assert.equal(current.scores.part2,5);assert.equal(get(current).delta,5);
  assert.deepEqual(current.answers,f.student.data.answers);assert.deepEqual(current.review,f.student.data.review);
  const auditName=name(`classrooms/2-1/archives/${plan.groups[0].auditId}`);
  const saved=decode({mapValue:{fields:store.docs.get(auditName+'/students/01').fields}});
  assert.deepEqual(saved.originalStudent,f.student.data);
  const again=await applyPlan(plan,store,plan.planHash);assert.equal(again[0].alreadyApplied,true);
  assert.equal(store.calls.filter(c=>c.url.endsWith(':commit')).length,1);
  assert.deepEqual(store.docs.get(f.session.name).updateTime,'round-original');
});
test('changed preview source aborts without any write; archived changes are blocked for separate review',async()=>{
  for(const key of ['session','student']){const f=fixture(),store=mockStore(f);store.docs.get(f[key].name).updateTime='changed';await assert.rejects(applyPlan(f.plan,store,f.plan.planHash),/CHANGED_SINCE_PREVIEW/);assert.equal(store.calls.filter(c=>c.url.endsWith(':commit')).length,0);assert.equal(store.calls.filter(c=>c.url.endsWith(':rollback')).length,1);}
  const f=fixture();f.plan.groups[0].archiveId='archived';const {planHash,...body}=f.plan;f.plan.planHash=digest(body);const store=mockStore(f);await assert.rejects(applyPlan(f.plan,store,f.plan.planHash),/ARCHIVED_CHANGE_REQUIRES_REVIEW/);assert.equal(store.calls.length,0);
});
test('restore removes newly added fields, retains both audit records and blocks replay or later teacher score changes',async()=>{
  const f=fixture(),store=mockStore(f);await applyPlan(f.plan,store,f.plan.planHash);
  const current=store.docs.get(f.student.name),originalFields=structuredClone(current.fields);
  current.fields.scores=fields({scores:{part2:20}}).scores;
  await assert.rejects(restorePlan(f.plan,store,f.plan.planHash),/RECORD_CHANGED_AFTER_CORRECTION/);
  current.fields=originalFields;
  await restorePlan(f.plan,store,f.plan.planHash);
  assert.deepEqual(decode({mapValue:{fields:store.docs.get(f.student.name).fields}}),f.student.data);
  assert.equal([...store.docs.keys()].filter(k=>k.includes('/archives/')&&!k.includes('/students/')).length,2);
  await assert.rejects(applyPlan(f.plan,store,f.plan.planHash),/PLAN_ALREADY_RESTORED/);
});
