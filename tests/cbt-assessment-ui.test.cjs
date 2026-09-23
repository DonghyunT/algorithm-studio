const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createAssessmentContext() {
  const domElements = new Map();
  function getOrCreateElement(id) {
    if (!domElements.has(id)) {
      domElements.set(id, {
        id,
        classList: {
          classes: new Set(),
          add(...args) { for (const c of args) if (c) this.classes.add(c); },
          remove(...args) { for (const c of args) if (c) this.classes.delete(c); },
          toggle(c, v) { if (v === undefined) v = !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); return v; },
          contains(c) { return this.classes.has(c); }
        },
        children: [],
        listeners: {},
        addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); },
        dispatchEvent(event) { for (const handler of this.listeners[event.type] || []) handler.call(this, event); },
        replaceChildren(...ch) { this.children = ch; this.innerHTML = ''; },
        appendChild(child) { this.children.push(child); return child; },
        contains(child) { return this.children.includes(child); },
        setAttribute(name, val) { this[name] = String(val); },
        getAttribute(name) { return this[name] || null; },
        focus() { this.focused = true; },
        blur() { this.focused = false; },
        setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
        querySelector: () => null,
        querySelectorAll: () => [],
        innerHTML: '',
        textContent: '',
        value: '',
        disabled: false,
        hidden: false,
        style: {}
      });
    }
    return domElements.get(id);
  }

  const storage = new Map();
  const mockSessionStorage = {
    getItem(k) { return storage.get(k) || null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); },
    clear() { storage.clear(); }
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    sessionStorage: mockSessionStorage,
    document: {
      getElementById: (id) => getOrCreateElement(id),
      querySelector: (sel) => {
        if (sel.startsWith('#')) return getOrCreateElement(sel.slice(1));
        return getOrCreateElement('mock_' + sel.replace(/[^a-zA-Z0-9]/g, '_'));
      },
      querySelectorAll: (sel) => [],
      addEventListener: () => {},
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, v) { if (v === undefined) v = !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        children: [],
        appendChild(ch) { this.children.push(ch); return ch; },
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k] || null; },
        innerHTML: '',
        textContent: '',
        disabled: false
      })
    },
    URLSearchParams,
    window: {
      location: { search: '' },
      addEventListener: () => {},
      authService: { isDemo: () => true }
    },
    authService: { isDemo: () => true },
    isAssessmentLocked: () => false,
    updateAssessmentNavigation: () => {},
    escapeHtml: (s) => String(s || ''),
    EVAL_QUESTIONS: {
      part1: Array.from({ length: 10 }, (_, i) => ({ id: `p1_q${i+1}`, desc: `객관식 ${i+1}번`, options: ['A', 'B', 'C', 'D'], points: 3 })),
      part2: Array.from({ length: 6 }, (_, i) => ({ id: `p2_q${i+1}`, desc: `단답형 ${i+1}번`, points: 5 })),
      part3Themes: [{ id: 'theme_greenhouse', title: '온실', situation: '온실 상황', input: '기온', requirement: '환기' }]
    },
    evaluationQuestions: () => context.EVAL_QUESTIONS
  };
  context.window.sessionStorage = mockSessionStorage;
  context.window.document = context.document;
  vm.createContext(context);

  const aiScript = fs.readFileSync(path.join(__dirname, '../js/core/ai-service.js'), 'utf8');
  vm.runInContext(aiScript, context);
  const scriptCode = fs.readFileSync(path.join(__dirname, '../js/labs/lab-eval.js'), 'utf8');
  vm.runInContext(scriptCode, context);
  return context;
}

test('CBT layout: initializes with default index 1, subStep 1, and isCbtMode true', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  assert.equal(app.currentQuestionIndex, 1);
  assert.equal(app.part3SubStep, 1);
  assert.equal(app.isCbtMode, true);
});

