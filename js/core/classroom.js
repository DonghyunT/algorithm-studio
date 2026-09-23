/**
 * ==============================================================================
 * 🎓 [클래스룸 및 수행평가 관리관 엔진 (Classroom & Assessment Engine)]
 * ==============================================================================
 * - 11개 반 (2학년 1반 ~ 11반) 지원 및 학급당 최대 27명 학생 관리
 * - 3대 탭 시스템:
 *   1. [ ⏱️ 실시간 수행평가 관제실 ] (27명 실시간 신호등 바둑판 + 동시 시작 + 나이스 CSV)
 *   2. [ 🗂 이전 평가 기록 ] (담당 학급 보관 답안 읽기 전용 조회)
 *   3. [ 📑 단원별 과제 취합 ] (추상화 처방전, 샌드위치 레시피, 순서도 카드)
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
let isScoreBlindMode = true; // 프로젝터 투사 시 학생 실시간 점수 유출 방지 (기본 ON)
let currentModalStudent = null;
let teacherAutoReviewQueue = null;
let autoEndHandledAttemptId = null;
let currentLiveClassGrades = {};
let currentLiveClassGradesAttemptId = null;
const liveClassGradesRequests = new Map();
let gradesRefreshTimeout = null;
let liveClassGradesSourceKey = null;
let liveClassGradesRetry = { key: null, count: 0 };
let archiveViewGeneration = 0;
let archivedSessions = [];
let selectedArchivedSession = null;
let archivedStudents = [];
let selectedArchivedStudentId = null;
let archivedStudentsError = '';

function getTeacherAutoReviewQueue() {
  if (!teacherAutoReviewQueue && typeof AssessmentAutoReviewQueue === 'function') {
    teacherAutoReviewQueue = new AssessmentAutoReviewQueue({
      onStatusChange: updateTeacherAiQueueBadge
    });
  }
  return teacherAutoReviewQueue;
}

function updateTeacherAiQueueBadge(status = {}) {
  const badge = document.getElementById('classroom-live-ai-status');
  const text = document.getElementById('classroom-live-ai-text');
  if (!badge || !text) return;

  if (status.isBusy) {
    badge.classList.remove('hidden');
    badge.className = 'text-amber-300 font-bold flex items-center gap-1.5';
    const pending = status.pendingCount || 0;
    const proc = status.currentProcessing ? `${status.currentProcessing}번 분석 중` : '대기 중';
    text.textContent = `⚡ AI 초벌 채점 (${proc} · 대기 ${pending}명)`;
  } else if (status.totalProcessed > 0 && status.pendingCount === 0) {
    badge.classList.remove('hidden');
    badge.className = 'text-emerald-400 font-bold flex items-center gap-1.5';
    text.textContent = `✓ AI 초벌 채점 완료 (${status.totalProcessed}명)`;
  } else {
    badge.classList.add('hidden');
  }
}

function syncTeacherAutoReviewQueue(students = currentLiveStudents) {
  const classId = getClassIdFromSelected();
  const queue = getTeacherAutoReviewQueue();
  if (!queue || !classId || !currentLiveSession) return;
  queue.sync({
    classId,
    session: currentLiveSession,
    students: students || [],
    isTeacher: isTeacherAuthenticated
  });
}

function isV4AssessmentSession(session) {
  return session?.questionVersion === 4 || session?.version === 'v4';
}

function liveObjectiveSource(student) {
  return JSON.stringify([student.numStr || String(student.num), student.attemptId, student.submittedAt,
    student.answers?.part1 || {}, student.answers?.part2 || {}], (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}

function liveGradeSourceKey(students = currentLiveStudents) {
  return JSON.stringify(students.filter(s => s.status === 'submitted' && s.attemptId === currentLiveSession?.attemptId)
    .map(liveObjectiveSource).sort());
}

function updateLiveStudents(students) {
  const previousKey = liveGradeSourceKey();
  const previous = new Map(currentLiveStudents.map(s => [s.numStr || String(s.num), s]));
  for (const num of Object.keys(currentLiveClassGrades)) {
    const next = students.find(s => (s.numStr || String(s.num)) === num);
    const old = previous.get(num);
    if (!next || next.status !== 'submitted' || !old || liveObjectiveSource(next) !== liveObjectiveSource(old)) {
      delete currentLiveClassGrades[num];
    }
  }
  currentLiveStudents = students;
  if (previousKey !== liveGradeSourceKey()) liveClassGradesSourceKey = null;
}

function isCurrentLiveV4Attempt(attemptId, generation = liveDashboardGeneration) {
  return generation === liveDashboardGeneration &&
    isV4AssessmentSession(currentLiveSession) &&
    Boolean(attemptId) && currentLiveSession?.attemptId === attemptId;
}

function setCurrentLiveSession(session) {
  const previousAttemptId = currentLiveSession?.attemptId ?? null;
  const previousVersion = currentLiveSession?.questionVersion ?? currentLiveSession?.version ?? null;
  const nextSession = session || null;
  const nextAttemptId = nextSession?.attemptId ?? null;
  const nextVersion = nextSession?.questionVersion ?? nextSession?.version ?? null;
  currentLiveSession = nextSession;

  if (previousAttemptId !== nextAttemptId || previousVersion !== nextVersion) {
    liveClassGradesSourceKey = null;
    liveClassGradesRetry = { key: null, count: 0 };
    currentLiveClassGrades = {};
    currentLiveClassGradesAttemptId = null;
    if (previousAttemptId && previousAttemptId !== nextAttemptId) closeLiveStudentModal();
  }
}

function cacheLiveClassGrades(attemptId, grades, merge = false) {
  if (!isCurrentLiveV4Attempt(attemptId) || !grades || typeof grades !== 'object' || Array.isArray(grades)) return false;
  const existing = currentLiveClassGradesAttemptId === attemptId ? currentLiveClassGrades : {};
  currentLiveClassGrades = merge ? { ...existing, ...grades } : { ...grades };
  currentLiveClassGradesAttemptId = attemptId;
  return true;
}

async function refreshLiveClassGrades(classId) {
  if (!classId) return;
  const session = typeof currentLiveSession !== 'undefined' ? currentLiveSession : null;
  const isV4 = isV4AssessmentSession(session);
  const hasSubmitted = Array.isArray(currentLiveStudents) && currentLiveStudents.some(s =>
    s.status === 'submitted' && s.attemptId === session?.attemptId
  );

  if (!isV4 || !session?.attemptId || !hasSubmitted) return;
  if (typeof requestSecureEvaluationClassGrades !== 'function' || (window.authService && window.authService.isDemo())) return;
  const sourceKey = liveGradeSourceKey();
  if (sourceKey === liveClassGradesSourceKey) return;
  const generation = liveDashboardGeneration;
  const requestKey = `${generation}:${session.attemptId}`;
  const inFlight = liveClassGradesRequests.get(requestKey);
  if (inFlight) {
    inFlight.refreshRequested = true;
    return;
  }

  const requestState = { refreshRequested: false };
  liveClassGradesRequests.set(requestKey, requestState);
  let succeeded = false;
  let incomplete = false;
  try {
    const res = await requestSecureEvaluationClassGrades(classId);
    if (res?.grades && res.attemptId === session.attemptId && isCurrentLiveV4Attempt(session.attemptId, generation) && sourceKey === liveGradeSourceKey()) {
      incomplete = currentLiveStudents.some(s => s.status === 'submitted' && s.attemptId === session.attemptId &&
        !res.grades[s.numStr || String(s.num).padStart(2, '0')]?.score);
      succeeded = cacheLiveClassGrades(session.attemptId, res.grades);
      if (succeeded && !incomplete) {
        liveClassGradesSourceKey = sourceKey;
        liveClassGradesRetry = { key: null, count: 0 };
      }
      if (succeeded && Array.isArray(currentLiveStudents) && currentLiveStudents.length > 0) {
        renderLiveGrid(currentLiveStudents);
      }
    }
  } catch (err) {
    console.warn('[CLASSROOM] class-grades 자동 조회 알림:', err.message);
  } finally {
    if (liveClassGradesRequests.get(requestKey) === requestState) {
      liveClassGradesRequests.delete(requestKey);
    }
    if (requestState.refreshRequested && sourceKey !== liveGradeSourceKey() && isCurrentLiveV4Attempt(session.attemptId, generation)) {
      scheduleRefreshLiveClassGrades(classId, 300);
    } else if (incomplete && isCurrentLiveV4Attempt(session.attemptId, generation)) {
      // A local teacher submission may arrive before its write is acknowledged.
      // Never mark an incomplete response as the final cached result.
      if (liveClassGradesRetry.key !== sourceKey) liveClassGradesRetry = { key: sourceKey, count: 0 };
      if (liveClassGradesRetry.count++ < 2) scheduleRefreshLiveClassGrades(classId, 1000);
    }
  }
}

function scheduleRefreshLiveClassGrades(classId, delayMs = 400) {
  clearTimeout(gradesRefreshTimeout);
  gradesRefreshTimeout = setTimeout(() => {
    refreshLiveClassGrades(classId);
  }, delayMs);
}

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
async function openClassroomTab(request = switchUnit.request) {
  if(isAssessmentLocked())return;
  const destination = currentActiveUnit;
  try {
    const user = await window.authService.existingTeacher();
    if(isAssessmentLocked() || currentActiveUnit !== destination || request !== switchUnit.request)return;
    isTeacherAuthenticated = !!user;
    if(user) showClassroomView(); else promptTeacherPin();
  } catch(error) {
    if(!isAssessmentLocked() && currentActiveUnit === destination && request === switchUnit.request) {
      isTeacherAuthenticated=false;
      promptTeacherPin(window.authService.teacherError(error));
    }
  }
}

function promptTeacherPin(message = '') {
  if(isAssessmentLocked())return;
  if(window.studentEvalApp?.joined && !window.studentEvalApp.isSubmitted) {
    alert('이 창에 입장한 학생의 평가가 남아 있습니다. 교사 로그인은 별도 창에서 진행해 주세요.');
    return;
  }
  const dialog = document.getElementById('teacher-login-dialog');
  document.getElementById('teacher-login-feedback').textContent = message;
  document.getElementById('teacher-temporary-form').hidden = true;
  document.getElementById('teacher-login-password').value = '';
  if(!dialog.open)dialog.showModal();
}

function showTemporaryTeacherLogin() {
  document.getElementById('teacher-temporary-form').hidden = false;
  document.getElementById('teacher-login-password').focus();
}

let teacherLoginPending = false;
let teacherLoginGeneration = 0;
function cancelTeacherLogin() {
  teacherLoginGeneration++;
  switchUnit.request++;
  document.getElementById('teacher-login-password').value='';
}
async function loginTeacher(method) {
  if(isAssessmentLocked() || teacherLoginPending)return;
  const dialog=document.getElementById('teacher-login-dialog');
  const input=document.getElementById('teacher-login-password');
  if(method==='temporary'&&!input.reportValidity())return;
  teacherLoginPending=true;
  const generation=++teacherLoginGeneration;
  dialog.querySelectorAll('button:not([data-login-cancel])').forEach(button=>button.disabled=true);
  document.getElementById('teacher-login-feedback').textContent='로그인을 확인하고 있습니다…';
  try {
    const user=await window.authService.teacher({method,password:input.value});
    if(isAssessmentLocked() || generation !== teacherLoginGeneration || !dialog.open){await window.authService.discardTeacherLogin(user);return;}
    isTeacherAuthenticated = true;
    dialog.close();
    currentActiveUnit='classroom';
    showClassroomView();
  } catch (error) {
    if(generation !== teacherLoginGeneration || !dialog.open)return;
    isTeacherAuthenticated=false;
    document.getElementById('teacher-login-feedback').textContent=window.authService.teacherError(error);
  } finally {
    input.value='';teacherLoginPending=false;
    dialog.querySelectorAll('button').forEach(button=>button.disabled=button.dataset.previewDisabled==='true');
  }
}

function showClassroomView() {
  if(isAssessmentLocked())return;
  currentActiveUnit='classroom';
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

// 탭 전환 (live_eval | archives | assignments)
function switchClassroomSubTab(tabName) {
  const allowedTabs=['live_eval','archives','assignments'];
  currentClassroomTab=allowedTabs.includes(tabName)?tabName:'live_eval';
  const tabs=[
    {name:'live_eval',button:'classroom-tab-btn-live',section:'classroom-section-live'},
    {name:'archives',button:'classroom-tab-btn-archive',section:'classroom-section-archive'},
    {name:'assignments',button:'classroom-tab-btn-assign',section:'classroom-section-assign'}
  ];
  tabs.forEach(tab=>{
    const active=tab.name===currentClassroomTab,button=document.getElementById(tab.button),section=document.getElementById(tab.section);
    if(button){
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
      button.className=`min-w-[132px] px-4 py-2.5 rounded-xl text-xs sm:text-sm ${active?'font-black bg-indigo-600 text-white shadow-xs':'font-bold bg-slate-100 hover:bg-slate-200 text-slate-700'} transition cursor-pointer flex flex-1 sm:flex-none items-center justify-center gap-2`;
    }
    section?.classList.toggle('hidden',!active);
  });

  if(currentClassroomTab==='live_eval')initLiveEvalDashboard();
  else{
    stopLiveEvalDashboard();
    archiveViewGeneration++;
    if(currentClassroomTab==='archives')loadArchivedSessions();
    else renderAssignmentsTable();
  }
}

function handleClassroomTabKeydown(event){
  const current=event.target.closest?.('[role="tab"]');
  if(!current)return;
  const tabs=[...current.parentElement.querySelectorAll('[role="tab"]')],index=tabs.indexOf(current);
  let nextIndex=index;
  if(event.key==='ArrowRight')nextIndex=(index+1)%tabs.length;
  else if(event.key==='ArrowLeft')nextIndex=(index-1+tabs.length)%tabs.length;
  else if(event.key==='Home')nextIndex=0;
  else if(event.key==='End')nextIndex=tabs.length-1;
  else return;
  event.preventDefault();tabs[nextIndex].focus();tabs[nextIndex].click();
}

function switchClassroomClass(className) {
  if(!getAllowedClassNames().includes(className)){alert('담당 학급만 선택할 수 있습니다.');return;}
  currentSelectedClass = className;
  if (currentClassroomTab === 'live_eval') {
    initLiveEvalDashboard();
  } else if(currentClassroomTab==='archives'){
    loadArchivedSessions();
  } else {
    renderAssignmentsTable();
  }
}

// 대시보드 전체 렌더링
function getAllowedClassNames() {
  const ids=window.authService.allowedClassIds();
  return DEFAULT_CLASSES.filter((_,i)=>ids.includes('2-'+(i+1)));
}
function renderClassroomDashboard() {
  const classes=getAllowedClassNames();
  if(!classes.includes(currentSelectedClass))currentSelectedClass=classes[0]||'';
  const classSelect = document.getElementById('classroom-class-select');
  if (classSelect) {
    classSelect.innerHTML = classes.map(c => `
      <option value="${c}" ${c === currentSelectedClass ? 'selected' : ''}>${c}</option>
    `).join('');
  }

  if(!classes.length){stopLiveEvalDashboard();renderLiveGrid([]);setTeacherSessionFeedback('담당 학급 권한을 확인한 뒤 다시 로그인해 주세요.');return;}
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
  currentLiveClassGrades = {};
  currentLiveClassGradesAttemptId = null;
  clearTimeout(gradesRefreshTimeout);
  setTeacherSessionFeedback('');
  renderLiveGrid([]);
  renderTeacherSessionControl();

  if (window.evalService) {
    try {
    liveSessionUnsub = window.evalService.listenSession(classId, (session, metadata) => {
      if (generation !== liveDashboardGeneration || metadata?.hasPendingWrites) return;
      setCurrentLiveSession(session);
      liveSessionError = false;
      renderTeacherSessionControl();
      syncTeacherAutoReviewQueue(currentLiveStudents);
      if (currentLiveStudents.some(s => s.status === 'submitted')) {
        scheduleRefreshLiveClassGrades(classId, 200);
      }
    }, () => {
      if (generation !== liveDashboardGeneration) return;
      clearUnavailableTeacherData();
    });
    if(generation!==liveDashboardGeneration){liveSessionUnsub?.();liveSessionUnsub=null;return;}
    liveEvalUnsub = window.evalService.listenStudents(classId, (students) => {
      if (generation !== liveDashboardGeneration) return;
      const label=document.getElementById('classroom-connection-status');
      if(label) label.textContent=window.evalService.isDemo() ? '로컬 시연 · 운영 DB와 분리됨' : '답안 수신됨 · 연결 상태는 갱신 시 확인';
      updateLiveStudents(students || []);
      renderLiveGrid(currentLiveStudents);
      syncTeacherAutoReviewQueue(currentLiveStudents);
      if (currentLiveStudents.some(s => s.status === 'submitted')) {
        scheduleRefreshLiveClassGrades(classId, 300);
      }
    }, ()=>{if(generation===liveDashboardGeneration)clearUnavailableTeacherData();});
    if(generation!==liveDashboardGeneration){liveEvalUnsub?.();liveEvalUnsub=null;return;}
    liveSessionTimer = setInterval(renderTeacherSessionControl, 1000);
    } catch(error) { liveSessionError = true; setTeacherSessionFeedback(error.message); renderTeacherSessionControl(); }
  }
}

function clearUnavailableTeacherData() {
  stopLiveEvalDashboard();
  currentLiveStudents=[];currentLiveSession=null;liveSessionError=true;
  currentLiveClassGrades={};
  currentLiveClassGradesAttemptId=null;
  renderLiveGrid([]);closeLiveStudentModal();
  ['classroom-live-modal-title','classroom-live-modal-summary','classroom-live-modal-p1','classroom-live-modal-p2','classroom-live-modal-p3'].forEach(id=>{const el=document.getElementById(id);if(el)el.replaceChildren();});
  const score=document.getElementById('classroom-live-override-score');if(score)score.value='';
  const label=document.getElementById('classroom-connection-status');if(label)label.textContent='자료 표시 중단 · 연결과 담당 학급 권한을 확인해 주세요';
  setTeacherSessionFeedback('학생 자료를 표시할 수 없어 화면을 비웠습니다. 연결을 확인하고, 담당 반이 바뀌었다면 다시 로그인해 주세요.');
  renderTeacherSessionControl();
}

function stopLiveEvalDashboard() {
  liveClassGradesSourceKey = null;
  liveClassGradesRetry = { key: null, count: 0 };
  liveDashboardGeneration++;
  liveEvalUnsub?.(); liveEvalUnsub = null;
  liveSessionUnsub?.(); liveSessionUnsub = null;
  clearInterval(liveSessionTimer); liveSessionTimer = null;
  clearTimeout(gradesRefreshTimeout);
  currentLiveClassGrades = {};
  currentLiveClassGradesAttemptId = null;
  teacherAutoReviewQueue?.reset();
  updateTeacherAiQueueBadge({ isBusy: false, pendingCount: 0, totalProcessed: 0 });
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

  // 시험 시간 만료 시 백그라운드에서 미제출 일괄 마감 및 세션 종료(ended) 동기화
  const isExpired = currentLiveSession?.status === 'in_progress' && Number.isFinite(currentLiveSession.deadlineMs) && Date.now() >= currentLiveSession.deadlineMs;
  if (isExpired && autoEndHandledAttemptId !== currentLiveSession.attemptId && !teacherSessionPending && typeof getClassIdFromSelected === 'function') {
    autoEndHandledAttemptId = currentLiveSession.attemptId;
    const classId = getClassIdFromSelected();
    const expected = { attemptId: currentLiveSession.attemptId, status: 'in_progress' };
    (async () => {
      try {
        if (window.evalService && typeof window.evalService.autoSubmitRemainingStudents === 'function') {
          await window.evalService.autoSubmitRemainingStudents(classId).catch(() => {});
        }
        await window.evalService.endSession(classId, expected);
      } catch(e) {
        console.warn('자동 마감 동기화 알림:', e.message);
      }
    })();
  }
  // Pending writes are not presented as completed operations.
  if (!teacherSessionPending) {
    if (badge) { badge.textContent = model.label; badge.dataset.state = model.state; }
    if (hint) hint.textContent = model.hint;
    const verBadge = document.getElementById('teacher-session-version');
    if (verBadge) {
      if (currentLiveSession?.questionVersion === 4) {
        verBadge.textContent = '실전평가';
        verBadge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
        verBadge.classList.remove('hidden');
      } else if (currentLiveSession?.questionVersion === 3) {
        verBadge.textContent = '모의평가';
        verBadge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40';
        verBadge.classList.remove('hidden');
      } else {
        verBadge.classList.add('hidden');
      }
    }
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
  const extendTimeBtn = document.getElementById('teacher-session-extend-time');
  if (extendTimeBtn) {
    const showExtendTime = model.state === 'running';
    extendTimeBtn.classList.toggle('hidden', !showExtendTime);
    extendTimeBtn.disabled = teacherSessionPending;
  }
  const closeWaitingBtn = document.getElementById('teacher-session-close-waiting');
  if (closeWaitingBtn) {
    const showCloseWaiting = model.state === 'waiting';
    closeWaitingBtn.classList.toggle('hidden', !showCloseWaiting);
    closeWaitingBtn.disabled = teacherSessionPending;
  }
  const select = document.getElementById('classroom-class-select');
  if (select) select.disabled = teacherSessionPending;
  const verSelect = document.getElementById('teacher-session-version-select');
  if (verSelect) {
    const isPrepareState = model.action === 'prepare';
    verSelect.disabled = teacherSessionPending || !isPrepareState;
    if (model.state === 'waiting' || model.state === 'running') {
      verSelect.value = String(currentLiveSession?.questionVersion === 3 ? 3 : 4);
      verSelect.title = '진행 중이거나 대기 중인 평가의 유형은 변경할 수 없습니다.';
    } else {
      verSelect.title = '준비할 평가 유형(실전평가 또는 모의평가)을 선택하세요.';
    }
  }
}

async function handleCloseWaitingRoom() {
  if (teacherSessionPending) return;
  const model = teacherSessionState();
  if (model.state !== 'waiting') return;
  const classId = getClassIdFromSelected(), generation = liveDashboardGeneration;
  const expected = {attemptId:currentLiveSession?.attemptId ?? null, status:currentLiveSession?.status ?? 'waiting'};
  if (!confirm(`[${currentSelectedClass}] 대기실을 닫으시겠습니까?\n아직 시작하지 않은 학생들의 입장이 차단되고 '대기실 닫힘' 상태로 변경됩니다.`)) return;

  teacherSessionPending = true;
  teacherSessionPendingLabel = '대기실 닫는 중…';
  setTeacherSessionFeedback(''); renderTeacherSessionControl();
  try {
    const session = {...currentLiveSession, ...await window.evalService.endSession(classId, expected)};
    if (generation === liveDashboardGeneration) {
      setCurrentLiveSession(session);
      setTeacherSessionFeedback('대기실을 닫았습니다. 학생 입장이 차단되었습니다.');
    }
  } catch(error) {
    if (generation === liveDashboardGeneration) setTeacherSessionFeedback('처리하지 못했습니다. '+error.message);
  } finally {
    teacherSessionPending = false;
    renderTeacherSessionControl();
  }
}

async function handleTeacherExtendClassTime() {
  if (teacherSessionPending) return;
  const model = teacherSessionState();
  if (model.state !== 'running') return;
  const classId = getClassIdFromSelected();
  if (!confirm(`⏱️ [${currentSelectedClass}] 진행 중인 시험 시간을 학급 전체 5분 연장하시겠습니까?\n\n- 현재 풀이 중인 모든 학생에게 시험 시간 5분이 즉시 추가됩니다.\n- 학생 화면에 실시간으로 연장된 타이머가 반영됩니다.`)) {
    return;
  }

  teacherSessionPending = true;
  teacherSessionPendingLabel = '시간 연장 중…';
  setTeacherSessionFeedback('');
  renderTeacherSessionControl();
  try {
    if (window.evalService) {
      await window.evalService.extendClassSessionTime(classId, 5);
      setTeacherSessionFeedback('학급 시험 시간을 5분 연장했습니다.');
    }
  } catch (error) {
    alert('학급 시간 연장 실패: ' + (error?.message || error));
  } finally {
    teacherSessionPending = false;
    teacherSessionPendingLabel = '';
    renderTeacherSessionControl();
  }
}

async function handleCloseAllWaitingRooms() {
  if (teacherSessionPending) return;
  const btn = document.getElementById('classroom-close-all-btn');

  // 1단계 확인 질문
  const step1 = confirm(
    "⚠️ 담당 학급 중 '입장 대기' 상태인 모든 대기실을 일괄 닫으시겠습니까?\n\n" +
    "※ 이미 평가가 진행 중(시험 중)인 학급은 안전하게 보호되며 닫히지 않습니다.\n" +
    "※ 계속하시려면 [확인]을 눌러주세요."
  );
  if (!step1) return;

  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  }

  try {
    const allowedClasses = getAllowedClassNames();
    const waitingTargets = [];

    // 각 학급의 세션 상태 조회
    for (const className of allowedClasses) {
      const match = className.match(/(\d+)학년\s*(\d+)반/);
      const cId = match ? `${match[1]}-${match[2]}` : null;
      if (!cId) continue;
      try {
        const session = await window.evalService.getSession(cId);
        if (session && session.status === 'waiting' && session.attemptId) {
          waitingTargets.push({ className, classId: cId, session });
        }
      } catch (err) {
        console.warn(`[${className}] 세션 조회 실패:`, err);
      }
    }

    if (!waitingTargets.length) {
      alert("현재 '입장 대기' 상태인 학급이 없습니다.\n모든 학급의 대기실이 이미 닫혀 있거나 진행 중입니다.");
      return;
    }

    // 2단계 확인 질문 (실제 닫힐 대상 학급 목록 확인)
    const targetNames = waitingTargets.map(t => t.className).join(', ');
    const step2 = confirm(
      `다음 ${waitingTargets.length}개 학급의 대기실을 닫습니다:\n` +
      `[ ${targetNames} ]\n\n` +
      `정말 진행하시겠습니까? 학생 입장이 즉시 차단됩니다.`
    );
    if (!step2) return;

    let closedCount = 0;
    for (const target of waitingTargets) {
      try {
        await window.evalService.endSession(target.classId, {
          attemptId: target.session.attemptId,
          status: 'waiting'
        });
        closedCount++;
      } catch (err) {
        console.error(`[${target.className}] 대기실 닫기 실패:`, err);
      }
    }

    alert(`✅ 총 ${closedCount}개 학급의 대기실을 안전하게 닫았습니다.\n[ ${targetNames} ]`);
    initLiveEvalDashboard();
  } catch (error) {
    alert("대기실 일괄 닫기 중 오류가 발생했습니다: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
}

async function handleTeacherSessionAction() {
  if (teacherSessionPending) return;
  const model = teacherSessionState();
  if (model.action === 'retry') { initLiveEvalDashboard(); return; }
  if (!model.action) return;
  const classId = getClassIdFromSelected(), generation = liveDashboardGeneration;
  const expected = {attemptId:currentLiveSession?.attemptId ?? null, status:currentLiveSession?.status ?? 'waiting'};
  if (model.action === 'end') {
    const unsubmitted = (currentLiveStudents || []).filter(s => s.status !== 'submitted');
    let confirmMsg = `[${currentSelectedClass}] 평가를 종료하시겠습니까?\n연결된 학생 화면에 현재 답안 제출을 요청합니다.`;
    if (unsubmitted.length > 0) {
      const inProg = unsubmitted.filter(s => s.status === 'in_progress').length;
      const waiting = unsubmitted.filter(s => s.status === 'waiting').length;
      confirmMsg = `⚠️ 아직 제출하지 않은 학생이 ${unsubmitted.length}명 있습니다.\n` +
        `(풀이 중: ${inProg}명, 대기 중: ${waiting}명)\n\n` +
        `[확인]을 누르면 미제출 학생들의 현재 답안으로 일괄 정상 제출 마감하고 평가를 종료합니다.\n` +
        `[취소]를 누르면 종료하지 않고 이전 화면을 유지합니다.`;
    }
    if (!confirm(confirmMsg)) return;
  }
  let selectedVersion = 4;
  if (model.action === 'prepare') {
    const verSelect = document.getElementById('teacher-session-version-select');
    selectedVersion = Number(verSelect?.value) === 3 ? 3 : 4;
    const isMock = selectedVersion === 3;

    if (model.state === 'ended') {
      const confirmMsg = isMock
        ? '이전 답안을 안전하게 보관하고 새 [📘 모의평가]를 준비하시겠습니까?\n\n' +
          '• 평가 유형: 모의평가 (기본 실습 문항 배정)\n' +
          '• 채점 방식: AI 채점 꺼짐 (토큰 절약 및 자유 실습)\n' +
          '• 학생들은 새 회차에 다시 입장해야 합니다.'
        : '이전 답안을 안전하게 보관하고 새 [📗 실전평가]를 준비하시겠습니까?\n\n' +
          '• 평가 유형: 실전평가 (80문항 비공개 문제은행 기반 균형 배정)\n' +
          '• 채점 방식: Solar AI 자동 초벌 채점 가동\n' +
          '• 학생들은 새 회차에 다시 입장해야 합니다.';
      const ok = confirm(confirmMsg);
      if (!ok) return;
    }
  }
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
      session = await window.evalService.prepareSession(classId, expected, selectedVersion);
    } else if (model.action === 'start') session = await window.evalService.startSession(classId, 30, expected);
    else {
      if (window.evalService && typeof window.evalService.autoSubmitRemainingStudents === 'function') {
        try { await window.evalService.autoSubmitRemainingStudents(classId); } catch(e) { console.warn('일괄 제출 알림:', e); }
      }
      session = {...currentLiveSession, ...await window.evalService.endSession(classId, expected)};
    }
    if (generation === liveDashboardGeneration) {
      setCurrentLiveSession(session);
      const isMockSession = currentLiveSession?.questionVersion === 3;
      const prepFeedback = isMockSession
        ? '모의평가를 준비했습니다. 학생 입장 후 시작해 주세요.'
        : '실전평가를 준비했습니다. 학생 입장 후 시작해 주세요.';
      setTeacherSessionFeedback({prepare:prepFeedback,start:'평가를 시작했습니다.',end:'평가를 종료했습니다. 학생별 제출 상태를 확인해 주세요.'}[model.action]);
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
    const isClickable = true;

    if (s) {
      if (s.makeupAllowed && s.status === 'waiting') {
        statusBg = "bg-amber-50/80 border-amber-400 text-amber-950 shadow-2xs";
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">추가응시대기</span>`;
      } else if (s.status === 'waiting') {
        statusBg = "bg-amber-50/80 border-amber-300 text-amber-900";
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">대기중</span>`;
      } else if (s.status === 'in_progress') {
        statusBg = "bg-blue-50/80 border-blue-400 text-blue-900";
        const pCount = (Number(s.progress?.part1) || 0) + (Number(s.progress?.part2) || 0);
        const currentObjScore = (s.scores?.part1 || 0) + (s.scores?.part2 || 0);
        const makeupPrefix = s.makeupAllowed ? '추가응시 ' : '';
        if (s.scores?.serverGraded) {
          statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">${makeupPrefix}풀이중 (${pCount}문항)</span>`;
          scoreDisplay = `<span class="text-xs text-slate-400 font-medium">서버 채점 예정</span>`;
        } else if (isScoreBlindMode) {
          statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">${makeupPrefix}풀이중 (${pCount}/16문항)</span>`;
          scoreDisplay = `<span class="text-xs text-slate-400 font-medium">풀이 진행 중</span>`;
        } else if (s.scores?.serverGraded) {
          scoreDisplay = `<span class="text-sm font-black text-emerald-700">서버 채점 확인 필요</span>`;
        } else {
          statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">${makeupPrefix}풀이중 (${pCount}문항 · ${currentObjScore}점)</span>`;
          scoreDisplay = `<span class="text-xs text-slate-500 font-bold font-mono">${currentObjScore}점 (임시)</span>`;
        }
      } else if (s.status === 'submitted') {
        statusBg = "bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs";

        // 1. 서버 지필 채점 점수 (Part 1 + Part 2 객관·단답 소계)
        const isCurrentV4Student = isV4AssessmentSession(currentLiveSession) &&
          s.attemptId === currentLiveSession?.attemptId;
        const hasCurrentAttemptGrades = isCurrentV4Student &&
          currentLiveClassGradesAttemptId === currentLiveSession?.attemptId;
        const serverData = hasCurrentAttemptGrades
          ? (currentLiveClassGrades[s.numStr] || currentLiveClassGrades[numStr])
          : null;
        const serverObjScore = serverData?.score?.objectiveTotal ?? (
          (s.scores?.part1 !== null && s.scores?.part1 !== undefined && s.scores?.part2 !== null && s.scores?.part2 !== undefined)
            ? ((s.scores.part1 || 0) + (s.scores.part2 || 0))
            : null
        );

        // 2. Part 3 교사 확정 점수 (0~40)
        const confirmedP3 = s.review?.confirmed?.criteria
          ? s.review.confirmed.criteria.reduce((sum, c) => sum + (Number(c.score) || 0), 0)
          : null;

        // 3. Part 3 AI 제안 점수 (0~40)
        const proposalP3 = s.review?.proposal?.criteria
          ? s.review.proposal.criteria.reduce((sum, c) => sum + (Number(c.score) || 0), 0)
          : null;

        // 4. 교사 수동 전체 총점 오버라이드
        const teacherOverride = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
          ? s.scores.teacherOverride
          : null;

        let reviewBadge = '';
        if (teacherOverride !== null || confirmedP3 !== null) {
          reviewBadge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-black ml-1">확정</span>`;
        } else if (proposalP3 !== null) {
          reviewBadge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold ml-1">AI제안</span>`;
        }
        statusBadge = `<div class="flex items-center"><span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">제출완료</span>${reviewBadge}</div>`;

        if (isScoreBlindMode) {
          scoreDisplay = `<span class="text-xs text-emerald-700 font-bold">제출 완료 (비공개)</span>`;
        } else if (teacherOverride !== null) {
          scoreDisplay = `<span class="text-sm font-black text-blue-700">${teacherOverride}점 (확정)</span>`;
        } else if (confirmedP3 !== null) {
          const totalScore = (serverObjScore !== null ? serverObjScore : 0) + confirmedP3;
          scoreDisplay = `<span class="text-sm font-black text-blue-700">${totalScore}점 (확정)</span>`;
        } else if (proposalP3 !== null) {
          if (serverObjScore !== null) {
            const proposedTotal = serverObjScore + proposalP3;
            scoreDisplay = `<span class="text-sm font-black text-amber-700">${proposedTotal}점 (AI제안)</span>`;
          } else {
            scoreDisplay = `<span class="text-xs font-bold text-amber-700">AI제안 ${proposalP3}점</span>`;
          }
        } else if (isCurrentV4Student && serverObjScore !== null) {
          scoreDisplay = `<span class="text-sm font-black text-emerald-700">지필 ${serverObjScore}점 (서술대기)</span>`;
        } else if (s.scores?.serverGraded || s.questionVersion === 4) {
          scoreDisplay = `<span class="text-xs text-slate-500 font-medium animate-pulse"><i class="fa-solid fa-spinner fa-spin text-[10px] mr-1"></i>채점 확인 중</span>`;
        } else {
          const fallbackFinal = s.scores?.total || 0;
          scoreDisplay = `<span class="text-sm font-black text-emerald-700">${s.scores?.pendingReview ? '소계 ' + ((s.scores?.part1 || 0) + (s.scores?.part2 || 0)) + '점 (검토대기)' : fallbackFinal + '점'}</span>`;
        }
      }
    }

    const studentName = s ? s.name : "빈 좌석";

    html += `
      <div onclick="openLiveStudentModal(${num})" class="p-3 rounded-2xl border ${statusBg} flex flex-col justify-between min-h-[120px] transition hover:scale-[1.03] cursor-pointer shadow-xs">
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

// 칠판 프로젝터 점수 블라인드 토글 (학생 실시간 점수 유출 방지)
function toggleScoreBlindMode() {
  isScoreBlindMode = !isScoreBlindMode;
  const btn = document.getElementById('classroom-blind-toggle');
  const icon = document.getElementById('classroom-blind-toggle-icon');
  const label = document.getElementById('classroom-blind-toggle-label');
  if (btn && icon && label) {
    if (isScoreBlindMode) {
      btn.className = "px-2.5 py-1 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-2xs mr-1";
      icon.className = "fa-solid fa-eye-slash text-amber-600";
      label.textContent = "스크린 점수 숨김 (보호 중)";
    } else {
      btn.className = "px-2.5 py-1 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-2xs mr-1";
      icon.className = "fa-solid fa-eye text-indigo-600";
      label.textContent = "스크린 점수 표시 중";
    }
  }
  renderLiveGrid(currentLiveStudents);
}

// 성적표 엑셀(Multi-Sheet XLSX: 학급종합 + 개별학생 + 나이스) 다운로드
async function handleTeacherExportExcel() {
  const classId = getClassIdFromSelected();
  const session = currentLiveSession;
  const attemptId = session?.attemptId ?? null;
  const generation = liveDashboardGeneration;
  const students = [...currentLiveStudents];
  const btn = document.getElementById('btn-export-excel');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>성적표 생성 중...</span>';
  }

  try {
    let classGrades = {};
    // V4 평가의 서버 채점 결과를 요청하고 현재 회차 응답인지 확인
    const isV4 = isV4AssessmentSession(session);

    if (isV4 && typeof requestSecureEvaluationClassGrades === 'function' && !window.authService.isDemo()) {
      if (!attemptId) throw new Error('현재 평가 회차를 확인할 수 없습니다. 관제실을 새로고침한 뒤 다시 다운로드해 주세요.');
      let res = null;
      try {
        res = await requestSecureEvaluationClassGrades(classId);
      } catch (apiErr) {
        console.warn('[EXPORT_EXCEL] class-grades API 조회 실패 (로컬 데이터로 대체):', apiErr);
      }
      if (!isCurrentLiveV4Attempt(attemptId, generation)) {
        throw new Error('평가 회차가 바뀌어 성적표를 만들지 않았습니다. 현재 회차를 확인한 뒤 다시 다운로드해 주세요.');
      }
      if (res && (res.attemptId !== attemptId || !isCurrentLiveV4Attempt(attemptId, generation))) {
        throw new Error('평가 회차가 바뀌어 성적표를 만들지 않았습니다. 현재 회차를 확인한 뒤 다시 다운로드해 주세요.');
      }
      if (res?.grades) {
        classGrades = res.grades;
        cacheLiveClassGrades(attemptId, res.grades);
      }
    }

    if (window.excelExportService) {
      window.excelExportService.exportAssessmentWorkbook(classId, students, classGrades);
    } else if (window.evalService) {
      // Fallback: evalService
      window.evalService.exportAssessmentExcel(classId, students, classGrades);
    } else {
      throw new Error('엑셀 내보내기 모듈을 찾을 수 없습니다.');
    }
  } catch (err) {
    console.error('[EXPORT_EXCEL_ERROR]', err);
    alert(err.message || '성적표 엑셀 생성 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// 나이스 CSV 다운로드 (호환용)
function handleTeacherExportCSV() {
  const classId = getClassIdFromSelected();
  if (window.evalService) {
    window.evalService.exportNeisCSV(classId, currentLiveStudents);
  }
}

// 실전평가 V4 80문항 비공개 문제은행 JSON 백업 다운로드
async function handleTeacherExportV4Bank() {
  const btn = document.getElementById('btn-export-v4-bank');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>다운로드 중...</span>';
  }
  try {
    const data = await requestSecureEvaluationBankExport();
    if (!data || !data.bank) throw new Error('문제은행 데이터를 수신하지 못했습니다.');
    const jsonStr = JSON.stringify(data.bank, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eval_bank_v4.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('실전평가 V4 80문항 문제은행(eval_bank_v4.json) 다운로드가 완료되었습니다!\n\n로컬 개발 환경에서 작업하시려면 다운로드된 파일을 프로젝트의 scratch/ 폴더에 넣어주세요.');
  } catch (err) {
    console.error('[EXPORT_BANK_FAIL]', err);
    alert(err.message || '문제은행 백업 다운로드에 실패했습니다. 교사 로그인 상태를 확인해 주세요.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

/**
 * 순서도 블록을 실행 흐름(시작 ➔ 다음 블록 ➔ ... ➔ 종료) 순서대로 정렬
 * - 시작 블록('eblk_start' 또는 단말 '시작' 또는 진입 차수 0)에서 출발
 * - 사이클(반복 루프백) 발생 시 무한 루프에 빠지지 않도록 visited Set 방어
 * - 판단(decision) 블록 분기 시 [예] 경로를 우선 탐색 후 [아니오] 경로 탐색
 * - 종료(terminal '끝'/'종료') 블록은 실행 흐름의 가장 마지막에 배치
 * - 연결되지 않은 고립 블록도 누락 없이 Y축 순으로 마지막에 추가
 */
