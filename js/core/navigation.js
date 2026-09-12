/**
 * ==============================================================================
 * 🧭 [정보 알고리즘 스튜디오 단원 중심 통합 네비게이션 제어기]
 * ==============================================================================
 * - 단원 전환: [로드맵] | [문제 추상화] | [알고리즘 설계] | [순서도 연구소] | [교사용 🔒]
 * - 3단계 학습 파이프라인: [📖 1. 핵심 개념] ── [📝 2. 쏙쏙 퀴즈] ── [🚀 3. 실전 실습실]
 * - 기존 뷰(view-roadmap, view-concept, view-quiz, view-lab) 1:1 완벽 연동
 * - 중2 정보 교육과정 맞춤: 출판사 종속성 제거 및 용어 순화
 */

let currentActiveUnit = 'roadmap';
let currentUnitSubStep = {
  unit1: 'concept',
  unit2: 'concept',
  unit3: 'concept'
};
const completedUnitSteps = new Set();

const UNIT_META = {
  unit1: {
    key: 'abstraction',
    name: '문제 추상화',
    icon: '💡',
    conceptModule: 1,
    labId: 'abstraction'
  },
  unit2: {
    key: 'algorithm',
    name: '알고리즘 설계',
    icon: '🤖',
    conceptModule: 2,
    labId: 'sandwich'
  },
  unit3: {
    key: 'flowchart',
    name: '순서도 연구소',
    icon: '📐',
    conceptModule: 3,
    labId: 'flowchart'
  }
};

/**
 * 1. 최상단 단원(Unit) 전환 함수
 */
