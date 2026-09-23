/* Shared, versioned criteria and a canonical anonymized answer snapshot. */
const ASSESSMENT_RUBRIC = [
  {id:'problem',label:'문제·조건의 명확성'},
  {id:'logic',label:'자연어 알고리즘의 논리성'},
  {id:'consistency',label:'자연어와 순서도의 일치'},
  {id:'flow',label:'순서도 구조·동작의 타당성'}
];
function assessmentReviewPayload(part={}) {
  const text=value=>typeof value==='string'?value:'';
  const plan=part?.plan||{};
  return {plan:{current:text(plan.current),goal:text(plan.goal),conditions:text(plan.conditions),steps:(Array.isArray(plan.steps)?plan.steps:[]).map(s=>({type:text(s?.type)||'seq',text:text(s?.text),condition:text(s?.condition),yesAction:text(s?.yesAction),noAction:text(s?.noAction),loopAction:text(s?.loopAction)}))},
    blocks:(Array.isArray(part?.blocks)?part.blocks:[]).map(b=>({id:text(b?.id),shape:text(b?.shape),text:text(b?.text)})),
    connections:(Array.isArray(part?.connections)?part.connections:[]).map(c=>({from:text(c?.from),to:text(c?.to),fromPort:text(c?.fromPort),toPort:text(c?.toPort)}))};
}
function assessmentSourceKey(part){return JSON.stringify(assessmentReviewPayload(part));}
const ASSESSMENT_V2='open-design-v2';
const ASSESSMENT_RUBRIC_V2=[
  {id:'current',label:'현재 상태',max:5,allowed:[0,3,4,5]},
  {id:'goal',label:'목표 상태',max:5,allowed:[0,3,4,5]},
  {id:'conditions',label:'조건',max:5,allowed:[0,3,4,5]},
  {id:'plan',label:'자연어 기획서',max:5,allowed:[2,3,4,5]},
  {id:'logic',label:'문제 해결 논리',max:10,allowed:[0,2,4,6,8,10]},
  {id:'structure',label:'순서도 구조·표현',max:10,allowed:[0,2,4,6,8,10]}
];
function assessmentRules(version){return version===ASSESSMENT_V2?ASSESSMENT_RUBRIC_V2:ASSESSMENT_RUBRIC.map(r=>({...r,max:10,allowed:Array.from({length:11},(_,i)=>i)}));}
function assessmentVersion(student,session){return student?.assessmentRubricVersion||session?.assessmentRubricVersion||student?.review?.confirmed?.rubricVersion||student?.review?.proposal?.rubricVersion||'open-design-v1';}
function validateAssessmentCriteria(criteria,version='open-design-v1') {
  if(!['open-design-v1',ASSESSMENT_V2].includes(version))throw Error('채점 기준 버전을 확인해 주세요.');
  const rules=assessmentRules(version);
  if(!Array.isArray(criteria)||criteria.length!==rules.length||new Set(criteria.map(c=>c?.id)).size!==rules.length)throw Error('평가 항목의 누락·중복을 확인해 주세요.');
  return rules.map(rule=>{
    const row=criteria.find(c=>c?.id===rule.id);
    if(!row||!Number.isInteger(row.score)||!rule.allowed.includes(row.score))throw Error('각 항목의 허용 점수 구간을 확인해 주세요.');
    return {id:rule.id,score:row.score,evidence:typeof row.evidence==='string'?row.evidence.slice(0,1200):''};
  });
}
function assessmentTotals(criteria,version){const rows=validateAssessmentCriteria(criteria,version),rawTotal=rows.reduce((n,c)=>n+c.score,0),total=version===ASSESSMENT_V2?Math.max(6,rawTotal):rawTotal;return {rawTotal,total,minimumAdjustment:total-rawTotal};}
function assessmentHasSteps(part){return assessmentReviewPayload(part).plan.steps.some(s=>[s.text,s.condition,s.yesAction,s.noAction,s.loopAction].some(v=>v.trim()));}
function assessmentIsEmpty(part){const p=assessmentReviewPayload(part);return ![p.plan.current,p.plan.goal,p.plan.conditions].some(v=>v.trim())&&!assessmentHasSteps(part)&&p.connections.length===0&&p.blocks.every(b=>b.shape==='terminal'&&['시작','종료','끝',''].includes(b.text.trim()));}
function assessmentEmptyCriteria(){return ASSESSMENT_RUBRIC_V2.map(r=>({id:r.id,score:r.id==='plan'?2:0,evidence:r.id==='plan'?'자연어 미작성 기본 2점':'작성된 평가 증거가 없습니다.'}));}
function assessmentNormalizeAI(criteria,part,version){
  const rows=validateAssessmentCriteria(criteria,version);if(version!==ASSESSMENT_V2)return rows;
  const p=assessmentReviewPayload(part);
  for(const key of ['current','goal','conditions'])if(!p.plan[key].trim()){const row=rows.find(c=>c.id===key);row.score=0;row.evidence='작성하지 않음';}
  if(!assessmentHasSteps(part)){const row=rows.find(c=>c.id==='plan');row.score=2;row.evidence='자연어 미작성 기본 2점';}
  if(!p.blocks.length||(p.connections.length===0&&p.blocks.every(b=>b.shape==='terminal'&&['시작','종료','끝',''].includes(b.text.trim()))))for(const key of ['logic','structure']){const row=rows.find(c=>c.id===key);row.score=0;row.evidence='순서도 미작성';}
  if(assessmentIsEmpty(part))return assessmentEmptyCriteria();return rows;
}
function assessmentEffectiveReview(student){
  if(student?.status!=='submitted')return null;
  const version=assessmentVersion(student),key=assessmentSourceKey(student.answers?.part3);
  for(const kind of ['confirmed','proposal']){const r=student.review?.[kind];if(!r||r.attemptId!==student.attemptId||r.sourceKey!==key||(r.rubricVersion||'open-design-v1')!==version)continue;try{return {...r,...assessmentTotals(r.criteria,version),criteria:validateAssessmentCriteria(r.criteria,version),rubricVersion:version,confirmed:kind==='confirmed',status:kind==='confirmed'?'교사 정정':version===ASSESSMENT_V2?'잠정':'1차 채점'};}catch{}}
  return null;
}
function assessmentConvert(total){return typeof total==='number'&&Number.isFinite(total)&&total>=0&&total<=100?2*Math.ceil(total*0.3/2):null;}
function applyConfirmedAssessmentReview(scores,student){
  if(!scores.pendingReview)return scores;
  const final=assessmentEffectiveReview(student);
  if(final&&(final.confirmed||final.rubricVersion===ASSESSMENT_V2))return {...scores,part3:final.total,total:scores.objectiveTotal+final.total,pendingReview:false,assessmentStatus:final.status};
  return scores;
}
if(typeof module!=='undefined')module.exports={ASSESSMENT_RUBRIC,ASSESSMENT_V2,ASSESSMENT_RUBRIC_V2,assessmentRules,assessmentVersion,assessmentReviewPayload,assessmentSourceKey,validateAssessmentCriteria,assessmentTotals,assessmentHasSteps,assessmentIsEmpty,assessmentEmptyCriteria,assessmentNormalizeAI,assessmentEffectiveReview,assessmentConvert,applyConfirmedAssessmentReview};
