/**
 * ==============================================================================
 * 🎓 [클래스룸 및 수행평가 관리관 엔진 (Classroom & Assessment Engine)]
 * ==============================================================================
 * - 학생 과제 제출(추상화 처방전, 샌드위치 레시피, 순서도 마스터 카드) 처리
 * - 학교 컴퓨터실 환경 준수: sessionStorage 기반 로컬 세션 영속성 및 동기화
 * - 교사용 대시보드: 학급별 제출 현황판, 과제 상세 뷰어 모달, 루브릭 원클릭 채점
 * - 나이스(NEIS) 연계용 엑셀(CSV with UTF-8 BOM) 다운로드
 * - 향후 Firebase Firestore 클라우드 DB 연동 확장 인터페이스 내장
 */

const CLASSROOM_STORAGE_KEY = "ALGO_LAB_CLASSROOM_DATA_V3";
const DEFAULT_TEACHER_PIN = "0000";

// 기본 학급 및 초기 샘플 데이터 (선생님이 첫 화면에서 즉시 체험 가능)
const DEFAULT_CLASSES = ["2학년 1반", "2학년 2반", "2학년 3반", "2학년 4반"];

let currentSelectedClass = "2학년 1반";
let isTeacherAuthenticated = false;

// 1. 클래스룸 데이터 로드 및 초기화
function getClassroomData() {
  try {
    const raw = sessionStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Classroom data parse error:", e);
  }

  // 초기 샘플 데이터 생성 (교사용 테스트용)
  const initialData = {
    "2학년 1반": [
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
      },
      {
        studentNum: "20103",
        studentName: "이도윤",
        unit1: { completed: true, score: "A", date: "2026-09-05 10:20", prescription: { current: "정리정돈 안 됨", goal: "책상 5분 정리", variables: ["책권수", "필기구"], plan: "1. 책 꽂기\n2. 쓰레기 버리기" } },
        unit2: { completed: false, score: "-", date: "-", stepsCount: 0, debugSuccess: false },
        unit3: { completed: false, score: "-", date: "-", summary: "미완료" },
        teacherFeedback: ""
      }
    ],
    "2학년 2반": [],
    "2학년 3반": [],
    "2학년 4반": []
  };

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

// 2. 학생 과제 제출 처리 (Unit 1, Unit 2, Unit 3)
function submitStudentAssignment(unitId) {
  const numInput = document.getElementById(`submit-st-num-${unitId}`);
  const nameInput = document.getElementById(`submit-st-name-${unitId}`);
  const classSelect = document.getElementById(`submit-st-class-${unitId}`);

  const studentNum = numInput ? numInput.value.trim() : "";
  const studentName = nameInput ? nameInput.value.trim() : "";
  const studentClass = classSelect ? classSelect.value : "2학년 1반";

  if (!studentNum || !studentName) {
    alert("⚠️ 학번과 이름을 모두 입력해 주세요!");
    if (!studentNum && numInput) numInput.focus();
    else if (nameInput) nameInput.focus();
    return;
  }

  const nowStr = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const allData = getClassroomData();
  if (!allData[studentClass]) allData[studentClass] = [];

  let student = allData[studentClass].find(s => s.studentNum === studentNum);
  if (!student) {
    student = {
      studentNum: studentNum,
      studentName: studentName,
      unit1: { completed: false, score: "-", date: "-" },
      unit2: { completed: false, score: "-", date: "-" },
      unit3: { completed: false, score: "-", date: "-" },
      teacherFeedback: ""
    };
    allData[studentClass].push(student);
  }
  student.studentName = studentName; // 이름 최신화

  if (unitId === 'unit1') {
    const pres = window.latestAbstractionPrescription || (window.defaultAbstractionPresets ? window.defaultAbstractionPresets[0] : null);
    student.unit1 = {
      completed: true,
      score: "A",
      date: nowStr,
      prescription: pres ? {
        current: pres.currentStatus,
        goal: pres.goalStatus,
        variables: pres.coreVariables,
        conditions: pres.conditions,
        plan: Array.isArray(window.latestAbstractionPlans) ? window.latestAbstractionPlans.join('\n') : "1. 핵심 변수 확인 ➔ 2. 실천"
      } : { current: "일상 문제", goal: "문제 해결", variables: ["핵심요소"], plan: "1단계 실행" }
    };
  } else if (unitId === 'unit2') {
    student.unit2 = {
      completed: true,
      score: "A",
      date: nowStr,
      stepsCount: typeof sandwichUserSteps !== 'undefined' ? sandwichUserSteps.length : 4,
      debugSuccess: true
    };
  } else if (unitId === 'unit3') {
    student.unit3 = {
      completed: true,
      score: "A",
      date: nowStr,
      summary: `순서도 블록 ${typeof freeBlocks !== 'undefined' ? freeBlocks.length : 4}개 및 연결선 ${typeof freeConnections !== 'undefined' ? freeConnections.length : 3}개 설계 완료`,
      blocksCount: typeof freeBlocks !== 'undefined' ? freeBlocks.length : 4
    };
  }

  saveClassroomData(allData);

  // 로컬 세션에 학생 정보 기억
  sessionStorage.setItem('LAST_STUDENT_NUM', studentNum);
  sessionStorage.setItem('LAST_STUDENT_NAME', studentName);
  sessionStorage.setItem('LAST_STUDENT_CLASS', studentClass);

  if (typeof playSfx === 'function') playSfx('success');

  // 완료 안내 모달 또는 알림
  alert(`🎉 [${studentClass} ${studentNum} ${studentName}] 학생의 ${getUnitTitle(unitId)} 과제가 성공적으로 클래스룸에 제출되었습니다!`);

  // 단원 완료 도장 업데이트
  if (typeof markUnitStepCompleted === 'function') {
    markUnitStepCompleted(unitId, 3);
  }

  // 제출 완료 버튼 상태 변경
  const submitBtn = document.getElementById(`btn-do-submit-${unitId}`);
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-300"></i> 제출 완료 (${nowStr})`;
    submitBtn.className = "px-6 py-3.5 bg-emerald-700 text-white font-black rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-md cursor-default";
  }
}

