const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEvaluationBank, assignQuestions, publicAssignment, teacherReview, gradeAssignment } = require('../server/evaluation-bank.cjs');

function part1(id, difficulty, subType = 'concept') {
  return { id, title: id + ' 제목', desc: id + ' 설명', teacherNote: id + '이 확인하려는 개념과 오개념을 교사가 검토합니다.', difficulty, subType, points: 3, options: ['첫째', '둘째', '셋째', '넷째'], correctAnswer: 1 };
}
function part2(id, difficulty, subType = 'term') {
  return { id, title: id + ' 제목', desc: id + ' 설명', teacherNote: id + '이 확인하려는 표현과 판단 근거를 교사가 검토합니다.', difficulty, subType, points: 5, placeholder: '답 입력', answers: ['정답', '정답 예시'] };
}
function bankJson() {
  return JSON.stringify({
    version: 4,
    part1: [
      ...['p1a', 'p1b', 'p1c'].map(id => part1(id, 'easy', 'concept')),
      part1('p1d', 'easy', 'applied'),
      ...['p1e', 'p1f', 'p1g', 'p1h'].map(id => part1(id, 'medium', 'analysis')),
      ...['p1i', 'p1j'].map(id => part1(id, 'hard', 'scenario'))
    ],
    part2: [
      ...['p2a', 'p2b'].map(id => part2(id, 'easy')),
      ...['p2c', 'p2d'].map(id => part2(id, 'medium')),
      part2('p2e', 'hard', 'trace'), part2('p2f', 'hard', 'scenario')
    ]
  });
}

test('V4 accepts up to 32 explicit aliases without accepting arbitrary text', () => {
  const bank = JSON.parse(bankJson());
  bank.part2[0].answers = Array.from({length:32}, (_,i) => `허용 표현 ${i}`);
  const parsed = parseEvaluationBank(JSON.stringify(bank));
  assert.equal(gradeAssignment({part1:[],part2:[parsed.part2[0]]},{part2:{p2a:'허용표현31'}}).part2,5);
  assert.equal(gradeAssignment({part1:[],part2:[parsed.part2[0]]},{part2:{p2a:'허용표현31 아님'}}).part2,0);
  bank.part2[0].answers.push('초과 답안');
  assert.throws(() => parseEvaluationBank(JSON.stringify(bank)), /단답형/);
});

test('V4 assigns the required difficulty mix and never sends answers to students', () => {
  const bank = parseEvaluationBank(bankJson());
  const assignment = assignQuestions(bank, 's'.repeat(32), 'round-4:2-1:01');
  const publicQuestions = publicAssignment(assignment);
  assert.equal(assignment.part1.length, 10);
  assert.equal(assignment.part2.length, 6);
  assert.equal(assignment.part1.filter(question => question.difficulty === 'easy' && question.subType === 'concept').length, 3);
  assert.equal(assignment.part1.filter(question => question.difficulty === 'easy' && question.subType === 'applied').length, 1);
  assert.equal(assignment.part1.filter(question => question.difficulty === 'medium').length, 4);
  assert.equal(assignment.part1.filter(question => question.difficulty === 'hard').length, 2);
  assert.equal(assignment.part2.filter(question => question.difficulty === 'easy').length, 2);
  assert.equal(assignment.part2.filter(question => question.difficulty === 'medium').length, 2);
  assert.equal(assignment.part2.filter(question => question.difficulty === 'hard' && question.subType === 'trace').length, 1);
  assert.equal(assignment.part2.filter(question => question.difficulty === 'hard' && question.subType === 'scenario').length, 1);
  assert.ok(!JSON.stringify(publicQuestions).includes('correctAnswer'));
  assert.ok(!JSON.stringify(publicQuestions).includes('"answers"'));
  assert.ok(!JSON.stringify(publicQuestions).includes('teacherNote'));
});

test('V4 grading uses only the server assignment and teacher review includes its private rubric', () => {
  const assignment = assignQuestions(parseEvaluationBank(bankJson()), 's'.repeat(32), 'round-4:2-1:01');
  const answers = { part1: {}, part2: {}, assignedQuestions: { forged: true } };
  assignment.part1.forEach(question => { answers.part1[question.id] = question.correctAnswer; });
  assignment.part2.forEach(question => { answers.part2[question.id] = question.answers[0]; });
  const score = gradeAssignment(assignment, answers);
  assert.equal(score.part1, 30);
  assert.equal(score.part2, 30);
  assert.equal(score.objectiveTotal, 60);
  const review = teacherReview(assignment, answers);
  assert.equal(review.part1[0].correctAnswer, 1);
  assert.equal(review.part2[0].answers[0], '정답');
  assert.ok(review.part1[0].teacherNote.includes('교사'));
});