function switchUnit(unitId, targetStep = null) {
  currentActiveUnit = unitId;

  // 1. 상단 글로벌 네비게이션 버튼 활성화 스타일 업데이트
  const navKeys = ['roadmap', 'unit1', 'unit2', 'unit3', 'classroom', 'eval'];
  navKeys.forEach(k => {
    const btn = document.getElementById(`nav-btn-${k}`);
    if (btn) {
      const isActive = (k === unitId);
      if (isActive) {
        btn.className = "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1.5 bg-white text-indigo-600 shadow-xs border border-indigo-100 whitespace-nowrap";
      } else {
        let defaultClass = "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 whitespace-nowrap";
        if (k === 'classroom') {
          defaultClass = "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 whitespace-nowrap";
        } else if (k === 'eval') {
          defaultClass = "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 whitespace-nowrap cursor-pointer shadow-2xs";
        }
        btn.className = defaultClass;
      }
    }
  });

  const viewRoadmap = document.getElementById('view-roadmap');
  const viewConcept = document.getElementById('view-concept');
  const viewQuiz = document.getElementById('view-quiz');
  const viewLab = document.getElementById('view-lab');
  const viewClassroom = document.getElementById('view-classroom');
  const viewEval = document.getElementById('view-eval');

  // 모든 뷰 초기 비활성화 보조 함수
  const hideAllViews = () => {
    if (viewRoadmap) viewRoadmap.classList.add('hidden');
    if (viewConcept) viewConcept.classList.add('hidden');
    if (viewQuiz) viewQuiz.classList.add('hidden');
    if (viewLab) viewLab.classList.add('hidden');
    if (viewClassroom) viewClassroom.classList.add('hidden');
    if (viewEval) viewEval.classList.add('hidden');
  };

  // 2. 로드맵 처리
  if (unitId === 'roadmap') {
    if (typeof disableStudioMode === 'function') disableStudioMode();
    hideAllViews();
    if (viewRoadmap) viewRoadmap.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // 3. 교사용 클래스룸 처리 (풀페이지 뷰)
  if (unitId === 'classroom') {
    if (typeof openClassroomTab === 'function') {
      openClassroomTab();
    }
    return;
  }

  // 4. 학생용 수행평가 처리 (풀페이지 뷰)
  if (unitId === 'eval') {
    if (typeof disableStudioMode === 'function') disableStudioMode();
    hideAllViews();
    if (viewEval) viewEval.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // 3. 단원 (unit1, unit2, unit3) 처리
  const meta = UNIT_META[unitId];
  if (!meta) return;

  // step 결정 (지정되지 않은 경우 이전 상태 또는 'concept' 기본)
  let step = targetStep;
  if (!step) {
    step = currentUnitSubStep[unitId] || 'concept';
  } else if (step === 1 || step === '1') {
    step = 'concept';
  } else if (step === 2 || step === '2') {
    step = 'quiz';
  } else if (step === 3 || step === '3') {
    step = 'lab';
  }

  switchUnitStep(unitId, step);
}

/**
 * 2. 단원 내부 3단계 (개념 ➔ 퀴즈 ➔ 실습) 전환 함수
 */
function switchUnitStep(unitIdOrKey, stepName) {
  // unitId 표준화 ('abstraction' -> 'unit1')
  let unitId = unitIdOrKey;
  if (unitIdOrKey === 'abstraction') unitId = 'unit1';
  else if (unitIdOrKey === 'algorithm') unitId = 'unit2';
  else if (unitIdOrKey === 'flowchart') unitId = 'unit3';

  const meta = UNIT_META[unitId];
  if (!meta) return;

  currentActiveUnit = unitId;
  currentUnitSubStep[unitId] = stepName;

  const viewRoadmap = document.getElementById('view-roadmap');
  const viewConcept = document.getElementById('view-concept');
  const viewQuiz = document.getElementById('view-quiz');
  const viewLab = document.getElementById('view-lab');

  if (viewRoadmap) viewRoadmap.classList.add('hidden');

  // 각 단원별 상단 3단계 헤더 업데이트
  updateAllUnitStepHeaders(unitId, stepName);

  if (stepName === 'concept') {
    if (typeof disableStudioMode === 'function') disableStudioMode();
    if (viewConcept) viewConcept.classList.remove('hidden');
    if (viewQuiz) viewQuiz.classList.add('hidden');
    if (viewLab) viewLab.classList.add('hidden');

    if (typeof selectConceptUnit === 'function') {
      selectConceptUnit(unitId);
    } else if (typeof selectConceptModule === 'function') {
      selectConceptModule(meta.conceptModule);
    }
  } else if (stepName === 'quiz') {
    if (typeof disableStudioMode === 'function') disableStudioMode();
    if (viewConcept) viewConcept.classList.add('hidden');
    if (viewQuiz) viewQuiz.classList.remove('hidden');
    if (viewLab) viewLab.classList.add('hidden');

    // 퀴즈 화면 렌더링
    showQuizForUnit(meta.key);
  } else if (stepName === 'lab') {
    if (viewConcept) viewConcept.classList.add('hidden');
    if (viewQuiz) viewQuiz.classList.add('hidden');
    if (viewLab) viewLab.classList.remove('hidden');

    activateLabContent(meta.labId);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof playSfx === 'function') playSfx('step');
}

/**
 * 3. 퀴즈 화면 렌더링 도우미
 */
function showQuizForUnit(unitKey) {
  const qAbs = document.getElementById('quiz-container-abstraction');
  const qAlgo = document.getElementById('quiz-container-algorithm');
  const qFlow = document.getElementById('quiz-container-flowchart');

  if (qAbs) qAbs.classList.toggle('hidden', unitKey !== 'abstraction');
  if (qAlgo) qAlgo.classList.toggle('hidden', unitKey !== 'algorithm');
  if (qFlow) qFlow.classList.toggle('hidden', unitKey !== 'flowchart');

  if (typeof renderUnitQuiz === 'function') {
    renderUnitQuiz(unitKey);
  }
}

/**
 * 4. 상단 3단계 (개념 ➔ 퀴즈 ➔ 실습) 알약형 헤더 상태 업데이트
 */
function updateAllUnitStepHeaders(activeUnitId, activeStep) {
  const stepKeys = ['concept', 'quiz', 'lab'];
  const units = ['unit1', 'unit2', 'unit3'];
  const meta = UNIT_META[activeUnitId] || UNIT_META.unit1;

  // 1. 개념관 서브 바 헤더 동기화
  const conceptIcon = document.getElementById('concept-header-icon');
  const conceptTitle = document.getElementById('concept-header-title');
  const conceptBadge = document.getElementById('concept-header-badge');
  if (conceptIcon) conceptIcon.textContent = meta.icon;
  if (conceptTitle) conceptTitle.textContent = meta.name;
  if (conceptBadge) conceptBadge.textContent = "1. 핵심 개념";

  // 2. 퀴즈관 서브 바 헤더 동기화
  const quizIcon = document.getElementById('quiz-header-icon');
  const quizTitle = document.getElementById('quiz-header-title');
  const quizBadge = document.getElementById('quiz-header-badge');
  if (quizIcon) quizIcon.textContent = meta.icon;
  if (quizTitle) quizTitle.textContent = meta.name;
  if (quizBadge) quizBadge.textContent = "2. 쏙쏙 퀴즈";

  // 3. 개념관 내부 3단계 버튼 스타일 업데이트
  stepKeys.forEach(s => {
    const btn = document.getElementById(`concept-step-btn-${s}`);
    if (btn) {
      if (s === activeStep) {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-black transition flex items-center gap-1 bg-indigo-600 text-white shadow-xs";
      } else {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-bold transition flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50";
      }
    }
  });

  // 4. 퀴즈관 내부 3단계 버튼 스타일 업데이트
  stepKeys.forEach(s => {
    const btn = document.getElementById(`quiz-step-btn-${s}`);
    if (btn) {
      if (s === activeStep) {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-black transition flex items-center gap-1 bg-indigo-600 text-white shadow-xs";
      } else {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-bold transition flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50";
      }
    }
  });

  // 5. 각 단원 실습실 내부 3단계 알약 버튼 업데이트
  units.forEach(u => {
    stepKeys.forEach(s => {
      const btn = document.getElementById(`unit-step-${u}-${s}`);
      if (!btn) return;

      const isCurrentActive = (u === activeUnitId && s === activeStep);
      if (isCurrentActive) {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-black transition flex items-center gap-1 bg-indigo-600 text-white shadow-xs";
      } else {
        btn.className = "subbar-quick-pill-btn px-2.5 sm:px-3 rounded-md font-bold transition flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50";
      }
    });
  });
}

/**
 * 5. 실습실 내부 콘텐츠 활성화 헬퍼
 */
function activateLabContent(activity) {
  const isAbs = (activity === 'abstraction');
  const isSand = (activity === 'sandwich');
  const isFlow = (activity === 'flowchart');

  const absEl = document.getElementById('lab-abstraction-content');
  const sandEl = document.getElementById('lab-sandwich-content');
  const flowEl = document.getElementById('lab-flowchart-content');

  if (absEl) absEl.classList.toggle('hidden', !isAbs);
  if (sandEl) sandEl.classList.toggle('hidden', !isSand);
  if (flowEl) flowEl.classList.toggle('hidden', !isFlow);

  if (isFlow) {
    if (typeof switchFlowchartStep === 'function') {
      const step = (typeof currentFlowchartStep !== 'undefined' && currentFlowchartStep) ? currentFlowchartStep : 1;
      switchFlowchartStep(step);
    }
  }
}

// 기존 코드 및 URL 해시 호환성 계층
function switchTab(tabId) {
  if (tabId === 'home') switchUnit('roadmap');
  else if (tabId === 'concept') switchUnit('unit1', 'concept');
  else if (tabId === 'lab') switchUnit('unit1', 'lab');
  else switchUnit('roadmap');
}

function switchLabActivity(activity) {
  if (activity === 'abstraction') switchUnit('unit1', 'lab');
  else if (activity === 'sandwich') switchUnit('unit2', 'lab');
  else if (activity === 'flowchart') switchUnit('unit3', 'lab');
}

// 전역 노출
window.switchUnit = switchUnit;
window.switchUnitStep = switchUnitStep;
window.activateLabContent = activateLabContent;
window.switchTab = switchTab;
window.switchLabActivity = switchLabActivity;

/* ==============================================================================
 * 🎮 넥슨 게임 포털 스타일 메가 드롭다운 메뉴 (Mega Menu) 제어기
 * ============================================================================== */
let megaMenuOpenTimer = null;
let megaMenuCloseTimer = null;
let isMegaMenuOpen = false;

function openMegaMenu() {
  cancelMegaMenuClose();
  const dropdown = document.getElementById('mega-menu-dropdown');
  const backdrop = document.getElementById('mega-menu-backdrop');
  const chevron = document.getElementById('mega-chevron');

  if (dropdown) {
    dropdown.classList.remove('mega-menu-hidden');
    dropdown.classList.add('mega-menu-visible');
  }
  if (backdrop) {
    backdrop.classList.remove('backdrop-hidden');
    backdrop.classList.add('backdrop-visible');
  }
  if (chevron) {
    chevron.classList.add('chevron-rotated');
  }
  isMegaMenuOpen = true;
}

function closeMegaMenu() {
  cancelMegaMenuClose();
  const dropdown = document.getElementById('mega-menu-dropdown');
  const backdrop = document.getElementById('mega-menu-backdrop');
  const chevron = document.getElementById('mega-chevron');

  if (dropdown) {
    dropdown.classList.remove('mega-menu-visible');
    dropdown.classList.add('mega-menu-hidden');
  }
  if (backdrop) {
    backdrop.classList.remove('backdrop-visible');
    backdrop.classList.add('backdrop-hidden');
  }
  if (chevron) {
    chevron.classList.remove('chevron-rotated');
  }
  isMegaMenuOpen = false;
}

function toggleMegaMenu() {
  if (isMegaMenuOpen) {
    closeMegaMenu();
  } else {
    openMegaMenu();
  }
}

function scheduleMegaMenuOpen(delay = 1500) {
  cancelMegaMenuClose();
  megaMenuOpenTimer = setTimeout(() => {
    openMegaMenu();
  }, delay);
}

function scheduleMegaMenuClose(delay = 240) {
  cancelMegaMenuClose();
  megaMenuCloseTimer = setTimeout(() => {
    closeMegaMenu();
  }, delay);
}

function cancelMegaMenuClose() {
  if (megaMenuOpenTimer) {
    clearTimeout(megaMenuOpenTimer);
    megaMenuOpenTimer = null;
  }
  if (megaMenuCloseTimer) {
    clearTimeout(megaMenuCloseTimer);
    megaMenuCloseTimer = null;
  }
}

/**
 * 메가 메뉴 내부 링크 다이렉트 네비게이션
 */
function navigateToMega(unitId, step = null, options = {}) {
  closeMegaMenu();

  if (unitId === 'roadmap') {
    switchUnit('roadmap');
    return;
  }
  if (unitId === 'classroom') {
    switchUnit('classroom');
    return;
  }
  if (unitId === 'eval') {
    switchUnit('eval');
    return;
  }

  // 단원 및 스텝 이동
  switchUnit(unitId, step || 'concept');

  // 서브 탭 이동 처리 (추상화 튜토리얼 vs 워크북)
  if (options.subTab && typeof switchAbstractionSubTab === 'function') {
    setTimeout(() => {
      switchAbstractionSubTab(options.subTab);
    }, 60);
  }

  // 순서도 5단계 스텝 이동 처리
  if (options.flowchartStep && typeof switchFlowchartStep === 'function') {
    setTimeout(() => {
      switchFlowchartStep(options.flowchartStep);
    }, 60);
  }
}

// 키보드 ESC 및 외부 클릭 닫기 이벤트 등록
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMegaMenuOpen) {
      closeMegaMenu();
    }
  });

  document.addEventListener('click', (e) => {
    const header = document.getElementById('global-header');
    if (isMegaMenuOpen && header && !header.contains(e.target)) {
      closeMegaMenu();
    }
  });
}

// 전역 노출
window.openMegaMenu = openMegaMenu;
window.closeMegaMenu = closeMegaMenu;
window.toggleMegaMenu = toggleMegaMenu;
window.scheduleMegaMenuOpen = scheduleMegaMenuOpen;
window.scheduleMegaMenuClose = scheduleMegaMenuClose;
window.cancelMegaMenuClose = cancelMegaMenuClose;
window.navigateToMega = navigateToMega;

