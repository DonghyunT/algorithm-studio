const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function setup(){
 const records=new Map(),copy=value=>JSON.parse(JSON.stringify(value));let fail=false;
  function ref(path){return {path,id:path.split('/').pop(),delete:async()=>{records.delete(path);},collection:name=>({doc:id=>ref(path+'/'+name+'/'+id),get:async()=>{const prefix=path+'/'+name+'/';const docs=[...records.keys()].filter(k=>k.startsWith(prefix)&&!k.slice(prefix.length).includes('/')).map(k=>({id:k.split('/').pop(),ref:ref(k),data:()=>copy(records.get(k)||{})}));return {forEach:fn=>docs.forEach(fn),docs};}}),update:async value=>{records.set(path,{...records.get(path),...copy(value)});},get:async()=>({exists:records.has(path),id:path.split('/').pop(),ref:ref(path),data:()=>copy(records.get(path)||{})})};}
  const db={collection:name=>({doc:id=>ref(name+'/'+id)}),batch:()=>({update:(d,val)=>{records.set(d.path,{...records.get(d.path),...copy(val)});},commit:async()=>{}}),runTransaction:async task=>{
    const writes=[];
    const result=await task({get:async doc=>({exists:records.has(doc.path),id:doc.id,ref:doc,data:()=>copy(records.get(doc.path)||{})}),set:(doc,value)=>writes.push(['set',doc.path,copy(value)]),update:(doc,value)=>writes.push(['update',doc.path,copy(value)]),delete:doc=>writes.push(['delete',doc.path])});
    if(fail)throw Error('write failed');
    for(const [type,path,value] of writes){if(type==='delete')records.delete(path);else records.set(path,type==='update'?{...records.get(path),...value}:value);}return result;
  }};
  let studentUid = 'new-student';
  const ctx={window:{firebaseDb:db,authService:{isDemo:()=>false,teacher:async()=>({uid:'teacher'}),student:async()=>({uid:studentUid})}},crypto,console,Map,Set};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data/eval-question-bank.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data/eval-questions.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/core/assessment-policy.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/core/eval-service.js'),'utf8'),ctx);
  records.set('classrooms/2-1',{classId:'2-1',status:'ended',attemptId:'old',deadlineMs:1,schoolYear:2026});
  records.set('classrooms/2-1/students/01',{ownerUid:'old-student',status:'submitted',num:1,answers:{part1:{q1:2}},scores:{teacherOverride:85}});
  return {records,service:ctx.window.evalService,setFail:value=>{fail=value},setStudentUid:uid=>{studentUid=uid}};
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

test('teacher controls reject stale rounds and failed end writes preserve the active exam',async()=>{
 const {records,service,setFail}=setup();
 await service.prepareSession('2-1');
 const ready=records.get('classrooms/2-1'), expected={attemptId:ready.attemptId,status:'waiting'};
 await assert.rejects(service.startSession('2-1',30,{attemptId:'old',status:'waiting'}),/다른 화면/);
 await service.startSession('2-1',30,expected);
 await assert.rejects(service.prepareSession('2-1',expected),/다른 화면/);
 const running={...expected,status:'in_progress'};
 setFail(true);await assert.rejects(service.endSession('2-1',running),/write failed/);
 assert.equal(records.get('classrooms/2-1').status,'in_progress');setFail(false);
 await service.endSession('2-1',running);
 assert.equal(records.get('classrooms/2-1').status,'ended');
 await service.prepareSession('2-1',{...expected,status:'ended'});
 await service.startSession('2-1');
 await assert.rejects(service.endSession('2-1',running),/다른 화면/);
 assert.equal(records.get('classrooms/2-1').status,'in_progress');
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

test('waiting session can be directly closed with endSession and getSession fetches session snapshot',async()=>{
  const {records,service}=setup();
  await service.prepareSession('2-1');
  const ready=await service.getSession('2-1');
  assert.equal(ready.status,'waiting');
  assert.ok(ready.attemptId);
  await service.endSession('2-1',{attemptId:ready.attemptId,status:'waiting'});
  const ended=await service.getSession('2-1');
  assert.equal(ended.status,'ended');
});

test('bulk closing waiting rooms targets only waiting sessions and leaves in_progress intact',async()=>{
  const {records,service}=setup();
  await service.prepareSession('2-1');
  records.set('classrooms/2-2',{classId:'2-2',status:'in_progress',attemptId:'round-2',deadlineMs:Date.now()+60000});
  records.set('classrooms/2-3',{classId:'2-3',status:'ended',attemptId:'round-3'});

  const classes=['2-1','2-2','2-3'];
  const targets=[];
  for(const cId of classes){
    const s=await service.getSession(cId);
    if(s&&s.status==='waiting'&&s.attemptId)targets.push({classId:cId,session:s});
  }
  assert.equal(targets.length,1);
  assert.equal(targets[0].classId,'2-1');

  for(const t of targets){
    await service.endSession(t.classId,{attemptId:t.session.attemptId,status:'waiting'});
  }

  assert.equal((await service.getSession('2-1')).status,'ended');
  assert.equal((await service.getSession('2-2')).status,'in_progress');
  assert.equal((await service.getSession('2-3')).status,'ended');
});

test('student can leave waiting room and free seat for another student, but cannot leave after exam starts',async()=>{
  const {records,service}=setup();
  await service.prepareSession('2-1');
  const student1=await service.joinWaitingRoom('2-1',5,'실수학생');
  assert.equal(records.has('classrooms/2-1/students/05'),true);

  await service.leaveWaitingRoom('2-1',5);
  assert.equal(records.has('classrooms/2-1/students/05'),false);

  const student2=await service.joinWaitingRoom('2-1',5,'진짜학생');
  assert.equal(student2.name,'진짜학생');
  assert.equal(records.has('classrooms/2-1/students/05'),true);

  await service.startSession('2-1');
  records.get('classrooms/2-1/students/05').status='in_progress';
  await assert.rejects(service.leaveWaitingRoom('2-1',5),/평가가 이미 시작되었거나/);
});

test('student answers include blocks and connections that can be mapped for teacher canvas rendering', async () => {
  const {records, service} = setup();
  await service.prepareSession('2-1');
  await service.joinWaitingRoom('2-1', 7, '순서도학생');
  await service.startSession('2-1');
  const blocks = [
    { id: 'b1', shape: 'terminal', text: '시작', x: 100, y: 50 },
    { id: 'b2', shape: 'proc', text: '환기 팬 가동', x: 100, y: 150 },
    { id: 'b3', shape: 'terminal', text: '끝', x: 100, y: 250 }
  ];
  const connections = [
    { id: 'c1', from: 'b1', to: 'b2', fromPort: 'bottom', toPort: 'top' },
    { id: 'c2', from: 'b2', to: 'b3', fromPort: 'bottom', toPort: 'top' }
  ];
  await service.updateStudentProgress('2-1', 7, { part1: 5, part2: 3, part3: 1 }, {
    part1: { p1_q1: 0 },
    part2: { p2_q1: '순차' },
    part3: { blocks, connections, questionVersion: 3 }
  });

  const student = records.get('classrooms/2-1/students/07');
  assert.equal(student.answers.part3.blocks.length, 3);
  assert.equal(student.answers.part3.connections.length, 2);
  assert.equal(student.answers.part3.blocks[0].shape, 'terminal');
  assert.equal(student.answers.part3.blocks[1].text, '환기 팬 가동');
});

test('sortBlocksByExecution orders blocks by execution flow, handles branching and loops safely', () => {
  const { sortBlocksByExecution } = require('../js/core/classroom.js');

  // Case 1: Branching with early created '종료' block (like teacher screenshot)
  const blocks = [
    { id: 'start', shape: 'terminal', text: '시작', y: 30 },
    { id: 'b_input', shape: 'io', text: '현재시간 입력', y: 110 },
    { id: 'b_end', shape: 'terminal', text: '종료', y: 480 },
    { id: 'b_dec', shape: 'decision', text: '12시 이전?', y: 200 },
    { id: 'b_study', shape: 'process', text: '공부한다', y: 320 },
    { id: 'b_play', shape: 'process', text: '논다', y: 320 }
  ];
  const connections = [
    { from: 'start', to: 'b_input' },
    { from: 'b_input', to: 'b_dec' },
    { from: 'b_dec', to: 'b_study', fromPort: 'yes' },
    { from: 'b_dec', to: 'b_play', fromPort: 'no' },
    { from: 'b_study', to: 'b_end' },
    { from: 'b_play', to: 'b_end' }
  ];

  const sorted = sortBlocksByExecution(blocks, connections);
  const texts = sorted.map(b => b.text);
  assert.deepEqual(texts, ['시작', '현재시간 입력', '12시 이전?', '공부한다', '논다', '종료']);

  // Case 2: Repetition / Loopback (cycle-safe, no infinite loop)
  const loopBlocks = [
    { id: 's', shape: 'terminal', text: '시작', y: 0 },
    { id: 'measure', shape: 'io', text: '기온 측정', y: 100 },
    { id: 'cond', shape: 'decision', text: '기온 > 28?', y: 200 },
    { id: 'cool', shape: 'process', text: '냉방기 가동', y: 300 },
    { id: 'e', shape: 'terminal', text: '종료', y: 400 },
    { id: 'orphan', shape: 'process', text: '연결 안 된 메모', y: 500 }
  ];
  const loopConns = [
    { from: 's', to: 'measure' },
    { from: 'measure', to: 'cond' },
    { from: 'cond', to: 'cool', fromPort: 'yes' },
    { from: 'cool', to: 'measure' }, // cycle / loopback
    { from: 'cond', to: 'e', fromPort: 'no' }
  ];

  const sortedLoop = sortBlocksByExecution(loopBlocks, loopConns);
  const loopTexts = sortedLoop.map(b => b.text);
  assert.equal(loopTexts[0], '시작');
  assert.equal(loopTexts[1], '기온 측정');
  assert.equal(loopTexts[2], '기온 > 28?');
  assert.equal(loopTexts[3], '냉방기 가동');
  assert.equal(loopTexts[4], '종료');
  assert.equal(loopTexts[5], '연결 안 된 메모');
});

test('question bank: assignQuestions extracts exact difficulty distributions deterministically', () => {
  const { EVAL_QUESTION_BANK } = require('../js/data/eval-question-bank.js');
  const { assignQuestions, evaluationQuestions } = require('../js/data/eval-questions.js');
  const { gradeEvaluation } = require('../js/core/flow-validation.js');

  // Verify total question bank size
  assert.equal(EVAL_QUESTION_BANK.part1.length, 30, 'Part 1 bank must have 30 questions');
  assert.equal(EVAL_QUESTION_BANK.part2.length, 18, 'Part 2 bank must have 18 questions');

  // Assign questions for student 1
  const student1Key = 'attempt_20260914_2-1_05';
  const assigned1 = assignQuestions(student1Key, EVAL_QUESTION_BANK);

  assert.equal(assigned1.part1.length, 10, 'Part 1 must assign exactly 10 questions');
  assert.equal(assigned1.part2.length, 6, 'Part 2 must assign exactly 6 questions');

  // Check Part 1 breakdown: 4 easy (3 concept, 1 applied), 4 medium, 2 hard
  const p1Questions = assigned1.part1.map(id => EVAL_QUESTION_BANK.part1.find(q => q.id === id));
  assert.equal(p1Questions.filter(q => q.difficulty === 'easy').length, 4);
  assert.equal(p1Questions.filter(q => q.difficulty === 'easy' && q.subType === 'concept').length, 3);
  assert.equal(p1Questions.filter(q => q.difficulty === 'easy' && q.subType === 'applied').length, 1);
  assert.equal(p1Questions.filter(q => q.difficulty === 'medium').length, 4);
  assert.equal(p1Questions.filter(q => q.difficulty === 'hard').length, 2);

  // Check Part 2 breakdown: 2 easy, 2 medium, 2 hard (1 trace, 1 scenario)
  const p2Questions = assigned1.part2.map(id => EVAL_QUESTION_BANK.part2.find(q => q.id === id));
  assert.equal(p2Questions.filter(q => q.difficulty === 'easy').length, 2);
  assert.equal(p2Questions.filter(q => q.difficulty === 'medium').length, 2);
  assert.equal(p2Questions.filter(q => q.difficulty === 'hard').length, 2);
  assert.equal(p2Questions.filter(q => q.difficulty === 'hard' && q.subType === 'trace').length, 1);
  assert.equal(p2Questions.filter(q => q.difficulty === 'hard' && q.subType === 'scenario').length, 1);

  // Determinism test: same studentKey must produce identical assignment
  const assigned1Repeat = assignQuestions(student1Key, EVAL_QUESTION_BANK);
  assert.deepEqual(assigned1, assigned1Repeat, 'Same studentKey must produce identical assignment');

  // Variation test: different studentKey should produce different set of questions
  const student2Key = 'attempt_20260914_2-1_06';
  const assigned2 = assignQuestions(student2Key, EVAL_QUESTION_BANK);
  assert.notDeepEqual(assigned1.part1, assigned2.part1, 'Different students should get different Part 1 questions');

  // Resolution and grading test:
  const resolved = evaluationQuestions({ assignedQuestions: assigned1 });
  assert.equal(resolved.part1.length, 10);
  assert.equal(resolved.part2.length, 6);

  // Prepare full correct answers for assigned questions
  const answers = {
    assignedQuestions: assigned1,
    part1: {},
    part2: {},
    part3: { questionVersion: 3 }
  };
  resolved.part1.forEach(q => {
    answers.part1[q.id] = q.correctAnswer;
  });
  resolved.part2.forEach(q => {
    answers.part2[q.id] = q.answers[0]; // first valid alternative answer
  });

  const graded = gradeEvaluation(answers, 3);
  assert.equal(graded.scores.part1, 30, 'All correct Part 1 must score 30 points');
  assert.equal(graded.scores.part2, 30, 'All correct Part 2 must score 30 points');
  assert.equal(graded.scores.objectiveTotal, 60, 'Total auto-graded score must be 60 points');
  assert.equal(graded.scores.pendingReview, true, 'Part 3 must remain pendingReview for teacher grading');
});

test('eval-service assigns distinct question sets to different students and backfills missing assignedQuestions', async () => {
  const { records, service } = setup();
  await service.prepareSession('2-1');

  // Student 1 joins
  const student1 = await service.joinWaitingRoom('2-1', 1, '학생1');
  assert.ok(student1.answers.assignedQuestions, 'Student 1 must have assignedQuestions');
  assert.equal(student1.answers.assignedQuestions.part1.length, 10);
  assert.equal(student1.answers.assignedQuestions.part2.length, 6);

  // Student 2 joins
  const student2 = await service.joinWaitingRoom('2-1', 2, '학생2');
  assert.ok(student2.answers.assignedQuestions, 'Student 2 must have assignedQuestions');
  assert.equal(student2.answers.assignedQuestions.part1.length, 10);
  assert.equal(student2.answers.assignedQuestions.part2.length, 6);

  // They must have different questions
  assert.notDeepEqual(student1.answers.assignedQuestions.part1, student2.answers.assignedQuestions.part1, 'Student 1 and 2 must receive different Part 1 questions');

  // Backfill test: simulate existing student without assignedQuestions
  const rawStudent = records.get('classrooms/2-1/students/01');
  delete rawStudent.answers.assignedQuestions;
  records.set('classrooms/2-1/students/01', rawStudent);

  // Re-joining should backfill assignedQuestions
  const rejoined = await service.joinWaitingRoom('2-1', 1, '학생1');
  assert.ok(rejoined.answers.assignedQuestions, 'Rejoined student must have backfilled assignedQuestions');
  assert.deepEqual(rejoined.answers.assignedQuestions, student1.answers.assignedQuestions, 'Backfilled questions must match original deterministic set');
});

test('teacher can clear student seat to remove ghost seat or allow new student login', async () => {
  const { records, service } = setup();
  await service.prepareSession('2-1');
  await service.joinWaitingRoom('2-1', 1, '유령학생');
  assert.ok(records.has('classrooms/2-1/students/01'), 'Student seat must be reserved');

  // Teacher clears the seat
  await service.clearStudentSeat('2-1', 1);
  assert.equal(records.has('classrooms/2-1/students/01'), false, 'Seat must be deleted from records');

  // New student can now join without duplicate error
  const newStudent = await service.joinWaitingRoom('2-1', 1, '진짜학생');
  assert.equal(newStudent.name, '진짜학생');
  assert.equal(records.has('classrooms/2-1/students/01'), true);
});

test('teacher can force submit in-progress student with current answers', async () => {
  const { records, service } = setup();
  await service.prepareSession('2-1');
  await service.joinWaitingRoom('2-1', 1, '풀이중학생');
  await service.startSession('2-1');

  // Update some answers but never submitted by student
  await service.updateStudentProgress('2-1', 1, { part1: 5, part2: 0, part3: 0 }, { part1: { q1: 1, q2: 2 } });
  assert.equal(records.get('classrooms/2-1/students/01').status, 'in_progress');

  // Teacher forces submission
  const submitted = await service.forceSubmitStudentExam('2-1', 1);
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.submittedBy, 'teacher_force');
  assert.equal(records.get('classrooms/2-1/students/01').status, 'submitted');
  assert.deepEqual(records.get('classrooms/2-1/students/01').answers.part1, { q1: 1, q2: 2 });
});

test('autoSubmitRemainingStudents submits all unsubmitted students when exam ends', async () => {
  const { records, service } = setup();
  await service.prepareSession('2-1');
  await service.joinWaitingRoom('2-1', 1, '학생1');
  await service.joinWaitingRoom('2-1', 2, '학생2');
  await service.startSession('2-1');

  // Student 1 answers something
  await service.updateStudentProgress('2-1', 1, { part1: 3, part2: 0, part3: 0 }, { part1: { q1: 1 } });
  // Student 2 never answers anything (stays in_progress)

  // Auto-submit remaining students
  const count = await service.autoSubmitRemainingStudents('2-1');
  assert.equal(count, 2, 'Both students must be auto-submitted');
  assert.equal(records.get('classrooms/2-1/students/01').status, 'submitted');
  assert.equal(records.get('classrooms/2-1/students/02').status, 'submitted');
  assert.equal(records.get('classrooms/2-1/students/01').submittedBy, 'teacher_auto_end');
  assert.equal(records.get('classrooms/2-1/students/02').submittedBy, 'teacher_auto_end');
});

test('prepareSession accepts questionVersion 3 (모의평가) or 4 (실전평가) and defaults to 4', async () => {
  const { records, service } = setup();
  // 1. Version 3 (모의평가)
  const sessionV3 = await service.prepareSession('2-1', null, 3);
  assert.equal(sessionV3.questionVersion, 3);
  assert.equal(records.get('classrooms/2-1').questionVersion, 3);

  // End round 3 before preparing next
  await service.endSession('2-1', { attemptId: sessionV3.attemptId, status: 'waiting' });

  // 2. Version 4 (실전평가)
  const sessionV4 = await service.prepareSession('2-1', null, 4);
  assert.equal(sessionV4.questionVersion, 4);
  assert.equal(records.get('classrooms/2-1').questionVersion, 4);

  // End round 4 before preparing next
  await service.endSession('2-1', { attemptId: sessionV4.attemptId, status: 'waiting' });

  // 3. Default (omitted questionVersion should default to 4)
  const sessionDefault = await service.prepareSession('2-1');
  assert.equal(sessionDefault.questionVersion, 4);
  assert.equal(records.get('classrooms/2-1').questionVersion, 4);
});

test('allowStudentReconnect preserves answers and allows rejoining with new UID', async () => {
  const { records, service, setStudentUid } = setup();
  await service.prepareSession('2-1');
  
  // 1. First student enters with UID 'student-original'
  setStudentUid('student-original');
  await service.joinWaitingRoom('2-1', 1, '홍길동');
  await service.startSession('2-1');
  
  // Student writes answers
  await service.updateStudentProgress('2-1', 1, { part1: 5, part2: 2, part3: 0 }, { part1: { q1: 3, q2: 1 }, part2: { q11: '추상화' } });
  assert.equal(records.get('classrooms/2-1/students/01').ownerUid, 'student-original');
  assert.equal(records.get('classrooms/2-1/students/01').answers.part2.q11, '추상화');

  // 2. PC rebooted / rolled back -> Student gets new UID 'student-rebooted'
  setStudentUid('student-rebooted');
  
  // Joining without reconnect permission should be rejected to protect student seat
  await assert.rejects(service.joinWaitingRoom('2-1', 1, '홍길동'), /다른 응시 기록에 연결/);

  // 3. Teacher grants reconnect
  await service.allowStudentReconnect('2-1', 1);
  assert.equal(records.get('classrooms/2-1/students/01').allowReconnect, true);

  // 4. Student rejoins with new UID
  const reconnected = await service.joinWaitingRoom('2-1', 1, '홍길동');
  assert.equal(reconnected.ownerUid, 'student-rebooted');
  assert.equal(reconnected.allowReconnect, false, 'allowReconnect should be reset to false after join');
  
  // Verify previous answers and progress are completely preserved
  assert.equal(reconnected.answers.part2.q11, '추상화', 'Server stored answers must be preserved');
  assert.equal(reconnected.answers.part1.q1, 3);
  assert.equal(records.get('classrooms/2-1/students/01').ownerUid, 'student-rebooted');
});

test('allowStudentMakeup grants individual 30-minute exam without reopening ended session', async () => {
  const { records, service, setStudentUid } = setup();
  await service.prepareSession('2-1');
  await service.joinWaitingRoom('2-1', 1, '정상학생');
  await service.startSession('2-1');
  
  // Student 1 finishes and submits
  await service.submitStudentExam('2-1', 1, { answers: { part1: {}, part2: {}, part3: { questionVersion: 4, blocks: [], connections: [] } } });
  assert.equal(records.get('classrooms/2-1/students/01').status, 'submitted');

  // Class session ends
  const currentSession = records.get('classrooms/2-1');
  await service.endSession('2-1', currentSession);
  assert.equal(records.get('classrooms/2-1').status, 'ended');

  // Teacher cannot grant makeup to already submitted student
  await assert.rejects(service.allowStudentMakeup('2-1', 1, 30), /이미 정상 제출된/);

  // Teacher grants makeup to absent student #5
  await service.allowStudentMakeup('2-1', 5, 30);
  assert.equal(records.get('classrooms/2-1/students/05').makeupAllowed, true);
  assert.equal(records.get('classrooms/2-1/students/05').status, 'waiting');

  // Student 5 joins waiting room
  setStudentUid('makeup-student-5');
  const student5 = await service.joinWaitingRoom('2-1', 5, '지각생');
  assert.equal(student5.ownerUid, 'makeup-student-5');
  assert.equal(student5.makeupAllowed, true);

  // Student 5 starts their individual makeup exam
  const startRes = await service.startStudentMakeupExam('2-1', 5, 30);
  assert.equal(records.get('classrooms/2-1/students/05').status, 'in_progress');
  assert.ok(startRes.deadlineMs > Date.now());

  // Class end auto-submit must NOT auto-submit active makeup student
  const autoCount = await service.autoSubmitRemainingStudents('2-1');
  assert.equal(autoCount, 0, 'Makeup student must not be auto-submitted');
  assert.equal(records.get('classrooms/2-1/students/05').status, 'in_progress');
  assert.equal(records.get('classrooms/2-1/students/01').status, 'submitted', 'Student 1 remains submitted');
});





