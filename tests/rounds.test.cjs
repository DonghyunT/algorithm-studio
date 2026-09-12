const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function setup(){
 const records=new Map(),copy=value=>JSON.parse(JSON.stringify(value));let fail=false;
 function ref(path){return {path,id:path.split('/').pop(),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})};}
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async task=>{
   const writes=[];
   const result=await task({get:async doc=>({exists:records.has(doc.path),id:doc.id,ref:doc,data:()=>copy(records.get(doc.path)||{})}),set:(doc,value)=>writes.push(['set',doc.path,copy(value)]),update:(doc,value)=>writes.push(['update',doc.path,copy(value)]),delete:doc=>writes.push(['delete',doc.path])});
   if(fail)throw Error('write failed');
   for(const [type,path,value] of writes){if(type==='delete')records.delete(path);else records.set(path,type==='update'?{...records.get(path),...value}:value);}return result;
 }};
 const ctx={window:{firebaseDb:db,authService:{isDemo:()=>false,teacher:async()=>({uid:'teacher'}),student:async()=>({uid:'new-student'})}},crypto,console,Map,Set};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/assessment-policy.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/eval-service.js'),'utf8'),ctx);
 records.set('classrooms/2-1',{classId:'2-1',status:'ended',attemptId:'old',deadlineMs:1,schoolYear:2026});
 records.set('classrooms/2-1/students/01',{ownerUid:'old-student',status:'submitted',num:1,answers:{part1:{q1:2}},scores:{teacherOverride:85}});
 return {records,service:ctx.window.evalService,setFail:value=>{fail=value}};
}
test('new round archives answers and grades, frees seats, and prevents accidental restart',async()=>{
 const {records,service}=setup();await service.prepareSession('2-1');
 const archive=[...records].find(([path])=>path.includes('/archives/')&&path.endsWith('/students/01'));
 assert.equal(archive[1].scores.teacherOverride,85);assert.equal(archive[1].answers.part1.q1,2);
 assert.equal(records.has('classrooms/2-1/students/01'),false);
 const joined=await service.joinWaitingRoom('2-1',1,'새 학생');assert.equal(joined.ownerUid,'new-student');assert.equal(Object.keys(joined.answers.part1).length,0);
 assert.notEqual(joined.attemptId,'old');await service.startSession('2-1');
 await assert.rejects(service.startSession('2-1'));await assert.rejects(service.prepareSession('2-1'));
 await service.resetStudentExam('2-1',1);
 assert.equal([...records.values()].filter(value=>value.kind==='student-reset').length,1);
});
test('failed archival transaction preserves current answer',async()=>{
 const {records,service,setFail}=setup();setFail(true);await assert.rejects(service.prepareSession('2-1'),/write failed/);
 assert.equal(records.get('classrooms/2-1/students/01').answers.part1.q1,2);
 assert.equal(records.get('classrooms/2-1').attemptId,'old');
 assert.equal([...records.keys()].some(path=>path.includes('/archives/')),false);
});

test('teacher review is bound to the submitted answer; failures and resets do not confirm stale scores',async()=>{
 const {records,service,setFail}=setup(),policy=require('../js/core/assessment-policy.js');
 await service.prepareSession('2-1');const s=await service.joinWaitingRoom('2-1',1,'검증');await service.startSession('2-1');
 const criteria=policy.ASSESSMENT_RUBRIC.map(r=>({id:r.id,score:7})),source=policy.assessmentSourceKey(s.answers.part3);
 await assert.rejects(service.savePart3Review('2-1',1,source,{criteria},'confirmed'));
 records.get('classrooms/2-1/students/01').status='submitted';
 await assert.rejects(service.savePart3Review('2-1',1,'stale',{criteria},'confirmed'));
 setFail(true);await assert.rejects(service.savePart3Review('2-1',1,source,{criteria},'confirmed'));assert.equal(records.get('classrooms/2-1/students/01').review,undefined);setFail(false);
 await service.savePart3Review('2-1',1,source,{criteria,attemptId:s.attemptId,uncertainties:[]},'proposal');assert.equal(records.get('classrooms/2-1/students/01').review.confirmed,undefined);
 await service.savePart3Review('2-1',1,source,{criteria},'confirmed');assert.equal(records.get('classrooms/2-1/students/01').review.confirmed.reviewerUid,'teacher');
 await service.resetStudentExam('2-1',1);assert.equal(records.get('classrooms/2-1/students/01').review,null);
});
