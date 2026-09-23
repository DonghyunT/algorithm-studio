let assessmentReviewViewToken=null;
function renderAssessmentReview(student,classId,options={}){
  const box=options.box||document.getElementById('classroom-assessment-review'),token={};assessmentReviewViewToken=token;
  box.replaceChildren();box.hidden=![3,4].includes(student.questionVersion);if(box.hidden)return;
  const sourceKey=assessmentSourceKey(student.answers?.part3);
  const version=assessmentVersion(student,options.archiveId?null:typeof currentLiveSession!=='undefined'?currentLiveSession:null),v2=version===ASSESSMENT_V2,rules=assessmentRules(version);
  const add=(tag,text,parent=box)=>{const el=document.createElement(tag);el.textContent=text;parent.appendChild(el);return el;};
  add('h3',v2?'Part 3 · 잠정점수와 교사 정정':'Part 3 · AI 초벌 채점과 교사 확정');
  add('p',v2?'AI 점수는 학생 배부용 잠정점수입니다. 이의신청을 검토한 뒤 필요한 항목만 정정할 수 있습니다.':'AI는 점수와 근거를 제안합니다. 답안을 확인하고 네 항목의 점수를 검토한 뒤 확정해 주세요. AI 없이 직접 평가할 수도 있습니다.');
  const status=add('p',student.status==='submitted'?(v2?'잠정점수로 총점을 표시합니다. 교사 정정이 있으면 우선 반영합니다.':'교사 확정 전에는 총점을 표시하지 않습니다.'):'학생이 제출한 뒤 검토할 수 있습니다.');status.setAttribute('role','status');
  let proposal=student.review?.proposal;
  if(proposal?.sourceKey!==sourceKey||proposal?.attemptId!==student.attemptId||(proposal?.rubricVersion||'open-design-v1')!==version)proposal=null;
  let confirmed=student.review?.confirmed;
  if(confirmed?.sourceKey!==sourceKey||confirmed?.attemptId!==student.attemptId||(confirmed?.rubricVersion||'open-design-v1')!==version)confirmed=null;
  let ai = null;
  if (student.questionVersion === 4&&!options.archiveId) {
    ai = add('button', 'Solar AI 초벌 채점 요청');
    ai.type = 'button';
    ai.disabled = student.status !== 'submitted'||(v2&&!!(proposal||confirmed));
  } else if(!options.archiveId) {
    add('p', 'ℹ️ 모의평가 회차는 교사 직접 평가로 진행됩니다. (AI 초벌 채점은 실전평가 회차에서 지원)');
  }
  const detail=add('div',''),inputs=[];
  for(const rule of rules){
    const row=add('div','',detail);row.className='assessment-review-row';
    const label=add('label',rule.label+' / '+rule.max+'점',row),input=document.createElement('input');input.type='number';input.min=Math.min(...rule.allowed);input.max=rule.max;input.step=v2&&rule.max===10?2:1;input.id='review-score-'+rule.id;label.htmlFor=input.id;
    input.value=confirmed?.criteria.find(c=>c.id===rule.id)?.score??proposal?.criteria.find(c=>c.id===rule.id)?.score??'';
    input.disabled=student.status!=='submitted';row.appendChild(input);inputs.push({rule,input});
    const evidence=proposal?.criteria.find(c=>c.id===rule.id)?.evidence;
    if(evidence)add('p','AI 근거: '+evidence,row);
  }
  if(proposal){const totals=assessmentTotals(proposal.criteria,version);add('p',(v2?'잠정점수: ':'AI 제안: ')+totals.total+' / 40점'+(totals.minimumAdjustment?` (항목 합계 ${totals.rawTotal} + 최저점 보정 ${totals.minimumAdjustment})`:''));(proposal.uncertainties||[]).forEach(note=>add('p','확인 필요: '+note));}
  if(confirmed)add('p','저장된 교사 '+(v2?'정정':'확정')+' 점수: '+assessmentTotals(confirmed.criteria,version).total+' / 40점');
  const ackLabel=add('label',''),ack=document.createElement('input');ack.type='checkbox';ack.id='review-confirm-read';ackLabel.append(ack,document.createTextNode(' 답안과 각 항목의 점수를 확인했습니다.'));
  const save=add('button',v2?'교사 정정 점수 저장':'교사 점수 확정 저장');save.type='button';save.id='review-confirm-save';save.disabled=true;
  ack.onchange=()=>{save.disabled=!ack.checked||student.status!=='submitted';};
  inputs.forEach(({input})=>input.addEventListener('input',()=>{ack.checked=false;save.disabled=true;}));
  if(ai){
    ai.onclick=async()=>{
      ai.disabled=true;status.textContent='제출 답안을 검토하고 있습니다. 점수는 자동 확정되지 않습니다.';
      try{
        const result=await requestAssessmentAI({purpose:'review',classId,studentNum:student.numStr});
        await evalService.savePart3Review(classId,student.num,sourceKey,result,'proposal');
        if(assessmentReviewViewToken===token){student.review={...student.review,proposal:{...result,sourceKey}};renderAssessmentReview(student,classId);if(typeof renderLiveGrid==='function'&&typeof currentLiveStudents!=='undefined')renderLiveGrid(currentLiveStudents);}
      }catch(error){if(assessmentReviewViewToken===token)status.textContent=error.message;}
      finally{if(assessmentReviewViewToken===token)ai.disabled=false;}
    };
  }
  save.onclick=async()=>{
    if(!ack.checked)return;
    save.disabled=true;
    try{
      if(inputs.some(({input})=>input.value.trim()===''))throw Error('모든 항목의 점수를 입력해 주세요.');
      const criteria=validateAssessmentCriteria(inputs.map(({rule,input})=>{const prior=(confirmed||proposal)?.criteria.find(c=>c.id===rule.id),score=Number(input.value);return {id:rule.id,score,evidence:prior&&prior.score!==score?`교사 검토로 ${prior.score}점에서 ${score}점으로 정정. 이전 근거: ${prior.evidence||''}`:prior?.evidence||'교사 직접 검토'};}),version);
      const savedReview=options.archiveId?await evalService.saveArchivedPart3Review(classId,options.archiveId,student.archiveStudentId,sourceKey,criteria):await evalService.savePart3Review(classId,student.num,sourceKey,{criteria},'confirmed');
      if(assessmentReviewViewToken===token){student.review=savedReview||{...student.review,confirmed:{criteria,sourceKey,attemptId:student.attemptId,rubricVersion:version}};renderAssessmentReview(student,classId,options);if(typeof renderLiveGrid==='function'&&typeof currentLiveStudents!=='undefined')renderLiveGrid(currentLiveStudents);}
    }catch(error){if(assessmentReviewViewToken===token){status.textContent=error.message;save.disabled=false;}}
  };
}