function sortBlocksByExecution(blocks = [], connections = []) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  if (!Array.isArray(connections)) connections = [];

  const blockMap = new Map();
  blocks.forEach(b => { if (b && b.id) blockMap.set(b.id, b); });

  const adj = new Map();
  const inDegree = new Map();
  blocks.forEach(b => {
    adj.set(b.id, []);
    inDegree.set(b.id, 0);
  });

  connections.forEach(c => {
    if (c && c.from && c.to && blockMap.has(c.from) && blockMap.has(c.to)) {
      adj.get(c.from).push(c);
      inDegree.set(c.to, (inDegree.get(c.to) || 0) + 1);
    }
  });

  // 분기 우선순위: 'yes'(예) 우선, 'no'(아니오) 나중, 그 외 Y 좌표 순
  adj.forEach(conns => {
    conns.sort((a, b) => {
      if (a.fromPort === 'yes' && b.fromPort !== 'yes') return -1;
      if (b.fromPort === 'yes' && a.fromPort !== 'yes') return 1;
      if (a.fromPort === 'no' && b.fromPort !== 'no') return 1;
      if (b.fromPort === 'no' && a.fromPort !== 'no') return -1;
      const targetA = blockMap.get(a.to);
      const targetB = blockMap.get(b.to);
      return (Number(targetA?.y) || 0) - (Number(targetB?.y) || 0);
    });
  });

  // 시작 블록 탐색 (우선순위: eblk_start ➔ 단말 '시작' ➔ 진입 차수 0 ➔ Y 최소)
  let startBlock = blocks.find(b => b.id === 'eblk_start');
  if (!startBlock) {
    startBlock = blocks.find(b => b.shape === 'terminal' && /시작|start/i.test(b.text || ''));
  }
  if (!startBlock) {
    const zeroIn = blocks.filter(b => (inDegree.get(b.id) || 0) === 0);
    if (zeroIn.length > 0) {
      zeroIn.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
      startBlock = zeroIn[0];
    } else {
      startBlock = [...blocks].sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0))[0];
    }
  }

  const isTerminalEnd = (b) => {
    if (!b) return false;
    const txt = (b.text || '').trim();
    return b.shape === 'terminal' && (txt.includes('끝') || txt.includes('종료') || /end/i.test(txt) || (startBlock && b.id !== startBlock.id));
  };

  const ordered = [];
  const endBlocks = [];
  const visited = new Set();
  const queue = [startBlock.id];
  visited.add(startBlock.id);

  while (queue.length > 0) {
    const currId = queue.shift();
    const currBlock = blockMap.get(currId);
    if (!currBlock) continue;

    if (isTerminalEnd(currBlock)) {
      if (!endBlocks.some(eb => eb.id === currBlock.id)) {
        endBlocks.push(currBlock);
      }
    } else {
      ordered.push(currBlock);
    }

    const outConns = adj.get(currId) || [];
    for (const conn of outConns) {
      const nextId = conn.to;
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    }
  }

  // 종료 블록들을 탐색 경로 맨 뒤에 배치
  endBlocks.forEach(eb => {
    if (!ordered.includes(eb)) {
      ordered.push(eb);
    }
  });

  // 미방문 고립 블록들도 누락 없이 Y 좌표순으로 맨 뒤에 추가
  const unvisited = blocks.filter(b => !visited.has(b.id));
  if (unvisited.length > 0) {
    unvisited.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
    ordered.push(...unvisited);
  }

  return ordered;
}

