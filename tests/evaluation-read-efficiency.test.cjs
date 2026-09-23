const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const copy = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function environment() {
  let serial = 0;
  const timers = new Map(), elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {textContent:'', classList:{contains:()=>false,add(){},remove(){}},replaceChildren(){}});
    return elements.get(id);
  };
  const context = {console, document:{getElementById:element}, sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    window:{addEventListener(){},authService:{isDemo:()=>false,student:async()=>({uid:'synthetic-student'})}}, alert(){}, updateAssessmentNavigation(){},
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    setInterval(){return 1;},clearInterval(){}};
  vm.createContext(context);
  return {context,timers,element};
}
function studentEnv() {
  const env=environment(),c=env.context;
  vm.runInContext(fs.readFileSync(path.join(root,'js/labs/lab-eval.js'),'utf8'),c);
  const app=c.window.studentEvalApp;
  Object.assign(app,{currentClass:'2-1',studentNum:1,attemptId:'round',isSubmitted:true,joined:true,
    latestSession:{questionVersion:4,attemptId:'round'},renderResult(){},renderServerScoreReveal(){},
    calculateScores(){},updateLobbyMakeupUI(){},showScreen(){},saveDraft(){},startExam(){}});
  let listener;
  c.window.evalService={listenSession(){return ()=>{};},listenStudent(id,num,cb){listener=cb;return ()=>{};}};
  app.attachAssessmentListeners();
  return {...env,app,notify:record=>listener(copy(record))};
}
const response = part3 => ({ready:true,score:{part1:25,part2:25,objectiveTotal:50},part3});
const record = () => ({num:1,numStr:'01',attemptId:'round',status:'submitted',submittedAt:'time',answers:{part1:{q:1},part2:{q:'answer'}}});

test('student: ready objective score does not poll while Part 3 is pending', async()=>{
  const {context:c,app,timers,notify}=studentEnv();let calls=0;
  c.requestSecureEvaluationStudentScore=async()=>{calls++;return response(null);};
  notify(record());await flush();
  for(let i=0;i<100;i++)notify({...record(),updatedAt:String(i)});
  await flush();
  assert.equal(calls,1);assert.equal(timers.size,0);assert.equal(app.serverScoreState.score.part3Status,'pending');
});

test('student: snapshot review updates fetch proposal, confirmation and corrected zero without polling', async()=>{
  const {context:c,app,timers,notify}=studentEnv();let review=null,calls=0;
  c.requestSecureEvaluationStudentScore=async()=>{calls++;return response(review);};
  notify(record());await flush();
  for(const [total,confirmed] of [[30,false],[35,true],[0,true]]){
    review={total,confirmed,criteria:[]};
    notify({...record(),review:{[confirmed?'confirmed':'proposal']:review}});await flush();
    assert.equal(app.serverScoreState.score.part3,total);
    assert.equal(app.serverScoreState.score.part3Status,confirmed?'confirmed':'first_graded');
  }
  assert.equal(calls,4);assert.equal(timers.size,0);
});

test('student: late same-round response cannot overwrite a newer teacher review', async()=>{
  const {context:c,app,notify}=studentEnv();const pending=[];
  c.requestSecureEvaluationStudentScore=()=>new Promise(resolve=>pending.push(resolve));
  notify(record());
  notify({...record(),review:{confirmed:{total:35}}});
  pending[1](response({total:35,confirmed:true}));await flush();
  pending[0](response(null));await flush();
  assert.equal(app.serverScoreState.score.part3,35);assert.equal(app.serverScoreRequest,null);
});

test('student: reopening invalidates the outstanding score; resubmission fetches again', async()=>{
  const {context:c,app,notify}=studentEnv();let resolve;
  c.requestSecureEvaluationStudentScore=()=>new Promise(r=>{resolve=r;});
  notify(record());notify({...record(),status:'in_progress'});
  resolve(response({total:35,confirmed:true}));await flush();
  assert.equal(app.serverScoreState.status,'idle');assert.equal(app.serverScoreRequestKey,null);
  c.requestSecureEvaluationStudentScore=async()=>response(null);
  notify({...record(),submittedAt:'resubmission'});await flush();
  assert.equal(app.serverScoreState.status,'ready');
});

test('student: submission visibility retries are bounded and an explicit retry recovers',async()=>{
  const {context:c,app,timers}=studentEnv();let calls=0;
  c.requestSecureEvaluationStudentScore=async()=>{calls++;return {ready:false};};
  app.startServerScorePolling();await flush();
  while(timers.size){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();await flush();}
  assert.equal(calls,3);assert.equal(app.serverScoreState.status,'error');
  c.requestSecureEvaluationStudentScore=async()=>response(null);
  app.startServerScorePolling(true);await flush();assert.equal(app.serverScoreState.status,'ready');
});

test('student: a late response does not reopen a hidden result screen',async()=>{
  const {context:c,app,element}=studentEnv();let resolve,renders=0;
  app.renderResult=()=>renders++;
  c.requestSecureEvaluationStudentScore=()=>new Promise(r=>{resolve=r;});
  app.startServerScorePolling();
  element('eval-screen-result').classList.contains=()=>true;
  resolve(response(null));await flush();assert.equal(renders,0);
});

