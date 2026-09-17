const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bank = require('../server/evaluation-bank.cjs');

function field(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, field(child)])) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  return { stringValue: value };
}
function bankJson() {
  const p1 = (id, difficulty, subType = 'concept') => ({ id, title: id + ' 제목', desc: id + ' 설명', teacherNote: id + '의 교육적 의도를 교사가 검토합니다.', difficulty, subType, points: 3, options: ['첫째', '둘째', '셋째', '넷째'], correctAnswer: 1 });
  const p2 = (id, difficulty, subType = 'term') => ({ id, title: id + ' 제목', desc: id + ' 설명', teacherNote: id + '의 교육적 의도를 교사가 검토합니다.', difficulty, subType, points: 5, placeholder: '답 입력', answers: ['정답'] });
  return JSON.stringify({ version: 4, part1: [...['p1a', 'p1b', 'p1c'].map(id => p1(id, 'easy')), p1('p1d', 'easy', 'applied'), ...['p1e', 'p1f', 'p1g', 'p1h'].map(id => p1(id, 'medium', 'analysis')), p1('p1i', 'hard', 'scenario'), p1('p1j', 'hard', 'scenario')], part2: [p2('p2a', 'easy'), p2('p2b', 'easy'), p2('p2c', 'medium'), p2('p2d', 'medium'), p2('p2e', 'hard', 'trace'), p2('p2f', 'hard', 'scenario')] });
}
function harness({ studentOwner = 'student-uid', studentStatus = 'submitted' } = {}) {
  const documents = {
    classroom: { questionVersion: 4, attemptId: 'round-4', status: 'in_progress' },
    student: { ownerUid: studentOwner, attemptId: 'round-4', status: studentStatus, answers: { part1: {}, part2: {}, part3: {} } },
    teacher: { enabled: true, allClasses: true }
  };
  const context = {
    module: { exports: {} },
    require: request => {
      if (request.includes('firebase-token')) return { verifyFirebaseToken: async token => token === 'student' ? { sub: 'student-uid', firebase: { sign_in_provider: 'anonymous' } } : { sub: 'teacher-uid', firebase: { sign_in_provider: 'password' } } };
      if (request.includes('evaluation-bank')) return { ...bank, loadEvaluationBank: () => bank.parseEvaluationBank(bankJson()) };
      return require(request);
    },
    process: { env: { FIREBASE_PROJECT_ID: 'donghyun-algo', EVAL_BANK_V4_JSON: bankJson(), EVAL_ASSIGNMENT_SECRET: 's'.repeat(32) } },
    AbortSignal,
    fetch: async url => {
      const data = url.includes('/teachers/') ? documents.teacher : url.includes('/students/') ? documents.student : documents.classroom;
      return { ok: true, json: async () => ({ fields: field(data).mapValue.fields }) };
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/evaluation.js'), 'utf8'), context);
  async function request(body, token) {
    const result = {}, response = { setHeader() {}, status(code) { result.status = code; return this; }, json(data) { result.body = data; return result; } };
    await context.module.exports({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body }, response);
    return result;
  }
  return { request, documents };
}

test('V4 sends an anonymous student only redacted questions for their own active attempt', async () => {
  const result = await harness({ studentStatus: 'in_progress' }).request({ action: 'questions', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(result.status, 200);
  assert.equal(result.body.questions.part1.length, 10);
  assert.equal(result.body.questions.part2.length, 6);
  assert.ok(!JSON.stringify(result.body).includes('correctAnswer'));
  assert.ok(!JSON.stringify(result.body).includes('teacherNote'));
  assert.ok(!JSON.stringify(result.body).includes('"answers"'));
});

test('V4 rejects another student identity before returning question content', async () => {
  const result = await harness({ studentOwner: 'someone-else' }).request({ action: 'questions', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(result.status, 403);
  assert.equal(result.body.questions, undefined);
});

test('V4 accepts numeric or unpadded studentNum (e.g., 1 or "1") and normalizes to "01"', async () => {
  // Test numeric 1
  const resultNum = await harness({ studentStatus: 'in_progress' }).request({ action: 'questions', classId: '2-1', studentNum: 1 }, 'student');
  assert.equal(resultNum.status, 200, 'Numeric studentNum 1 must be normalized to "01" and accepted');
  assert.equal(resultNum.body.questions.part1.length, 10);

  // Test single digit string '1'
  const resultStr = await harness({ studentStatus: 'in_progress' }).request({ action: 'questions', classId: '2-1', studentNum: '1' }, 'student');
  assert.equal(resultStr.status, 200, 'String studentNum "1" must be normalized to "01" and accepted');
  assert.equal(resultStr.body.questions.part1.length, 10);
});

test('V4 exposes score and complete review only to the scoped teacher after submission', async () => {
  const h = harness();
  const assigned = bank.assignQuestions(bank.parseEvaluationBank(bankJson()), 's'.repeat(32), 'round-4:2-1:01');
  assigned.part1.forEach(question => { h.documents.student.answers.part1[question.id] = question.correctAnswer; });
  assigned.part2.forEach(question => { h.documents.student.answers.part2[question.id] = question.answers[0]; });
  const grade = await h.request({ action: 'grade', classId: '2-1', studentNum: '01' }, 'teacher');
  assert.equal(grade.status, 200);
  assert.equal(grade.body.score.objectiveTotal, 60);
  assert.equal(grade.body.questions, undefined);
  const review = await h.request({ action: 'review', classId: '2-1', studentNum: '01' }, 'teacher');
  assert.equal(review.status, 200);
  assert.equal(review.body.review.part1[0].correctAnswer, 1);
  assert.equal(review.body.review.part2[0].answers[0], '정답');
  assert.ok(review.body.review.part1[0].teacherNote.includes('교사'));
});