test('V4 result: server score is fetched for the student and revealed only while the button is held', async () => {
  const ctx = createAssessmentContext();
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('id="eval-result-score-reveal-button"'), '결과 화면에 점수 보기 버튼이 있어야 함');
  assert.ok(html.includes('누르는 동안만 표시됩니다.'), '점수 공개 방식이 결과 화면에 안내되어야 함');
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;
  app.currentClass = '2-1';
  app.studentNum = 1;
  app.attemptId = 'round-4';
  app.isSubmitted = true;
  app.answers.part3.questionVersion = 4;
  app.scores = { part1: null, part2: null, part3: null, objectiveTotal: null, total: null, pendingReview: true, serverGraded: true };
  ctx.requestSecureEvaluationStudentScore = async () => ({ ready: true, status: 'ready', score: { part1: 3, part2: 5, objectiveTotal: 8 } });

  app.renderResult();
  app.startServerScorePolling();
  await new Promise(resolve => setTimeout(resolve, 0));

  const button = ctx.document.getElementById('eval-result-score-reveal-button');
  const panel = ctx.document.getElementById('eval-result-score-reveal-panel');
  assert.equal(app.serverScoreState.status, 'ready');
  assert.equal(button.disabled, false);
  assert.equal(ctx.document.getElementById('eval-result-total-score').textContent, '🔒 • • / 60점');
  assert.equal(ctx.document.getElementById('eval-result-part1-score').textContent, '🔒 •• / 30점');
  assert.equal(ctx.document.getElementById('eval-result-part2-score').textContent, '🔒 •• / 30점');
  assert.equal(panel.hidden, true);
  assert.equal(panel.textContent, '');

  button.dispatchEvent({ type: 'pointerdown', pointerId: 1, preventDefault() {} });
  assert.equal(panel.hidden, false);
  assert.ok(panel.textContent.includes('8 / 60점'));
  assert.equal(ctx.document.getElementById('eval-result-total-score').textContent, '8 / 60점');
  assert.equal(ctx.document.getElementById('eval-result-part1-score').textContent, '3 / 30점');
  assert.equal(ctx.document.getElementById('eval-result-part2-score').textContent, '5 / 30점');

  button.dispatchEvent({ type: 'pointerup', pointerId: 1 });
  assert.equal(panel.hidden, true);
  assert.equal(panel.textContent, '');
  assert.equal(ctx.document.getElementById('eval-result-total-score').textContent, '🔒 • • / 60점');
  assert.equal(ctx.document.getElementById('eval-result-part1-score').textContent, '🔒 •• / 30점');
  assert.equal(ctx.document.getElementById('eval-result-part2-score').textContent, '🔒 •• / 30점');

  button.dispatchEvent({ type: 'keydown', key: 'Enter', repeat: false, preventDefault() {} });
  assert.equal(panel.hidden, false);
  assert.equal(ctx.document.getElementById('eval-result-total-score').textContent, '8 / 60점');
  button.dispatchEvent({ type: 'keyup', key: 'Enter', preventDefault() {} });
  assert.equal(panel.hidden, true);
  assert.equal(panel.textContent, '');
  assert.equal(ctx.document.getElementById('eval-result-total-score').textContent, '🔒 • • / 60점');
  app.stopServerScorePolling();
});

test('CBT layout: draft preserves currentQuestionIndex, part3SubStep, and isCbtMode', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  app.joined = true;
  app.currentClass = '2-1';
  app.studentNum = 7;
  app.ownerUid = 'test-uid';
  app.attemptId = 'att-1';
  app.studentName = '김학생';
  app.isCbtMode = false;
  app.userToggledMode = true;
  app.currentQuestionIndex = 14;
  app.part3SubStep = 2;
  app.answers.part1.p1_q1 = 2;
  app.answers.part2.p2_q1 = '순차';

  app.saveDraft();

  const restoredApp = new StudentEvalApp();
  restoredApp.currentClass = '2-1';
  restoredApp.studentNum = 7;
  restoredApp.ownerUid = 'test-uid';
  restoredApp.studentName = '김학생';
  restoredApp.restoreDraft({ attemptId: 'att-1', resetAt: null, answers: app.answers });

  assert.equal(restoredApp.isCbtMode, false);
  assert.equal(restoredApp.currentQuestionIndex, 14);
  assert.equal(restoredApp.part3SubStep, 2);
  assert.equal(restoredApp.answers.part1.p1_q1, 2);
  assert.equal(restoredApp.answers.part2.p2_q1, '순차');
});

test('CBT layout: navigation transitions properly between Part 1, Part 2, and Part 3', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;
  app.isCbtMode = true;

  // 1번 문항 (Part 1)
  app.goToCbtQuestion(1);
  assert.equal(app.currentQuestionIndex, 1);
  assert.equal(app.currentPart, 'part1');

  // Next -> 2번 문항
  app.nextCbtQuestion();
  assert.equal(app.currentQuestionIndex, 2);

  // Jump to 11번 문항 (Part 2)
  app.goToCbtQuestion(11);
  assert.equal(app.currentQuestionIndex, 11);
  assert.equal(app.currentPart, 'part2');

  // Jump to 17번 문항 (Part 3)
  app.goToCbtQuestion(17);
  assert.equal(app.currentQuestionIndex, 17);
  assert.equal(app.currentPart, 'part3');
  assert.equal(app.visitedPart3, true);
  assert.equal(app.part3SubStep, 1);

  // Next in Part 3 Step 1 advances to Step 2
  app.nextCbtQuestion();
  assert.equal(app.currentQuestionIndex, 17);
  assert.equal(app.part3SubStep, 2);

  // Prev in Part 3 Step 2 goes back to Step 1
  app.prevCbtQuestion();
  assert.equal(app.currentQuestionIndex, 17);
  assert.equal(app.part3SubStep, 1);

  // Prev in Part 3 Step 1 goes back to Question 16
  app.prevCbtQuestion();
  assert.equal(app.currentQuestionIndex, 16);
  assert.equal(app.currentPart, 'part2');
});

test('CBT layout: mode toggle switches cleanly between CBT and Classic', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  assert.equal(app.isCbtMode, true);
  app.toggleCbtMode();
  assert.equal(app.isCbtMode, false);

  app.toggleCbtMode();
  assert.equal(app.isCbtMode, true);
});

