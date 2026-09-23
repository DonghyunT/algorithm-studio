const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function createClassroomEnv() {
  const elements = {};
  function makeEl(id = '') {
    return {
      id,
      innerHTML: '',
      textContent: '',
      className: '',
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      replaceChildren: function() { this.innerHTML = ''; }
    };
  }

  const gridEl = makeEl('classroom-live-grid');
  const onlineEl = makeEl('classroom-live-online-count');
  const submitEl = makeEl('classroom-live-submit-count');
  const blindToggleBtn = makeEl('classroom-blind-toggle');
  const blindIcon = makeEl('classroom-blind-toggle-icon');
  const blindLabel = makeEl('classroom-blind-toggle-label');

  elements['classroom-live-grid'] = gridEl;
  elements['classroom-live-online-count'] = onlineEl;
  elements['classroom-live-submit-count'] = submitEl;
  elements['classroom-blind-toggle'] = blindToggleBtn;
  elements['classroom-blind-toggle-icon'] = blindIcon;
  elements['classroom-blind-toggle-label'] = blindLabel;

  const doc = {
    getElementById: id => elements[id] || makeEl(id),
    createElement: tag => ({
      tagName: tag,
      className: '',
      textContent: '',
      appendChild: () => {},
      replaceChildren: () => {},
      setAttribute: () => {}
    }),
    body: { classList: { remove: () => {} } }
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: doc,
    window: {
      authService: {
        isDemo: () => false,
        allowedClassIds: () => ['2-1']
      }
    },
    escapeHtml: str => String(str || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  };

  vm.createContext(sandbox);

  const classroomCode = fs.readFileSync(path.join(__dirname, '../js/core/classroom.js'), 'utf8');
  vm.runInContext(classroomCode, sandbox);

  return { sandbox, gridEl, elements };
}

function setLiveV4Attempt(sandbox, attemptId = 'attempt-v4') {
  sandbox.setCurrentLiveSession({ questionVersion: 4, attemptId });
}

test('V4 실전평가 제출 학생: 서버 채점 데이터 수신 전에는 허위 "소계 0점 (검토대기)" 대신 "채점 확인 중" 표시', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  // 블라인드 모드 해제
  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox);

  // V4 실전평가에서 학생이 제출한 직후의 데이터 상태 (scores의 part1, part2가 null)
  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: {
      part1: null,
      part2: null,
      part3: null,
      objectiveTotal: null,
      total: null,
      teacherOverride: null,
      pendingReview: true,
      serverGraded: true
    },
    answers: { part1: {}, part2: {}, part3: {} }
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  // 1번 학생 카드에 "채점 확인 중" 표시 확인
  assert.match(output, /채점 확인 중/);
  // 이전 버그였던 "소계 0점 (검토대기)"는 절대로 나타나지 않아야 함
  assert.doesNotMatch(output, /소계 0점 \(검토대기\)/);
  assert.doesNotMatch(output, /0점 \(검토대기\)/);
});

test('V4 실전평가 제출 학생: 서버 지필 점수가 캐시되면 "지필 56점 (서술대기)" 정상 렌더링', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox);

  // 서버 성적 캐시에 1번 학생 점수 주입 (Part 1 + Part 2 = 56점)
  vm.runInContext(`
    currentLiveClassGrades['01'] = {
      score: { part1: 28, part2: 28, objectiveTotal: 56 }
    };
    currentLiveClassGradesAttemptId = 'attempt-v4';
  `, sandbox);

  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: { serverGraded: true, pendingReview: true },
    answers: {}
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  assert.match(output, /지필 56점 \(서술대기\)/);
  assert.doesNotMatch(output, /0점/);
});

test('V4 실전평가 제출 학생: Part 3 AI 제안 점수가 있으면 지필과 합산하여 "88점 (AI제안)" 렌더링', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox);

  // 서버 지필 56점 캐시
  vm.runInContext(`
    currentLiveClassGrades['01'] = {
      score: { part1: 28, part2: 28, objectiveTotal: 56 }
    };
    currentLiveClassGradesAttemptId = 'attempt-v4';
  `, sandbox);

  // AI 1차 초벌 채점 32점 (8 + 8 + 8 + 8)
  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: { serverGraded: true },
    review: {
      proposal: {
        criteria: [
          { id: 'c1', score: 8 },
          { id: 'c2', score: 8 },
          { id: 'c3', score: 8 },
          { id: 'c4', score: 8 }
        ]
      }
    },
    answers: {}
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  // 56 + 32 = 88점
  assert.match(output, /88점 \(AI제안\)/);
  assert.match(output, /AI제안/);
});

