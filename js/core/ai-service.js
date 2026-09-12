/* Server-only AI access. Local API keys are never read or sent by the browser. */
async function callSolarAI({messages}) {
  if (window.studentEvalApp?.joined && !window.studentEvalApp.isSubmitted &&
      ['in_progress','ended'].includes(window.studentEvalApp.sessionStatus)) {
    throw new Error('수행평가 중에는 실행 결과 확인을 이용해 주세요.');
  }
  if (window.authService.isDemo()) throw new Error('로컬 시연에서는 AI를 호출하지 않습니다.');
  const token=await window.authService.token();
  const response=await fetch('/api/chat',{
    method:'POST',signal:AbortSignal.timeout(30000),
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({messages})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || 'AI 연결을 확인해 주세요.');
  const content=data.choices?.[0]?.message?.content;
  if(typeof content!=='string') throw new Error('AI 응답을 확인할 수 없습니다.');
  return content;
}
window.callSolarAI=callSolarAI;

async function requestAssessmentAI(body){
  if(window.authService.isDemo()){
    if(body.purpose==='conditions')return {demo:true,conditions:['사용할 수 있는 시간에 제한이 있다.','사용할 수 있는 도구나 자원의 범위를 정한다.','처리할 대상의 수를 정한다.']};
    throw Error('로컬 시연에서는 실제 AI 채점을 호출하지 않습니다. 항목별 점수 입력과 교사 확정은 시험할 수 있습니다.');
  }
  if(body.purpose==='review')await window.authService.teacher();
  const token=await window.authService.token();
  const response=await fetch('/api/assessment',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'AI 연결을 확인해 주세요.');
  return data;
}