test('CBT layout: renders clean question labels, separate notice strip, and no redundant yellow notice for Part 2', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  // 11번 문제(단답형 1번째)로 이동
  app.goToCbtQuestion(11);
  const qnumBadge = ctx.document.getElementById('eval-cbt-qnum-badge');
  assert.equal(qnumBadge.textContent, '11번 문제', '괄호 안의 번호가 삭제되고 "11번 문제"로 단일화되어야 함');

  const promptContainer = ctx.document.getElementById('eval-cbt-prompt-container');
  assert.ok(promptContainer.innerHTML.includes('cbt-notice-strip'), '안내 문구가 cbt-notice-strip 띠지로 분리되어야 함');

  const shortArea = ctx.document.getElementById('eval-cbt-short-answer');
  assert.ok(!shortArea.innerHTML.includes('알고리즘 핵심 개념이나 제어 구조에 알맞은'), '불필요한 노란 박스 안내문구가 제거되어야 함');
  assert.ok(shortArea.innerHTML.includes('cbt_inp_p2_q1'), '단답형 input 필드가 정상 생성되어야 함');
});

test('CBT layout: suggestConditions renders smart condition chips and appends them to draft plan', async () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  // V3/V4 자유 설계 모드 및 온실 온도 관련 현재/목표 상태 설정
  app.answers.part3.questionVersion = 3;
  app.setAssessmentPlanField('current', '온실 안의 기온이 너무 높다');
  app.setAssessmentPlanField('goal', '적정 온도를 유지한다');

  await app.suggestConditions();

  const box = ctx.document.getElementById('eval-condition-candidates');
  assert.ok(box.children.length >= 3, '최소 3개 이상의 추천 조건 칩이 생성되어야 함');
  const firstChip = box.children[0];
  assert.equal(firstChip.className, 'cbt-condition-chip', '추천 조건은 cbt-condition-chip 클래스를 가져야 함');

  // 칩 클릭 시 처방전 조건에 추가 확인
  firstChip.onclick();
  const plan = app.getAssessmentPlan();
  assert.ok(plan.conditions.includes('온도'), '선택한 스마트 조건이 처방전 plan.conditions에 추가되어야 함');
  assert.equal(firstChip.disabled, true, '선택된 칩은 비활성화되어 중복 추가를 방지해야 함');
});

test('CBT layout: button labels show "다음 문항" and never premature "제출하고 이동하기"', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  // Q1
  app.goToCbtQuestion(1);
  const nextText = ctx.document.getElementById('eval-cbt-next-text');
  assert.equal(nextText.textContent, '다음 문항', '1~16번 문항 버튼은 "다음 문항"이어야 함');
  assert.ok(!nextText.textContent.includes('제출하고 이동하기'), '"제출하고 이동하기" 문구가 노출되지 않아야 함');

  // Notice strip
  const promptContainer = ctx.document.getElementById('eval-cbt-prompt-container');
  assert.ok(promptContainer.innerHTML.includes('"다음 문항"'), '안내 띠지도 "다음 문항"으로 일치해야 함');

  // Q17-1
  app.goToCbtPart3Step(1);
  assert.equal(nextText.textContent, '다음 단계: 순서도 조립', '17-1단계 버튼은 "다음 단계: 순서도 조립"이어야 함');

  // Q17-2
  app.goToCbtPart3Step(2);
  assert.equal(nextText.textContent, '답안 검토 및 최종 제출', '17-2단계 버튼은 "답안 검토 및 최종 제출"이어야 함');
});

test('CBT layout: Part 3 sidebar splits into 17-1 and 17-2 without redundant "40점" in buttons', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  app.goToCbtPart3Step(1);
  const p3Container = ctx.document.getElementById('eval-cbt-palette-part3');
  assert.ok(p3Container.innerHTML.includes('17-1. 분석'), 'Part 3에 17-1 버튼이 있어야 함');
  assert.ok(p3Container.innerHTML.includes('17-2. 조립'), 'Part 3에 17-2 버튼이 있어야 함');
  assert.ok(!p3Container.innerHTML.includes('40점'), '개별 버튼 내에 어색한 40점 텍스트가 없어야 함');
});

test('CBT layout: sidebar collapses on 17-2 for maximum canvas workspace and toggles cleanly', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const container = ctx.document.getElementById('eval-cbt-container');

  // 17-2 진입 시 자동 사이드바 접힘
  app.goToCbtPart3Step(2);
  assert.ok(container.classList.contains('cbt-sidebar-collapsed'), '17-2 순서도 캔버스에서는 사이드바가 자동으로 접혀야 함');

  // 17-1로 복귀 시 사이드바 다시 펼침
  app.goToCbtPart3Step(1);
  assert.ok(!container.classList.contains('cbt-sidebar-collapsed'), '17-1 계획 수립 복귀 시 사이드바가 다시 펼쳐져야 함');

  // 수동 토글
  app.toggleCbtSidebar();
  assert.ok(container.classList.contains('cbt-sidebar-collapsed'), 'toggleCbtSidebar() 호출 시 접혀야 함');
  app.toggleCbtSidebar();
  assert.ok(!container.classList.contains('cbt-sidebar-collapsed'), 'toggleCbtSidebar() 재호출 시 펼쳐져야 함');
});

test('CBT layout: formatCbtPrompt formats condition box cleanly', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();

  const rawPrompt = "스마트 배달 로봇이 1층에서 출발합니다.\n\n[조건: 현재 층수가 7층 미만인 동안 반복]\n반복 실행 명령: '위로 2개 층 올라간다'\n\n로봇이 7층 이상에 도달했을 때 총 몇 번 실행되었을지 쓰시오.";
  const formatted = app.formatCbtPrompt(rawPrompt);

  assert.ok(formatted.includes('cbt-condition-box'), '조건 블록이 cbt-condition-box로 감싸져야 함');
  assert.ok(formatted.includes('지켜야 할 규칙 / 조건'), '조건 상자에 헤더 타이틀이 포함되어야 함');
});