/**
 * 교사용 학생 순서도 다이어그램 Canvas 2D 고해상도 미니어처 렌더링 엔진
 * - 순수 HTML5 Canvas API 사용 (외부 캡처 라이브러리 Zero)
 * - 엔트리 표준 4대 기호 색상 완벽 일치 (단말 🟣, 자료 🟢, 판단 🟠, 처리 🔵)
 */
function drawFlowchartPreview(canvas, blocks = [], connections = []) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // 1. 캔버스 배경 및 격자 도트
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#f1f5f9";
  for (let x = 16; x < W; x += 24) {
    for (let y = 16; y < H; y += 24) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // 2. 블록 없을 때 안내
  if (!Array.isArray(blocks) || blocks.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 14px 'Pretendard', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("배치된 순서도 블록이 없습니다.", W / 2, H / 2);
    return;
  }

  // 둥근 모서리 사각형 헬퍼
  const drawRoundRect = (x, y, w, h, r, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  // 3. 전체 블록의 경계 상자(Bounding Box) 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  blocks.forEach(b => {
    const bw = b.shape === 'decision' ? 220 : (b.shape === 'terminal' ? 200 : (b.shape === 'io' ? 220 : 210));
    const bh = b.shape === 'decision' ? 120 : 60;
    const bx = Number(b.x) || 0;
    const by = Number(b.y) || 0;
    if (bx < minX) minX = bx;
    if (by < minY) minY = by;
    if (bx + bw > maxX) maxX = bx + bw;
    if (by + bh > maxY) maxY = by + bh;
  });

  const contentW = Math.max(maxX - minX, 120);
  const contentH = Math.max(maxY - minY, 120);
  const pad = 36;
  const availW = W - pad * 2;
  const availH = H - pad * 2;
  const scale = Math.min(availW / contentW, availH / contentH, 1.0);

  const offsetX = (W - contentW * scale) / 2 - minX * scale;
  const offsetY = (H - contentH * scale) / 2 - minY * scale;

  const toX = (x) => offsetX + x * scale;
  const toY = (y) => offsetY + y * scale;

  // 4. 연결선 (connections) 드로잉
  (connections || []).forEach(conn => {
    const fromB = blocks.find(b => b.id === conn.from);
    const toB = blocks.find(b => b.id === conn.to);
    if (!fromB || !toB) return;

    const fromBW = (fromB.shape === 'decision' ? 220 : (fromB.shape === 'terminal' ? 200 : (fromB.shape === 'io' ? 220 : 210)));
    const fromBH = (fromB.shape === 'decision' ? 120 : 60);
    const toBW = (toB.shape === 'decision' ? 220 : (toB.shape === 'terminal' ? 200 : (toB.shape === 'io' ? 220 : 210)));
    const toBH = (toB.shape === 'decision' ? 120 : 60);

    let p1X = (Number(fromB.x) || 0) + fromBW / 2, p1Y = (Number(fromB.y) || 0) + fromBH;
    if (conn.fromPort === 'right' || conn.fromPort === 'no') { p1X = (Number(fromB.x) || 0) + fromBW; p1Y = (Number(fromB.y) || 0) + fromBH / 2; }
    else if (conn.fromPort === 'left') { p1X = (Number(fromB.x) || 0); p1Y = (Number(fromB.y) || 0) + fromBH / 2; }
    else if (conn.fromPort === 'top' || conn.fromPort === 'in') { p1X = (Number(fromB.x) || 0) + fromBW / 2; p1Y = (Number(fromB.y) || 0); }

    let p2X = (Number(toB.x) || 0) + toBW / 2, p2Y = (Number(toB.y) || 0);
    let entryDir = 'down';
    if (conn.toPort === 'left') { p2X = (Number(toB.x) || 0); p2Y = (Number(toB.y) || 0) + toBH / 2; entryDir = 'right'; }
    else if (conn.toPort === 'right') { p2X = (Number(toB.x) || 0) + toBW; p2Y = (Number(toB.y) || 0) + toBH / 2; entryDir = 'left'; }
    else if (conn.toPort === 'bottom' || conn.toPort === 'out') { p2X = (Number(toB.x) || 0) + toBW / 2; p2Y = (Number(toB.y) || 0) + toBH; entryDir = 'up'; }

    const x1 = toX(p1X), y1 = toY(p1Y);
    const x2 = toX(p2X), y2 = toY(p2Y);

    let strokeCol = "#475569";
    let badgeText = "";
    if (conn.fromPort === 'yes') { strokeCol = "#059669"; badgeText = "예"; }
    else if (conn.fromPort === 'no') { strokeCol = "#d97706"; badgeText = "아니오"; }
    else if (conn.fromPort === 'left') { strokeCol = "#d97706"; badgeText = "분기"; }

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = Math.max(1.8, 2.2 * scale);
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    if (conn.fromPort === 'right' || conn.fromPort === 'no') {
      const midX = Math.max(x1 + 18 * scale, (x1 + x2) / 2);
      ctx.lineTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.lineTo(x2, y2);
    } else if (conn.fromPort === 'left') {
      const midX = Math.min(x1 - 18 * scale, (x1 + x2) / 2);
      ctx.lineTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.lineTo(x2, y2);
    } else {
      if (y2 > y1 + 10) {
        const midY = (y1 + y2) / 2;
        ctx.lineTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.lineTo(x2, y2);
      } else {
        const loopX = x2 < x1 ? Math.min(x1 - 35 * scale, x2 - 35 * scale) : Math.max(x1 + 35 * scale, x2 + 35 * scale);
        ctx.lineTo(x1, y1 + 14 * scale);
        ctx.lineTo(loopX, y1 + 14 * scale);
        ctx.lineTo(loopX, y2 - 14 * scale);
        ctx.lineTo(x2, y2 - 14 * scale);
        ctx.lineTo(x2, y2);
      }
    }
    ctx.stroke();

    // 화살표 머리
    const headLen = Math.max(6, 8 * scale);
    ctx.fillStyle = strokeCol;
    ctx.beginPath();
    if (entryDir === 'right') {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen, y2 - headLen * 0.55);
      ctx.lineTo(x2 - headLen, y2 + headLen * 0.55);
    } else if (entryDir === 'left') {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 + headLen, y2 - headLen * 0.55);
      ctx.lineTo(x2 + headLen, y2 + headLen * 0.55);
    } else if (entryDir === 'up') {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * 0.55, y2 + headLen);
      ctx.lineTo(x2 + headLen * 0.55, y2 + headLen);
    } else {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * 0.55, y2 - headLen);
      ctx.lineTo(x2 + headLen * 0.55, y2 - headLen);
    }
    ctx.closePath();
    ctx.fill();

    // 분기 뱃지 텍스트
    if (badgeText) {
      const badgeX = conn.fromPort === 'left' ? x1 - 16 * scale : x1 + 16 * scale;
      const badgeY = y1 + 10 * scale;
      ctx.fillStyle = strokeCol;
      ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px 'Pretendard', sans-serif`;
      ctx.textAlign = conn.fromPort === 'left' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX, badgeY);
    }
  });

  // 5. 블록 (blocks) 드로잉 (엔트리 표준 4대 기호 색상)
  blocks.forEach(b => {
    const bw = (b.shape === 'decision' ? 220 : (b.shape === 'terminal' ? 200 : (b.shape === 'io' ? 220 : 210)));
    const bh = (b.shape === 'decision' ? 120 : 60);
    const x = toX(Number(b.x) || 0);
    const y = toY(Number(b.y) || 0);
    const w = bw * scale;
    const h = bh * scale;

    ctx.save();
    let fill = "#eff6ff";
    let stroke = "#2563eb"; // default proc 🔵

    if (b.shape === 'terminal') {
      fill = "#f5f3ff"; stroke = "#7c3aed"; // 🟣 단말
    } else if (b.shape === 'io') {
      fill = "#ecfdf5"; stroke = "#059669"; // 🟢 자료
    } else if (b.shape === 'decision') {
      fill = "#fffbeb"; stroke = "#d97706"; // 🟠 판단
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, 2.2 * scale);

    if (b.shape === 'terminal') {
      drawRoundRect(x, y, w, h, Math.min(w / 2, h / 2), true, true);
    } else if (b.shape === 'decision') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (b.shape === 'io') {
      const skew = Math.min(w * 0.15, 20 * scale);
      ctx.beginPath();
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - skew, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      drawRoundRect(x, y, w, h, 8 * scale, true, true);
    }

    // 블록 텍스트 렌더링
    const fontSize = Math.max(10, Math.min(13, Math.round(13 * scale)));
    ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = (b.text || '').trim() || (b.shape === 'terminal' ? '시작/끝' : '블록 내용');
    const maxTextW = b.shape === 'decision' ? w * 0.65 : w * 0.85;
    let displayText = text;
    if (ctx.measureText(displayText).width > maxTextW) {
      while (displayText.length > 2 && ctx.measureText(displayText + '…').width > maxTextW) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '…';
    }
    ctx.fillText(displayText, x + w / 2, y + h / 2);

    ctx.restore();
  });
}

function openFlowchartModalPreview() {
  if (!currentModalStudent) return;
  const lightbox = document.getElementById('classroom-flowchart-lightbox');
  const canvas = document.getElementById('classroom-lightbox-flowchart-canvas');
  const title = document.getElementById('classroom-flowchart-lightbox-title');
  if (!lightbox || !canvas) return;

  if (title) {
    title.textContent = `${currentSelectedClass} ${currentModalStudent.num}번 ${currentModalStudent.name} 학생 순서도 다이어그램`;
  }

  // 다이어그램 크기에 맞춘 캔버스 높이 동적 확장 (세로로 긴 순서도 가독성 확보)
  const blocks = currentModalStudent.answers?.part3?.blocks || [];
  let minY = Infinity, maxY = -Infinity;
  blocks.forEach(b => {
    const bh = b.shape === 'decision' ? 120 : 60;
    const by = Number(b.y) || 0;
    if (by < minY) minY = by;
    if (by + bh > maxY) maxY = by + bh;
  });
  const contentH = Math.max(maxY - minY, 120);
  canvas.height = Math.max(650, Math.min(1400, Math.round(contentH + 120)));

  drawFlowchartPreview(canvas, blocks, currentModalStudent.answers?.part3?.connections);
  lightbox.classList.remove('hidden');
}

function closeFlowchartModalPreview() {
  const lightbox = document.getElementById('classroom-flowchart-lightbox');
  if (lightbox) lightbox.classList.add('hidden');
}

function renderSecureV4TeacherQuestions(container, questions, part) {
  if (!container) return;
  container.replaceChildren();
  const rows = Array.isArray(questions) ? questions : [];
  if (!rows.length) { container.textContent = '서버에서 문항 검토 내용을 받지 못했습니다.'; return; }
  rows.forEach((question, index) => {
    const card = document.createElement('section'); card.className = 'p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1';
    const titleRow = document.createElement('div'); titleRow.className = 'flex items-center justify-between gap-2';
    const title = document.createElement('div'); title.className = 'font-black text-slate-800 text-xs'; title.textContent = `${index + 1}. ${question.title}`;
    const desc = document.createElement('div'); desc.className = 'text-[11px] text-slate-500 leading-tight'; desc.textContent = question.desc;
    const rawStudentAnswer = question.studentAnswer;
    const hasStudentAnswer = rawStudentAnswer !== '' && rawStudentAnswer !== null && rawStudentAnswer !== undefined;
    const studentChoiceIndex = part === 'part1' && hasStudentAnswer && Number.isInteger(Number(rawStudentAnswer)) ? Number(rawStudentAnswer) : null;
    const correctChoiceIndex = part === 'part1' && Number.isInteger(question.correctAnswer) ? question.correctAnswer : null;
    const studentChoiceText = studentChoiceIndex !== null ? question.options?.[studentChoiceIndex] : null;
    const answer = correctChoiceIndex !== null ? question.options?.[correctChoiceIndex] : (question.answers || []).join(' · ');
    const studentAnswer = !hasStudentAnswer
      ? '미응답'
      : studentChoiceIndex !== null
        ? `${studentChoiceIndex + 1}번 (${studentChoiceText || '선지 내용을 확인해 주세요.'})`
        : String(rawStudentAnswer);
    const correctAnswer = correctChoiceIndex !== null
      ? `${correctChoiceIndex + 1}번 (${answer || '선지 내용을 확인해 주세요.'})`
      : (answer || '없음');
    const normalizeAnswer = value => String(value ?? '').toLowerCase().replace(/\s+/g, '');
    const isCorrect = hasStudentAnswer && (part === 'part1'
      ? studentChoiceIndex !== null && studentChoiceIndex === correctChoiceIndex
      : (question.answers || []).some(accepted => normalizeAnswer(accepted) === normalizeAnswer(rawStudentAnswer)));
    const badge = document.createElement('span');
    badge.className = `text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 shrink-0 ${!hasStudentAnswer ? 'bg-slate-100 text-slate-500' : isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`;
    badge.textContent = !hasStudentAnswer ? '미응답 (0점)' : isCorrect ? `정답 (+${question.points || (part === 'part1' ? 3 : 5)}점)` : `오답 (0점 / 정답: ${correctAnswer})`;
    titleRow.append(title, badge);
    const response = document.createElement('div');
    response.className = `text-xs text-slate-700 font-medium pl-2.5 border-l-2 ${isCorrect ? 'border-emerald-400' : (hasStudentAnswer ? 'border-rose-400' : 'border-slate-300')} mt-1.5`;
    response.textContent = `${part === 'part1' ? '학생 선택' : '학생 답안'}: ${studentAnswer} / 정답: ${correctAnswer}`;
    const note = document.createElement('div'); note.className = 'text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1'; note.textContent = `출제 의도: ${question.teacherNote}`;
    card.append(titleRow, desc, response, note); container.appendChild(card);
  });
}

// 학생 응시 긴급 구제: 제출 취소 및 풀던 답안 유지 복귀 (+5분/+10분)
async function handleReopenStudent(addedMinutes = 10) {
  if (!currentModalStudent) return;
  const s = currentModalStudent;
  const classId = getClassIdFromSelected();
  if (!confirm(`🔄 [${s.name || s.num + '번'}] 학생의 시험 제출을 취소하고 풀던 답안을 유지한 채 시험장으로 복귀시키겠습니까?\n\n- 학생이 기존에 작성한 답안(객관식/단답형/순서도)이 100% 보존됩니다.\n- ${addedMinutes}분의 추가 시간이 부여되어 즉시 풀이를 이어갈 수 있습니다.\n- 학생 화면이 실시간으로 시험 풀이 화면으로 자동 전환됩니다.`)) {
    return;
  }
  if (window.evalService) {
    try {
      await window.evalService.reopenStudentExam(classId, s.num, addedMinutes);
      alert(`✅ [${s.name || s.num + '번'}] 학생의 시험이 재개되었습니다 (+${addedMinutes}분).\n학생 화면에 기존 작성 답안이 복원되고 시험이 이어집니다.`);
      closeLiveStudentModal();
    } catch (error) {
      alert('제출 취소 및 답안 복귀 실패: ' + (error?.message || error));
    }
  }
}

// 학생 개별 시험 시간 연장 (+5분/+10분)
async function handleExtendStudent(addedMinutes = 5) {
  if (!currentModalStudent) return;
  const s = currentModalStudent;
  const classId = getClassIdFromSelected();
  if (!confirm(`⏱️ [${s.name || s.num + '번'}] 학생에게 개별 시험 시간 +${addedMinutes}분을 추가 부여하시겠습니까?\n\n- 해당 학생의 제한 시간이 즉시 ${addedMinutes}분 연장됩니다.`)) {
    return;
  }
  if (window.evalService) {
    try {
      await window.evalService.extendStudentTime(classId, s.num, addedMinutes);
      alert(`✅ [${s.name || s.num + '번'}] 학생의 시험 시간이 +${addedMinutes}분 연장되었습니다.`);
      closeLiveStudentModal();
    } catch (error) {
      alert('개별 시간 연장 실패: ' + (error?.message || error));
    }
  }
}

  let currentModalTimerInterval = null;

// 학생 개별 답안 상세 팝업 및 점수 수동 조정 / 재시험 허용
function openLiveStudentModal(studentNum) {
  if (currentModalTimerInterval) {
    clearInterval(currentModalTimerInterval);
    currentModalTimerInterval = null;
  }
  const s = currentLiveStudents.find(item => item.num === studentNum);
  const modal = document.getElementById('classroom-live-detail-modal');
  if (!modal) return;

  currentModalStudent = s || null;

  const titleEl = document.getElementById('classroom-live-modal-title');
  const summaryEl = document.getElementById('classroom-live-modal-summary');
  const p1Box = document.getElementById('classroom-live-modal-p1-box');
  const p2Box = document.getElementById('classroom-live-modal-p2-box');
  const p3Box = document.getElementById('classroom-live-modal-p3-box');
  const p1El = document.getElementById('classroom-live-modal-p1');
  const p2El = document.getElementById('classroom-live-modal-p2');
  const p3El = document.getElementById('classroom-live-modal-p3');
  const scoreInp = document.getElementById('classroom-live-override-score');
  const legacyScoreBox = document.getElementById('classroom-legacy-score');
  const reviewEl = document.getElementById('classroom-assessment-review');

  // 좌측 미니 프로필 카드 요소
  const stBadge = document.getElementById('classroom-live-modal-st-badge');
  const statusBadge = document.getElementById('classroom-live-modal-status-badge');
  const stNameEl = document.getElementById('classroom-live-modal-st-name');
  const timeTextEl = document.getElementById('classroom-live-modal-time-text');

  // 좌측 상태별 액션 컨테이너 요소
  const submittedGroup = document.getElementById('classroom-modal-actions-submitted');
  const inprogressGroup = document.getElementById('classroom-modal-actions-inprogress');
  const dangerGroup = document.getElementById('classroom-modal-actions-danger');

  const forceSubmitBox = document.getElementById('classroom-live-force-submit-box');
  const forceSubmitBtn = document.getElementById('classroom-live-force-submit-btn');
  const reconnectBox = document.getElementById('classroom-live-reconnect-box');
  const reconnectBtn = document.getElementById('classroom-live-reconnect-btn');
  const makeupBox = document.getElementById('classroom-live-makeup-box');
  const makeupBtn = document.getElementById('classroom-live-makeup-btn');
  const resetBox = document.getElementById('classroom-live-reset-box');
  const resetBtn = document.getElementById('classroom-live-reset-btn');
  const kickBox = document.getElementById('classroom-live-kick-seat-box');
  const kickBtn = document.getElementById('classroom-live-kick-seat-btn');

  if (!s) {
    if (titleEl) titleEl.textContent = `${currentSelectedClass} ${studentNum}번 좌석 (미응시 / 결시)`;
    if (stBadge) { stBadge.textContent = `${studentNum}번 좌석`; stBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700'; }
    if (statusBadge) { statusBadge.textContent = '미응시 / 빈 좌석'; statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500'; }
    if (stNameEl) stNameEl.textContent = '미입장';
    if (timeTextEl) timeTextEl.textContent = '응시 기록 없음';

    if (submittedGroup) submittedGroup.classList.add('hidden');
    if (inprogressGroup) inprogressGroup.classList.add('hidden');
    if (dangerGroup) dangerGroup.classList.add('hidden');

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl col-span-1 sm:col-span-3 text-center space-y-1">
          <div class="text-sm font-black text-slate-700">현재 응시 기록이 없는 빈 좌석입니다.</div>
          <p class="text-xs text-slate-500">결석이나 지각으로 응시하지 못한 학생인 경우, 좌측 <strong>[개별 30분 추가 응시 허용]</strong> 버튼을 눌러 개별 시간을 부여할 수 있습니다.</p>
        </div>
      `;
    }
    if (p1Box) p1Box.classList.add('hidden');
    if (p2Box) p2Box.classList.add('hidden');
    if (p3Box) p3Box.classList.add('hidden');
    if (legacyScoreBox) legacyScoreBox.classList.add('hidden');
    if (reviewEl) reviewEl.hidden = true;
    if (forceSubmitBox) forceSubmitBox.classList.add('hidden');
    if (reconnectBox) reconnectBox.classList.add('hidden');
    if (resetBox) resetBox.classList.add('hidden');
    if (kickBox) kickBox.classList.add('hidden');

    if (makeupBox) makeupBox.classList.remove('hidden');
    if (makeupBtn) {
      makeupBtn.onclick = async () => {
        if (!confirm(`⏱️ [${currentSelectedClass} ${studentNum}번] 학생에게 개별 30분 추가 응시 권한을 부여하시겠습니까?\n\n- 학생이 로그인하여 시작하는 순간 30분 개인 타이머가 작동합니다.\n- 학생은 어느 컴퓨터(PC/노트북)에서든 접속하여 응시할 수 있습니다.\n- 다른 학생들의 시험 결과는 안전하게 보존되며 영향이 없습니다.`)) {
          return;
        }
        const classId = getClassIdFromSelected();
        if (window.evalService) {
          try {
            await window.evalService.allowStudentMakeup(classId, studentNum, 30, { forceReset: true });
            alert(`✅ ${studentNum}번 학생의 개별 30분 추가 응시가 승인되었습니다.\n학생이 아무 PC에서나 로그인하여 [개별 평가 시작하기]를 누르면 시작됩니다.`);
            closeLiveStudentModal();
          } catch (error) {
            alert('추가 응시 승인 실패: ' + error.message);
          }
        }
      };
    }

    modal.classList.remove('hidden');
    return;
  }

  // 응시 학생인 경우 프로필 카드 정보 갱신
  if (titleEl) titleEl.textContent = `${currentSelectedClass} ${s.num}번 ${s.name} 학생 답안 검토`;
  if (stBadge) { stBadge.textContent = `${s.num}번 좌석`; stBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800'; }
  if (stNameEl) stNameEl.textContent = s.name ? `${s.name} 학생` : `${s.num}번 학생`;

  const isSubmitted = s.status === 'submitted';
  const isInProgress = s.status === 'in_progress';
  const isWaiting = s.status === 'waiting';

  if (statusBadge) {
    if (isSubmitted) {
      statusBadge.textContent = '제출 완료';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800';
    } else if (isInProgress) {
      statusBadge.textContent = '시험 풀이 중';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800';
    } else if (isWaiting) {
      statusBadge.textContent = '대기실 입장';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800';
    } else {
      statusBadge.textContent = '미제출 / 결시';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800';
    }
  }

  const updateModalTimeText = () => {
    if (!timeTextEl) return;
    const currentS = currentLiveStudents.find(item => item.num === s.num) || s;
    if (currentS.status === 'submitted') {
      const timeStr = currentS.submittedAt ? new Date(currentS.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      timeTextEl.textContent = timeStr ? `${timeStr} 제출 완료` : '제출 완료됨';
    } else if (currentS.status === 'in_progress') {
      const now = window.evalService?.getNow ? window.evalService.getNow() : Date.now();
      const deadline = currentS.individualDeadlineMs || currentLiveSession?.deadlineMs || now;
      const remainSec = Math.max(0, Math.ceil((deadline - now) / 1000));
      const remainMin = Math.floor(remainSec / 60);
      const remainSecRem = String(remainSec % 60).padStart(2, '0');
      const label = currentS.individualDeadlineMs ? ' (개별 연장)' : '';
      timeTextEl.textContent = `남은 시간 약 ${remainMin}분 ${remainSecRem}초${label}`;
    } else if (currentS.status === 'waiting') {
      timeTextEl.textContent = '시험 시작 대기 중';
    } else {
      timeTextEl.textContent = '기록 없음';
    }
  };

  updateModalTimeText();
  if (isInProgress) {
    currentModalTimerInterval = setInterval(updateModalTimeText, 1000);
  }

  // 액션 그룹 노출 제어
  if (submittedGroup) submittedGroup.classList.toggle('hidden', !isSubmitted);
  if (inprogressGroup) inprogressGroup.classList.toggle('hidden', !isInProgress);
  if (dangerGroup) dangerGroup.classList.remove('hidden');

  if (p1Box) p1Box.classList.remove('hidden');
  if (p2Box) p2Box.classList.remove('hidden');
  if (p3Box) p3Box.classList.remove('hidden');
  if (legacyScoreBox) legacyScoreBox.classList.remove('hidden');
  if (resetBox) resetBox.classList.remove('hidden');
  if (kickBox) kickBox.classList.remove('hidden');

  // 재접속 및 추가응시 박스 표시 제어
  if (reconnectBox) {
    if (isSubmitted) reconnectBox.classList.add('hidden');
    else reconnectBox.classList.remove('hidden');
  }

  if (makeupBox) {
    // 제출 완료자에게는 제출 취소 및 복귀 버튼이 제공되므로 makeupBox 숨김
    // 풀이 중이거나 이미 추가응시 승인 대기인 경우도 숨김
    if (isSubmitted || isInProgress || (s.makeupAllowed && isWaiting)) {
      makeupBox.classList.add('hidden');
    } else {
      makeupBox.classList.remove('hidden');
    }
  }

  if (reconnectBtn) {
    reconnectBtn.onclick = async () => {
      if (!confirm(`🔄 [${s.name || s.num + '번'}] 학생의 풀던 답안 유지 재접속을 허용하시겠습니까?\n\n서버에 저장된 기존 작성 답안을 그대로 유지한 채 새 브라우저로 재접속할 수 있도록 허용합니다.`)) {
        return;
      }
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        try {
          await window.evalService.allowStudentReconnect(classId, s.num);
          alert(`✅ [${s.name || s.num + '번'}] 학생의 재접속이 승인되었습니다.\n학생 컴퓨터에서 [${s.num}번 / ${s.name}]을 입력하고 대기실에 입장하면 풀던 답안이 그대로 복구됩니다.`);
          closeLiveStudentModal();
        } catch (error) {
          alert('재접속 허용 실패: ' + error.message);
        }
      }
    };
  }

  if (makeupBtn) {
    makeupBtn.onclick = async () => {
      const isSubmitted = s.status === 'submitted';
      const confirmMsg = isSubmitted
        ? `⏱️ [${currentSelectedClass} ${s.num}번 ${s.name}] 학생의 기존 제출(또는 0점 결시) 기록을 초기화하고, 개별 30분 추가 응시 권한을 부여하시겠습니까?\n\n- 기존 답안과 성적이 깨끗이 초기화되며 학생이 로그인하여 시작하는 순간 30분 개인 타이머가 작동합니다.\n- 학생은 어느 컴퓨터(PC/노트북)에서든 접속하여 응시할 수 있습니다.\n- 다른 학생들의 성적은 안전하게 보존됩니다.`
        : `⏱️ [${currentSelectedClass} ${s.num}번 ${s.name}] 학생에게 개별 30분 추가 응시 권한을 부여하시겠습니까?\n\n- 학생이 시작하는 순간 30분 개인 타이머가 작동합니다.\n- 학생은 어느 컴퓨터(PC/노트북)에서든 접속하여 응시할 수 있습니다.\n- 기존 학생들의 성적은 안전하게 보존됩니다.`;
      if (!confirm(confirmMsg)) {
        return;
      }
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        try {
          await window.evalService.allowStudentMakeup(classId, s.num, 30, { forceReset: true });
          alert(`✅ [${s.num}번 ${s.name}] 학생의 개별 30분 추가 응시가 승인되었습니다.\n학생이 아무 PC에서나 [${s.num}번 / ${s.name}]으로 로그인하여 [개별 평가 시작하기]를 누르면 시험이 시작됩니다.`);
          closeLiveStudentModal();
        } catch (error) {
          alert('추가 응시 승인 실패: ' + error.message);
        }
      }
    };
  }

  const secureV4 = s.questionVersion === 4;

  let assigned = s.answers?.assignedQuestions || s.answers?.part3?.assignedQuestions;
  if (!secureV4 && !assigned && (s.questionVersion >= 3 || s.answers?.part3?.questionVersion >= 3)) {
    const assignFn = typeof window.assignQuestions === 'function' ? window.assignQuestions : (typeof assignQuestions === 'function' ? assignQuestions : null);
    const session = typeof currentSelectedClass !== 'undefined' && window.evalService ? window.evalService.read('EVAL_SESSION_' + currentSelectedClass, null) : null;
    const attemptId = s.attemptId || session?.attemptId || 'demo';
    if (assignFn && attemptId) {
      assigned = assignFn(`${attemptId}_${currentSelectedClass || '2-1'}_${s.num || s.numStr || 1}`);
      if (s.answers) s.answers.assignedQuestions = assigned;
    }
  }
  const questions = secureV4 ? {part1:[],part2:[]} : (typeof window.evaluationQuestions === 'function'
    ? window.evaluationQuestions(s.answers, s.questionVersion)
    : (window.EVAL_QUESTIONS || (typeof EVAL_QUESTIONS !== 'undefined' ? EVAL_QUESTIONS : { part1: [], part2: [] })));

  const studentP1 = s.answers?.part1 || {};
  let p1Html = '';
  let p1CorrectCount = 0;
  let p1Score = 0;
  (questions.part1 || []).forEach((q, idx) => {
    const studentAnsIdx = studentP1[q.id];
    const hasAnswered = studentAnsIdx !== undefined && studentAnsIdx !== null;
    const isCorrect = hasAnswered && studentAnsIdx === q.correctAnswer;
    if (isCorrect) {
      p1CorrectCount++;
      p1Score += (q.points || 3);
    }
    const ansText = hasAnswered && q.options ? q.options[studentAnsIdx] : "미응답";
    const badge = !hasAnswered
      ? '<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold ml-2">미응답 (0점)</span>'
      : isCorrect 
        ? `<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ml-2">정답 (+${q.points || 3}점)</span>` 
        : `<span class="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold ml-2">오답 (0점 / 정답: ${q.options ? escapeHtml(q.options[q.correctAnswer]) : ''})</span>`;
    p1Html += `
      <div class="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-black text-slate-800 text-xs">${idx + 1}. ${escapeHtml(q.title || '')}</span>
          ${badge}
        </div>
        <div class="text-[11px] text-slate-500 leading-tight">${escapeHtml(q.desc || '')}</div>
        <div class="text-xs text-slate-700 font-medium pl-2.5 border-l-2 ${isCorrect ? 'border-emerald-400' : (hasAnswered ? 'border-rose-400' : 'border-slate-300')} mt-1.5">
          학생 선택: <strong class="${isCorrect ? 'text-emerald-700 font-black' : (hasAnswered ? 'text-rose-700 font-black' : 'text-slate-400')}">${escapeHtml(ansText)}</strong>
        </div>
      </div>
    `;
  });
  if (p1El) p1El.innerHTML = p1Html || '<div class="text-slate-400 p-2 italic">답안 데이터가 없습니다.</div>';

  const studentP2 = s.answers?.part2 || {};
  let p2Html = '';
  let p2CorrectCount = 0;
  let p2Score = 0;
  (questions.part2 || []).forEach((q, idx) => {
    const studentAnsText = (studentP2[q.id] || '').trim();
    const hasAnswered = studentAnsText.length > 0;
    const cleanedAns = studentAnsText.toLowerCase().replace(/\s+/g, '');
    const isCorrect = hasAnswered && q.answers && q.answers.some(ans => ans.toLowerCase().replace(/\s+/g, '') === cleanedAns);
    if (isCorrect) {
      p2CorrectCount++;
      p2Score += (q.points || 5);
    }
    const badge = !hasAnswered
      ? '<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold ml-2">미응답 (0점)</span>'
      : isCorrect 
        ? `<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ml-2">정답 (+${q.points || 5}점)</span>` 
        : `<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold ml-2">오답/확인필요 (0점 / 정답 예: ${q.answers ? escapeHtml(q.answers[0]) : ''})</span>`;
    p2Html += `
      <div class="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-black text-slate-800 text-xs">${idx + 1}. ${escapeHtml(q.title || '')}</span>
          ${badge}
        </div>
        <div class="text-[11px] text-slate-500 leading-tight">${escapeHtml(q.desc || '')}</div>
        <div class="text-xs text-slate-700 font-medium pl-2.5 border-l-2 ${isCorrect ? 'border-emerald-400' : (hasAnswered ? 'border-amber-400' : 'border-slate-300')} mt-1.5">
          학생 입력: <strong class="${isCorrect ? 'text-emerald-700 font-black' : (hasAnswered ? 'text-amber-800 font-black' : 'text-slate-400')}">${hasAnswered ? escapeHtml(studentAnsText) : '미응답'}</strong>
        </div>
      </div>
    `;
  });
  if (p2El) p2El.innerHTML = p2Html || '<div class="text-slate-400 p-2 italic">답안 데이터가 없습니다.</div>';

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl">
        <div class="text-[11px] font-bold text-indigo-700 flex items-center justify-between">
          <span>Part 1. 객관식 (10문항)</span>
          <span class="text-indigo-600 font-black">${p1CorrectCount}/10개</span>
        </div>
        <div class="text-base font-black text-indigo-950 mt-1">${p1Score} / 30점</div>
      </div>
      <div class="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl">
        <div class="text-[11px] font-bold text-amber-800 flex items-center justify-between">
          <span>Part 2. 단답형 (6문항)</span>
          <span class="text-amber-700 font-black">${p2CorrectCount}/6개</span>
        </div>
        <div class="text-base font-black text-amber-950 mt-1">${p2Score} / 30점</div>
      </div>
      <div class="p-3 bg-slate-100/90 border border-slate-200 rounded-2xl">
        <div class="text-[11px] font-bold text-slate-600 flex items-center justify-between">
          <span>객관·단답 자동채점 소계</span>
          <span class="text-slate-500 font-bold">${p1CorrectCount + p2CorrectCount}/16문항</span>
        </div>
        <div class="text-base font-black text-slate-900 mt-1">${p1Score + p2Score} / 60점</div>
      </div>
    `;
  }
  if (secureV4) {
    if (s.status !== 'submitted') {
      if (p1El) p1El.textContent='실전평가 문항·정답·출제 의도는 학생이 제출한 뒤 교사 화면에서 확인할 수 있습니다.';
      if (p2El) p2El.textContent='진행 중에는 정답이 보이지 않으며, 객관·단답 점수도 서버에서만 계산합니다.';
      if (summaryEl) summaryEl.textContent='학생이 제출하면 실전평가 서버 채점 결과를 확인할 수 있습니다.';
    } else {
      const expectedAttemptId = s.attemptId;
      const requestGeneration = liveDashboardGeneration;
      const isCurrentStudentAttempt = () => currentModalStudent === s &&
        s.attemptId === expectedAttemptId &&
        isCurrentLiveV4Attempt(expectedAttemptId, requestGeneration);
      if (p1El) p1El.textContent='실전평가 객관식 문항 검토 내용을 서버에서 확인하고 있습니다…';
      if (p2El) p2El.textContent='실전평가 단답형 문항 검토 내용을 서버에서 확인하고 있습니다…';
      if (summaryEl) {
        if (!expectedAttemptId || !isCurrentStudentAttempt()) {
          summaryEl.textContent='현재 평가 회차와 학생 답안 회차가 일치하지 않아 서버 점수를 표시하지 않았습니다. 관제실을 새로고침해 주세요.';
        } else {
          summaryEl.textContent='실전평가 객관·단답 답안의 서버 채점 결과를 확인하고 있습니다…';
          requestSecureEvaluationGrade(getClassIdFromSelected(), s.numStr).then(result=>{
            if (!isCurrentStudentAttempt() || result.attemptId !== expectedAttemptId) return;
            const score=result.score;
            cacheLiveClassGrades(expectedAttemptId, { [s.numStr]: { score } }, true);
            renderLiveGrid(currentLiveStudents);
            summaryEl.replaceChildren();
            [['Part 1. 객관식',score.part1,30],['Part 2. 단답형',score.part2,30],['객관·단답 서버 채점 소계',score.objectiveTotal,60]].forEach(([label,value,max])=>{
              const row=document.createElement('div');row.className='p-3 bg-slate-50 border border-slate-200 rounded-2xl';
              const name=document.createElement('div');name.className='text-[11px] font-bold text-slate-600';name.textContent=label;
              const resultText=document.createElement('div');resultText.className='text-base font-black text-slate-900 mt-1';resultText.textContent=`${value} / ${max}점`;
              row.append(name,resultText);summaryEl.appendChild(row);
            });
          }).catch(error=>{if(isCurrentStudentAttempt())summaryEl.textContent='실전평가 서버 채점 결과를 확인하지 못했습니다. '+error.message;});
        }
      }
      if (expectedAttemptId && isCurrentStudentAttempt()) {
        requestSecureEvaluationReview(getClassIdFromSelected(), s.numStr).then(result=>{
          if (!isCurrentStudentAttempt() || result.attemptId !== expectedAttemptId) return;
          renderSecureV4TeacherQuestions(p1El, result.review?.part1, 'part1');
          renderSecureV4TeacherQuestions(p2El, result.review?.part2, 'part2');
        }).catch(error=>{
          if (!isCurrentStudentAttempt()) return;
          if (p1El) p1El.textContent='실전평가 문항 검토 내용을 확인하지 못했습니다. '+error.message;
          if (p2El) p2El.textContent='실전평가 문항 검토 내용을 확인하지 못했습니다. '+error.message;
        });
      } else {
        if (p1El) p1El.textContent='현재 평가 회차와 학생 답안 회차가 일치하지 않아 문항 정보를 표시하지 않았습니다.';
        if (p2El) p2El.textContent='현재 평가 회차와 학생 답안 회차가 일치하지 않아 문항 정보를 표시하지 않았습니다.';
      }
    }
  }

  if (p3El) {
    const graph = s.answers?.part3 || {};
    const plan = graph.plan || {};
    
    let stepsHtml = (Array.isArray(plan.steps) ? plan.steps : []).map((step, index) => {
      if (step.type === 'sel') return `<div class="ml-2 mb-1"><span class="font-bold text-indigo-600">[선택]</span> 조건: ${step.condition || '미작성'}<br><span class="text-[10px] text-slate-500 ml-4">↳ 예: ${step.yesAction || '미작성'} | 아니오: ${step.noAction || '미작성'}</span></div>`;
      if (step.type === 'loop') return `<div class="ml-2 mb-1"><span class="font-bold text-emerald-600">[반복]</span> 지속 조건: ${step.condition || '미작성'}<br><span class="text-[10px] text-slate-500 ml-4">↳ 반복할 행동: ${step.loopAction || '미작성'}</span></div>`;
      return `<div class="ml-2 mb-1"><span class="font-bold text-slate-600">[순차]</span> ${step.text || '미작성'}</div>`;
    }).join('');

    const shapeMeta = {
      terminal: { label: '단말 🟣', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
      io: { label: '자료 🟢', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      decision: { label: '판단 🟠', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
      proc: { label: '처리 🔵', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      process: { label: '처리 🔵', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
    };

    const blockMap = {};
    (graph.blocks || []).forEach(b => {
      if (b && b.id) {
        blockMap[b.id] = (b.text || '').trim() || (shapeMeta[b.shape]?.label || '블록');
      }
    });
    blockMap['eblk_start'] = '시작';

    const sortedBlocks = sortBlocksByExecution(graph.blocks, graph.connections);

    let blocksHtml = sortedBlocks.filter(Boolean).map((b, idx) => {
      const meta = shapeMeta[b.shape] || { label: b.shape, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
      const txt = (b.text || '').trim() || '내용 없음';
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${meta.cls} text-xs font-bold mr-1.5 mb-1.5 shadow-2xs">
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-mono">${idx + 1}. ${meta.label}</span>
        <span>${escapeHtml(txt)}</span>
      </span>`;
    }).join('');

    let connsHtml = (Array.isArray(graph.connections) ? graph.connections : []).filter(Boolean).map(c => {
      const fromName = blockMap[c.from] || '블록';
      const toName = blockMap[c.to] || '블록';
      let branchBadge = '';
      if (c.fromPort === 'yes') branchBadge = ' <span class="text-emerald-600 font-bold">[예]</span>';
      else if (c.fromPort === 'no') branchBadge = ' <span class="text-amber-600 font-bold">[아니오]</span>';
      return `<div class="text-[11px] text-slate-600 py-0.5 font-medium">↳ <strong class="text-slate-800">${escapeHtml(fromName)}</strong>${branchBadge} ➔ <strong class="text-slate-800">${escapeHtml(toName)}</strong></div>`;
    }).join('');

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
          <span class="text-[10px] font-normal bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shadow-sm">${[3,4].includes(s.questionVersion) ? '교사 수동 40점 배점' : `자동 계산: ${(s.scores?.part3 || 0)}/40점`}</span>
        </div>
        <!-- 캔버스 미니어처 뷰어 영역 -->
        <div class="my-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <i class="fa-solid fa-diagram-project text-emerald-600"></i>
              <span>순서도 다이어그램 시각화 (엔트리 표준 색상)</span>
            </span>
            <button type="button" onclick="openFlowchartModalPreview()" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-700 transition flex items-center gap-1 shadow-2xs cursor-pointer">
              <i class="fa-solid fa-up-right-and-down-left-from-center text-[10px] text-slate-500"></i>
              <span>크게 보기 (확대 팝업)</span>
            </button>
          </div>
          <div class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center min-h-[220px]">
            <canvas id="classroom-live-flowchart-canvas" width="800" height="340" class="w-full max-h-[340px] object-contain block"></canvas>
          </div>
        </div>
        <div class="mb-1.5 text-xs font-bold text-slate-700 flex items-center justify-between">
          <span>실행 순서별 블록 (${(graph.blocks || []).length}개):</span>
        </div>
        <div class="flex flex-wrap items-center mb-2">${blocksHtml || '<div class="text-slate-400 italic text-xs">배치된 블록 없음</div>'}</div>
        ${connsHtml ? `
        <details class="mt-2 text-xs text-slate-500">
          <summary class="cursor-pointer font-bold hover:text-slate-800 text-[11px] select-none flex items-center gap-1">
            <i class="fa-solid fa-list-nodes text-slate-400"></i>
            <span>텍스트 연결 경로 보기 (${(graph.connections || []).length}개 연결)</span>
          </summary>
          <div class="pt-1.5 pl-2.5 space-y-0.5 border-l-2 border-slate-200 mt-1.5 bg-slate-50/50 p-2 rounded-lg">
            ${connsHtml}
          </div>
        </details>
        ` : ''}
      </div>
    `;
    p3El.innerHTML = p3Html;
    p3El.style.whiteSpace = 'normal';

    const canvas = document.getElementById('classroom-live-flowchart-canvas');
    if (canvas) {
      drawFlowchartPreview(canvas, graph.blocks, graph.connections);
    }
  }

  const currentScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
    ? s.scores.teacherOverride
    : (s.scores?.total || 0);

  if (scoreInp) scoreInp.value = currentScore;
  document.getElementById('classroom-legacy-score').hidden=[3,4].includes(s.questionVersion);
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

  // 검사 중단 / 풀이중 학생: 현재 답안으로 정상 제출 버튼
  if (forceSubmitBox && forceSubmitBtn) {
    if (s.status !== 'submitted') {
      forceSubmitBox.classList.remove('hidden');
      forceSubmitBtn.onclick = async () => {
        if (!confirm(`📝 [${s.name || s.num + '번'}] 학생의 현재 작성 답안으로 정상 제출 마감하시겠습니까?\n기기 꺼짐이나 네트워크 중단으로 제출하지 못한 답안을 교사 권한으로 즉시 마감 처리합니다.`)) {
          return;
        }
        const classId = getClassIdFromSelected();
        if (window.evalService) {
          try {
            await window.evalService.forceSubmitStudentExam(classId, s.num);
            alert(`✅ ${s.name || s.num + '번'} 학생의 현재 답안으로 정상 제출되었습니다.`);
            closeLiveStudentModal();
          } catch(error) {
            alert('제출 처리 실패: ' + error.message);
          }
        }
      };
    } else {
      forceSubmitBox.classList.add('hidden');
    }
  }

  // 유령 계정 / 번호 오입력: 좌석 비우기 (퇴장 처리) 버튼
  if (kickBtn) {
    kickBtn.onclick = async () => {
      if (!confirm(`⚠️ 정말로 [${s.name || s.num + '번'}] 학생의 좌석을 비우고 퇴장 처리하시겠습니까?\n이 좌석의 응시 기록이 삭제되어 빈자리가 되며, 진짜 해당 번호 학생이 에러 없이 새로 입장할 수 있게 됩니다.`)) {
        return;
      }
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        try {
          await window.evalService.clearStudentSeat(classId, s.num);
          alert(`🗑️ ${s.name || s.num + '번'} 학생의 좌석이 초기화되었습니다. 이제 빈자리로 반환되었습니다.`);
          closeLiveStudentModal();
        } catch(error) {
          alert('좌석 비우기 실패: ' + error.message);
        }
      }
    };
  }

  modal.classList.remove('hidden');
}

function closeLiveStudentModal() {
  if (currentModalTimerInterval) {
    clearInterval(currentModalTimerInterval);
    currentModalTimerInterval = null;
  }
  currentModalStudent = null;
  closeFlowchartModalPreview();
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

function archiveTimestampInfo(archive){
  const session=archive?.session||{};
  for(const [value,source] of [[session.startTime,'start'],[session.preparedAt,'prepared'],[archive?.archivedAt,'archived']]){
    if(value===undefined||value===null||value==='')continue;
    const time=archiveDateMillis(value);
    if(Number.isFinite(time))return {time,source};
  }
  return {time:null,source:'unknown'};
}
function archiveDateMillis(value){
  try{
    if(value instanceof Date)return value.getTime();
    if(typeof value==='number')return value;
    if(typeof value?.toDate==='function')return value.toDate().getTime();
    if(Number.isFinite(value?.seconds))return value.seconds*1000;
    return Date.parse(String(value));
  }catch{return NaN;}
}
function archiveSeoulDate(time,withTime=false){
  if(!Number.isFinite(time))return '날짜 확인 불가';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).formatToParts(new Date(time)).map(part=>[part.type,part.value]));
  return withTime?`${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`:`${parts.year}.${parts.month}.${parts.day}`;
}
function archiveAssessmentVersion(archive){
  const raw=archive?.session?.questionVersion??archive?.session?.version;
  const parsed=Number(String(raw??'').replace(/^v/i,''));
  return Number.isFinite(parsed)?parsed:0;
}
function archiveAssessmentType(version){return version===3?'모의평가':version===4?'실전평가':'이전 평가';}
function archiveStudentNumber(student){
  const raw=student?.num??student?.numStr??student?.archiveStudentId??'';
  const parsed=Number.parseInt(String(raw).replace(/\D/g,''),10);
  return Number.isFinite(parsed)&&parsed>0?String(parsed).padStart(2,'0'):'--';
}
function archiveStudentStatus(student){
  return student?.status==='submitted'?'제출 완료':student?.status==='in_progress'?'작성 중':student?.status==='waiting'?'대기 중':'상태 기록 없음';
}
function archiveStudentScoreLabel(student){
  const scores=student?.scores;
  const correction=window.ObjectiveCorrection?.get(student);
  if(!scores||typeof scores!=='object')return '저장 점수 없음';
  if(Number.isFinite(scores.teacherOverride))return `교사 조정 ${scores.teacherOverride}점`;
  if(scores.pendingReview){
    const objective=Number.isFinite(scores.objectiveTotal)?scores.objectiveTotal:(Number.isFinite(scores.part1)&&Number.isFinite(scores.part2)?scores.part1+scores.part2:null);
    return objective===null?(scores.serverGraded?'서버 채점 대기':'서술 검토 대기'):`소계 ${objective}점 · 서술 대기`;
  }
  if(Number.isFinite(scores.total))return `${scores.total}점`;
  if(correction)return `단답형 ${correction.afterPart2} / 30점 · 정정 +${correction.delta}점`;
  const confirmed=student?.review?.confirmed?.criteria;
  if(Array.isArray(confirmed)&&confirmed.length)return '교사 확정 검토 기록 있음';
  if(student?.review?.proposal)return 'AI 제안 · 미확정';
  return '저장 점수 없음';
}
function archiveErrorText(error,kind='list'){
  if(error?.code==='permission-denied')return '이 학급의 보관 답안을 읽을 권한이 없습니다. 담당 학급을 확인한 뒤 다시 로그인해 주세요.';
  if(error?.message?.includes('보관 평가 회차를 찾을 수 없습니다.'))return error.message;
  return kind==='students'?'학생 답안을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.':'보관 평가 목록을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
}
function ensureArchiveInteractions(container){
  if(!container||container.dataset.archiveEvents==='bound')return;
  container.dataset.archiveEvents='bound';
  container.addEventListener('click',event=>{
    const button=event.target.closest('[data-archive-action]');
    if(!button||!container.contains(button))return;
    const action=button.dataset.archiveAction;
    if(action==='retry-list')loadArchivedSessions();
    else if(action==='show-live')switchClassroomSubTab('live_eval');
    else if(action==='open-round')openArchivedSession(button.dataset.archiveId);
    else if(action==='back-list'){
      const previousId=selectedArchivedSession?.id;
      archiveViewGeneration++;selectedArchivedSession=null;archivedStudents=[];selectedArchivedStudentId=null;archivedStudentsError='';renderArchivedSessionList();
      const rounds=[...container.querySelectorAll('[data-archive-action="open-round"]')];(rounds.find(item=>item.dataset.archiveId===previousId)||rounds[0])?.focus();
    }else if(action==='retry-students'&&selectedArchivedSession)openArchivedSession(selectedArchivedSession.id);
    else if(action==='select-student')selectArchivedStudent(button.dataset.archiveStudentId);
    else if(action==='back-roster'){
      selectedArchivedStudentId=null;renderArchivedSessionDetail();document.getElementById('classroom-archive-student-search')?.focus();
    }
  });
  container.addEventListener('input',event=>{
    if(event.target.id!=='classroom-archive-student-search')return;
    const query=event.target.value.trim().toLocaleLowerCase('ko-KR');
    let visible=0;
    container.querySelectorAll('[data-archive-student-row]').forEach(row=>{
      const matches=!query||row.dataset.searchText.includes(query);row.hidden=!matches;if(matches)visible++;
    });
    const count=container.querySelector('#classroom-archive-search-count');
    if(count)count.textContent=query?`${visible}명 표시`:`${archivedStudents.length}명`;
    const empty=container.querySelector('#classroom-archive-search-empty');
    if(empty)empty.hidden=visible>0;
  });
}
function archiveContentElement(){
  const container=document.getElementById('classroom-archive-content');
  ensureArchiveInteractions(container);
  return container;
}
async function loadArchivedSessions(){
  const container=archiveContentElement(),classLabel=document.getElementById('classroom-archive-class-label');
  if(!container)return;
  const classId=getClassIdFromSelected(),generation=++archiveViewGeneration;
  selectedArchivedSession=null;archivedStudents=[];selectedArchivedStudentId=null;archivedStudentsError='';archivedSessions=[];
  if(classLabel)classLabel.textContent=currentSelectedClass;
  container.innerHTML='<p class="text-sm text-slate-500 py-10 text-center" role="status">보관된 평가 기록을 불러오는 중입니다.</p>';
  try{
    const sessions=await window.evalService.listArchivedSessions(classId);
    if(generation!==archiveViewGeneration||currentClassroomTab!=='archives'||classId!==getClassIdFromSelected())return;
    archivedSessions=Array.isArray(sessions)?sessions.filter(item=>item?.id&&item.kind==='new-session'):[];
    renderArchivedSessionList();
  }catch(error){
    if(generation!==archiveViewGeneration||currentClassroomTab!=='archives')return;
    container.innerHTML=`<div class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center" role="alert"><p class="text-sm font-bold text-rose-800">${escapeHtml(archiveErrorText(error))}</p><button type="button" data-archive-action="retry-list" class="mt-3 min-h-11 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-800 text-sm font-bold">다시 불러오기</button></div>`;container.querySelector('[data-archive-action="retry-list"]')?.focus();
  }
}
function renderArchivedSessionList(){
  const container=archiveContentElement();if(!container)return;
  if(!archivedSessions.length){
    container.innerHTML='<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8 text-center"><div class="mx-auto w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400"><i class="fa-solid fa-box-open" aria-hidden="true"></i></div><h4 class="mt-3 font-black text-slate-800">아직 보관된 평가가 없습니다</h4><p class="max-w-xl mx-auto mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">평가가 끝난 뒤 새 평가를 준비하면 직전 회차의 답안이 이곳에 보관됩니다. 다음 평가를 아직 준비하지 않았다면 현재 회차는 실시간 수행평가 화면에서 확인하실 수 있습니다.</p><button type="button" data-archive-action="show-live" class="mt-4 min-h-11 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-100">실시간 평가로 이동</button></div>';
    return;
  }
  const sorted=[...archivedSessions].sort((a,b)=>(archiveTimestampInfo(b).time??-Infinity)-(archiveTimestampInfo(a).time??-Infinity));
  const labels=sorted.map(archive=>{
    const version=archiveAssessmentVersion(archive),date=archiveTimestampInfo(archive),day=archiveSeoulDate(date.time),key=`${version}:${day}`;
    return {archive,version,date,day,key};
  });
  const counts=new Map();labels.forEach(item=>counts.set(item.key,(counts.get(item.key)||0)+1));
  container.innerHTML=`<div class="space-y-3"><p class="text-xs text-slate-500">${sorted.length}개 보관 회차 · 최근 평가부터 표시</p><div class="grid grid-cols-1 xl:grid-cols-2 gap-3">${labels.map(item=>{
    const type=archiveAssessmentType(item.version),needsTime=(counts.get(item.key)||0)>1,dateText=item.date.time===null?'평가 날짜 확인 불가':`${item.date.source==='archived'?'보관일':'평가일'} ${item.day}${needsTime?` · ${archiveSeoulDate(item.date.time,true).slice(-5)}`:''}`;
    return `<article class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm transition"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="px-2 py-1 rounded-lg text-[11px] font-black ${item.version===3?'bg-blue-50 text-blue-700':item.version===4?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-700'}">${type}</span><h4 class="font-black text-slate-900">${type} · ${item.day}</h4></div><p class="mt-1 text-xs text-slate-500">${dateText}</p></div><button type="button" data-archive-action="open-round" data-archive-id="${escapeHtml(item.archive.id)}" class="shrink-0 min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black flex items-center justify-center gap-2"><span>답안 보기</span><i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></button></article>`;
  }).join('')}</div></div>`;
}
async function openArchivedSession(archiveId){
  const container=archiveContentElement(),classId=getClassIdFromSelected();
  const archive=archivedSessions.find(item=>item.id===archiveId);
  if(!container||!archive)return;
  const generation=++archiveViewGeneration;
  selectedArchivedSession=archive;archivedStudents=null;selectedArchivedStudentId=null;archivedStudentsError='';renderArchivedSessionDetail();
  try{
    const students=await window.evalService.getArchivedSessionStudents(classId,archive.id);
    if(generation!==archiveViewGeneration||currentClassroomTab!=='archives'||classId!==getClassIdFromSelected()||selectedArchivedSession?.id!==archive.id)return;
    archivedStudents=Array.isArray(students)?students.map(student=>({...student})).sort((a,b)=>Number(archiveStudentNumber(a))-Number(archiveStudentNumber(b))):[];
    renderArchivedSessionDetail();
    const focusTarget=container.querySelector('[data-archive-action="select-student"]')||container.querySelector('[data-archive-action="back-list"]');focusTarget?.focus();
  }catch(error){
    if(generation!==archiveViewGeneration||selectedArchivedSession?.id!==archive.id)return;
    archivedStudents=[];archivedStudentsError=archiveErrorText(error,'students');renderArchivedSessionDetail();container.querySelector('[data-archive-action="retry-students"]')?.focus();
  }
}
function selectArchivedStudent(studentId){
  if(!Array.isArray(archivedStudents))return;
  const student=archivedStudents.find(item=>String(item.archiveStudentId||item.numStr||item.num||'')===String(studentId));
  if(!student)return;
  selectedArchivedStudentId=String(student.archiveStudentId||student.numStr||student.num||'');renderArchivedSessionDetail();
  const container=archiveContentElement(),focused=[...container.querySelectorAll('[data-archive-action="select-student"]')].find(button=>button.dataset.archiveStudentId===selectedArchivedStudentId);focused?.focus();
}
function renderArchivedSessionDetail(){
  const container=archiveContentElement(),archive=selectedArchivedSession;
  if(!container||!archive)return;
  const version=archiveAssessmentVersion(archive),date=archiveTimestampInfo(archive),type=archiveAssessmentType(version),dateText=date.time===null?'날짜 정보 없음':`${date.source==='archived'?'보관일':'평가일'} ${archiveSeoulDate(date.time,true)}`;
  const students=Array.isArray(archivedStudents)?archivedStudents:[],submitted=students.filter(student=>student.status==='submitted').length;
  const selected=students.find(student=>String(student.archiveStudentId||student.numStr||student.num||'')===selectedArchivedStudentId);
  const summary=Array.isArray(archivedStudents)?`${students.length}명 보관 · 제출 ${submitted}명`:'답안 목록 불러오는 중';
  const rosterBody=archivedStudents===null?'<p class="p-5 text-sm text-slate-500" role="status">학생 답안을 불러오는 중입니다.</p>':archivedStudentsError?`<div class="p-5 text-center" role="alert"><p class="text-sm text-rose-700">${escapeHtml(archivedStudentsError)}</p><button type="button" data-archive-action="retry-students" class="mt-3 min-h-11 px-4 py-2 rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-800">다시 불러오기</button></div>`:students.length?students.map(student=>{
    const id=String(student.archiveStudentId||student.numStr||student.num||''),num=archiveStudentNumber(student),name=String(student.name||'이름 기록 없음'),search=`${num} ${name}`.toLocaleLowerCase('ko-KR'),active=selectedArchivedStudentId===id;
    return `<button type="button" data-archive-action="select-student" data-archive-student-id="${escapeHtml(id)}" data-archive-student-row data-search-text="${escapeHtml(search)}" aria-pressed="${active}" class="w-full text-left p-3 rounded-xl border ${active?'border-indigo-300 bg-indigo-50':'border-slate-200 bg-white hover:bg-slate-50'} transition"><span class="flex items-start justify-between gap-2"><span class="min-w-0"><span class="block text-xs font-black text-slate-500">${num}번 · ${escapeHtml(name)}</span><span class="mt-1 block text-[11px] text-slate-500">${archiveStudentStatus(student)}</span></span><span class="shrink-0 text-[11px] font-black text-slate-700">${escapeHtml(archiveStudentScoreLabel(student))}</span></span></button>`;
  }).join(''):'<p class="p-5 text-sm text-slate-500 text-center">이 회차에 보관된 학생 답안이 없습니다.</p>';
  const answer=selected?renderArchivedStudentAnswer(selected,version):'<div class="min-h-[280px] flex flex-col items-center justify-center text-center p-6"><span class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center"><i class="fa-regular fa-file-lines" aria-hidden="true"></i></span><h4 class="mt-3 font-black text-slate-800">학생을 선택해 답안을 확인하세요</h4><p class="mt-1 text-xs text-slate-500">보관된 기록만 표시하며 현재 회차에는 영향을 주지 않습니다.</p></div>';
  container.innerHTML=`<div class="space-y-4"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><button type="button" data-archive-action="back-list" class="min-h-10 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>회차 목록</span></button><div class="mt-2 flex flex-wrap items-center gap-2"><span class="px-2 py-1 rounded-lg text-[11px] font-black ${version===3?'bg-blue-50 text-blue-700':version===4?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-700'}">${type}</span><h3 class="text-base sm:text-lg font-black text-slate-900">${type} · ${archiveSeoulDate(date.time)}</h3><span class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black">읽기 전용</span></div><p class="mt-1 text-xs text-slate-500">${dateText} · ${summary}</p></div><span class="text-xs font-bold text-slate-500">${escapeHtml(currentSelectedClass)}</span></div><div class="classroom-archive-round-layout" id="classroom-archive-round-layout" data-mobile-view="${selected?'student':'roster'}"><section class="classroom-archive-roster rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><div class="flex items-center justify-between gap-2"><h4 class="font-black text-slate-800">학생 답안</h4><span id="classroom-archive-search-count" class="text-[11px] text-slate-500">${students.length}명</span></div><label class="block mt-3"><span class="sr-only">학생 번호 또는 이름 검색</span><input id="classroom-archive-student-search" type="search" placeholder="번호 또는 이름 검색" class="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-indigo-500"></label><div class="classroom-archive-student-list mt-3 space-y-2">${rosterBody}<p id="classroom-archive-search-empty" class="p-4 text-sm text-slate-500 text-center" hidden>검색 결과가 없습니다.</p></div></section><section class="classroom-archive-answer rounded-2xl border border-slate-200 bg-white overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 border-b border-slate-100"><div><h4 class="font-black text-slate-800">${selected?`${archiveStudentNumber(selected)}번 · ${escapeHtml(selected.name||'이름 기록 없음')}`:'답안 상세'}</h4><p class="mt-1 text-[11px] text-slate-500">보관된 답안과 확정 기록을 수정 없이 표시합니다.</p></div>${selected?'<button type="button" data-archive-action="back-roster" class="classroom-archive-back-roster min-h-11 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">학생 목록으로</button>':''}</div><div class="classroom-archive-answer-body p-3 sm:p-4">${answer}</div></section></div></div>`;
  if(selected){
    const canvas=container.querySelector('#classroom-archive-flowchart-canvas'),graph=selected.answers?.part3||{};
    if(canvas&&typeof drawFlowchartPreview==='function')drawFlowchartPreview(canvas,Array.isArray(graph.blocks)?graph.blocks:[],Array.isArray(graph.connections)?graph.connections:[]);
  }
}
function renderArchivedQuestionAnswers(answerMap,questions,isChoice){
  const answers=answerMap&&typeof answerMap==='object'?answerMap:{};
  const choiceIndex=value=>Number.isInteger(value)?value:(typeof value==='string'&&/^[0-4]$/.test(value)?Number(value):null);
  if(Array.isArray(questions)&&questions.length){
    return questions.map((question,index)=>{
      const value=answers[question.id],hasAnswer=Object.prototype.hasOwnProperty.call(answers,question.id)&&value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim());
      let answer='미응답';
      if(hasAnswer){
        const choice=choiceIndex(value);
        if(isChoice&&choice!==null&&question.options?.[choice]!==undefined){const symbols=['①','②','③','④','⑤'];answer=`${symbols[choice]||''} ${question.options[choice]}`.trim();}
        else answer=typeof value==='string'?value:JSON.stringify(value);
      }
      return `<article class="p-3 rounded-xl border border-slate-200 bg-slate-50"><h5 class="text-xs font-black text-slate-800">${escapeHtml(question.title||`${index+1}번 문항`)}</h5>${question.desc?`<p class="mt-1 text-[11px] text-slate-500 whitespace-pre-wrap">${escapeHtml(question.desc)}</p>`:''}<p class="mt-2 text-sm text-slate-800 whitespace-pre-wrap break-words"><span class="text-slate-500 font-bold">학생 답안:</span> ${escapeHtml(answer)}</p></article>`;
    }).join('');
  }
  const entries=Object.entries(answers);
  if(!entries.length)return '<p class="text-xs text-slate-500">저장된 답안이 없습니다.</p>';
  return `<div class="space-y-2">${entries.map(([key,value])=>{
    const match=String(key).match(/(?:q|question)[_-]?(\d+)/i)||String(key).match(/(\d+)$/),label=match?`${Number(match[1])}번 문항`:String(key);
    let answer=value===null||value===undefined||typeof value==='string'&&!value.trim()?'미응답':typeof value==='string'?value:JSON.stringify(value);
    const index=choiceIndex(value);
    if(isChoice&&index!==null){const symbols=['①','②','③','④','⑤'];answer=symbols[index]||String(value);}
    return `<article class="p-3 rounded-xl border border-slate-200 bg-slate-50"><h5 class="text-xs font-black text-slate-800">${escapeHtml(label)}</h5><p class="mt-2 text-sm text-slate-800 whitespace-pre-wrap break-words"><span class="text-slate-500 font-bold">학생 답안:</span> ${escapeHtml(answer??'미응답')}</p></article>`;
  }).join('')}</div>`;
}
function renderArchivedStudentAnswer(student,version){
  const correction=version===4?window.ObjectiveCorrection?.get(student):null;
  const correctionHtml=correction?`<p class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" data-objective-correction>인정 답안 확대에 따라 단답형 점수가 ${correction.beforePart2}점에서 ${correction.afterPart2}점으로 정정되었습니다. (+${correction.delta}점) 원본 답안과 서술형 검토 기록은 유지됩니다.</p>`:'';
  const answers=student?.answers&&typeof student.answers==='object'?student.answers:{},p1=answers.part1||{},p2=answers.part2||{},assigned=answers.assignedQuestions||answers.part3?.assignedQuestions;
  const submittedAt=archiveDateMillis(student.submittedAt),submittedAtText=Number.isFinite(submittedAt)?`${archiveSeoulDate(submittedAt,true)} KST`:'기록 없음';
  let questions=null;
  if(version!==4&&!(version===3&&!assigned)&&typeof window.evaluationQuestions==='function'){
    try{questions=window.evaluationQuestions(answers,version);}catch{}
  }
  const p1Questions=questions?.part1||[],p2Questions=questions?.part2||{};
  const part3=answers.part3||{},plan=part3.plan||{},steps=Array.isArray(plan.steps)?plan.steps:typeof plan.steps==='string'&&plan.steps.trim()?[plan.steps]:[];
  const stepsHtml=steps.map((step,index)=>`<li class="ml-5 list-decimal text-sm text-slate-700 whitespace-pre-wrap break-words">${escapeHtml(typeof step==='string'?step:step?.text??JSON.stringify(step))}</li>`).join('');
  const blocks=Array.isArray(part3.blocks)?part3.blocks:[],connections=Array.isArray(part3.connections)?part3.connections:[];
  const review=student.review||{},confirmed=Array.isArray(review.confirmed?.criteria)?review.confirmed.criteria:[];
  const reviewHtml=confirmed.length?`<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><h5 class="text-xs font-black text-emerald-900">교사 확정 검토 기록</h5><ul class="mt-2 space-y-1">${confirmed.map(item=>{const rule=(typeof ASSESSMENT_RUBRIC!=='undefined'?ASSESSMENT_RUBRIC:[]).find(entry=>entry.id===item.id);return `<li class="text-xs text-slate-700">${escapeHtml(rule?.label||item.id||'평가 기준')}: ${escapeHtml(item.score)} / 10점${item.evidence?` · ${escapeHtml(item.evidence)}`:''}</li>`;}).join('')}</ul></div>`:review.proposal?'<p class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">AI 초벌 제안이 저장되어 있습니다. 교사 확정 점수와 구분하여 표시합니다.</p>':'';
  const planHtml=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${[['현재 상태',plan.current],['목표 상태',plan.goal],['지켜야 할 조건',plan.conditions]].map(([label,value])=>`<div class="rounded-xl bg-slate-50 p-3"><span class="block text-[11px] font-bold text-slate-500">${label}</span><p class="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">${escapeHtml(value||'작성하지 않음')}</p></div>`).join('')}</div>${stepsHtml?`<div class="mt-3"><h5 class="text-xs font-black text-slate-700">자연어 해결 순서</h5><ol class="mt-2 space-y-1">${stepsHtml}</ol></div>`:''}`;
  const blockHtml=blocks.length?`<canvas id="classroom-archive-flowchart-canvas" width="800" height="340" class="w-full max-h-[340px] object-contain rounded-xl border border-slate-200 bg-white" role="img" aria-label="보관된 학생 순서도"></canvas><p class="mt-2 text-xs text-slate-500">기호 ${blocks.length}개 · 연결 ${connections.length}개</p>`:'<p class="text-xs text-slate-500">보관된 순서도 블록이 없습니다.</p>';
  const questionNote=version===4?'<p class="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">V4 당시 문항 원문은 답안 보관 자료에 포함되지 않았습니다. 저장된 응답만 표시하며 현재 문항으로 대체하지 않습니다.</p>':version===3&&!assigned?'<p class="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">이전 답안에 문항 배정 정보가 없어 문항 원문 대신 저장된 응답을 표시합니다.</p>':'';
  return `<div class="space-y-4"><div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><div class="rounded-xl bg-indigo-50 border border-indigo-100 p-3"><span class="text-[11px] font-bold text-indigo-700">제출 상태</span><p class="mt-1 text-sm font-black text-indigo-950">${escapeHtml(archiveStudentStatus(student))}</p></div><div class="rounded-xl bg-slate-50 border border-slate-200 p-3"><span class="text-[11px] font-bold text-slate-500">보관된 점수</span><p class="mt-1 text-sm font-black text-slate-900">${escapeHtml(archiveStudentScoreLabel(student))}</p></div><div class="rounded-xl bg-slate-50 border border-slate-200 p-3"><span class="text-[11px] font-bold text-slate-500">제출 시각</span><p class="mt-1 text-xs font-bold text-slate-800">${escapeHtml(submittedAtText)}</p></div></div>${correctionHtml}<section class="rounded-2xl border border-indigo-100 p-3 sm:p-4"><h5 class="mb-3 text-sm font-black text-indigo-950">Part 1 · 객관식 답안</h5>${questionNote}${renderArchivedQuestionAnswers(p1,p1Questions,true)}</section><section class="rounded-2xl border border-amber-100 p-3 sm:p-4"><h5 class="mb-3 text-sm font-black text-amber-950">Part 2 · 단답형 답안</h5>${renderArchivedQuestionAnswers(p2,p2Questions,false)}</section><section class="rounded-2xl border border-emerald-100 p-3 sm:p-4"><h5 class="mb-3 text-sm font-black text-emerald-950">Part 3 · 자연어 계획과 순서도</h5>${planHtml}<div class="mt-4"><h5 class="mb-2 text-xs font-black text-slate-700">보관된 순서도</h5>${blockHtml}</div>${reviewHtml}</section></div>`;
}

if (typeof window !== 'undefined') {
  window.sortBlocksByExecution = sortBlocksByExecution;
  window.drawFlowchartPreview = drawFlowchartPreview;
  window.handleTeacherExtendClassTime = handleTeacherExtendClassTime;
  window.handleReopenStudent = handleReopenStudent;
  window.handleExtendStudent = handleExtendStudent;
  window.openLiveStudentModal = openLiveStudentModal;
  window.closeLiveStudentModal = closeLiveStudentModal;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sortBlocksByExecution,
    drawFlowchartPreview,
    handleTeacherExtendClassTime,
    handleReopenStudent,
    handleExtendStudent,
    openLiveStudentModal,
    closeLiveStudentModal
  };
}

