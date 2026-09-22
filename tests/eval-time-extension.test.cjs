const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

function setup() {
  const records = new Map(), copy = value => JSON.parse(JSON.stringify(value));
  function ref(path) {
    return {
      path,
      id: path.split('/').pop(),
      delete: async () => { records.delete(path); },
      collection: name => ({
        doc: id => ref(path + '/' + name + '/' + id),
        get: async () => {
          const prefix = path + '/' + name + '/';
          const docs = [...records.keys()].filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')).map(k => ({
            id: k.split('/').pop(),
            ref: ref(k),
            data: () => copy(records.get(k) || {})
          }));
          return { forEach: fn => docs.forEach(fn), docs };
        }
      }),
      update: async value => { records.set(path, { ...records.get(path), ...copy(value) }); },
      get: async () => ({ exists: records.has(path), id: path.split('/').pop(), ref: ref(path), data: () => copy(records.get(path) || {}) })
    };
  }
  const db = {
    collection: name => ({ doc: id => ref(name + '/' + id) }),
    batch: () => ({ update: (d, val) => { records.set(d.path, { ...records.get(d.path), ...copy(val) }); }, commit: async () => {} }),
    runTransaction: async task => {
      const writes = [];
      const result = await task({
        get: async doc => ({ exists: records.has(doc.path), id: doc.id, ref: doc, data: () => copy(records.get(doc.path) || {}) }),
        set: (doc, value) => writes.push(['set', doc.path, copy(value)]),
        update: (doc, value) => writes.push(['update', doc.path, copy(value)]),
        delete: doc => writes.push(['delete', doc.path])
      });
      for (const [type, path, value] of writes) {
        if (type === 'delete') records.delete(path);
        else records.set(path, type === 'update' ? { ...records.get(path), ...value } : value);
      }
      return result;
    }
  };

  let studentUid = 'student-uid-1';
  const ctx = {
    window: {
      firebaseDb: db,
      authService: {
        isDemo: () => false,
        teacher: async () => ({ uid: 'teacher' }),
        student: async () => ({ uid: studentUid })
      }
    },
    crypto,
    console,
    Map,
    Set
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data/eval-question-bank.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data/eval-questions.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/core/assessment-policy.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/core/eval-service.js'), 'utf8'), ctx);

  return {
    records,
    service: ctx.window.evalService,
    setStudentUid: uid => { studentUid = uid; }
  };
}

test('serverTimeOffset: correctly syncs server time and offsets getNow', () => {
  const { service } = setup();
  assert.equal(service.serverTimeOffset, 0);

  // 로컬 시계가 10분 빠른 상황: 서버 시간(50분), 로컬 시간(60분)
  const localTime = Date.now();
  const serverTime = localTime - 600000; // 10 minutes behind
  service.syncServerTime(serverTime);

  // offset은 약 -600000ms 여야 함
  assert.ok(service.serverTimeOffset <= -599000 && service.serverTimeOffset >= -601000);

  const calculatedNow = service.getNow();
  assert.ok(Math.abs(calculatedNow - serverTime) < 500);

  // 수동 오프셋 설정 검증
  service.setServerTimeOffset(30000);
  assert.equal(service.serverTimeOffset, 30000);
  assert.ok(Math.abs(service.getNow() - (Date.now() + 30000)) < 100);
});

test('reopenStudentExam: preserves all student answers, resets status to in_progress, and extends deadline', async () => {
  const { records, service } = setup();
  const now = service.getNow();

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'in_progress',
    attemptId: 'att-1',
    deadlineMs: now + 10 * 60000
  });

  const originalAnswers = {
    part1: { q1: 1, q2: 2 },
    part2: { q11: '선택구조' },
    part3: {
      plan: { current: '배고픔', goal: '배부름', conditions: '빠르게' },
      blocks: [{ id: 'b1', text: '라면 끓이기', shape: 'proc' }],
      connections: []
    }
  };

  records.set('classrooms/2-1/students/05', {
    studentNum: 5,
    studentName: '김민수',
    status: 'submitted',
    submittedAt: new Date(now - 60000).toISOString(),
    answers: originalAnswers,
    scores: { total: 45, part1: 20, part2: 15, part3: 10 }
  });

  // 10분 추가 시간과 함께 재오픈
  await service.reopenStudentExam('2-1', 5, 10);

  const updatedStudent = records.get('classrooms/2-1/students/05');
  assert.equal(updatedStudent.status, 'in_progress');
  assert.equal(updatedStudent.makeupAllowed, true);
  assert.equal(updatedStudent.allowReconnect, true, '새 PC 재접속을 위해 allowReconnect 허용 플래그 확인');
  
  // 답안 100% 보존 확인
  assert.deepEqual(updatedStudent.answers.part1, originalAnswers.part1);
  assert.deepEqual(updatedStudent.answers.part2, originalAnswers.part2);
  assert.deepEqual(updatedStudent.answers.part3, originalAnswers.part3);

  // 개인 연장 만료 시간 검증: now + 10분 (약 600,000ms)
  assert.ok(updatedStudent.individualDeadlineMs >= now + 9.9 * 60000);
  assert.ok(updatedStudent.individualDeadlineMs <= now + 10.1 * 60000);

  // 감사 아카이브 생성 확인 (classrooms/2-1/archives/)
  const archiveKey = [...records.keys()].find(k => k.startsWith('classrooms/2-1/archives/'));
  assert.ok(archiveKey, '감사 아카이브 레코드가 생성되어야 함');
  const studentArchiveKey = [...records.keys()].find(k => k.startsWith('classrooms/2-1/archives/') && k.endsWith('/students/05'));
  assert.ok(studentArchiveKey, '학생 답안 보존 아카이브가 생성되어야 함');
  const archiveData = records.get(studentArchiveKey);
  assert.deepEqual(archiveData.answers, originalAnswers);
});

