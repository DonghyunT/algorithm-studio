/* Server-only AI access. Local API keys are never read or sent by the browser. */
async function callSolarAI({messages}) {
  if (window.studentEvalApp?.joined && !window.studentEvalApp.isSubmitted &&
      ['in_progress','ended'].includes(window.studentEvalApp.sessionStatus)) {
    throw new Error('수행평가 중에는 실행 결과 확인을 이용해 주세요.');
  }
  if (window.authService.isDemo()) {
    if(window.localPreview)return window.localPreview.chat(messages);
    throw new Error('로컬 시연에서는 AI를 호출하지 않습니다.');
  }
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

function generateSmartConditions(current = '', goal = '') {
  const text = (current + ' ' + goal).toLowerCase();
  if (/온도|기온|더위|추위|환기|에어컨|히터|온실|난방|냉방/.test(text)) {
    return [
      '온도가 기준치(예: 28도) 이상이 되면 작동을 시작한다.',
      '적정 온도에 도달하면 동작을 자동으로 멈춘다.',
      '3분 간격으로 온도를 측정하여 상태를 다시 확인한다.'
    ];
  }
  if (/조명|불|어둡|밝|전등|스마트홈|센서|led|밤|낮/.test(text)) {
    return [
      '주변 밝기(조도)가 기준치 이하로 어두울 때만 켠다.',
      '사람의 움직임이 3분 이상 감지되지 않으면 자동으로 끈다.',
      '스위치가 켜져 있는 동안에만 센서 감지를 동작시킨다.'
    ];
  }
  if (/물|화분|식물|수분|습도|건조|급수/.test(text)) {
    return [
      '토양 습도가 기준치(예: 30%) 이하로 떨어지면 물을 준다.',
      '한 번에 10초 동안만 물을 공급하고 멈춘다.',
      '물이 넘치지 않도록 물통의 잔여량을 확인한다.'
    ];
  }
  if (/시간|알람|지각|공부|타이머|기상|시계|분|초/.test(text)) {
    return [
      '정해진 목표 시간(예: 30분)이 지나면 알림을 울린다.',
      '알람이 울린 후 3회 이상 멈춤 버튼이 없으면 더 큰 소리를 낸다.',
      '취소 버튼을 누를 때까지 5초 간격으로 반복 확인한다.'
    ];
  }
  if (/청소|먼지|로봇|쓰레기|분리수거|청소기/.test(text)) {
    return [
      '장애물 센서에 물체가 감지되면 방향을 바꾼다.',
      '배터리가 20% 이하로 떨어지면 동작을 멈추고 복귀한다.',
      '청소 구역을 최대 3회 왕복한 후 작업을 완료한다.'
    ];
  }
  // 일반적인 맥락 기반 제어 조건
  return [
    '목표 상태가 될 때까지 최대 5회까지만 반복 시도한다.',
    '명령을 한 번 실행한 후 3초 동안 대기하고 상태를 다시 확인한다.',
    '비상 상황이나 이상 신호가 감지되면 즉시 멈추고 경고를 표시한다.'
  ];
}

async function requestAssessmentAI(body){
  if(window.authService.isDemo()){
    if(body.purpose==='conditions') {
      return {demo:true, conditions: generateSmartConditions(body.current, body.goal)};
    }
    throw Error('로컬 시연에서는 실제 AI 채점을 호출하지 않습니다. 항목별 점수 입력과 교사 확정은 시험할 수 있습니다.');
  }
  if(body.purpose==='review')await window.authService.teacher();
  const token=await window.authService.token();
  const response=await fetch('/api/assessment',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'AI 연결을 확인해 주세요.');
  return data;
}

async function requestSecureEvaluation(action, body, teacher=false) {
  if (window.authService.isDemo()) throw Error('로컬 시연에서는 실전평가 비공개 문항을 열지 않습니다.');
  if (teacher) await window.authService.teacher({classId:body.classId});
  const token = await window.authService.token();
  const response = await fetch('/api/evaluation', {method:'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...body})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw Error(data.error || '실전평가 서버를 확인하지 못했습니다.');
  return data;
}

async function requestSecureEvaluationQuestions(classId, studentNum) {
  const numStr = String(Number(studentNum)).padStart(2, '0');
  return requestSecureEvaluation('questions', {classId, studentNum: numStr});
}

async function requestSecureEvaluationGrade(classId, studentNum) {
  const numStr = String(Number(studentNum)).padStart(2, '0');
  return requestSecureEvaluation('grade', {classId, studentNum: numStr}, true);
}

async function requestSecureEvaluationStudentScore(classId, studentNum) {
  const numStr = String(Number(studentNum)).padStart(2, '0');
  return requestSecureEvaluation('student-score', {classId, studentNum: numStr});
}

async function requestSecureEvaluationReview(classId, studentNum) {
  const numStr = String(Number(studentNum)).padStart(2, '0');
  return requestSecureEvaluation('review', {classId, studentNum: numStr}, true);
}

async function requestSecureEvaluationBankExport() {
  return requestSecureEvaluation('export-bank', {}, true);
}
