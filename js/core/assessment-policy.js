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
function validateAssessmentCriteria(criteria) {
  if(!Array.isArray(criteria)||criteria.length!==4)throw Error('네 가지 평가 항목을 확인해 주세요.');
  return ASSESSMENT_RUBRIC.map(rule=>{
    const row=criteria.find(c=>c?.id===rule.id);
    if(!row||typeof row.score!=='number'||!Number.isInteger(row.score)||row.score<0||row.score>10)throw Error('각 항목은 0~10의 정수 점수여야 합니다.');
    return {id:rule.id,score:row.score,evidence:typeof row.evidence==='string'?row.evidence.slice(0,1200):''};
  });
}
function applyConfirmedAssessmentReview(scores,student){
  if(!scores.pendingReview)return scores;
  const final=student?.review?.confirmed;
  if(final&&student.status==='submitted'&&final.attemptId===student.attemptId&&final.sourceKey===assessmentSourceKey(student.answers?.part3)){
    try{const rows=validateAssessmentCriteria(final.criteria),part3=rows.reduce((n,c)=>n+c.score,0);return {...scores,part3,total:scores.objectiveTotal+part3,pendingReview:false};}catch{}
  }
  return scores;
}
if(typeof module!=='undefined')module.exports={ASSESSMENT_RUBRIC,assessmentReviewPayload,assessmentSourceKey,validateAssessmentCriteria};