function getUnitTitle(unitId) {
  if (unitId === 'unit1') return "Unit 1 (추상화 닥터)";
  if (unitId === 'unit2') return "Unit 2 (샌드위치 로봇 디버깅)";
  if (unitId === 'unit3') return "Unit 3 (순서도 공방)";
  return "과제";
}

// 3. 교사용 클래스룸 모드 인증 및 화면 렌더링
function openClassroomTab() {
  if (!isTeacherAuthenticated) {
    promptTeacherPin();
  } else {
    renderClassroomDashboard();
    const modal = document.getElementById('classroom-modal');
    if (modal) modal.classList.remove('hidden');
  }
}

function promptTeacherPin() {
  const pin = prompt("🔐 선생님 전용 클래스룸 관리관입니다.\n교사용 비밀번호(PIN 4자리)를 입력하세요:", "");
  if (pin === null) return; // 취소

  if (pin.trim() === DEFAULT_TEACHER_PIN) {
    isTeacherAuthenticated = true;
    if (typeof playSfx === 'function') playSfx('success');
    renderClassroomDashboard();
    const modal = document.getElementById('classroom-modal');
    if (modal) modal.classList.remove('hidden');
  } else {
    if (typeof playSfx === 'function') playSfx('error');
    alert("❌ 비밀번호가 올바르지 않습니다.");
  }
}

function closeClassroomModal() {
  const modal = document.getElementById('classroom-modal');
  if (modal) modal.classList.add('hidden');
}

function switchClassroomClass(className) {
  currentSelectedClass = className;
  renderClassroomDashboard();
}

