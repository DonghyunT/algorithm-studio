const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function context() {
  const ctx = vm.createContext({ console, Map, Set });
  for (const file of ['js/data/eval-questions.js','js/core/flow-expressions.js','js/core/flow-validation.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  return ctx;
}
function flow(theme='theme_greenhouse', condition='온도 > 28', yes='창문 열기', no='창문 닫기', input='온도 입력') {
  return {selectedThemeId:theme,blocks:[['s','terminal','시작'],['i','io',input],['d','decision',condition],['y','process',yes],['n','process',no],['e','terminal','종료']].map(([id,shape,text])=>({id,shape,text})),connections:[['s','i','out'],['i','d','out'],['d','y','yes'],['d','n','no'],['y','e','out'],['n','e','out']].map(([from,to,fromPort])=>({from,to,fromPort}))};
}
test('four themes execute actual comparisons and both branches',()=>{
  const ctx=context();
  const examples=[flow(),flow('theme_vending','금액 >= 1000','음료 배출','잔액 부족 안내','금액 입력'),flow('theme_transit','나이 >= 13 && 나이 <= 18','청소년 요금','일반 요금','나이 입력'),flow('theme_traffic','대기시간 >= 30','초록불','빨간불','대기시간 입력')];
  for(const example of examples) assert.equal(ctx.inspectAssessmentFlow(example).passed,true);
});
test('wrong boundary, reversed branches, disconnected graph and forged verification fail',()=>{
  const ctx=context();
  for(const graph of [flow('theme_greenhouse','온도 >= 28'),flow('theme_greenhouse','온도 > 28','창문 닫기','창문 열기')]) assert.equal(ctx.inspectAssessmentFlow(graph).score,0);
  const graph=flow();graph.connections.pop();graph.isVerified=true;
  assert.equal(ctx.gradeEvaluation({part3:graph}).scores.part3,0);
  assert.equal(ctx.inspectAssessmentFlow({blocks:[{id:'s',shape:'terminal',text:'시작'},{id:'e',shape:'terminal',text:'종료'}],connections:[]}).passed,false);
});
test('unknown expressions stop honestly and malformed graphs do not crash grading',()=>{
  const ctx=context();
  const graph=flow('theme_greenhouse','온도가 28도 이상이 아닌가');
  assert.ok(ctx.inspectAssessmentFlow(graph).issues.length);
  for(const blocks of [null,{},[null],[{id:{toString:4},shape:'terminal',text:42}]]) assert.equal(ctx.gradeEvaluation({part3:{blocks}}).scores.part3,0);
  assert.equal(ctx.gradeEvaluation({part2:{q11:{toString:4}},part3:{selectedThemeId:{toString:4}}}).scores.total,0);
});
test('parser respects precedence, constants, missing variables and numeric syntax',()=>{
  const ctx=context();
  assert.equal(ctx.evalFlowchartAST(ctx.parseFlowchartAssign('x = (1+2)*3').ast,{}),9);
  assert.equal(ctx.evalFlowchartCond(ctx.parseFlowchartCond('1 < 2'),{}),true);
  assert.throws(()=>ctx.parseFlowchartAssign('x = 1.2.3'));
  assert.throws(()=>ctx.evalFlowchartCond(ctx.parseFlowchartCond('missing < 2'),{}));
});
test('all objective/short answers total 60 and student score fields are ignored',()=>{
  const ctx=context();
  const answers=vm.runInContext('({part1:Object.fromEntries(EVAL_QUESTIONS.part1.map(q=>[q.id,q.correctAnswer])),part2:Object.fromEntries(EVAL_QUESTIONS.part2.map(q=>[q.id,q.answers[0]]))})',ctx);
  answers.scores={total:100};assert.equal(ctx.gradeEvaluation(answers).scores.total,60);
});
test('service propagates writes, rejects invalid grades and preserves rejoining record',async()=>{
  const records=new Map(), storage=new Map();
  let existing={ownerUid:'u',status:'submitted',answers:{part1:{q1:1}}};
  let fail=false;
  const ctx=vm.createContext({console,window:{authService:{isDemo:()=>false,student:async()=>({uid:'u'}),teacher:async()=>({uid:'t'})}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto'),setTimeout,clearTimeout});
  const doc={collection:()=>({doc:()=>doc}),get:async()=>({data:()=>({status:'in_progress',deadlineMs:Date.now()+999999})}),update:async v=>{if(fail)throw Error('permission-denied');records.set('last',v);}};
  ctx.window.firebaseDb={collection:()=>({doc:()=>doc}),runTransaction:async cb=>cb({get:async()=>({exists:true,data:()=>existing}),update:(_,value)=>{if(fail)throw Error('permission-denied');records.set('last',value);}})};
  vm.runInContext(fs.readFileSync(path.join(root,'js/core/eval-service.js'),'utf8'),ctx);
  const service=ctx.window.evalService;
  assert.equal((await service.joinWaitingRoom('2-1',1,'테스트')).status,'submitted');
  assert.equal((await service.submitStudentExam('2-1',1,{answers:{part1:{q1:1}}})).status,'submitted');
  await assert.rejects(service.submitStudentExam('2-1',1,{answers:{part1:{q1:2}}}));
  existing.status='in_progress';
  for(const value of [-1,101,'',NaN]) await assert.rejects(service.overrideStudentScore('2-1',1,value));
  fail=true;await assert.rejects(service.submitStudentExam('2-1',1,{answers:{}}),/permission/);
  fail=false;await service.submitStudentExam('2-1',1,{answers:{part1:{}},scores:{total:100}});
  assert.equal(records.get('last').scores,undefined);
});
module.exports={flow};
