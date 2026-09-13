/**
 * ==============================================================================
 * 🎓 [클래스룸 및 수행평가 관리관 엔진 (Classroom & Assessment Engine)]
 * ==============================================================================
 * - 11개 반 (2학년 1반 ~ 11반) 지원 및 학급당 최대 27명 학생 관리
 * - 2대 탭 시스템:
 *   1. [ 📑 단원별 과제 취합 ] (추상화 처방전, 샌드위치 레시피, 순서도 카드)
 *   2. [ ⏱️ 30분 실시간 수행평가 관제실 ] (27명 실시간 신호등 바둑판 + 동시 시작 + 나이스 CSV)
 * - Zero-Dependency 웹 표준 및 sessionStorage + Firestore 하이브리드 동기화
 */

const CLASSROOM_STORAGE_KEY = "ALGO_LAB_CLASSROOM_DATA_V3";


// 전국 중학교 표준 11개 반 구성
const DEFAULT_CLASSES = [
  "2학년 1반", "2학년 2반", "2학년 3반", "2학년 4반",
  "2학년 5반", "2학년 6반", "2학년 7반", "2학년 8반",
  "2학년 9반", "2학년 10반", "2학년 11반"
];

let currentSelectedClass = "2학년 1반";
let currentClassroomTab = "live_eval"; // 기본을 '실시간 수행평가 관제실'로 설정
let isTeacherAuthenticated = false;
let liveEvalUnsub = null;
let currentLiveStudents = [];
let liveSessionUnsub = null;
let liveSessionTimer = null;
let liveDashboardGeneration = 0;
let currentLiveSession = null;
let liveSessionError = false;
let teacherSessionPending = false;
let teacherSessionPendingLabel = '';

// 1. 클래스룸 데이터 로드 및 초기화
function getClassroomData() { return Object.fromEntries(DEFAULT_CLASSES.map(name => [name, []])); }

function saveClassroomData(data) {
  try {
    sessionStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save classroom data:", e);
  }
}

// 2. 교사용 클래스룸 모드 열기 및 PIN 인증 (풀페이지 전체 뷰)
function openClassroomTab() {
  if(isAssessmentLocked())return;
  if (!isTeacherAuthenticated) {
    promptTeacherPin();
  } else {
    showClassroomView();
  }
}

async function promptTeacherPin() {
  if(isAssessmentLocked())return;
  try {
    await window.authService.teacher();
    if(isAssessmentLocked())return;
    isTeacherAuthenticated = true;
    showClassroomView();
  } catch (error) { alert(error.message); }
}