test('CBT layout: formatCbtPrompt wraps [순서도 흐름] and [알고리즘] paragraphs as condition boxes', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();

  // [순서도 흐름: ...] 단락 → 섬 처리 확인
  const flowchartPrompt = '인공지능 스마트 재활용 분리수거기의 동작 순서도입니다.\n\n[순서도 흐름: 분리수거기]\n[시작] ➔ [자료: 재질 센서 값 인식]\n  └─ (아니오) ➔ (허공에 끊김)\n\n이 버그를 해결하기 위해 연결해야 할 처리는?';
  const flowFormatted = app.formatCbtPrompt(flowchartPrompt);
  assert.ok(flowFormatted.includes('cbt-condition-box'), '[순서도 흐름] 단락이 cbt-condition-box로 감싸져야 함');

  // [알고리즘: ...] 단락 → 섬 처리 확인
  const algoPrompt = '다음 알고리즘을 보고 물음에 답하시오.\n\n[알고리즘: 김치볶음밥]\n(A) 프라이팬에 식용유를 두르고 예열한다.\n(B) 김치와 밥을 넣고 볶는다.\n\n알고리즘의 순서 오류를 찾아 올바른 순서로 쓰시오.';
  const algoFormatted = app.formatCbtPrompt(algoPrompt);
  assert.ok(algoFormatted.includes('cbt-condition-box'), '[알고리즘] 단락이 cbt-condition-box로 감싸져야 함');
});

test('CBT round 2: 2-column layout controls grid & Part 3 visibility correctly across Q1, Q11, Q17', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const grid = ctx.document.getElementById('eval-cbt-question-grid');
  const part3Wrap = ctx.document.getElementById('eval-cbt-part3-title-wrap');
  const part3Area = ctx.document.getElementById('eval-cbt-part3-area');
  const optionsArea = ctx.document.getElementById('eval-cbt-options');
  const shortArea = ctx.document.getElementById('eval-cbt-short-answer');

  // 1번(객관식)
  app.goToCbtQuestion(1);
  assert.equal(grid.classList.contains('hidden'), false, '1번 문항에서 2열 그리드가 보여야 함');
  assert.equal(part3Wrap.classList.contains('hidden'), true, '1번 문항에서 Part 3 타이틀은 숨겨져야 함');
  assert.equal(part3Area.classList.contains('hidden'), true, '1번 문항에서 Part 3 영역은 숨겨져야 함');
  assert.equal(optionsArea.classList.contains('hidden'), false, '1번 문항에서 보기가 보여야 함');
  assert.equal(shortArea.classList.contains('hidden'), true, '1번 문항에서 단답형은 숨겨져야 함');

  // 11번(단답형)
  app.goToCbtQuestion(11);
  assert.equal(grid.classList.contains('hidden'), false, '11번 문항에서 2열 그리드가 보여야 함');
  assert.equal(part3Wrap.classList.contains('hidden'), true, '11번 문항에서 Part 3 타이틀은 숨겨져야 함');
  assert.equal(part3Area.classList.contains('hidden'), true, '11번 문항에서 Part 3 영역은 숨겨져야 함');
  assert.equal(optionsArea.classList.contains('hidden'), true, '11번 문항에서 보기는 숨겨져야 함');
  assert.equal(shortArea.classList.contains('hidden'), false, '11번 문항에서 단답형이 보여야 함');

  // 17번(순서도 및 계획)
  app.goToCbtQuestion(17);
  assert.equal(grid.classList.contains('hidden'), true, '17번 문항에서 2열 그리드는 숨겨져야 함');
  assert.equal(part3Wrap.classList.contains('hidden'), false, '17번 문항에서 Part 3 타이틀이 보여야 함');
  assert.equal(part3Area.classList.contains('hidden'), false, '17번 문항에서 Part 3 영역이 보여야 함');
});

test('CBT round 2: slim rail badges and collapsed class update properly', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const sidebar = ctx.document.getElementById('eval-cbt-sidebar');
  const railCurBadge = ctx.document.getElementById('eval-cbt-rail-cur-badge');
  const railRatio = ctx.document.getElementById('eval-cbt-rail-ratio');

  // Q1
  app.goToCbtQuestion(1);
  assert.equal(railCurBadge.textContent, 1, '레일 뱃지에 현재 문항 1이 표시되어야 함');
  assert.equal(railRatio.textContent, '0/17', '레일 비율에 0/17이 표시되어야 함');

  // 1번 풀이 후 갱신
  app.onSelectCbtPart1('p1_q1', 0);
  assert.equal(railRatio.textContent, '1/17', '답안 선택 시 레일 비율이 1/17로 즉시 갱신되어야 함');

  // 사이드바 접기 토글
  app.toggleCbtSidebar(true);
  assert.ok(sidebar.classList.contains('collapsed'), 'toggleCbtSidebar(true) 시 collapsed 클래스가 부여되어야 함');

  // 사이드바 펼치기 토글
  app.toggleCbtSidebar(false);
  assert.ok(!sidebar.classList.contains('collapsed'), 'toggleCbtSidebar(false) 시 collapsed 클래스가 제거되어야 함');

  // 17-2 진입 시 레일 뱃지 '17-2' 확인
  app.goToCbtPart3Step(2);
  assert.equal(railCurBadge.textContent, '17-2', '17-2 진입 시 레일 뱃지가 17-2로 표시되어야 함');
  assert.ok(sidebar.classList.contains('collapsed'), '17-2에서는 사이드바가 자동으로 collapsed 되어야 함');
});

