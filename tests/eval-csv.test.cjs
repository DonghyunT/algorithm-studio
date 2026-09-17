const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createEvalServiceContext() {
  const ctx = {
    window: { authService: { isDemo: () => true } },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    BroadcastChannel: class { addEventListener() {} postMessage() {} },
    console,
    module: {},
    exports: {}
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '../js/core/eval-service.js'), 'utf8');
  vm.runInContext(code, ctx);
  return ctx.window.evalService;
}

test('formatNeisCSVRows generates correct header with 지필소계/60', () => {
  const evalService = createEvalServiceContext();
  const rows = evalService.formatNeisCSVRows('2-1', []);
  assert.equal(rows.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rows[0])), [
    '학급', '번호', '이름', '응시상태',
    '객관식/30', '단답형/30', '지필소계/60', '순서도/40',
    '자동채점 총점', '교사 조정', '최종 점수', '제출시각'
  ]);
});

test('formatNeisCSVRows correctly computes 지필소계 and formats Korean status and timestamp', () => {
  const evalService = createEvalServiceContext();
  const testStudents = [
    {
      num: 2,
      name: '이순신',
      status: 'submitted',
      submittedAt: '2026-09-17T09:30:00.000Z',
      scores: {
        part1: 25,
        part2: 20,
        part3: 35,
        total: 80,
        teacherOverride: 85
      }
    },
    {
      num: 1,
      name: '홍길동',
      status: 'in_progress',
      submittedAt: null,
      scores: {
        part1: 15,
        part2: 10,
        pendingReview: true
      }
    },
    {
      num: 3,
      name: '강감찬',
      status: 'waiting',
      submittedAt: null,
      scores: {}
    }
  ];

  const rows = evalService.formatNeisCSVRows('2-1', testStudents);
  assert.equal(rows.length, 4); // 헤더 1 + 학생 3

  // 정렬 순서: 1번 -> 2번 -> 3번
  const s1 = rows[1];
  assert.equal(s1[1], 1);
  assert.equal(s1[2], '홍길동');
  assert.equal(s1[3], '풀이중');
  assert.equal(s1[4], 15);
  assert.equal(s1[5], 10);
  assert.equal(s1[6], 25); // 지필소계 = 15 + 10
  assert.equal(s1[7], '채점 대기');
  assert.equal(s1[11], '');

  const s2 = rows[2];
  assert.equal(s2[1], 2);
  assert.equal(s2[2], '이순신');
  assert.equal(s2[3], '제출완료');
  assert.equal(s2[4], 25);
  assert.equal(s2[5], 20);
  assert.equal(s2[6], 45); // 지필소계 = 25 + 20
  assert.equal(s2[7], 35);
  assert.equal(s2[8], 80);
  assert.equal(s2[9], 85);
  assert.equal(s2[10], 85);
  assert.match(s2[11], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/); // YYYY-MM-DD HH:mm 포맷

  const s3 = rows[3];
  assert.equal(s3[1], 3);
  assert.equal(s3[2], '강감찬');
  assert.equal(s3[3], '대기중');
  assert.equal(s3[6], 0); // 기본 0
});