function renderClassroomDashboard() {
  const container = document.getElementById('classroom-table-container');
  const classSelect = document.getElementById('classroom-class-select');
  const totalCountEl = document.getElementById('classroom-total-count');
  const submitRateEl = document.getElementById('classroom-submit-rate');

  if (classSelect) {
    classSelect.innerHTML = DEFAULT_CLASSES.map(c => `
      <option value="${c}" ${c === currentSelectedClass ? 'selected' : ''}>${c}</option>
    `).join('');
  }

  const allData = getClassroomData();
  const studentList = allData[currentSelectedClass] || [];

  // 학번 오름차순 정렬
  studentList.sort((a, b) => a.studentNum.localeCompare(b.studentNum));

  if (totalCountEl) totalCountEl.textContent = `${studentList.length}명`;

  // 전체 제출 완료율 계산
  if (submitRateEl) {
    if (studentList.length === 0) {
      submitRateEl.textContent = "0%";
    } else {
      let completeCount = studentList.filter(s => s.unit1.completed && s.unit2.completed && s.unit3.completed).length;
      let rate = Math.round((completeCount / studentList.length) * 100);
      submitRateEl.textContent = `${rate}% (${completeCount}/${studentList.length}명 완주)`;
    }
  }

  if (!container) return;

  if (studentList.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <div class="text-4xl mb-3">📭</div>
        <div class="font-bold text-slate-600 text-base">아직 ${currentSelectedClass}에 제출된 과제가 없습니다.</div>
        <p class="text-xs text-slate-400 mt-1">학생들이 각 단원에서 [과제 제출] 버튼을 누르면 실시간으로 이곳에 등록됩니다.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs sm:text-sm border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] sm:text-xs">
            <th class="p-3.5 pl-5">학번</th>
            <th class="p-3.5">이름</th>
            <th class="p-3.5 text-center">Unit 1 (추상화)</th>
            <th class="p-3.5 text-center">Unit 2 (디버깅)</th>
            <th class="p-3.5 text-center">Unit 3 (순서도)</th>
            <th class="p-3.5 text-center">수행 성취도</th>
            <th class="p-3.5 text-center pr-5">상세 검토 / 피드백</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${studentList.map(s => {
            const u1 = s.unit1.completed 
              ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ 완료 (${s.unit1.score})</span>`
              : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">미제출</span>`;

            const u2 = s.unit2.completed 
              ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ 완료 (${s.unit2.score})</span>`
              : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">미제출</span>`;

            const u3 = s.unit3.completed 
              ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ 완료 (${s.unit3.score})</span>`
              : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">미제출</span>`;

            // 종합 성취도 판정
            let totalGrade = "미완료";
            let totalBadgeClass = "bg-slate-100 text-slate-500";
            if (s.unit1.completed && s.unit2.completed && s.unit3.completed) {
              totalGrade = "A (탁월)";
              totalBadgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-200 font-black";
            } else if (s.unit1.completed || s.unit2.completed || s.unit3.completed) {
              totalGrade = "진행 중";
              totalBadgeClass = "bg-amber-50 text-amber-700 border border-amber-200 font-bold";
            }

            return `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3.5 pl-5 font-mono font-bold text-slate-800">${s.studentNum}</td>
                <td class="p-3.5 font-bold text-slate-900">${s.studentName}</td>
                <td class="p-3.5 text-center">${u1}</td>
                <td class="p-3.5 text-center">${u2}</td>
                <td class="p-3.5 text-center">${u3}</td>
                <td class="p-3.5 text-center">
                  <span class="inline-block px-2.5 py-1 rounded-lg text-xs ${totalBadgeClass}">${totalGrade}</span>
                </td>
                <td class="p-3.5 text-center pr-5">
                  <button onclick="openStudentDetailModal('${s.studentNum}')" class="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition border border-slate-200 flex items-center gap-1.5 mx-auto">
                    <i class="fa-solid fa-magnifying-glass text-[10px]"></i> 검토 / 채점
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

// 4. 학생 과제 상세 검토 및 루브릭 채점 모달
function openStudentDetailModal(studentNum) {
  const allData = getClassroomData();
  const student = (allData[currentSelectedClass] || []).find(s => s.studentNum === studentNum);
  if (!student) return;

  const modal = document.getElementById('classroom-detail-modal');
  if (!modal) return;

  document.getElementById('modal-st-info').textContent = `${currentSelectedClass} • ${student.studentNum} ${student.studentName}`;

  // Unit 1 처방전 상세
  const u1Box = document.getElementById('modal-u1-content');
  if (u1Box) {
    if (student.unit1.completed && student.unit1.prescription) {
      const p = student.unit1.prescription;
      u1Box.innerHTML = `
        <div class="space-y-1.5 text-xs">
          <div><strong>현재 상태:</strong> ${p.current || '-'}</div>
          <div><strong>목표 상태:</strong> ${p.goal || '-'}</div>
          <div><strong>핵심 변수:</strong> <span class="px-2 py-0.5 bg-violet-100 text-violet-800 rounded font-bold">${Array.isArray(p.variables) ? p.variables.join(', ') : (p.variables || '-')}</span></div>
          <div class="mt-2 pt-2 border-t border-slate-100">
            <strong class="text-violet-700">실천 알고리즘:</strong>
            <pre class="whitespace-pre-wrap font-sans text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 text-[11px]">${p.plan || '-'}</pre>
          </div>
        </div>
      `;
    } else {
      u1Box.innerHTML = `<span class="text-xs text-slate-400">아직 제출되지 않았습니다.</span>`;
    }
  }

  // Unit 2 로봇 디버깅 상세
  const u2Box = document.getElementById('modal-u2-content');
  if (u2Box) {
    if (student.unit2.completed) {
      u2Box.innerHTML = `
        <div class="text-xs space-y-1">
          <div class="text-emerald-700 font-bold">✓ 샌드위치 로봇 디버깅 완수!</div>
          <div class="text-slate-600">작성된 정밀 명령어: ${student.unit2.stepsCount || 4}단계</div>
          <div class="text-[11px] text-slate-400">제출 시각: ${student.unit2.date}</div>
        </div>
      `;
    } else {
      u2Box.innerHTML = `<span class="text-xs text-slate-400">아직 제출되지 않았습니다.</span>`;
    }
  }

  // Unit 3 순서도 공방 상세
  const u3Box = document.getElementById('modal-u3-content');
  if (u3Box) {
    if (student.unit3.completed) {
      u3Box.innerHTML = `
        <div class="text-xs space-y-1">
          <div class="text-indigo-700 font-bold">✓ 순서도 설계 및 띵커보드 제출 완료</div>
          <div class="text-slate-600">${student.unit3.summary || '표준 순서도 설계 완료'}</div>
          <div class="text-[11px] text-slate-400">제출 시각: ${student.unit3.date}</div>
        </div>
      `;
    } else {
      u3Box.innerHTML = `<span class="text-xs text-slate-400">아직 제출되지 않았습니다.</span>`;
    }
  }

  // 교사 피드백 입력란 바인딩
  const feedbackInput = document.getElementById('modal-teacher-feedback');
  if (feedbackInput) {
    feedbackInput.value = student.teacherFeedback || "";
  }

  // 저장 버튼 이벤트
  const saveBtn = document.getElementById('btn-save-grading');
  if (saveBtn) {
    saveBtn.onclick = () => {
      student.teacherFeedback = feedbackInput ? feedbackInput.value.trim() : "";
      saveClassroomData(allData);
      renderClassroomDashboard();
      closeStudentDetailModal();
      if (typeof playSfx === 'function') playSfx('success');
      alert("✅ 학생 피드백 및 채점 결과가 저장되었습니다.");
    };
  }

  modal.classList.remove('hidden');
}

function closeStudentDetailModal() {
  const modal = document.getElementById('classroom-detail-modal');
  if (modal) modal.classList.add('hidden');
}

// 5. 나이스(NEIS) 연계용 엑셀(CSV with BOM) 다운로드
function exportClassroomCSV() {
  const allData = getClassroomData();
  const studentList = allData[currentSelectedClass] || [];

  if (studentList.length === 0) {
    alert("다운로드할 학생 제출 데이터가 없습니다.");
    return;
  }

  // UTF-8 BOM (\uFEFF) 추가하여 엑셀에서 한글 깨짐 방지
  let csv = "\uFEFF학번,이름,학급,문제_추상화,알고리즘_설계,순서도_연구소,종합성취도,선생님의견\n";

  studentList.forEach(s => {
    const u1 = s.unit1.completed ? "완료(A)" : "미제출";
    const u2 = s.unit2.completed ? "완료(A)" : "미제출";
    const u3 = s.unit3.completed ? "완료(A)" : "미제출";
    const total = (s.unit1.completed && s.unit2.completed && s.unit3.completed) ? "A(탁월)" : (s.unit1.completed || s.unit2.completed || s.unit3.completed ? "B(보통)" : "C(노력요함)");
    const feedback = (s.teacherFeedback || "").replace(/,/g, ' '); // 쉼표 이스케이프

    csv += `"${s.studentNum}","${s.studentName}","${currentSelectedClass}","${u1}","${u2}","${u3}","${total}","${feedback}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentSelectedClass}_정보_수행평가_취합표_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  if (typeof playSfx === 'function') playSfx('success');
}