test('extendStudentTime: adds individual deadline minutes for student in progress', async () => {
  const { records, service } = setup();
  const now = service.getNow();

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'in_progress',
    attemptId: 'att-1',
    deadlineMs: now + 10 * 60000
  });

  records.set('classrooms/2-1/students/07', {
    studentNum: 7,
    studentName: '이영희',
    status: 'in_progress',
    individualDeadlineMs: now + 8 * 60000
  });

  // 5분 연장
  await service.extendStudentTime('2-1', 7, 5);

  const updatedStudent = records.get('classrooms/2-1/students/07');
  // 기존 8분 남은 상태에서 5분 추가 -> 13분
  assert.ok(updatedStudent.individualDeadlineMs >= now + 12.9 * 60000);
  assert.ok(updatedStudent.individualDeadlineMs <= now + 13.1 * 60000);
});

test('extendClassSessionTime: extends deadlineMs and updates durationMinutes for entire class session', async () => {
  const { records, service } = setup();
  const now = service.getNow();

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'in_progress',
    attemptId: 'att-1',
    durationMinutes: 30,
    deadlineMs: now + 10 * 60000
  });

  // 학급 전체 5분 연장
  await service.extendClassSessionTime('2-1', 5);

  const updatedSession = records.get('classrooms/2-1');
  assert.equal(updatedSession.durationMinutes, 35);
  // 기존 deadlineMs + 5분(300,000ms)
  assert.ok(updatedSession.deadlineMs >= now + 14.9 * 60000);
  assert.ok(updatedSession.deadlineMs <= now + 15.1 * 60000);
});

test('classroom action handlers: verify handleTeacherExtendClassTime, handleReopenStudent, handleExtendStudent interface', async () => {
  const classroom = require('../js/core/classroom.js');
  assert.equal(typeof classroom.handleTeacherExtendClassTime, 'function');
  assert.equal(typeof classroom.handleReopenStudent, 'function');
  assert.equal(typeof classroom.handleExtendStudent, 'function');
  assert.equal(typeof classroom.openLiveStudentModal, 'function');
  assert.equal(typeof classroom.closeLiveStudentModal, 'function');
});

test('demo mode: BroadcastChannel real-time sync for extendStudentTime and forceSubmitStudentExam', async () => {
  class MockBroadcastChannel {
    static channels = new Map();
    constructor(name) {
      this.name = name;
      this.listeners = [];
      if (!MockBroadcastChannel.channels.has(name)) MockBroadcastChannel.channels.set(name, []);
      MockBroadcastChannel.channels.get(name).push(this);
    }
    addEventListener(event, fn) { if (event === 'message') this.listeners.push(fn); }
    postMessage(data) {
      const list = MockBroadcastChannel.channels.get(this.name) || [];
      for (const ch of list) { if (ch !== this) { for (const l of ch.listeners) l({ data }); } }
    }
  }

  function makeDemoEnv(storage = {}) {
    const sessionStorage = {
      getItem: k => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: k => { delete storage[k]; }
    };
    const ctx = {
      window: {
        authService: { isDemo: () => true, teacher: async () => ({ uid: 'demo-teacher' }), student: async () => ({ uid: 'demo-student' }) }
      },
      location: { hostname: 'localhost', search: '?demo=1' },
      BroadcastChannel: MockBroadcastChannel,
      sessionStorage,
      console,
      crypto,
      Set,
      Map,
      Date
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(require.resolve('../js/core/eval-service.js'), 'utf8'), ctx);
    return { ctx, service: ctx.window.evalService, storage };
  }

  const teacher = makeDemoEnv();
  const student = makeDemoEnv();
  const classId = '2-10';

  await teacher.service.prepareSession(classId);
  await student.service.joinWaitingRoom(classId, 1, '홍길동');
  await teacher.service.startSession(classId, 30);

  let studentData = null;
  student.service.listenStudent(classId, 1, st => { studentData = st; });

  await student.service.updateStudentProgress(classId, 1, { part1: 5 }, { part1: { q1: 1 } });
  assert.equal(studentData.status, 'in_progress');

  // 교사 10분 연장 -> 학생 탭 실시간 동기화
  const extendRes = await teacher.service.extendStudentTime(classId, 1, 10);
  assert.equal(studentData.individualDeadlineMs, extendRes.deadlineMs);

  // 교사 강제 정상 제출 마감 -> 학생 탭 실시간 동기화
  await teacher.service.forceSubmitStudentExam(classId, 1);
  assert.equal(studentData.status, 'submitted');
  assert.equal(studentData.submittedBy, 'teacher_force');
});