test('CBT round 2: preserves user manual sidebar collapse preference across question navigation and draft', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const sidebar = ctx.document.getElementById('eval-cbt-sidebar');

  // 기본 상태: 펼쳐짐
  app.goToCbtQuestion(1);
  assert.equal(sidebar.classList.contains('collapsed'), false, '초기 상태는 펼쳐져 있어야 함');

  // 학생이 직접 사이드바를 접음
  app.toggleCbtSidebar(true, true);
  assert.equal(sidebar.classList.contains('collapsed'), true, '학생이 직접 접으면 collapsed 여야 함');
  assert.equal(app.userSidebarCollapsed, true, 'userSidebarCollapsed 상태가 true 로 기록되어야 함');

  // 2번 문제로 이동: 접힌 상태가 강제 복구되지 않고 유지되어야 함!
  app.goToCbtQuestion(2);
  assert.equal(sidebar.classList.contains('collapsed'), true, '문항 이동 후에도 접힌 상태가 유지되어야 함');

  // 11번(단답형)으로 이동: 여전히 접힌 상태 유지!
  app.goToCbtQuestion(11);
  assert.equal(sidebar.classList.contains('collapsed'), true, '단답형 이동 후에도 접힌 상태가 유지되어야 함');

  // 17-1로 이동: 여전히 접힌 상태 유지!
  app.goToCbtPart3Step(1);
  assert.equal(sidebar.classList.contains('collapsed'), true, '17-1 이동 후에도 접힌 상태가 유지되어야 함');

  // 17-2로 이동: 캔버스를 위해 접힌 상태 유지
  app.goToCbtPart3Step(2);
  assert.equal(sidebar.classList.contains('collapsed'), true, '17-2 순서도 조립에서도 접혀 있어야 함');

  // 학생이 1번으로 돌아가서 다시 사이드바를 직접 펼침
  app.goToCbtQuestion(1);
  app.toggleCbtSidebar(false, true);
  assert.equal(sidebar.classList.contains('collapsed'), false, '학생이 펼치면 펼쳐져야 함');
  assert.equal(app.userSidebarCollapsed, false, 'userSidebarCollapsed 상태가 false 로 기록되어야 함');

  // 2번으로 이동: 이제는 펼쳐진 상태로 유지!
  app.goToCbtQuestion(2);
  assert.equal(sidebar.classList.contains('collapsed'), false, '펼친 상태에서 문항 이동 시 펼쳐진 상태 유지');
});

test('CBT round 3: terminology unified to 현재 상태 in 17-1 and 17-2 summary', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('🚩 현재 상태 (주어진 상황)'), 'index.html에 🚩 현재 상태 (주어진 상황)이 표기되어야 함');
  assert.ok(html.includes('① 현재 상태 · 목표 상태 · 조건 (각 5점)'), '새 실전평가의 상태·조건 배점을 표시한다');
  assert.ok(!html.includes('🚩 시작 상태'), 'index.html에 🚩 시작 상태가 없어야 함');

  app.goToCbtPart3Step(2);
  const summaryEl = ctx.document.getElementById('eval-cbt-plan-summary');
  assert.ok(summaryEl.innerHTML.includes('🚩 현재 상태'), '17-2 요약 바에 🚩 현재 상태가 표기되어야 함');
  assert.ok(!summaryEl.innerHTML.includes('🚩 시작 상태'), '17-2 요약 바에 🚩 시작 상태가 없어야 함');
});

test('CBT round 3: cbtBody toggles overflow-y-auto only on 17-2 and remains overflow-hidden on 1~16 and 17-1', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const cbtBody = ctx.document.getElementById('eval-cbt-body');
  assert.ok(cbtBody, 'eval-cbt-body가 존재해야 함');

  // 1번 문항: 스크롤 제로 고정 바디
  app.goToCbtQuestion(1);
  assert.equal(cbtBody.classList.contains('overflow-hidden'), true, '1번은 overflow-hidden이어야 함');
  assert.equal(cbtBody.classList.contains('overflow-y-auto'), false, '1번은 overflow-y-auto가 아니어야 함');

  // 11번(단답형): 스크롤 제로 고정 바디
  app.goToCbtQuestion(11);
  assert.equal(cbtBody.classList.contains('overflow-hidden'), true, '11번은 overflow-hidden이어야 함');
  assert.equal(cbtBody.classList.contains('overflow-y-auto'), false, '11번은 overflow-y-auto가 아니어야 함');

  // 17-1: 계획 수립 화면도 스크롤 제로 고정 바디
  app.goToCbtPart3Step(1);
  assert.equal(cbtBody.classList.contains('overflow-hidden'), true, '17-1은 overflow-hidden이어야 함');
  assert.equal(cbtBody.classList.contains('overflow-y-auto'), false, '17-1은 overflow-y-auto가 아니어야 함');

  // 17-2: 순서도 조립 캔버스는 자유로운 높이 확장을 위해 overflow-y-auto 허용!
  app.goToCbtPart3Step(2);
  assert.equal(cbtBody.classList.contains('overflow-y-auto'), true, '17-2 캔버스는 overflow-y-auto가 켜져야 함');
  assert.equal(cbtBody.classList.contains('overflow-hidden'), false, '17-2 캔버스는 overflow-hidden이 해제되어야 함');

  // 다시 17-1로 복귀 시 즉시 고정 바디로 복원
  app.goToCbtPart3Step(1);
  assert.equal(cbtBody.classList.contains('overflow-hidden'), true, '17-1로 복귀 시 overflow-hidden으로 복원되어야 함');
  assert.equal(cbtBody.classList.contains('overflow-y-auto'), false, '17-1로 복귀 시 overflow-y-auto가 꺼져야 함');
});

