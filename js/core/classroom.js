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
let isScoreBlindMode = true; // 프로젝터 투사 시 학생 실시간 점수 유출 방지 (기본 ON)
let currentModalStudent = null;

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
  if(!getAllowedClassNames().includes(className)){alert('담당 학급만 선택할 수 있습니다.');return;}
  currentSelectedClass = className;
  if (currentClassroomTab === 'live_eval') {
    initLiveEvalDashboard();
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
      clearUnavailableTeacherData();
    });
    if(generation!==liveDashboardGeneration){liveSessionUnsub?.();liveSessionUnsub=null;return;}
    liveEvalUnsub = window.evalService.listenStudents(classId, (students) => {
      if (generation !== liveDashboardGeneration) return;
      const label=document.getElementById('classroom-connection-status');
      if(label) label.textContent=window.evalService.isDemo() ? '로컬 시연 · 운영 DB와 분리됨' : '답안 수신됨 · 연결 상태는 갱신 시 확인';
      currentLiveStudents = students || [];
      renderLiveGrid(currentLiveStudents);
    }, ()=>{if(generation===liveDashboardGeneration)clearUnavailableTeacherData();});
    if(generation!==liveDashboardGeneration){liveEvalUnsub?.();liveEvalUnsub=null;return;}
    liveSessionTimer = setInterval(renderTeacherSessionControl, 1000);
    } catch(error) { liveSessionError = true; setTeacherSessionFeedback(error.message); renderTeacherSessionControl(); }
  }
}

function clearUnavailableTeacherData() {
  stopLiveEvalDashboard();
  currentLiveStudents=[];currentLiveSession=null;liveSessionError=true;
  renderLiveGrid([]);closeLiveStudentModal();
  ['classroom-live-modal-title','classroom-live-modal-summary','classroom-live-modal-p1','classroom-live-modal-p2','classroom-live-modal-p3'].forEach(id=>{const el=document.getElementById(id);if(el)el.replaceChildren();});
  const score=document.getElementById('classroom-live-override-score');if(score)score.value='';
  const label=document.getElementById('classroom-connection-status');if(label)label.textContent='자료 표시 중단 · 연결과 담당 학급 권한을 확인해 주세요';
  setTeacherSessionFeedback('학생 자료를 표시할 수 없어 화면을 비웠습니다. 연결을 확인하고, 담당 반이 바뀌었다면 다시 로그인해 주세요.');
  renderTeacherSessionControl();
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
  const closeWaitingBtn = document.getElementById('teacher-session-close-waiting');
  if (closeWaitingBtn) {
    const showCloseWaiting = model.state === 'waiting';
    closeWaitingBtn.classList.toggle('hidden', !showCloseWaiting);
    closeWaitingBtn.disabled = teacherSessionPending;
  }
  const select = document.getElementById('classroom-class-select');
  if (select) select.disabled = teacherSessionPending;
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
      currentLiveSession = session;
      setTeacherSessionFeedback('대기실을 닫았습니다. 학생 입장이 차단되었습니다.');
    }
  } catch(error) {
    if (generation === liveDashboardGeneration) setTeacherSessionFeedback('처리하지 못했습니다. '+error.message);
  } finally {
    teacherSessionPending = false;
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
        const currentObjScore = (s.scores?.part1 || 0) + (s.scores?.part2 || 0);
        if (isScoreBlindMode) {
          statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">풀이중 (${pCount}/16문항)</span>`;
          scoreDisplay = `<span class="text-xs text-slate-400 font-medium">풀이 진행 중</span>`;
        } else {
          statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">풀이중 (${pCount}문항 · ${currentObjScore}점)</span>`;
          scoreDisplay = `<span class="text-xs text-slate-500 font-bold font-mono">${currentObjScore}점 (임시)</span>`;
        }
      } else if (s.status === 'submitted') {
        statusBg = "bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs";
        const finalScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
          ? s.scores.teacherOverride
          : (s.scores?.total || 0);
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">제출완료</span>`;
        if (isScoreBlindMode) {
          scoreDisplay = `<span class="text-xs text-emerald-700 font-bold">제출 완료 (비공개)</span>`;
        } else {
          scoreDisplay = `<span class="text-sm font-black text-emerald-700">${s.scores?.pendingReview ? '소계 ' + ((s.scores?.part1 || 0) + (s.scores?.part2 || 0)) + '점 (검토대기)' : finalScore + '점'}</span>`;
        }
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

// 나이스 CSV 다운로드
function handleTeacherExportCSV() {
  const classId = getClassIdFromSelected();
  if (window.evalService) {
    window.evalService.exportNeisCSV(classId, currentLiveStudents);
  }
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
  drawFlowchartPreview(canvas, currentModalStudent.answers?.part3?.blocks, currentModalStudent.answers?.part3?.connections);
  lightbox.classList.remove('hidden');
}

function closeFlowchartModalPreview() {
  const lightbox = document.getElementById('classroom-flowchart-lightbox');
  if (lightbox) lightbox.classList.add('hidden');
}

// 학생 개별 답안 상세 팝업 및 점수 수동 조정 / 재시험 허용
function openLiveStudentModal(studentNum) {
  const s = currentLiveStudents.find(item => item.num === studentNum);
  if (!s) return;
  currentModalStudent = s;

  const modal = document.getElementById('classroom-live-detail-modal');
  if (!modal) return;

  const titleEl = document.getElementById('classroom-live-modal-title');
  if (titleEl) titleEl.textContent = `${currentSelectedClass} ${s.num}번 ${s.name} 학생 답안 검토`;

  const summaryEl = document.getElementById('classroom-live-modal-summary');
  const p1El = document.getElementById('classroom-live-modal-p1');
  const p2El = document.getElementById('classroom-live-modal-p2');
  const p3El = document.getElementById('classroom-live-modal-p3');
  const scoreInp = document.getElementById('classroom-live-override-score');

  const questions = typeof window.evaluationQuestions === 'function'
    ? window.evaluationQuestions(s.answers, s.questionVersion)
    : (window.EVAL_QUESTIONS || (typeof EVAL_QUESTIONS !== 'undefined' ? EVAL_QUESTIONS : { part1: [], part2: [] }));

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

    let blocksHtml = (Array.isArray(graph.blocks) ? graph.blocks : []).filter(Boolean).map(b => {
      const meta = shapeMeta[b.shape] || { label: b.shape, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
      const txt = (b.text || '').trim() || '내용 없음';
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${meta.cls} text-xs font-bold mr-1.5 mb-1.5 shadow-2xs">
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-mono">${meta.label}</span>
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
          <span class="text-[10px] font-normal bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shadow-sm">${s.questionVersion === 3 ? '교사 수동 40점 배점' : `자동 계산: ${(s.scores?.part3 || 0)}/40점`}</span>
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
          <span>배치된 블록 목록 (${(graph.blocks || []).length}개):</span>
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
