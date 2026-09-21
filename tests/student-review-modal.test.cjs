const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read lab-eval.js and extract renderReviewModalContent method
const labEvalCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'labs', 'lab-eval.js'), 'utf8');

// Create an isolated instance of StudentEvalApp with renderReviewModalContent
function extractMethod(code, methodName) {
  const startIdx = code.indexOf(methodName + '(container');
  if (startIdx === -1) throw new Error(`Method ${methodName} not found`);
  let braceCount = 0;
  let started = false;
  let endIdx = -1;
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      started = true;
    } else if (code[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error(`Could not find end of method ${methodName}`);
  return 'function ' + code.slice(startIdx, endIdx);
}

function createEvalApp() {
  const sandbox = {
    currentQuestions: () => ({ part1: [], part2: [] }),
    answers: { part1: {}, part2: {} }
  };

  const methodCode = extractMethod(labEvalCode, 'renderReviewModalContent');
  const fn = new Function('return ' + methodCode)();
  sandbox.renderReviewModalContent = fn.bind(sandbox);
  return sandbox;
}

test('student review modal renders Part 1, Part 2, and Part 3 correctly with V4 server data', () => {
  const app = createEvalApp();
  const container = { innerHTML: '' };

  const reviewData = {
    version: 4,
    part1: [
      {
        id: 'p1_01',
        title: '알고리즘의 개념',
        desc: '문제를 해결하기 위한 명확한 절차나 규칙의 모음을 무엇이라 하는가?',
        options: ['데이터베이스', '알고리즘', '인터페이스', '네트워크'],
        points: 3,
        correctAnswer: 1,
        studentAnswer: 1,
        isCorrect: true,
        teacherNote: '문제를 해결하기 위한 유한한 절차를 알고리즘이라고 합니다.'
      },
      {
        id: 'p1_02',
        title: '순서도 기호',
        desc: '순서도에서 조건을 판단하여 흐름을 분기할 때 사용하는 기호는?',
        options: ['타원 (단말)', '직사각형 (처리)', '마름모 (판단)', '평행사변형 (자료)'],
        points: 3,
        correctAnswer: 2,
        studentAnswer: 1,
        isCorrect: false,
        teacherNote: '조건에 따른 분기는 마름모(판단) 기호를 사용합니다.'
      }
    ],
    part2: [
      {
        id: 'p2_01',
        title: '선택 구조 키워드',
        desc: '프로그래밍에서 특정 조건이 참일 때만 실행하도록 하는 제어 구조는?',
        placeholder: '정답 입력',
        points: 5,
        answers: ['선택', '선택구조', '조건', '조건문'],
        studentAnswer: '선택구조',
        isCorrect: true,
        teacherNote: '조건에 따라 분기하는 구조는 선택 구조(조건문)입니다.'
      },
      {
        id: 'p2_02',
        title: '반복문 변수',
        desc: '동일한 작업을 5회 수행할 때 카운트 역할을 하는 변수의 이름으로 가장 적절한 것은?',
        placeholder: '정답 입력',
        points: 5,
        answers: ['count', 'i', '카운트'],
        studentAnswer: 'total',
        isCorrect: false,
        teacherNote: '반복 횟수를 세는 변수는 count, i 등이 주로 사용됩니다.'
      }
    ]
  };

  const scores = {
    part1: 3,
    part2: 5,
    objectiveTotal: 8,
    questionCount: { part1: 2, part2: 2 }
  };

  const part3Data = {
    total: 36,
    confirmed: true,
    criteria: [
      { title: '1. 문제 해결 계획의 적절성', score: 9, evidence: '문제 분해가 매우 논리적임' },
      { title: '2. 시작/종료 기호의 올바른 사용', score: 10, evidence: '시작 및 종료 단말 정확히 배치' },
      { title: '3. 제어 구조(순차·선택·반복) 구현', score: 9, evidence: '선택 구조 조건식 명확' },
      { title: '4. 실행 결과의 올바름', score: 8, evidence: '예외 입력 처리 보완 필요' }
    ],
    feedback: '전반적으로 순서도 구조와 제어 흐름이 매우 훌륭합니다.'
  };

  app.renderReviewModalContent(container, reviewData, {}, scores, part3Data);
  const html = container.innerHTML;

  // 1. 요약 헤더 검증
  assert.ok(html.includes('객관·단답 지필소계: <span class="text-indigo-600 font-mono">8점</span> / 60점'));
  assert.ok(html.includes('36점 (선생님 확정)'));

  // 2. Part 1 객관식 검증
  assert.ok(html.includes('Q1. [배점 3점] 문제를 해결하기 위한 명확한 절차나 규칙의 모음을 무엇이라 하는가?'));
  assert.ok(html.includes('⭕ 정답 (+3점)'));
  assert.ok(html.includes('내가 선택한 답:</span>\n              <span class="font-black text-emerald-700 ml-1">2번 (알고리즘)</span>'));
  assert.ok(html.includes('실제 정답:</span>\n              <span class="font-black text-indigo-700 ml-1">2번 (알고리즘)</span>'));
  assert.ok(html.includes('💡 <strong>해설:</strong> 문제를 해결하기 위한 유한한 절차를 알고리즘이라고 합니다.'));

  assert.ok(html.includes('Q2. [배점 3점] 순서도에서 조건을 판단하여 흐름을 분기할 때 사용하는 기호는?'));
  assert.ok(html.includes('❌ 오답 (0점)'));
  assert.ok(html.includes('내가 선택한 답:</span>\n              <span class="font-black text-rose-700 ml-1">2번 (직사각형 (처리))</span>'));
  assert.ok(html.includes('실제 정답:</span>\n              <span class="font-black text-indigo-700 ml-1">3번 (마름모 (판단))</span>'));

  // 3. Part 2 단답형 검증
  assert.ok(html.includes('Q11. [배점 5점] 프로그래밍에서 특정 조건이 참일 때만 실행하도록 하는 제어 구조는?'));
  assert.ok(html.includes('인정 정답:</span>\n              <span class="font-black text-indigo-700 ml-1">선택, 선택구조, 조건, 조건문</span>'));
  assert.ok(html.includes('내가 입력한 답:</span>\n              <span class="font-black text-emerald-700 ml-1">선택구조</span>'));

  assert.ok(html.includes('Q12. [배점 5점] 동일한 작업을 5회 수행할 때 카운트 역할을 하는 변수의 이름으로 가장 적절한 것은?'));
  assert.ok(html.includes('내가 입력한 답:</span>\n              <span class="font-black text-rose-700 ml-1">total</span>'));

  // 4. Part 3 순서도 검증
  assert.ok(html.includes('1. 문제 해결 계획의 적절성'));
  assert.ok(html.includes('9 / 10점'));
  assert.ok(html.includes('문제 분해가 매우 논리적임'));
  assert.ok(html.includes('36 / 40점'));
  assert.ok(html.includes('전반적으로 순서도 구조와 제어 흐름이 매우 훌륭합니다.'));
  assert.ok(html.includes('선생님 확정 완료'));
});

test('student review modal renders Part 3 proposal state correctly when unconfirmed', () => {
  const app = createEvalApp();
  const container = { innerHTML: '' };

  const reviewData = { version: 4, part1: [], part2: [] };
  const scores = { part1: 0, part2: 0, objectiveTotal: 0 };
  const part3Data = {
    total: 32,
    confirmed: false,
    criteria: [
      { title: '1. 문제 해결 계획의 적절성', score: 8, feedback: '계획 수립 보통' }
    ],
    feedback: 'AI 1차 채점 결과입니다.'
  };

  app.renderReviewModalContent(container, reviewData, {}, scores, part3Data);
  const html = container.innerHTML;

  assert.ok(html.includes('32점 (1차 채점)'));
  assert.ok(html.includes('1차 채점 완료'));
  assert.ok(html.includes('32 / 40점'));
  assert.ok(html.includes('AI 1차 채점 결과입니다.'));
});
