/**
 * ==============================================================================
 * 🚀 [앱 초기화 진입점]
 * ==============================================================================
 * 웹페이지 로드가 완료되면 튜토리얼 UI와 순서도 1번 미션을 초기화하고 리사이즈 이벤트를 등록합니다.
 */
window.addEventListener('DOMContentLoaded', () => {
  // 1. 추상화 워크북 튜토리얼 UI 초기화
  if (typeof initTutorialUI === 'function') {
    initTutorialUI();
  }
  
  // 2. 순서도 1번 미션 기본 로드
  if (typeof selectFlowchartMission === 'function') {
    selectFlowchartMission(1);
  }
  
  // 3. 윈도우 크기 변경 시 순서도 SVG 화살표 자동 정렬
  if (typeof updateLoopArrowPosition === 'function') {
    window.addEventListener('resize', updateLoopArrowPosition);
  }

  // 4. URL 해시(#) 직접 이동 지원 (예: #sandwich, #flowchart, #flowchart-l2, #flowchart-l3)
  if (window.location.hash) {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#sandwich') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('sandwich');
    } else if (hash === '#step-1' || hash === '#flowchart' || hash === '#flowchart-l1') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(1);
    } else if (hash === '#step-2') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(2);
    } else if (hash === '#step-3') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(3);
    } else if (hash === '#step-4' || hash === '#flowchart-l2') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(4);
    } else if (hash === '#step-4-all') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(4);
      setTimeout(() => {
        if (typeof revealAllL2Steps === 'function') revealAllL2Steps();
      }, 100);
    } else if (hash === '#step-5' || hash === '#flowchart-l3') {
      if (typeof switchUnit === 'function') switchUnit('unit3', 'lab');
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
    } else if (hash === '#step-5-demo') {
      currentFlowchartStep = 5;
      if (typeof switchUnit === 'function') switchUnit('unit3', 'lab');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
      if (typeof addNlCard === 'function') {
        nlCards = [
          { id: 'nl-1', type: 'seq', text: '자판기 동전 투입구에 1,000원 지폐를 구겨지지 않게 끝까지 밀어 넣는다.' },
          { id: 'nl-2', type: 'sel', condition: '투입한 금액이 원하는 음료수 가격(1,200원) 이상인가?', yesAction: '음료수 버튼에 파란색 불이 켜지며 선택 대기 상태가 된다.', noAction: '금액 부족 알림 램프가 깜빡이며 추가 투입을 기다린다.' },
          { id: 'nl-3', type: 'loop', condition: '음료수 캔이 배출구로 완전히 떨어질 때까지', loopAction: '음료수 배출 모터를 계속 회전시킨다.' }
        ];
        renderNlCards();
      }
      if (typeof renderFreeCanvas === 'function') {
        freeBlocks = [
          { id: 'blk-start', shape: 'terminal', type: 'terminal', text: '시작', x: 240, y: 30 },
          { id: 'blk-1', shape: 'process', type: 'process', text: '동전 및 지폐 투입', x: 240, y: 130 },
          { id: 'blk-2', shape: 'decision', type: 'decision', text: '금액이 충분한가?', x: 240, y: 235 },
          { id: 'blk-3', shape: 'process', type: 'process', text: '음료수 선택 및 배출', x: 240, y: 375 },
          { id: 'blk-4', shape: 'process', type: 'process', text: '금액 부족 안내 및 대기', x: 520, y: 235 },
          { id: 'blk-end', shape: 'terminal', type: 'terminal', text: '종료', x: 240, y: 485 }
        ];
        freeConnections = [
          { from: 'blk-start', fromPort: 'out', to: 'blk-1', toPort: 'in' },
          { from: 'blk-1', fromPort: 'out', to: 'blk-2', toPort: 'in' },
          { from: 'blk-2', fromPort: 'yes', to: 'blk-3', toPort: 'in' },
          { from: 'blk-2', fromPort: 'no', to: 'blk-4', toPort: 'in' },
          { from: 'blk-4', fromPort: 'out', to: 'blk-1', toPort: 'in' },
          { from: 'blk-3', fromPort: 'out', to: 'blk-end', toPort: 'in' }
        ];
        renderFreeCanvas();
      }
    } else if (hash === '#mega-menu') {
      if (typeof openMegaMenu === 'function') openMegaMenu();
    } else if (hash === '#flowchart-step3') {
      if (typeof switchUnit === 'function') switchUnit('unit3', 'lab');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(3);
    } else if (hash === '#prescription') {
      if (typeof switchUnit === 'function') switchUnit('unit3', 'lab');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
      if (typeof openPrescriptionModal === 'function') openPrescriptionModal();
    } else if (hash === '#prescription-custom') {
      if (typeof switchUnit === 'function') switchUnit('unit3', 3);
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
      if (typeof openPrescriptionModal === 'function') {
        openPrescriptionModal();
        if (typeof switchPrescriptionTab === 'function') switchPrescriptionTab('custom');
      }
    } else if (hash === '#prescription-applied') {
      if (typeof switchUnit === 'function') switchUnit('unit3', 3);
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
      if (typeof selectPrescriptionPreset === 'function') selectPrescriptionPreset('weather');
      if (typeof applyPrescriptionDraft === 'function') applyPrescriptionDraft();
    } else if (hash === '#thinker') {
      if (typeof switchTab === 'function') switchTab('lab');
      if (typeof switchLabActivity === 'function') switchLabActivity('flowchart');
      if (typeof switchFlowchartStep === 'function') switchFlowchartStep(5);
      setTimeout(() => {
        if (typeof openThinkerSubmissionModal === 'function') openThinkerSubmissionModal();
      }, 300);
    } else if (hash === '#concept' || hash === '#concept-1') {
      if (typeof switchUnitStep === 'function') switchUnitStep('unit1', 'concept');
      else if (typeof switchTab === 'function') switchTab('concept');
    } else if (hash === '#quiz' || hash === '#quiz-1' || hash === '#quiz-unit1') {
      if (typeof switchUnitStep === 'function') switchUnitStep('unit1', 'quiz');
    } else if (hash === '#quiz-2' || hash === '#quiz-unit2') {
      if (typeof switchUnitStep === 'function') switchUnitStep('unit2', 'quiz');
    } else if (hash === '#quiz-3' || hash === '#quiz-unit3') {
      if (typeof switchUnitStep === 'function') switchUnitStep('unit3', 'quiz');
    } else if (hash === '#abstraction' || hash === '#abstraction-tut') {
      if (typeof switchUnitStep === 'function') switchUnitStep('unit1', 'lab');
      else {
        if (typeof switchTab === 'function') switchTab('lab');
        if (typeof switchLabActivity === 'function') switchLabActivity('abstraction');
      }
      if (typeof switchAbstractionSubTab === 'function') switchAbstractionSubTab('tutorial');
      if (hash === '#abstraction-tut' && typeof applyTutStep1 === 'function') {
        applyTutStep1('스토리는 올리면서 카톡 3시간째 안읽음', '부담 없이 답장 받고 자연스럽게 대화 이어감');
      }
    }
  }
});
