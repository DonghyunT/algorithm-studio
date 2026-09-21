const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

function setup() {
  const records = new Map(), copy = value => JSON.parse(JSON.stringify(value));
  let fail = false;
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
      if (fail) throw Error('write failed');
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

test('eval-entry-guard: blocks entry when session is ended', async () => {
  const { records, service } = setup();
  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'ended',
    attemptId: 'att-ended-1',
    deadlineMs: Date.now() - 10000
  });

  await assert.rejects(
    service.joinWaitingRoom('2-1', 10, '전출생'),
    /수행평가가 종료되었습니다/
  );
});

test('eval-entry-guard: blocks entry when in_progress session deadlineMs has expired', async () => {
  const { records, service } = setup();
  const now = Date.now();
  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'in_progress',
    attemptId: 'att-expired-1',
    startTime: new Date(now - 15 * 60000).toISOString(),
    deadlineMs: now - 5 * 60000 // 5 minutes ago
  });

  await assert.rejects(
    service.joinWaitingRoom('2-1', 10, '지각생'),
    /수행평가가 종료되었습니다/
  );
});

test('eval-entry-guard: allows entry when session is within deadline', async () => {
  const { records, service } = setup();
  const now = Date.now();
  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'in_progress',
    attemptId: 'att-active-1',
    questionVersion: 4,
    startTime: new Date(now - 5 * 60000).toISOString(),
    deadlineMs: now + 25 * 60000 // 25 minutes remaining
  });

  const student = await service.joinWaitingRoom('2-1', 10, '정상학생');
  assert.equal(student.num, 10);
  assert.equal(student.status, 'waiting');
  assert.equal(student.attemptId, 'att-active-1');
});

test('eval-entry-guard: preserves submitted student data after session ended and allows viewing result', async () => {
  const { records, service, setStudentUid } = setup();
  setStudentUid('submitted-student-uid');

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'ended',
    attemptId: 'att-ended-1',
    deadlineMs: Date.now() - 10000
  });

  records.set('classrooms/2-1/students/05', {
    num: 5,
    numStr: '05',
    name: '모범생',
    ownerUid: 'submitted-student-uid',
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    answers: { part1: { p1_01: 1 }, part2: {}, part3: {} }
  });

  const result = await service.joinWaitingRoom('2-1', 5, '모범생');
  assert.equal(result.status, 'submitted');
  assert.equal(result.name, '모범생');
  assert.equal(result.answers.part1.p1_01, 1);
});

test('eval-entry-guard: blocks foreign user from taking over another student seat', async () => {
  const { records, service, setStudentUid } = setup();

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'waiting',
    attemptId: 'att-wait-1'
  });

  records.set('classrooms/2-1/students/05', {
    num: 5,
    numStr: '05',
    name: '원래학생',
    ownerUid: 'original-owner-uid',
    status: 'waiting'
  });

  setStudentUid('attacker-uid');
  await assert.rejects(
    service.joinWaitingRoom('2-1', 5, '악용시도자'),
    /다른 응시 기록에 연결/
  );
});

test('eval-entry-guard: permits makeupAllowed student even after session ended', async () => {
  const { records, service, setStudentUid } = setup();
  setStudentUid('makeup-student-uid');

  records.set('classrooms/2-1', {
    classId: '2-1',
    status: 'ended',
    attemptId: 'att-ended-1',
    deadlineMs: Date.now() - 10000
  });

  records.set('classrooms/2-1/students/07', {
    num: 7,
    numStr: '07',
    name: '보충생',
    ownerUid: 'makeup-student-uid',
    status: 'in_progress',
    makeupAllowed: true,
    answers: { part1: {}, part2: {}, part3: {} }
  });

  const student = await service.joinWaitingRoom('2-1', 7, '보충생');
  assert.equal(student.num, 7);
  assert.equal(student.makeupAllowed, true);
});