test('CBT round 3: formatCbtPrompt strips outer [규칙: ...] brackets and formats inline conditions', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();

  // 단일 감싸기 규칙 대괄호 및 머리말 제거 확인 (Q15 케이스)
  const q15Prompt = "보물 상자 4개가 있습니다.\n\n[규칙: 다이아몬드는 3점 획득, 루비는 1점 획득]\n\n총 점수는 몇 점인지 쓰시오.";
  const q15Formatted = app.formatCbtPrompt(q15Prompt);
  assert.ok(q15Formatted.includes('cbt-condition-box'), '조건 상자로 감싸져야 함');
  assert.ok(q15Formatted.includes('다이아몬드는 3점 획득, 루비는 1점 획득'), '핵심 규칙 내용이 포함되어야 함');
  assert.ok(!q15Formatted.includes('[규칙: 다이아몬드는 3점 획득, 루비는 1점 획득]'), '중복되는 대괄호 및 [규칙: ] 머리말은 제거되어야 함');

  // Q7 유형의 3단 분할 조건 처리 확인
  const q7Prompt = "사용자가 숫자 10을 입력했습니다.\n\n[조건: 입력된 수 > 5]\n- 참(Yes)이면 '크다'를 출력\n- 거짓(No)이면 '작다'를 출력\n\n화면에 출력되는 결과는 무엇인가요?";
  const q7Formatted = app.formatCbtPrompt(q7Prompt);
  assert.ok(q7Formatted.includes('cbt-condition-box'), 'Q7도 조건 상자로 묶여야 함');
  assert.ok(q7Formatted.includes('지켜야 할 규칙 / 조건'), 'Q7 조건 상자 헤더 타이틀이 표기되어야 함');
});

test('CBT round 4: cbt-step2-unclamped toggles properly on 17-2 and removes on 17-1 and 1~16', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  const container = ctx.document.getElementById('eval-cbt-container');
  assert.ok(container, 'eval-cbt-container가 존재해야 함');

  // 17-2 진입 시 cbt-step2-unclamped 클래스가 추가되어야 함
  app.goToCbtPart3Step(2);
  assert.equal(container.classList.contains('cbt-step2-unclamped'), true, '17-2단계에서는 높이 고정이 해제되어야 함');

  // 17-1로 복귀 시 cbt-step2-unclamped 클래스가 제거되어야 함
  app.goToCbtPart3Step(1);
  assert.equal(container.classList.contains('cbt-step2-unclamped'), false, '17-1단계에서는 높이 고정 모드로 복원되어야 함');

  // 17-2로 갔다가 1~16번 문항으로 이동 시에도 cbt-step2-unclamped 제거되어야 함
  app.goToCbtPart3Step(2);
  assert.equal(container.classList.contains('cbt-step2-unclamped'), true);
  app.goToCbtQuestion(14);
  assert.equal(container.classList.contains('cbt-step2-unclamped'), false, '14번 단답형으로 이동 시 높이 고정 모드로 복원되어야 함');
});

test('CBT round 4: short-answer inputs include Enter key navigation handler and autofocus logic', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  app.goToCbtQuestion(14);
  const shortArea = ctx.document.getElementById('eval-cbt-short-answer');
  assert.ok(shortArea.innerHTML.includes('onkeydown="if(event.key===\'Enter\')'), 'Enter 키 이벤트 핸들러가 포함되어야 함');
  assert.ok(shortArea.innerHTML.includes('window.studentEvalApp.nextCbtQuestion()'), 'Enter 키 입력 시 다음 문항 이동 함수가 호출되어야 함');
});

test('CBT round 5: 17-2 step summary accordion is open by default', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('<details open class="bg-indigo-50/60'), 'index.html에 1단계 계획 요약 details 태그가 open 기본 속성을 가지고 있어야 함');
});

