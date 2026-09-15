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
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, v) { if (v === undefined) v = !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); return v; },
          contains(c) { return this.classes.has(c); }
        },
        children: [],
        replaceChildren(...ch) { this.children = ch; this.innerHTML = ''; },
        appendChild(child) { this.children.push(child); return child; },
        contains(child) { return this.children.includes(child); },
        setAttribute(name, val) { this[name] = String(val); },
        getAttribute(name) { return this[name] || null; },
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