test('V4 rejects an incomplete private bank or an unsafe assignment secret', () => {
  const invalid = JSON.parse(bankJson());
  delete invalid.part1[0].teacherNote;
  assert.throws(() => parseEvaluationBank(JSON.stringify(invalid)), /문항 은행/);
  assert.throws(() => assignQuestions(parseEvaluationBank(bankJson()), 'short', 'round'), /배정 설정/);
});

test('V4 domain-balanced assignment guarantees exact domain and difficulty distribution', () => {
  const fs = require('fs');
  const path = require('path');
  const bankPath = path.resolve(__dirname, '../scratch/eval_bank_v4.json');
  if (!fs.existsSync(bankPath)) return;

  const bank = parseEvaluationBank(fs.readFileSync(bankPath, 'utf8'));
  const secret = 's'.repeat(32);

  for (let studentId = 1; studentId <= 27; studentId++) {
    const scope = `round-4:2-1:${String(studentId).padStart(2, '0')}`;
    const assignment = assignQuestions(bank, secret, scope);

    // 1. 문항 수: Part 1은 10개, Part 2는 6개
    assert.equal(assignment.part1.length, 10);
    assert.equal(assignment.part2.length, 6);

    // 2. Part 1: D1~D5 대영역별 정확히 2문항씩 배정
    const dCounts = {};
    assignment.part1.forEach(q => { dCounts[q.domain] = (dCounts[q.domain] || 0) + 1; });
    assert.deepEqual(dCounts, { D1: 2, D2: 2, D3: 2, D4: 2, D5: 2 });

    // 3. Part 2: S1~S6 세부 영역별 정확히 1문항씩 배정
    const sCounts = {};
    assignment.part2.forEach(q => { sCounts[q.domain] = (sCounts[q.domain] || 0) + 1; });
    assert.deepEqual(sCounts, { S1: 1, S2: 1, S3: 1, S4: 1, S5: 1, S6: 1 });

    // 4. 난이도 비율: Part 1(하4, 중4, 상2 = 30점), Part 2(하2, 중2, 상2 = 30점)
    const p1Diff = { easy: 0, medium: 0, hard: 0 };
    assignment.part1.forEach(q => { p1Diff[q.difficulty]++; });
    assert.deepEqual(p1Diff, { easy: 4, medium: 4, hard: 2 });

    const p2Diff = { easy: 0, medium: 0, hard: 0 };
    assignment.part2.forEach(q => { p2Diff[q.difficulty]++; });
    assert.deepEqual(p2Diff, { easy: 2, medium: 2, hard: 2 });

    // 5. 총 배점: Part 1 30점 + Part 2 30점 = 총 60점
    const p1Score = assignment.part1.reduce((acc, q) => acc + q.points, 0);
    const p2Score = assignment.part2.reduce((acc, q) => acc + q.points, 0);
    assert.equal(p1Score, 30);
    assert.equal(p2Score, 30);

    // 6. 결정론적 추출 검증 (동일 시드 = 동일 문항)
    const repeatAssignment = assignQuestions(bank, secret, scope);
    assert.deepEqual(
      assignment.part1.map(q => q.id),
      repeatAssignment.part1.map(q => q.id)
    );
    assert.deepEqual(
      assignment.part2.map(q => q.id),
      repeatAssignment.part2.map(q => q.id)
    );
  }
});

test('V4 parses both plain JSON and gzip-base64 encoded bank format', () => {
  const zlib = require('node:zlib');
  const raw = bankJson();
  const bank1 = parseEvaluationBank(raw);
  assert.equal(bank1.version, 4);
  assert.equal(bank1.part1.length, 10);

  const compressed = zlib.gzipSync(Buffer.from(raw)).toString('base64');
  const bank2 = parseEvaluationBank(compressed);
  assert.equal(bank2.version, 4);
  assert.equal(bank2.part1.length, 10);
  assert.deepEqual(bank1, bank2);
});