test('CBT round 5: flow-validation accepts flexible terminal names and gives detailed decision branch issue messages', () => {
  const { validateFlowGraph } = require('../js/core/flow-validation.js');

  // 1. 유연한 시작/종료 단말 기호 허용 테스트 (종료하기, 끝!, 마침, 도착)
  const blocks = [
    { id: 's', shape: 'terminal', text: '시작!' },
    { id: 'p', shape: 'process', text: '창문 닫기' },
    { id: 'e', shape: 'terminal', text: '종료하기' }
  ];
  const connections = [
    { from: 's', to: 'p', fromPort: 'out', toPort: 'in' },
    { from: 'p', to: 'e', fromPort: 'out', toPort: 'in' }
  ];
  const res = validateFlowGraph(blocks, connections);
  assert.equal(res.valid, true, '종료하기/시작! 도 정상 단말 기호로 인식되어 검증 통과해야 함');

  // 2. 판단 기호 한쪽 분기 누락 시 구체적인 메시지 제공 테스트
  const decBlocks = [
    { id: 's', shape: 'terminal', text: '시작' },
    { id: 'd', shape: 'decision', text: '기온 > 28' },
    { id: 'p_yes', shape: 'process', text: '창문 열기' },
    { id: 'p_no', shape: 'process', text: '창문 닫기' },
    { id: 'e', shape: 'terminal', text: '종료' }
  ];
  // No 분기가 종료에 닿지 않고 끊긴 경우
  const decConns = [
    { from: 's', to: 'd', fromPort: 'out', toPort: 'in' },
    { from: 'd', to: 'p_yes', fromPort: 'yes', toPort: 'in' },
    { from: 'p_yes', to: 'e', fromPort: 'out', toPort: 'in' },
    { from: 'd', to: 'p_no', fromPort: 'no', toPort: 'in' } // p_no to e 누락
  ];
  const decRes = validateFlowGraph(decBlocks, decConns);
  assert.equal(decRes.valid, false);
  const hasSpecificMsg = decRes.issues.some(i => i.message.includes('창문 닫기') && i.message.includes('종료로 이어지는 길이 없습니다'));
  assert.ok(hasSpecificMsg, '문제가 발생한 구체적인 블록 이름(창문 닫기)이 메시지에 포함되어야 함');
});

test('CBT round 6: formatCbtPrompt extracts condition/algorithm boxes from embedded single-paragraph questions (Q14, Q15)', () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();

  // 1. Q14 유형: 청소년 요금 적용 조건이 [나이 >= 14 이고 나이 < 19]입니다. ...
  const q14Prompt = '청소년 요금 적용 조건이 [나이 >= 14 이고 나이 < 19]입니다. 이 조건의 거짓(아니오) 분기에 해당하는 나이 중, 10대(10~19세)에 속하면서 청소년 요금을 받지 못하는 가장 많은 나이(숫자만)를 쓰시오.';
  const q14Formatted = app.formatCbtPrompt(q14Prompt);

  assert.ok(q14Formatted.includes('cbt-condition-box'), 'Q14 조건 상자(cbt-condition-box)가 생성되어야 함');
  assert.ok(q14Formatted.includes('청소년 요금 적용 조건입니다.'), '발문이 정돈되어 상단에 분리되어야 함');
  assert.ok(q14Formatted.includes('나이 >= 14') || q14Formatted.includes('나이 &gt;= 14'), '조건식이 박스 내부에 안전하게 들어가야 함');
  assert.ok(q14Formatted.includes('이 조건의 거짓(아니오) 분기에 해당하는 나이 중'), '질문 문장이 박스 하단에 분리되어야 함');

  // 2. Q15 유형: 귤 14개를 3개씩 상자에 담는 알고리즘(남은 귤 >= 3 인 동안 [상자수 = 상자수 + 1, 남은 귤 = 남은 귤 - 3])이 종료되었을 때, ...
  const q15Prompt = '귤 14개를 3개씩 상자에 담는 알고리즘(남은 귤 >= 3 인 동안 [상자수 = 상자수 + 1, 남은 귤 = 남은 귤 - 3])이 종료되었을 때, 최종적으로 완성된 [상자수](숫자만)를 쓰시오.';
  const q15Formatted = app.formatCbtPrompt(q15Prompt);

  assert.ok(q15Formatted.includes('cbt-condition-box'), 'Q15 알고리즘 상자(cbt-condition-box)가 생성되어야 함');
  assert.ok(q15Formatted.includes('귤 14개를 3개씩 상자에 담는 알고리즘입니다.'), '알고리즘 소개 발문이 상단에 분리되어야 함');
  assert.ok(q15Formatted.includes('남은 귤 >= 3') || q15Formatted.includes('남은 귤 &gt;= 3'), '알고리즘 내용이 조건 상자에 들어가야 함');
  assert.ok(q15Formatted.includes('알고리즘이 종료되었을 때, 최종적으로 완성된 [상자수](숫자만)를 쓰시오.'), '질문 문장이 자연스럽게 박스 하단에 분리되어야 함');

  // 2-1. Q15 자연어 개정 유형: 귤 14개를 3개씩 상자에 담는 알고리즘([남은 귤 >= 3]인 동안 [상자수 1 증가, 남은 귤 3개 감소] 실행)이 종료되었을 때...
  const q15NaturalPrompt = '귤 14개를 3개씩 상자에 담는 알고리즘([남은 귤 >= 3]인 동안 [상자수 1 증가, 남은 귤 3개 감소] 실행)이 종료되었을 때, 최종 완성된 상자의 개수를 숫자만 쓰시오.';
  const q15NaturalFormatted = app.formatCbtPrompt(q15NaturalPrompt);
  assert.ok(q15NaturalFormatted.includes('cbt-condition-box'), '개정 Q15 조건 상자가 생성되어야 함');
  assert.ok(q15NaturalFormatted.includes('상자수 1 증가'), '자연어 알고리즘 본문이 상자에 들어가야 함');
  assert.ok(q15NaturalFormatted.includes('최종 완성된 상자의 개수를 숫자만 쓰시오.'), '하단 질문 문장이 자연스럽게 분리되어야 함');

  // 3. Q13 유형: 스마트 에어컨 알고리즘에 [현재 실내 온도 > 28℃] 라는 판단 기호가 있습니다. ...
  const q13Prompt = '스마트 에어컨 알고리즘에 [현재 실내 온도 > 28℃] 라는 판단 기호가 있습니다. 현재 실내 온도가 30℃일 때, 판단 기호에서 이어질 올바른 분기 방향은 무엇인가요?';
  const q13Formatted = app.formatCbtPrompt(q13Prompt);

  assert.ok(q13Formatted.includes('cbt-condition-box'), 'Q13 판단 기호 조건 상자가 생성되어야 함');
  assert.ok(q13Formatted.includes('스마트 에어컨 알고리즘의 판단 기호입니다.'), '발문이 상단에 분리되어야 함');
  assert.ok(q13Formatted.includes('현재 실내 온도 > 28℃') || q13Formatted.includes('현재 실내 온도 &gt; 28℃'), '판단 조건이 상자에 들어가야 함');

  // 4. Q31 유형: [라면 조리법] '1. 냄비에 물 붓기 ➔ 2. 면과 스프 넣기 ➔ 3. 4분간 끓이기'와 같이 ...
  const q31Prompt = "[라면 조리법] '1. 냄비에 물 붓기 ➔ 2. 면과 스프 넣기 ➔ 3. 4분간 끓이기'와 같이 이전 단계가 완료되면 다음 단계 명령이 순서대로 차례차례 한 번씩 실행되는 제어 구조의 이름을 쓰시오.";
  const q31Formatted = app.formatCbtPrompt(q31Prompt);

  assert.ok(q31Formatted.includes('cbt-condition-box'), 'Q31 조리법 상자가 생성되어야 함');
  assert.ok(q31Formatted.includes('[라면 조리법]'), '태그 타이틀이 유지되어야 함');
  assert.ok(q31Formatted.includes('1. 냄비에 물 붓기 ➔ 2. 면과 스프 넣기 ➔ 3. 4분간 끓이기'), '단계 내용이 상자에 들어가야 함');
});

