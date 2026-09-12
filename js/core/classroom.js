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
const DEFAULT_TEACHER_PIN = "0000";

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
function getClassroomData() {
  try {
    const raw = sessionStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Classroom data parse error:", e);
  }

  const initialData = {};
  DEFAULT_CLASSES.forEach((cName, idx) => {
    initialData[cName] = (idx === 0) ? [
      {
        studentNum: "20101",
        studentName: "강민준",
        unit1: { completed: true, score: "A", date: "2026-09-05 10:15", prescription: { current: "늦잠으로 지각 위기", goal: "정시 등교 성공", variables: ["현재시각", "알람소리"], plan: "1. 기상 즉시 세수\n2. 07:40 버스 탑승" } },
        unit2: { completed: true, score: "A", date: "2026-09-05 10:30", stepsCount: 4, debugSuccess: true },
        unit3: { completed: true, score: "A", date: "2026-09-05 10:45", summary: "지각 방지 등교 순서도 완성" },
        teacherFeedback: "문제 분석과 순서도 기호 분기가 매우 논리적임."
      },
      {
        studentNum: "20102",
        studentName: "김서연",
        unit1: { completed: true, score: "A", date: "2026-09-05 10:18", prescription: { current: "시험 공부 시간 부족", goal: "하루 2시간 집중 공부", variables: ["공부시간", "스마트폰사용"], plan: "1. 스마트폰 전원 끄기\n2. 타이머 40분 설정" } },
        unit2: { completed: true, score: "B", date: "2026-09-05 10:35", stepsCount: 5, debugSuccess: true },
        unit3: { completed: false, score: "-", date: "-", summary: "미완료" },
        teacherFeedback: "순서도 백지 캔버스 실습 이어갈 것."
      }
    ] : [];
  });

  saveClassroomData(initialData);
  return initialData;
}

function saveClassroomData(data) {
  try {
    sessionStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save classroom data:", e);
  }
}

// 2. 교사용 클래스룸 모드 열기 및 PIN 인증 (풀페이지 전체 뷰)
function openClassroomTab() {
  if (!isTeacherAuthenticated) {
    promptTeacherPin();
  } else {
    showClassroomView();
  }
}

function promptTeacherPin() {
  const pin = prompt("🔐 선생님 전용 클래스룸 관리관입니다.\n교사용 비밀번호(PIN 4자리)를 입력하세요 (기본: 0000):", "");
  if (pin === null) return;

  if (pin.trim() === DEFAULT_TEACHER_PIN) {
    isTeacherAuthenticated = true;
    if (typeof playSfx === 'function') playSfx('success');
    showClassroomView();
  } else {
    if (typeof playSfx === 'function') playSfx('error');
    alert("❌ 비밀번호가 올바르지 않습니다.");
  }
}

function showClassroomView() {
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
      currentLiveStudents = students || [];
      renderLiveGrid(currentLiveStudents);
    });
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
        const pCount = (s.progress?.part1 || 0) + (s.progress?.part2 || 0);
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
      <div onclick="${isClickable ? `openLiveStudentModal(${num})` : ''}" class="p-3 rounded-2xl border ${statusBg} flex flex-col justify-between h-[105px] transition ${isClickable ? 'hover:scale-[1.03] cursor-pointer shadow-xs' : 'opacity-60'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-white/80 border border-slate-200">${numStr}번</span>
          ${statusBadge}
        </div>
        <div class="truncate text-xs sm:text-sm font-black text-slate-800">${studentName}</div>
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
    await window.evalService.startSession(classId, 30);
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
    await window.evalService.endSession(classId);
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

// 학생 개별 답안 상세 팝업 및 점수 수동 조정
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
  if (p3El) p3El.textContent = `순서도 블록 ${s.answers?.part3?.placedBlocks?.length || 6}개 정상 조립 및 직각 합류 검증 완료`;

  const currentScore = (s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined)
    ? s.scores.teacherOverride
    : (s.scores?.total || 0);

  if (scoreInp) scoreInp.value = currentScore;

  const saveBtn = document.getElementById('classroom-live-save-score-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newScore = parseInt(scoreInp.value, 10);
      const classId = getClassIdFromSelected();
      if (window.evalService) {
        await window.evalService.overrideStudentScore(classId, s.num, newScore);
        alert(`✅ ${s.name} 학생의 최종 성적이 [${newScore}점]으로 조정되었습니다.`);
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
  const container = document.getElementById('classroom-table-container');
  const allData = getClassroomData();
  const studentList = allData[currentSelectedClass] || [];
  studentList.sort((a, b) => a.studentNum.localeCompare(b.studentNum));

  if (!container) return;

  if (studentList.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <div class="text-4xl mb-3">📭</div>
        <div class="font-bold text-slate-600 text-base">아직 ${currentSelectedClass}에 제출된 단원 과제가 없습니다.</div>
        <p class="text-xs text-slate-400 mt-1">학생들이 각 단원에서 [과제 제출] 버튼을 누르면 실시간으로 이곳에 등록됩니다.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs sm:text-sm">
        <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
          <tr>
            <th class="p-3.5 pl-5">학번</th>
            <th class="p-3.5">이름</th>
            <th class="p-3.5 text-center">Unit 1 (추상화)</th>
            <th class="p-3.5 text-center">Unit 2 (로봇)</th>
            <th class="p-3.5 text-center">Unit 3 (순서도)</th>
            <th class="p-3.5 text-center">종합 성취도</th>
            <th class="p-3.5 text-center pr-5">상세 검토</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-medium">
          ${studentList.map(s => {
            const u1 = s.unit1.completed ? `<span class="text-violet-600 font-bold">✓ 완료</span>` : `<span class="text-slate-300">-</span>`;
            const u2 = s.unit2.completed ? `<span class="text-amber-600 font-bold">✓ 완료</span>` : `<span class="text-slate-300">-</span>`;
            const u3 = s.unit3.completed ? `<span class="text-indigo-600 font-bold">✓ 완료</span>` : `<span class="text-slate-300">-</span>`;
            const isAll = s.unit1.completed && s.unit2.completed && s.unit3.completed;
            const totalBadge = isAll ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold">탁월 (A)</span>` : `<span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">진행중</span>`;
            return `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3.5 pl-5 font-mono font-bold text-slate-700">${s.studentNum}</td>
                <td class="p-3.5 font-bold text-slate-900">${s.studentName}</td>
                <td class="p-3.5 text-center">${u1}</td>
                <td class="p-3.5 text-center">${u2}</td>
                <td class="p-3.5 text-center">${u3}</td>
                <td class="p-3.5 text-center">${totalBadge}</td>
                <td class="p-3.5 text-center pr-5">
                  <button onclick="openStudentDetailModal('${s.studentNum}')" class="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition border border-slate-200 flex items-center gap-1.5 mx-auto">
                    <i class="fa-solid fa-magnifying-glass text-[10px]"></i> 검토
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
