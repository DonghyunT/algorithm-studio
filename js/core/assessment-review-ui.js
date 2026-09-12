let assessmentReviewViewToken=null;
function renderAssessmentReview(student,classId){
  const box=document.getElementById('classroom-assessment-review'),token={};assessmentReviewViewToken=token;
  box.replaceChildren();box.hidden=student.questionVersion!==3;if(box.hidden)return;
  const sourceKey=assessmentSourceKey(student.answers?.part3);
  const add=(tag,text,parent=box)=>{const el=document.createElement(tag);el.textContent=text;parent.appendChild(el);return el;};
  add('h3','Part 3 · AI 초벌 채점과 교사 확정');
  add('p','AI는 점수와 근거를 제안합니다. 답안을 확인하고 네 항목의 점수를 검토한 뒤 확정해 주세요. AI 없이 직접 평가할 수도 있습니다.');
  const status=add('p',student.status==='submitted'?'교사 확정 전에는 총점을 표시하지 않습니다.':'학생이 제출한 뒤 검토할 수 있습니다.');status.setAttribute('role','status');
  let proposal=student.review?.proposal;
  if(proposal?.sourceKey!==sourceKey||proposal?.attemptId!==student.attemptId)proposal=null;
  let confirmed=student.review?.confirmed;
  if(confirmed?.sourceKey!==sourceKey||confirmed?.attemptId!==student.attemptId)confirmed=null;
  const ai=add('button','Solar AI 초벌 채점 요청');ai.type='button';ai.disabled=student.status!=='submitted';
  const detail=add('div',''),inputs=[];
  for(const rule of ASSESSMENT_RUBRIC){
    const row=add('div','',detail);row.className='assessment-review-row';
    const label=add('label',rule.label+' / 10점',row),input=document.createElement('input');input.type='number';input.min=0;input.max=10;input.step=1;input.id='review-score-'+rule.id;label.htmlFor=input.id;
    input.value=confirmed?.criteria.find(c=>c.id===rule.id)?.score??proposal?.criteria.find(c=>c.id===rule.id)?.score??'';
    input.disabled=student.status!=='submitted';row.appendChild(input);inputs.push({rule,input});
    const evidence=proposal?.criteria.find(c=>c.id===rule.id)?.evidence;
    if(evidence)add('p','AI 근거: '+evidence,row);
  }
  if(proposal){add('p','AI 제안: '+proposal.criteria.reduce((n,c)=>n+c.score,0)+' / 40점 · 최종 점수 아님');(proposal.uncertainties||[]).forEach(note=>add('p','확인 필요: '+note));}
  if(confirmed)add('p','저장된 교사 확정 점수: '+confirmed.criteria.reduce((n,c)=>n+c.score,0)+' / 40점');
  const ackLabel=add('label',''),ack=document.createElement('input');ack.type='checkbox';ack.id='review-confirm-read';ackLabel.append(ack,document.createTextNode(' 답안과 각 항목의 점수를 확인했습니다.'));
  const save=add('button','교사 점수 확정 저장');save.type='button';save.id='review-confirm-save';save.disabled=true;
  ack.onchange=()=>{save.disabled=!ack.checked||student.status!=='submitted';};
  inputs.forEach(({input})=>input.addEventListener('input',()=>{ack.checked=false;save.disabled=true;}));
  ai.onclick=async()=>{
    ai.disabled=true;status.textContent='제출 답안을 검토하고 있습니다. 점수는 자동 확정되지 않습니다.';
    try{
      const result=await requestAssessmentAI({purpose:'review',classId,studentNum:student.numStr});
      await evalService.savePart3Review(classId,student.num,sourceKey,result,'proposal');
      if(assessmentReviewViewToken===token){student.review={...student.review,proposal:{...result,sourceKey}};renderAssessmentReview(student,classId);}
    }catch(error){if(assessmentReviewViewToken===token)status.textContent=error.message;}
    finally{if(assessmentReviewViewToken===token)ai.disabled=false;}
  };
  save.onclick=async()=>{
    if(!ack.checked)return;
    save.disabled=true;
    try{
      if(inputs.some(({input})=>input.value.trim()===''))throw Error('네 항목의 점수를 모두 입력해 주세요.');
      const criteria=validateAssessmentCriteria(inputs.map(({rule,input})=>({id:rule.id,score:Number(input.value),evidence:''})));
      await evalService.savePart3Review(classId,student.num,sourceKey,{criteria},'confirmed');
      if(assessmentReviewViewToken===token){status.textContent='교사 점수를 확정 저장했습니다. 총점에 반영됩니다.';ack.checked=false;}
    }catch(error){if(assessmentReviewViewToken===token){status.textContent=error.message;save.disabled=false;}}
  };
}
