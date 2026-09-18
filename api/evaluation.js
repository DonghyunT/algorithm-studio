const { verifyFirebaseToken } = require('../server/firebase-token.cjs');
const { loadEvaluationBank, assignQuestions, publicAssignment, teacherReview, gradeAssignment } = require('../server/evaluation-bank.cjs');

const CLASS_ID = /^2-(?:[1-9]|10|11)$/;
const STUDENT_NUM = /^(?:0[1-9]|1[0-9]|2[0-7])$/;

function decode(value) {
  if (value?.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  if (value?.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value?.integerValue !== undefined) return Number(value.integerValue);
  if (value?.doubleValue !== undefined) return value.doubleValue;
  if (value?.booleanValue !== undefined) return value.booleanValue;
  if (value?.nullValue !== undefined) return null;
  return value?.stringValue ?? null;
}
function validTarget(body) {
  if (!body) return false;
  if (typeof body.studentNum === 'number' || typeof body.studentNum === 'string') {
    const num = Number(body.studentNum);
    if (Number.isInteger(num) && num >= 1 && num <= 27) {
      body.studentNum = String(num).padStart(2, '0');
    }
  }
  return CLASS_ID.test(body.classId || '') && STUDENT_NUM.test(body.studentNum || '');
}
function scopeFor(session, classId, studentNum) { return `${session.attemptId}:${classId}:${studentNum}`; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, error) => res.status(status).json({ error });
  if (req.method !== 'POST') return fail(405, 'POST 요청만 사용할 수 있습니다.');
  const body = req.body || {};
  const isBankExport = body.action === 'export-bank';
  if (!['questions', 'student-score', 'grade', 'review', 'export-bank'].includes(body.action) || (!isBankExport && !validTarget(body)) || JSON.stringify(body).length > 1000) return fail(400, '요청 내용을 확인해 주세요.');
  const token = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
  const project = process.env.FIREBASE_PROJECT_ID || 'donghyun-algo';
  let claims;
  try { claims = await verifyFirebaseToken(token, project); } catch { return fail(401, '로그인을 확인한 뒤 다시 시도해 주세요.'); }
  const read = async path => {
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw Error('forbidden');
    const data = await response.json();
    return decode({ mapValue: { fields: data.fields } });
  };
  const readSessionAndStudent = async () => {
    const session = await read('classrooms/' + body.classId);
    const student = await read(`classrooms/${body.classId}/students/${body.studentNum}`);
    if (session.questionVersion !== 4 || !session.attemptId || student.attemptId !== session.attemptId) throw Error('round');
    return { session, student };
  };
  let bank;
  try { bank = loadEvaluationBank(); } catch (err) { console.error('[LOAD_EVAL_BANK_FAIL]', err.message); return fail(503, '실전평가 문항 설정을 확인 중입니다. 선생님께 준비 상태를 확인해 주세요.'); }
  if (typeof process.env.EVAL_ASSIGNMENT_SECRET !== 'string' || process.env.EVAL_ASSIGNMENT_SECRET.length < 32) {
    return fail(503, '실전평가 문항 배정 설정을 확인 중입니다. 선생님께 준비 상태를 확인해 주세요.');
  }

  if (body.action === 'questions') {
    if (claims.firebase?.sign_in_provider !== 'anonymous') return fail(403, '학생 평가 로그인으로만 문항을 열 수 있습니다.');
    try {
      const { session, student } = await readSessionAndStudent();
      const isStudentActive = session.status === 'in_progress' || (student.makeupAllowed === true && student.status === 'in_progress');
      if (student.ownerUid !== claims.sub || !isStudentActive || student.status === 'submitted') return fail(403, '현재 본인의 진행 중인 평가 문항만 열 수 있습니다.');
      const assignment = assignQuestions(bank, process.env.EVAL_ASSIGNMENT_SECRET, scopeFor(session, body.classId, body.studentNum));
      return res.status(200).json({ attemptId: session.attemptId, questions: publicAssignment(assignment) });
    } catch (error) {
      if (error.message === 'round') return fail(409, '현재 실전평가 회차가 아니거나 회차 정보가 바뀌었습니다. 새로고침한 뒤 다시 확인해 주세요.');
      return fail(403, '평가 문항을 확인할 권한이 없거나 평가가 아직 시작되지 않았습니다.');
    }
  }

  if (body.action === 'student-score') {
    if (claims.firebase?.sign_in_provider !== 'anonymous') return fail(403, '학생 평가 로그인으로만 점수를 확인할 수 있습니다.');
    try {
      const { session, student } = await readSessionAndStudent();
      if (student.ownerUid !== claims.sub) return fail(403, '본인의 평가 점수만 확인할 수 있습니다.');
      if (student.status !== 'submitted') return res.status(200).json({ ready: false, status: 'pending' });
      const assignment = assignQuestions(bank, process.env.EVAL_ASSIGNMENT_SECRET, scopeFor(session, body.classId, body.studentNum));
      const score = gradeAssignment(assignment, student.answers);
      return res.status(200).json({
        ready: true,
        status: 'ready',
        score: { part1: score.part1, part2: score.part2, objectiveTotal: score.objectiveTotal },
        rubricVersion: 'v4-server-objective'
      });
    } catch (error) {
      if (error.message === 'round') return fail(409, '현재 실전평가 회차가 아니거나 회차 정보가 바뀌었습니다. 새로고침한 뒤 다시 확인해 주세요.');
      return fail(403, '학생 점수를 확인할 권한이 없거나 제출 상태를 확인할 수 없습니다.');
    }
  }

  if (body.action === 'export-bank') {
    if (claims.firebase?.sign_in_provider === 'anonymous') return fail(403, '교사 로그인으로만 문항 은행을 내보낼 수 있습니다.');
    let role;
    try {
      role = await read('teachers/' + encodeURIComponent(claims.sub));
      const allowed = role.enabled === true && (role.allClasses === true || (Array.isArray(role.classIds) && role.classIds.length > 0));
      if (!allowed) return fail(403, '문항 은행을 내보낼 권한이 없습니다. 관리자에게 교사 권한을 확인해 주세요.');
    } catch { return fail(403, '교사 권한을 확인하지 못했습니다.'); }
    return res.status(200).json({
      ok: true,
      bank: { version: bank.version, part1: bank.part1, part2: bank.part2 }
    });
  }

  let role;
  try {
    role = await read('teachers/' + encodeURIComponent(claims.sub));
    const allowed = role.enabled === true && (role.allClasses === true || (Array.isArray(role.classIds) && role.classIds.includes(body.classId)));
    if (!allowed) return fail(403, '이 학급의 채점 결과를 볼 권한이 없습니다. 담당 학급 설정을 확인해 주세요.');
  } catch { return fail(403, '교사 권한을 확인하지 못했습니다.'); }
  try {
    const { session, student } = await readSessionAndStudent();
    if (student.status !== 'submitted') return fail(409, '제출이 완료된 답안만 서버 채점 결과를 확인할 수 있습니다.');
    const assignment = assignQuestions(bank, process.env.EVAL_ASSIGNMENT_SECRET, scopeFor(session, body.classId, body.studentNum));
    if (body.action === 'review') {
      return res.status(200).json({ attemptId: session.attemptId, review: teacherReview(assignment, student.answers), rubricVersion: 'v4-server-objective' });
    }
    return res.status(200).json({ attemptId: session.attemptId, score: gradeAssignment(assignment, student.answers), rubricVersion: 'v4-server-objective' });
  } catch (error) {
    if (error.message === 'round') return fail(409, '현재 실전평가 회차가 아니거나 회차 정보가 바뀌었습니다.');
    return fail(403, '제출 답안을 읽을 수 없습니다. 담당 학급과 회차를 확인해 주세요.');
  }
};