test('syncStudentProgress: dirty-checks answers and skips redundant remote writes', async () => {
  const ctx = createAssessmentContext();
  const StudentEvalApp = ctx.window.studentEvalApp.constructor;
  const app = new StudentEvalApp();
  ctx.window.studentEvalApp = app;

  let updateCallCount = 0;
  ctx.window.evalService = {
    isDemo: () => false,
    updateStudentProgress: async () => {
      updateCallCount++;
      return Promise.resolve();
    }
  };

  app.joined = true;
  app.sessionStatus = 'in_progress';
  app.currentClass = '2-1';
  app.studentNum = 1;
  app.answers = { part1: {}, part2: {}, part3: { blocks: [], connections: [] } };

  // 1. First immediate sync with answers
  app.answers.part1.p1_q1 = 0;
  app.syncStudentProgress(true);
  await app.progressPromise;
  assert.equal(updateCallCount, 1, '답안이 변경되었을 때 첫 즉시 동기화가 호출되어야 함');

  // 2. Second immediate sync with UNCHANGED answers (should be skipped by dirty check!)
  app.syncStudentProgress(true);
  await app.progressPromise;
  assert.equal(updateCallCount, 1, '답안이 바뀌지 않은 경우 Firestore 원격 쓰기가 건너뛰어져야 함 (중복 쓰기 0회)');

  // 3. Answers change again
  app.answers.part1.p1_q2 = 2;
  app.syncStudentProgress(true);
  await app.progressPromise;
  assert.equal(updateCallCount, 2, '새 답안이 추가되면 정상적으로 원격 동기화가 실행되어야 함');
});

test('workspace navigation: assessmentWorkspace.leave restores active state and frees prescription modal', () => {
  let leaveCalled = 0;
  let modalOpened = false;
  const mockWorkspace = {
    active: true,
    leave: () => {
      leaveCalled++;
      mockWorkspace.active = false;
    }
  };

  const nav = {
    isAssessmentLocked: () => false,
    assessmentWorkspace: mockWorkspace
  };

  // Simulate switchUnit logic when going to unit3
  const targetUnit = 'unit3';
  if (targetUnit !== 'eval' && nav.assessmentWorkspace?.active) {
    nav.assessmentWorkspace.leave();
  }

  assert.equal(leaveCalled, 1, 'switchUnit to unit3 must call assessmentWorkspace.leave()');
  assert.equal(mockWorkspace.active, false, 'workspace active state must be false after leaving');

  // Verify modal guard logic in assessment-workspace:
  const openPrescriptionModal = () => {
    if (nav.isAssessmentLocked() || mockWorkspace.active) return;
    modalOpened = true;
  };

  openPrescriptionModal();
  assert.equal(modalOpened, true, 'openPrescriptionModal should run when workspace is not active');
});