test('V4 실전평가 제출 학생: Part 3 교사 점수 확정 시 "88점 (확정)" 렌더링', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox);

  // 서버 지필 56점 캐시
  vm.runInContext(`
    currentLiveClassGrades['01'] = {
      score: { part1: 28, part2: 28, objectiveTotal: 56 }
    };
    currentLiveClassGradesAttemptId = 'attempt-v4';
  `, sandbox);

  // 교사 확정 32점
  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: { serverGraded: true },
    review: {
      confirmed: {
        criteria: [
          { id: 'c1', score: 8 },
          { id: 'c2', score: 8 },
          { id: 'c3', score: 8 },
          { id: 'c4', score: 8 }
        ]
      }
    },
    answers: {}
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  assert.match(output, /88점 \(확정\)/);
  assert.match(output, /확정/);
});

test('V4 실전평가 제출 학생: 교사 전체 수동 조정 시 "95점 (확정)" 렌더링', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox);

  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: { serverGraded: true, teacherOverride: 95 },
    answers: {}
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  assert.match(output, /95점 \(확정\)/);
});

test('블라인드 모드 ON 상태에서는 점수 대신 "제출 완료 (비공개)" 렌더링', () => {
  const { sandbox, gridEl } = createClassroomEnv();

  vm.runInContext('isScoreBlindMode = true;', sandbox);
  setLiveV4Attempt(sandbox);
  vm.runInContext(`currentLiveClassGrades['01'] = { score: { objectiveTotal: 60 } }; currentLiveClassGradesAttemptId = 'attempt-v4';`, sandbox);

  const submittedV4Student = {
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'attempt-v4',
    scores: { serverGraded: true }
  };

  sandbox.renderLiveGrid([submittedV4Student]);

  const output = gridEl.innerHTML;
  assert.match(output, /제출 완료 \(비공개\)/);
  assert.doesNotMatch(output, /60점/);
});

test('새 평가 회차로 바뀌면 이전 회차 서버 점수 캐시를 비운다', () => {
  const { sandbox } = createClassroomEnv();
  setLiveV4Attempt(sandbox, 'old-attempt');
  sandbox.cacheLiveClassGrades('old-attempt', { '01': { score: { objectiveTotal: 56 } } });

  sandbox.setCurrentLiveSession({ questionVersion: 3, attemptId: 'new-attempt' });

  assert.equal(vm.runInContext('currentLiveClassGradesAttemptId', sandbox), null);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentLiveClassGrades)', sandbox)), {});
});

test('현재 회차와 표시 학생 회차가 다르면 오래된 서버 점수를 좌석에 쓰지 않는다', () => {
  const { sandbox, gridEl } = createClassroomEnv();
  vm.runInContext('isScoreBlindMode = false;', sandbox);
  setLiveV4Attempt(sandbox, 'current-attempt');
  vm.runInContext(`
    currentLiveClassGrades['01'] = { score: { objectiveTotal: 56 } };
    currentLiveClassGradesAttemptId = 'old-attempt';
  `, sandbox);

  sandbox.renderLiveGrid([{
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 4,
    attemptId: 'current-attempt',
    scores: { part1: 21, part2: 18, pendingReview: true, serverGraded: true },
    answers: {}
  }]);

  assert.match(gridEl.innerHTML, /지필 39점 \(서술대기\)/);
  assert.doesNotMatch(gridEl.innerHTML, /56점/);
});

test('모의평가 좌석은 남아 있는 V4 캐시 대신 모의평가 소계를 표시한다', () => {
  const { sandbox, gridEl } = createClassroomEnv();
  vm.runInContext('isScoreBlindMode = false;', sandbox);
  sandbox.setCurrentLiveSession({ questionVersion: 3, attemptId: 'current-v3' });
  vm.runInContext(`
    currentLiveClassGrades['01'] = { score: { objectiveTotal: 56 } };
    currentLiveClassGradesAttemptId = 'old-v4';
  `, sandbox);

  sandbox.renderLiveGrid([{
    num: 1,
    numStr: '01',
    name: '김테스트',
    status: 'submitted',
    questionVersion: 3,
    attemptId: 'current-v3',
    scores: { part1: 21, part2: 18, total: 0, pendingReview: true },
    answers: {}
  }]);

  assert.match(gridEl.innerHTML, /소계 39점 \(검토대기\)/);
  assert.doesNotMatch(gridEl.innerHTML, /56점|지필 39점/);
});

test('이전 회차 class-grades 응답이 늦게 도착해도 새 회차 캐시에 저장하지 않는다', async () => {
  const { sandbox } = createClassroomEnv();
  let resolveRequest;
  sandbox.requestSecureEvaluationClassGrades = () => new Promise(resolve => { resolveRequest = resolve; });
  setLiveV4Attempt(sandbox, 'old-attempt');
  vm.runInContext(`currentLiveStudents = [{ status: 'submitted', attemptId: 'old-attempt' }];`, sandbox);

  const pending = sandbox.refreshLiveClassGrades('2-1');
  sandbox.setCurrentLiveSession({ questionVersion: 4, attemptId: 'new-attempt' });
  resolveRequest({ attemptId: 'old-attempt', grades: { '01': { score: { objectiveTotal: 56 } } } });
  await pending;

  assert.equal(vm.runInContext('currentLiveClassGradesAttemptId', sandbox), null);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentLiveClassGrades)', sandbox)), {});
});