function teacherEnv() {
  const env=environment(),c=env.context;let listener,calls=0;
  c.window.evalService={isDemo:()=>false,listenSession(id,cb){cb({questionVersion:4,attemptId:'round'});return ()=>{};},listenStudents(id,cb){listener=cb;return ()=>{};}};
  c.requestSecureEvaluationClassGrades=async()=>{calls++;return {attemptId:'round',grades:{'01':{score:{objectiveTotal:50}}}};};
  vm.runInContext(fs.readFileSync(path.join(root,'js/core/classroom.js'),'utf8'),c);
  for(const name of ['setTeacherSessionFeedback','renderLiveGrid','renderTeacherSessionControl','syncTeacherAutoReviewQueue','closeLiveStudentModal'])c[name]=()=>{};
  c.initLiveEvalDashboard();
  return {...env,notify:students=>listener(copy(students)),calls:()=>calls,
    async tick(){const jobs=[...env.timers.values()];env.timers.clear();for(const job of jobs)job.fn();await flush();}};
}

test('teacher: 100 unrelated draft updates and review-only changes produce no additional class reads',async()=>{
  const e=teacherEnv();e.notify([record()]);await e.tick();
  for(let i=0;i<100;i++){
    e.notify([{...record(),review:{proposal:{total:i%40}}},{num:2,numStr:'02',attemptId:'round',status:'in_progress',answers:{part1:{q:i}}}]);await e.tick();
  }
  assert.equal(e.calls(),1);
});

test('teacher: changed submitted answers invalidate cached scores and refetch',async()=>{
  const e=teacherEnv();e.notify([record()]);await e.tick();
  e.notify([{...record(),answers:{part1:{q:2},part2:{q:'answer'}}}]);
  assert.equal(vm.runInContext("currentLiveClassGrades['01']",e.context),undefined);
  await e.tick();assert.equal(e.calls(),2);
});

test('teacher: submission removal and identical resubmission never reuse the invalidated score',async()=>{
  const e=teacherEnv();e.notify([record()]);await e.tick();
  e.notify([{...record(),status:'in_progress'}]);await e.tick();
  assert.equal(vm.runInContext("currentLiveClassGrades['01']",e.context),undefined);
  e.notify([record()]);await e.tick();assert.equal(e.calls(),2);
});

test('teacher: changed inputs during an in-flight request discard the old result and fetch once more',async()=>{
  const e=teacherEnv();let resolve,calls=0;
  e.context.requestSecureEvaluationClassGrades=()=>{calls++;return new Promise(r=>{resolve=r;});};
  e.notify([record()]);await e.tick();
  e.notify([{...record(),answers:{part1:{q:2}}}]);await e.tick();
  resolve({attemptId:'round',grades:{'01':{score:{objectiveTotal:99}}}});await flush();
  assert.equal(vm.runInContext("currentLiveClassGrades['01']",e.context),undefined);
  await e.tick();assert.equal(calls,2);
  resolve({attemptId:'round',grades:{'01':{score:{objectiveTotal:45}}}});await flush();
  assert.equal(vm.runInContext("currentLiveClassGrades['01'].score.objectiveTotal",e.context),45);
});

test('teacher: failed requests remain retryable; switching to V3 does not read V4 grades',async()=>{
  const e=teacherEnv();let calls=0;
  e.context.requestSecureEvaluationClassGrades=async()=>{calls++;if(calls===1)throw Error('offline');return {attemptId:'round',grades:{}};};
  e.notify([record()]);await e.tick();e.notify([record()]);await e.tick();assert.equal(calls,2);
  e.context.setCurrentLiveSession({questionVersion:3,attemptId:'mock'});
  e.notify([{...record(),attemptId:'mock'}]);await e.tick();assert.equal(calls,2);
});

test('teacher: an incomplete response is retried but never cached indefinitely',async()=>{
  const e=teacherEnv();let calls=0;
  e.context.requestSecureEvaluationClassGrades=async()=>{calls++;return {attemptId:'round',grades:calls===1?{}:{'01':{score:{objectiveTotal:50}}}};};
  e.notify([record()]);await e.tick();await e.tick();
  assert.equal(calls,2);assert.equal(e.timers.size,0);
  e.notify([record()]);await e.tick();assert.equal(calls,2);
});

test('teacher: persistently incomplete responses stop after three reads',async()=>{
  const e=teacherEnv();let calls=0;
  e.context.requestSecureEvaluationClassGrades=async()=>{calls++;return {attemptId:'round',grades:{}};};
  e.notify([record()]);for(let i=0;i<6;i++)await e.tick();
  assert.equal(calls,3);assert.equal(e.timers.size,0);
});

test('student: review updates while away are fetched once when returning to results',async()=>{
  const {context:c,app,notify,element}=studentEnv();let calls=0,review=null;
  c.requestSecureEvaluationStudentScore=async()=>{calls++;return response(review);};
  notify(record());await flush();
  let hidden=true;element('eval-screen-result').classList.contains=()=>hidden;
  review={total:35,confirmed:true};notify({...record(),review:{confirmed:review}});await flush();assert.equal(calls,1);
  app.showScreen=()=>{hidden=false;};app.openLobby();await flush();
  assert.equal(calls,2);assert.equal(app.serverScoreState.score.part3,35);
});

test('student: synchronous snapshot delivery cannot recursively attach duplicate listeners',()=>{
  const {context:c,app}=studentEnv();let sessionSubscriptions=0,studentSubscriptions=0;
  app.sessionUnsub=null;app.studentUnsub=null;
  c.window.evalService.listenSession=()=>{sessionSubscriptions++;app.attachAssessmentListeners();return ()=>{};};
  c.window.evalService.listenStudent=()=>{studentSubscriptions++;return ()=>{};};
  app.attachAssessmentListeners();app.attachAssessmentListeners();
  assert.equal(sessionSubscriptions,1);assert.equal(studentSubscriptions,1);assert.equal(app.attachingAssessmentListeners,false);
});
