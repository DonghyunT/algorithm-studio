const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bank = require('../server/evaluation-bank.cjs');
const policy=require('../js/core/assessment-policy.js');
const legacyReview=scores=>({sourceKey:policy.assessmentSourceKey({}),attemptId:'round-4',criteria:policy.ASSESSMENT_RUBRIC.map((r,i)=>({id:r.id,score:scores[i]}))});

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
      if (url.includes('/students?pageSize=50')) {
        return { ok: true, json: async () => ({ documents: [{ name: 'projects/donghyun-algo/databases/(default)/documents/classrooms/2-1/students/01', fields: field(documents.student).mapValue.fields }] }) };
      }
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

test('V4 returns only the submitting student\'s server objective score', async () => {
  const h = harness();
  const assigned = bank.assignQuestions(bank.parseEvaluationBank(bankJson()), 's'.repeat(32), 'round-4:2-1:01');
  assigned.part1.forEach(question => { h.documents.student.answers.part1[question.id] = question.correctAnswer; });
  assigned.part2.forEach(question => { h.documents.student.answers.part2[question.id] = question.answers[0]; });
  const result = await h.request({ action: 'student-score', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(result.status, 200);
  assert.equal(result.body.score.part1, 30);
  assert.equal(result.body.score.part2, 30);
  assert.equal(result.body.score.objectiveTotal, 60);
  assert.equal(result.body.ready, true);
  assert.equal(result.body.review, undefined);
  assert.ok(!JSON.stringify(result.body).includes('correctAnswer'));
  assert.ok(!JSON.stringify(result.body).includes('teacherNote'));
  assert.ok(!JSON.stringify(result.body).includes('answers'));
});

test('V4 keeps the student score pending before submission and rejects another owner', async () => {
  const pending = await harness({ studentStatus: 'in_progress' }).request({ action: 'student-score', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(pending.status, 200);
  assert.equal(pending.body.ready, false);
  assert.equal(pending.body.status, 'pending');
  const denied = await harness({ studentOwner: 'someone-else' }).request({ action: 'student-score', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.score, undefined);
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

test('V4 allows only authorized teacher to export bank and denies students', async () => {
  const h = harness();
  const studentReq = await h.request({ action: 'export-bank' }, 'student');
  assert.equal(studentReq.status, 403);

  const teacherReq = await h.request({ action: 'export-bank' }, 'teacher');
  assert.equal(teacherReq.status, 200);
  assert.equal(teacherReq.body.ok, true);
  assert.equal(teacherReq.body.bank.version, 4);
  assert.equal(teacherReq.body.bank.part1.length, 10);
  assert.equal(teacherReq.body.bank.part2.length, 6);

  // Disabled teacher gets 403
  h.documents.teacher.enabled = false;
  const disabledReq = await h.request({ action: 'export-bank' }, 'teacher');
  assert.equal(disabledReq.status, 403);
});

test('V4 class-grades allows authorized teacher to get all student scores and reviews', async () => {
  const h = harness();
  const assigned = bank.assignQuestions(bank.parseEvaluationBank(bankJson()), 's'.repeat(32), 'round-4:2-1:01');
  assigned.part1.forEach(question => { h.documents.student.answers.part1[question.id] = question.correctAnswer; });
  assigned.part2.forEach(question => { h.documents.student.answers.part2[question.id] = question.answers[0]; });

  // Student is denied
  const studentReq = await h.request({ action: 'class-grades', classId: '2-1' }, 'student');
  assert.equal(studentReq.status, 403);

  // Teacher succeeds
  const teacherReq = await h.request({ action: 'class-grades', classId: '2-1' }, 'teacher');
  assert.equal(teacherReq.status, 200);
  assert.equal(teacherReq.body.ok, true);
  assert.ok(teacherReq.body.grades['01']);
  assert.equal(teacherReq.body.grades['01'].score.part1, 30);
  assert.equal(teacherReq.body.grades['01'].score.part2, 30);
  assert.equal(teacherReq.body.grades['01'].score.objectiveTotal, 60);
  assert.equal(teacherReq.body.grades['01'].review.part1.length, 10);
  assert.equal(teacherReq.body.grades['01'].review.part2.length, 6);
});

test('V4 student-review shields answers during in_progress and reveals after ended', async () => {
  const h = harness();
  const assigned = bank.assignQuestions(bank.parseEvaluationBank(bankJson()), 's'.repeat(32), 'round-4:2-1:01');
  assigned.part1.forEach(question => { h.documents.student.answers.part1[question.id] = question.correctAnswer; });
  h.documents.student.review = { proposal: { ...legacyReview([9,9,9,8]), feedback: '순서도 구성이 좋습니다.' } };

  // While in_progress: inProgress message, no answers revealed
  h.documents.classroom.status = 'in_progress';
  const progressReq = await h.request({ action: 'student-review', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(progressReq.status, 200);
  assert.equal(progressReq.body.ready, false);
  assert.equal(progressReq.body.inProgress, true);
  assert.equal(progressReq.body.review, undefined);

  // When ended: full review and part3 returned
  h.documents.classroom.status = 'ended';
  const endedReq = await h.request({ action: 'student-review', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(endedReq.status, 200);
  assert.equal(endedReq.body.ready, true);
  assert.equal(endedReq.body.score.part1, 30);
  assert.equal(endedReq.body.review.part1.length, 10);
  assert.equal(endedReq.body.part3.total, 35);
  assert.equal(endedReq.body.part3.confirmed, false);
  assert.equal(endedReq.body.part3.feedback, '순서도 구성이 좋습니다.');
});

test('V4 student-score includes part3 review when available', async () => {
  const h = harness();
  h.documents.student.review = { proposal: legacyReview([8,8,8,8]) };
  const res1 = await h.request({ action: 'student-score', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(res1.status, 200);
  assert.equal(res1.body.part3.total, 32);
  assert.equal(res1.body.part3.confirmed, false);

  h.documents.student.review.confirmed = legacyReview([10,10,9,9]);
  const res2 = await h.request({ action: 'student-score', classId: '2-1', studentNum: '01' }, 'student');
  assert.equal(res2.status, 200);
  assert.equal(res2.body.part3.total, 38);
  assert.equal(res2.body.part3.confirmed, true);
});
