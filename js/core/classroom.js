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
    btn.className = "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1.5 bg-white text-indigo-600 shadow-xs border border-indigo-100 whitespace-nowrap";
  }

  renderClassroomDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitClassroomView() {
  if (liveEvalUnsub) {
    liveEvalUnsub();
    liveEvalUnsub = null;
  }
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
  const classId = getClassIdFromSelected();
  const titleEl = document.getElementById('classroom-live-class-title');
  if (titleEl) titleEl.textContent = `${currentSelectedClass} (세션 ID: ${classId})`;

  if (liveEvalUnsub) {
    liveEvalUnsub();
    liveEvalUnsub = null;
  }

  if (window.evalService) {
    liveEvalUnsub = window.evalService.listenStudents(classId, (students) => {
      const label=document.getElementById('classroom-connection-status');
      if(label) label.textContent=window.evalService.isDemo() ? '로컬 시연 · 운영 DB와 분리됨' : '답안 수신됨 · 연결 상태는 갱신 시 확인';
      currentLiveStudents = students || [];
      renderLiveGrid(currentLiveStudents);
    }, error=>{const label=document.getElementById('classroom-connection-status');if(label)label.textContent='답안 수신 실패 · 연결과 권한 확인 필요';alert(error.message);});
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
        scoreDisplay = `<span class="text-sm font-black text-emerald-700">${finalScore}점</span>`;
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

// 교사용 30분 수행평가 시작 버튼
async function handleTeacherStartExam() {
  const classId = getClassIdFromSelected();
  if (!confirm(`🚀 [${currentSelectedClass}] 30분 실시간 수행평가를 지금 즉시 시작하시겠습니까?\n모든 접속 학생 화면이 즉시 30분 시험장으로 전환됩니다.`)) {
    return;
  }

  if (window.evalService) {
    try { await window.evalService.startSession(classId, 30); } catch(error) { alert(error.message); return; }
    alert(`🎉 [${currentSelectedClass}] 30분 실시간 수행평가가 시작되었습니다!\n타이머가 가동됩니다.`);
  }
}

// 교사용 시험 강제 마감 버튼
async function handleTeacherEndExam() {
  const classId = getClassIdFromSelected();
  if (!confirm(`⚠️ [${currentSelectedClass}] 수행평가를 마감하시겠습니까?\n아직 제출하지 않은 학생의 현재 답안이 최종 마감 처리됩니다.`)) {
    return;
  }

  if (window.evalService) {
    try { await window.evalService.endSession(classId); } catch(error) { alert(error.message); return; }
    alert(`🛑 [${currentSelectedClass}] 수행평가 세션이 마감되었습니다.`);
  }
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

  if (p1El) p1El.textContent = JSON.stringify(s.answers?.part1 || {}, null, 2);
  if (p2El) p2El.textContent = JSON.stringify(s.answers?.part2 || {}, null, 2);
  if (p3El) {
    const graph=s.answers?.part3||{};
    p3El.style.whiteSpace='pre-wrap';
    const plan=graph.plan||{};
    const planText='현재 상태: '+(plan.current||'미작성')+'\n목표 상태: '+(plan.goal||'미작성')+'\n자연어 알고리즘\n'+
      (Array.isArray(plan.steps)?plan.steps:[]).map((step,index)=>(index+1)+'. '+(step?.text||'미작성')).join('\n');
    p3El.textContent=planText+'\n\n순서도\n자동 계산 참고값: '+(s.scores?.part3||0)+' / 40점 (최종 교사 검토 필요)\n'+
      (Array.isArray(graph.blocks)?graph.blocks:[]).filter(Boolean).map(b=>b.id+' ['+b.shape+'] '+b.text).join('\n')+'\n연결\n'+
      (Array.isArray(graph.connections)?graph.connections:[]).filter(Boolean).map(c=>c.from+' ('+c.fromPort+') → '+c.to).join('\n');
  }

  const currentScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
    ? s.scores.teacherOverride
    : (s.scores?.total || 0);

  if (scoreInp) scoreInp.value = currentScore;

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
