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
      addEventListener: () => {}
    },
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
