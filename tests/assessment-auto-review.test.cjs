const test = require('node:test');
const assert = require('node:assert/strict');
const { AssessmentAutoReviewQueue } = require('../js/core/assessment-auto-review.js');

test('AssessmentAutoReviewQueue.isPart3Empty accurately detects empty answers', () => {
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty(null), true);
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({}), true);
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({ answers: {} }), true);
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({
    answers: { part3: { blocks: [], plan: { current: '', goal: '', steps: [] } } }
  }), true);
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({
    answers: { part3: { blocks: [{ id: 'b1', type: 'terminal' }], plan: { current: '   ', goal: '', steps: [] } } }
  }), true);

  // 블록이 2개 이상이면 빈 답안 아님
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({
    answers: { part3: { blocks: [{ id: 'b1' }, { id: 'b2' }] } }
  }), false);

  // 기획서 내용이 있으면 빈 답안 아님
  assert.equal(AssessmentAutoReviewQueue.isPart3Empty({
    answers: { part3: { blocks: [{ id: 'b1' }], plan: { goal: '음료수 뽑기' } } }
  }), false);
});

test('AssessmentAutoReviewQueue handles empty answers with immediate zero proposal without AI API call', async () => {
  let aiCallCount = 0;
  let savedReview = null;

  const queue = new AssessmentAutoReviewQueue({
    savePart3Review: async (classId, studentNum, sourceKey, details, kind) => {
      savedReview = { classId, studentNum, sourceKey, details, kind };
    },
    requestAssessmentAI: async () => {
      aiCallCount++;
      return {};
    }
  });

  const emptyStudent = {
    num: 5,
    numStr: '05',
    name: '김영희',
    status: 'submitted',
    attemptId: 'att-1',
    answers: {
      part3: { blocks: [{ id: 'b1' }], plan: { current: '', goal: '', steps: [] } }
    }
  };

  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 4 },
    students: [emptyStudent],
    isTeacher: true
  });

  // 빈 답안이므로 AI 호출 0회
  assert.equal(aiCallCount, 0);
  assert.ok(savedReview !== null);
  assert.equal(savedReview.classId, '2-1');
  assert.equal(savedReview.studentNum, 5);
  assert.equal(savedReview.kind, 'proposal');
  assert.equal(savedReview.details.total, 0);
  assert.equal(savedReview.details.model, 'system-rule-zero-fill');
  assert.equal(savedReview.details.criteria.length, 4);
  assert.ok(savedReview.details.criteria.every(c => c.score === 0));
});

test('AssessmentAutoReviewQueue enqueues normal answers and respects intervals', async () => {
  const aiCalls = [];
  const savedReviews = [];

  const queue = new AssessmentAutoReviewQueue({
    intervalMs: 10, // 테스트를 위해 10ms로 설정
    savePart3Review: async (classId, studentNum, sourceKey, details, kind) => {
      savedReviews.push({ studentNum, details, kind });
    },
    requestAssessmentAI: async (params) => {
      aiCalls.push(params);
      return {
        criteria: [
          { id: 'problem', score: 8, evidence: '양호' },
          { id: 'logic', score: 7, evidence: '양호' },
          { id: 'consistency', score: 8, evidence: '양호' },
          { id: 'flow', score: 8, evidence: '양호' }
        ],
        total: 31,
        model: 'solar-pro4'
      };
    }
  });

  const studentA = {
    num: 1,
    numStr: '01',
    name: '학생1',
    status: 'submitted',
    attemptId: 'att-1',
    answers: {
      part3: {
        blocks: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
        plan: { current: '시작', goal: '종료', steps: ['1단계'] }
      }
    }
  };

  const studentB = {
    num: 2,
    numStr: '02',
    name: '학생2',
    status: 'submitted',
    attemptId: 'att-1',
    answers: {
      part3: {
        blocks: [{ id: 'b1' }, { id: 'b2' }],
        plan: { current: '시작', goal: '종료', steps: ['1단계'] }
      }
    }
  };

  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 4 },
    students: [studentA, studentB],
    isTeacher: true
  });

  // 1명 처리 중
  assert.equal(queue.processingStudentNum, '01');

  // 완료 대기
  await new Promise(resolve => setTimeout(resolve, 50));

  // 2명 모두 완료
  assert.equal(savedReviews.length, 2);
  assert.equal(savedReviews[0].studentNum, 1);
  assert.equal(savedReviews[0].kind, 'proposal');
  assert.equal(savedReviews[1].studentNum, 2);
  assert.equal(savedReviews[1].kind, 'proposal');
});

test('AssessmentAutoReviewQueue ignores non-teachers, non-submitted students, and non-v4 sessions', async () => {
  let aiCallCount = 0;
  const queue = new AssessmentAutoReviewQueue({
    requestAssessmentAI: async () => { aiCallCount++; return {}; }
  });

  const student = {
    num: 1,
    status: 'in_progress',
    attemptId: 'att-1',
    answers: { part3: { blocks: [{ id: '1' }, { id: '2' }] } }
  };

  // 학생이 in_progress인 경우
  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 4 },
    students: [student],
    isTeacher: true
  });
  assert.equal(aiCallCount, 0);

  // 교사가 아닌 경우
  student.status = 'submitted';
  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 4 },
    students: [student],
    isTeacher: false
  });
  assert.equal(aiCallCount, 0);

  // questionVersion이 3(모의평가)인 경우 - 토큰 절약을 위해 AI 채점 제외
  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 3 },
    students: [student],
    isTeacher: true
  });
  assert.equal(aiCallCount, 0);

  // questionVersion이 2(단답형)인 경우
  queue.sync({
    classId: '2-1',
    session: { attemptId: 'att-1', questionVersion: 2 },
    students: [student],
    isTeacher: true
  });
  assert.equal(aiCallCount, 0);
});