function showClassroomView() {
  if(isAssessmentLocked())return;
  document.body.classList.remove('reading-mode');
  if (typeof disableStudioMode === "function") disableStudioMode();
  // 모든 메인 뷰 숨기고 view-classroom 단독 노출
  ['view-roadmap', 'view-concept', 'view-quiz', 'view-lab', 'view-eval'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const viewClassroom = document.getElementById('view-classroom');
  if (viewClassroom) viewClassroom.classList.remove('hidden');

  // 상단 네비게이션 활성화
  const btn = document.getElementById('nav-btn-classroom');
  if (btn) {
    document.querySelectorAll('#global-header [aria-current]').forEach(item=>item.removeAttribute('aria-current'));
    btn.setAttribute('aria-current','page');
  }

  renderClassroomDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitClassroomView() {
  stopLiveEvalDashboard();
  if (typeof switchUnit === 'function') {
    switchUnit('roadmap');
  }
}

// 탭 전환 (live_eval | assignments)
function switchClassroomSubTab(tabName) {
  currentClassroomTab = tabName;
  const btnLive = document.getElementById('classroom-tab-btn-live');
  const btnAssign = document.getElementById('classroom-tab-btn-assign');
  const secLive = document.getElementById('classroom-section-live');
  const secAssign = document.getElementById('classroom-section-assign');

  if (tabName === 'live_eval') {
    if (btnLive) btnLive.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 text-white shadow-xs transition cursor-pointer";
    if (btnAssign) btnAssign.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer";
    if (secLive) secLive.classList.remove('hidden');
    if (secAssign) secAssign.classList.add('hidden');
    initLiveEvalDashboard();
  } else {
    stopLiveEvalDashboard();
    if (btnLive) btnLive.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer";
    if (btnAssign) btnAssign.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 text-white shadow-xs transition cursor-pointer";
    if (secLive) secLive.classList.add('hidden');
    if (secAssign) secAssign.classList.remove('hidden');
    renderAssignmentsTable();
  }
}

function switchClassroomClass(className) {
  currentSelectedClass = className;
  if (currentClassroomTab === 'live_eval') {
    initLiveEvalDashboard();
  } else {
    renderAssignmentsTable();
  }
}

// 대시보드 전체 렌더링
function renderClassroomDashboard() {
  const classSelect = document.getElementById('classroom-class-select');
  if (classSelect) {
    classSelect.innerHTML = DEFAULT_CLASSES.map(c => `
      <option value="${c}" ${c === currentSelectedClass ? 'selected' : ''}>${c}</option>
    `).join('');
  }

  switchClassroomSubTab(currentClassroomTab);
}

// ============================================================================
// ⏱️ [신규] 30분 실시간 수행평가 관제탑 (27명 신호등 바둑판)
// ============================================================================

function getClassIdFromSelected() {
  // "2학년 3반" ➔ "2-3"
  const match = currentSelectedClass.match(/(\d+)학년\s*(\d+)반/);
  if (match) return `${match[1]}-${match[2]}`;
  return "2-1";
}

function initLiveEvalDashboard() {
  stopLiveEvalDashboard();
  const generation = liveDashboardGeneration;
  const classId = getClassIdFromSelected();
  const titleEl = document.getElementById('classroom-live-class-title');
  if (titleEl) titleEl.textContent = currentSelectedClass;
  currentLiveSession = null;
  liveSessionError = false;
  currentLiveStudents = [];
  setTeacherSessionFeedback('');
  renderLiveGrid([]);
  renderTeacherSessionControl();

  if (window.evalService) {
    try {
    liveSessionUnsub = window.evalService.listenSession(classId, (session, metadata) => {
      if (generation !== liveDashboardGeneration || metadata?.hasPendingWrites) return;
      currentLiveSession = session;
      liveSessionError = false;
      renderTeacherSessionControl();
    }, () => {
      if (generation !== liveDashboardGeneration) return;
      liveSessionError = true;
      renderTeacherSessionControl();
    });
    liveEvalUnsub = window.evalService.listenStudents(classId, (students) => {
      if (generation !== liveDashboardGeneration) return;
      const label=document.getElementById('classroom-connection-status');
      if(label) label.textContent=window.evalService.isDemo() ? '로컬 시연 · 운영 DB와 분리됨' : '답안 수신됨 · 연결 상태는 갱신 시 확인';
      currentLiveStudents = students || [];
      renderLiveGrid(currentLiveStudents);
    }, error=>{if(generation!==liveDashboardGeneration)return;const label=document.getElementById('classroom-connection-status');if(label)label.textContent='답안 수신 실패 · 연결과 권한 확인 필요';setTeacherSessionFeedback(error.message);});
    liveSessionTimer = setInterval(renderTeacherSessionControl, 1000);
    } catch(error) { liveSessionError = true; setTeacherSessionFeedback(error.message); renderTeacherSessionControl(); }
  }
}

function stopLiveEvalDashboard() {
  liveDashboardGeneration++;
  liveEvalUnsub?.(); liveEvalUnsub = null;
  liveSessionUnsub?.(); liveSessionUnsub = null;
  clearInterval(liveSessionTimer); liveSessionTimer = null;
}

function teacherSessionState(session = currentLiveSession) {
  if (liveSessionError) return {state:'error', label:'상태 확인 실패', action:'retry', button:'다시 연결', hint:'연결과 교사 권한을 확인한 뒤 다시 연결해 주세요.'};
  if (!session) return {state:'loading', label:'상태 확인 중', action:'', button:'상태 확인 중', hint:'평가 상태를 불러오고 있습니다.'};
  const expired = session.status === 'in_progress' && Number.isFinite(session.deadlineMs) && Date.now() >= session.deadlineMs;
  if (session.status === 'ended' || expired) return {state:'ended', label:'평가 종료', action:'prepare', button:'새 평가 준비', hint:expired?'평가 시간이 끝났습니다. 새 평가를 준비하면 이전 답안을 보관하고 새 회차를 엽니다.':'제출·채점 현황을 확인해 주세요. 새 평가를 준비하면 이전 답안을 보관하고 새 회차를 엽니다.'};
  if (session.status === 'in_progress') return {state:'running', label:'평가 중', action:'end', button:'평가 종료', hint:'학생들이 답안을 작성하고 있습니다. 종료하면 학생 화면에 제출을 요청합니다.'};
  if (session.status === 'waiting' && session.attemptId) return {state:'waiting', label:'입장 대기', action:'start', button:'평가 시작', hint:'입장 인원을 확인한 뒤 시작해 주세요. 평가 시간은 30분입니다.'};
  return {state:'unprepared', label:'준비 전', action:'prepare', button:'평가 준비', hint:'학생들이 입장할 수 있도록 평가를 준비해 주세요.'};
}

function setTeacherSessionFeedback(message) {
  const el = document.getElementById('teacher-session-feedback');
  if (el) el.textContent = message;
}

function renderTeacherSessionControl() {
  const model = teacherSessionState();
  const badge = document.getElementById('teacher-session-status');
  const hint = document.getElementById('teacher-session-hint');
  const button = document.getElementById('teacher-session-action');
  const time = document.getElementById('teacher-session-time');
  // Pending writes are not presented as completed operations.
  if (!teacherSessionPending) {
    if (badge) { badge.textContent = model.label; badge.dataset.state = model.state; }
    if (hint) hint.textContent = model.hint;
  }
  if (time) {
    const seconds = Math.max(0, Math.ceil((currentLiveSession?.deadlineMs - Date.now()) / 1000));
    time.textContent = model.state === 'running' && Number.isFinite(seconds) ? `남은 시간 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}` : '';
  }
  if (button) {
    button.disabled = teacherSessionPending || !model.action;
    button.textContent = teacherSessionPending ? teacherSessionPendingLabel : model.button;
    button.dataset.action = model.action;
    button.setAttribute('aria-busy',String(teacherSessionPending));
  }
  const select = document.getElementById('classroom-class-select');
  if (select) select.disabled = teacherSessionPending;
}

async function handleTeacherSessionAction() {
  if (teacherSessionPending) return;
  const model = teacherSessionState();
  if (model.action === 'retry') { initLiveEvalDashboard(); return; }
  if (!model.action) return;
  const classId = getClassIdFromSelected(), generation = liveDashboardGeneration;
  const expected = {attemptId:currentLiveSession?.attemptId ?? null, status:currentLiveSession?.status ?? 'waiting'};
  if (model.action === 'end' && !confirm(`[${currentSelectedClass}] 평가를 종료하시겠습니까?\n연결된 학생 화면에 현재 답안 제출을 요청합니다. 연결이 끊긴 학생은 제출 여부를 별도로 확인해 주세요.`)) return;
  if (model.action === 'prepare' && model.state === 'ended' && !confirm('이전 답안을 보관하고 새 평가를 준비하시겠습니까? 학생들은 새 회차에 다시 입장해야 합니다.')) return;
  teacherSessionPending = true;
  teacherSessionPendingLabel = {prepare:'준비 중…', start:'시작 중…', end:'종료 중…'}[model.action];
  setTeacherSessionFeedback(''); renderTeacherSessionControl();
  try {
    let session;
    if (model.action === 'prepare') {
      // A deadline ends student work without a teacher DB write; close that old round before preparing the next.
      if (expected.status === 'in_progress') {
        await window.evalService.endSession(classId, expected);
        expected.status = 'ended';
      }
      session = await window.evalService.prepareSession(classId, expected);
    } else if (model.action === 'start') session = await window.evalService.startSession(classId, 30, expected);
    else session = {...currentLiveSession, ...await window.evalService.endSession(classId, expected)};
    if (generation === liveDashboardGeneration) {
      currentLiveSession = session;
      setTeacherSessionFeedback({prepare:'평가를 준비했습니다. 학생 입장 후 시작해 주세요.',start:'평가를 시작했습니다.',end:'평가를 종료했습니다. 학생별 제출 상태를 확인해 주세요.'}[model.action]);
    }
  } catch(error) {
    if (generation === liveDashboardGeneration) setTeacherSessionFeedback('처리하지 못했습니다. '+error.message);
  } finally {
    teacherSessionPending = false;
    renderTeacherSessionControl();
  }
}

/**
 * 27명 학생 좌석 바둑판 (3x9 그리드) 렌더링
 */
function renderLiveGrid(students = []) {
  const gridContainer = document.getElementById('classroom-live-grid');
  const countOnlineEl = document.getElementById('classroom-live-online-count');
  const countSubmitEl = document.getElementById('classroom-live-submit-count');

  const studentMap = {};
  students.forEach(s => {
    studentMap[s.num] = s;
  });

  const onlineCount = students.filter(s => s.status !== 'waiting' || s.name).length;
  const submitCount = students.filter(s => s.status === 'submitted').length;

  if (countOnlineEl) countOnlineEl.textContent = `${onlineCount} / 27명`;
  if (countSubmitEl) countSubmitEl.textContent = `${submitCount} / 27명`;

  if (!gridContainer) return;

  // 1번부터 27번까지 27개 좌석 카드 생성
  let html = "";
  for (let num = 1; num <= 27; num++) {
    const s = studentMap[num];
    const numStr = String(num).padStart(2, '0');

    let statusBg = "bg-slate-50 border-slate-200 text-slate-400";
    let statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">미접속</span>`;
    let scoreDisplay = `<span class="text-xs text-slate-300">-</span>`;
    let isClickable = false;

    if (s) {
      isClickable = true;
      if (s.status === 'waiting') {
        statusBg = "bg-amber-50/80 border-amber-300 text-amber-900";
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">대기중</span>`;
      } else if (s.status === 'in_progress') {
        statusBg = "bg-blue-50/80 border-blue-400 text-blue-900";
        const pCount = (Number(s.progress?.part1) || 0) + (Number(s.progress?.part2) || 0);
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">풀이중 (${pCount}문항)</span>`;
      } else if (s.status === 'submitted') {
        statusBg = "bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs";
        const finalScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
          ? s.scores.teacherOverride
          : (s.scores?.total || 0);
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">제출완료</span>`;
        scoreDisplay = `<span class="text-sm font-black text-emerald-700">${s.scores?.pendingReview?'채점 대기':finalScore+'점'}</span>`;
      }
    }

    const studentName = s ? s.name : "빈 좌석";

    html += `
      <div onclick="${isClickable ? `openLiveStudentModal(${num})` : ''}" class="p-3 rounded-2xl border ${statusBg} flex flex-col justify-between min-h-[120px] transition ${isClickable ? 'hover:scale-[1.03] cursor-pointer shadow-xs' : 'opacity-60'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-white/80 border border-slate-200">${numStr}번</span>
          ${statusBadge}
        </div>
        <div class="truncate text-xs sm:text-sm font-black text-slate-800 py-1.5 leading-snug" title="${escapeHtml(studentName)}">${escapeHtml(studentName)}</div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <span class="text-[10px] text-slate-400">성적:</span>
          ${scoreDisplay}
        </div>
      </div>
    `;
  }

  gridContainer.innerHTML = html;
}

// 나이스 CSV 다운로드
function handleTeacherExportCSV() {
  const classId = getClassIdFromSelected();
  if (window.evalService) {
    window.evalService.exportNeisCSV(classId, currentLiveStudents);
  }
}

// 학생 개별 답안 상세 팝업 및 점수 수동 조정 / 재시험 허용
function openLiveStudentModal(studentNum) {
  const s = currentLiveStudents.find(item => item.num === studentNum);
  if (!s) return;

  const modal = document.getElementById('classroom-live-detail-modal');
  if (!modal) return;

  const titleEl = document.getElementById('classroom-live-modal-title');
  if (titleEl) titleEl.textContent = `${currentSelectedClass} ${s.num}번 ${s.name} 학생 답안 검토`;

  const p1El = document.getElementById('classroom-live-modal-p1');
  const p2El = document.getElementById('classroom-live-modal-p2');
  const p3El = document.getElementById('classroom-live-modal-p3');
  const scoreInp = document.getElementById('classroom-live-override-score');

  if (p1El) {
    const studentP1 = s.answers?.part1 || {};
    let p1Html = '';
    (window.EVAL_QUESTIONS?.part1 || []).forEach(q => {
      const studentAnsIdx = studentP1[q.id];
      const isCorrect = studentAnsIdx === q.correctAnswer;
      const ansText = studentAnsIdx !== undefined && q.options ? q.options[studentAnsIdx] : "미응답";
      const badge = isCorrect 
        ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ml-2">정답</span>' 
        : `<span class="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold ml-2">오답 (정답: ${q.options ? q.options[q.correctAnswer] : ''})</span>`;
      p1Html += `<div class="mb-1.5"><div class="font-bold text-slate-800">${q.title}</div><div class="text-slate-600 pl-3 border-l-2 border-slate-200 ml-1 mt-0.5 text-[11px]">👉 ${ansText} ${badge}</div></div>`;
    });
    p1El.innerHTML = p1Html || "답안 데이터가 없습니다.";
  }

  if (p2El) {
    const studentP2 = s.answers?.part2 || {};
    let p2Html = '';
    (window.EVAL_QUESTIONS?.part2 || []).forEach(q => {
      const studentAnsText = studentP2[q.id] || "미응답";
      const cleanedAns = studentAnsText.trim().replace(/\s+/g, '');
      const isCorrect = q.answers && q.answers.some(ans => ans.trim().replace(/\s+/g, '') === cleanedAns);
      const badge = isCorrect 
        ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ml-2">정답</span>' 
        : `<span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold ml-2">확인필요 (정답 예시: ${q.answers ? q.answers[0] : ''})</span>`;
      p2Html += `<div class="mb-1.5"><div class="font-bold text-slate-800">${q.title}</div><div class="text-slate-600 pl-3 border-l-2 border-slate-200 ml-1 mt-0.5 text-[11px]">👉 ${studentAnsText} ${badge}</div></div>`;
    });
    p2El.innerHTML = p2Html || "답안 데이터가 없습니다.";
  }

  if (p3El) {
    const graph = s.answers?.part3 || {};
    const plan = graph.plan || {};
    
    let stepsHtml = (Array.isArray(plan.steps) ? plan.steps : []).map((step, index) => {
      if (step.type === 'sel') return `<div class="ml-2 mb-1"><span class="font-bold text-indigo-600">[선택]</span> 조건: ${step.condition || '미작성'}<br><span class="text-[10px] text-slate-500 ml-4">↳ 예: ${step.yesAction || '미작성'} | 아니오: ${step.noAction || '미작성'}</span></div>`;
      if (step.type === 'loop') return `<div class="ml-2 mb-1"><span class="font-bold text-emerald-600">[반복]</span> 지속 조건: ${step.condition || '미작성'}<br><span class="text-[10px] text-slate-500 ml-4">↳ 반복할 행동: ${step.loopAction || '미작성'}</span></div>`;
      return `<div class="ml-2 mb-1"><span class="font-bold text-slate-600">[순차]</span> ${step.text || '미작성'}</div>`;
    }).join('');

    let blocksHtml = (Array.isArray(graph.blocks) ? graph.blocks : []).filter(Boolean).map(b => `<span class="inline-block bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-1 font-mono">[${b.shape}] ${b.text}</span>`).join('');
    let connsHtml = (Array.isArray(graph.connections) ? graph.connections : []).filter(Boolean).map(c => `<div class="text-[10px] text-slate-500 ml-2 font-mono">↳ ${c.from} (${c.fromPort}) → ${c.to}</div>`).join('');

    let p3Html = `
      <div class="mb-4">
        <div class="font-bold text-slate-800 mb-2 border-b border-emerald-100 pb-1 text-[12px]">자연어 기획서</div>
        <div class="text-[11px] text-slate-700 ml-1 space-y-0.5 mb-2 bg-emerald-50/50 p-2 rounded">
          <div><span class="font-semibold text-slate-500 w-12 inline-block">현재:</span> ${plan.current || '미작성'}</div>
          <div><span class="font-semibold text-slate-500 w-12 inline-block">목표:</span> ${plan.goal || '미작성'}</div>
          <div><span class="font-semibold text-slate-500 w-12 inline-block">조건:</span> ${plan.conditions || '미작성'}</div>
        </div>
        <div class="text-[11px] text-slate-700 mt-2">${stepsHtml || '<div class="text-slate-400 italic">작성된 단계 없음</div>'}</div>
      </div>
      <div>
        <div class="font-bold text-slate-800 mb-2 border-b border-emerald-100 pb-1 flex justify-between items-center text-[12px]">
          <span>순서도 캔버스 구성</span>
          <span class="text-[10px] font-normal bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shadow-sm">${s.questionVersion === 3 ? '교사 수동 40점 배점' : `자동 계산: ${(s.scores?.part3 || 0)}/40점`}</span>
        </div>
        <div class="mb-2 text-[11px]">${blocksHtml || '<div class="text-slate-400 italic">배치된 블록 없음</div>'}</div>
        <div class="mb-2">${connsHtml || '<div class="text-slate-400 italic text-[11px]">연결선 없음</div>'}</div>
      </div>
    `;
    p3El.innerHTML = p3Html;
    p3El.style.whiteSpace = 'normal';
  }

  const currentScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
    ? s.scores.teacherOverride
    : (s.scores?.total || 0);

  if (scoreInp) scoreInp.value = currentScore;
  document.getElementById('classroom-legacy-score').hidden=s.questionVersion===3;
  renderAssessmentReview(s,getClassIdFromSelected());

  // 교사 점수 수동 조정 저장 버튼
  const saveBtn = document.getElementById('classroom-live-save-score-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newScore = scoreInp.value;
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        try { await window.evalService.overrideStudentScore(classId, s.num, newScore); } catch(error) { alert(error.message); return; }
        alert(`✅ ${s.name} 학생의 최종 성적이 [${newScore}점]으로 조정되었습니다.`);
        closeLiveStudentModal();
      }
    };
  }

  // 교사 권한 재시험 허용 (답안 초기화) 버튼
  const resetBtn = document.getElementById('classroom-live-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (!confirm(`⚠️ 정말로 [${s.name}] 학생의 답안을 초기화하고 재시험을 허용하시겠습니까?\n기존 제출 답안과 성적이 리셋되며 학생 브라우저가 다시 시험 진행 상태로 전환됩니다.`)) {
        return;
      }
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        try { await window.evalService.resetStudentExam(classId, s.num); } catch(error) { alert(error.message); return; }
        alert(`🔄 ${s.name} 학생의 재시험이 승인되었습니다. 답안이 초기화되었습니다.`);
        closeLiveStudentModal();
      }
    };
  }

  modal.classList.remove('hidden');
}

function closeLiveStudentModal() {
  const modal = document.getElementById('classroom-live-detail-modal');
  if (modal) modal.classList.add('hidden');
}

// ============================================================================
// 📑 [기존 기능 보존] 단원별 과제 취합 테이블 렌더링
// ============================================================================

function renderAssignmentsTable() {
  const container=document.getElementById('classroom-table-container');
  if(container) container.textContent='단원별 과제 자동 취합은 아직 연결되지 않았습니다. 실습 결과는 이미지·텍스트로 내보내 선생님이 안내한 게시판에 제출해 주세요. 수행평가 답안은 실시간 관제실에서 확인할 수 있습니다.';
}
function exportClassroomCSV() { alert('단원별 과제 취합은 아직 연결되지 않았습니다. 수행평가 성적은 실시간 관제실의 CSV 버튼을 사용해 주세요.'); }
function closeStudentDetailModal() { document.getElementById('classroom-detail-modal')?.classList.add('hidden'); }
function copyPadletFormat() { alert('단원별 과제 취합은 아직 연결되지 않았습니다.'); }
