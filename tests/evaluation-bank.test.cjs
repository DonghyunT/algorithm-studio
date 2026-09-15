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
