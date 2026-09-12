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
