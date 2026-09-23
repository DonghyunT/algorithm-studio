const { createHmac } = require('node:crypto');
const { gunzipSync } = require('node:zlib');

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const LIMITS = Object.freeze({ questionText: 2000, optionText: 240, answerText: 160 });

function fail(message) { throw new Error(message); }
function isText(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function copyPublicPart1(question) {
  return { id: question.id, title: question.title, desc: question.desc, options: [...question.options], points: question.points };
}
function copyPublicPart2(question) {
  return { id: question.id, title: question.title, desc: question.desc, placeholder: question.placeholder, points: question.points };
}
function copyTeacherPart1(question, answer) {
  const isCorrect = answer !== undefined && answer !== null && Number(answer) === question.correctAnswer;
  return { ...copyPublicPart1(question), correctAnswer: question.correctAnswer, teacherNote: question.teacherNote, studentAnswer: answer ?? null, isCorrect, score: isCorrect ? question.points : 0 };
}
function copyTeacherPart2(question, answer) {
  const norm = value => typeof value === 'string' ? value.toLocaleLowerCase('ko-KR').replace(/\s+/g, '').trim() : '';
  const isCorrect = answer !== undefined && answer !== null && question.answers.some(a => norm(a) === norm(answer));
  return { ...copyPublicPart2(question), answers: [...question.answers], teacherNote: question.teacherNote, studentAnswer: answer ?? '', isCorrect, score: isCorrect ? question.points : 0 };
}

function validateQuestion(question, part, ids) {
  if (!question || typeof question !== 'object' || !ID.test(question.id || '') || ids.has(question.id)) fail('문항 은행 형식을 확인해 주세요.');
  if (!isText(question.title, 120) || !isText(question.desc, LIMITS.questionText) || !isText(question.teacherNote, 600) || !Number.isInteger(question.points) || question.points < 1 || question.points > 10) fail('문항 은행 형식을 확인해 주세요.');
  if (!['easy', 'medium', 'hard'].includes(question.difficulty) || !isText(question.subType, 40)) fail('문항 난이도 구성을 확인해 주세요.');
  if (part === 'part1') {
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 5 || question.options.some(option => !isText(option, LIMITS.optionText)) || !Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer >= question.options.length) fail('객관식 문항 형식을 확인해 주세요.');
  } else if (!isText(question.placeholder || '정답 입력', 120) || !Array.isArray(question.answers) || question.answers.length < 1 || question.answers.length > 32 || question.answers.some(answer => !isText(answer, LIMITS.answerText))) {
    fail('단답형 문항 형식을 확인해 주세요.');
  }
  ids.add(question.id);
}

function unpackRaw(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      return gunzipSync(buf).toString('utf8');
    }
  } catch {}
  return raw;
}

function parseEvaluationBank(raw) {
  const content = unpackRaw(raw);
  if (typeof content !== 'string' || content.length < 20 || content.length > 200000) fail('V4 문항 은행 설정을 확인해 주세요.');
  let bank;
  try { bank = JSON.parse(content); } catch { fail('V4 문항 은행 설정을 확인해 주세요.'); }
  if (!bank || bank.version !== 4 || !Array.isArray(bank.part1) || !Array.isArray(bank.part2)) fail('V4 문항 은행 설정을 확인해 주세요.');
  const ids = new Set();
  bank.part1.forEach(question => validateQuestion(question, 'part1', ids));
  bank.part2.forEach(question => validateQuestion(question, 'part2', ids));
  return { version: 4, part1: bank.part1, part2: bank.part2 };
}

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) fail('V4 문항 배정 설정을 확인해 주세요.');
  return secret;
}
function randomFor(secret, scope) {
  const key = requireSecret(secret);
  let counter = 0;
  return () => {
    const value = createHmac('sha256', key).update(String(scope) + ':' + counter++).digest().readUInt32BE(0);
    return value / 0x100000000;
  };
}
function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
function take(items, count, random) {
  if (items.length < count) fail('V4 문항 은행의 난이도 구성이 부족합니다.');
  return shuffled(items, random).slice(0, count);
}

function assignQuestions(bank, secret, scope) {
  const random = randomFor(secret, scope);

  const hasDomain = bank.part1.length > 0 && Boolean(bank.part1[0].domain) &&
                    bank.part2.length > 0 && Boolean(bank.part2[0].domain);

  if (hasDomain) {
    // ----------------------------------------------------
    // Part 1 도메인 균형 배정 (D1~D5 각 2문항 = 10문항, 하4/중4/상2 = 30점)
    // ----------------------------------------------------
    const dList = ['D1', 'D2', 'D3', 'D4', 'D5'];
    const shuffledD = shuffled(dList, random);
    const hardD1 = shuffledD[0];
    const hardD2 = shuffledD[1];
    const remainingD = shuffledD.slice(2);

    const part1Map = {};
    part1Map[hardD1] = [
      ...take(bank.part1.filter(q => q.domain === hardD1 && q.difficulty === 'hard'), 1, random),
      ...take(bank.part1.filter(q => q.domain === hardD1 && q.difficulty === 'easy'), 1, random)
    ];
    part1Map[hardD2] = [
      ...take(bank.part1.filter(q => q.domain === hardD2 && q.difficulty === 'hard'), 1, random),
      ...take(bank.part1.filter(q => q.domain === hardD2 && q.difficulty === 'medium'), 1, random)
    ];
    for (const d of remainingD) {
      part1Map[d] = [
        ...take(bank.part1.filter(q => q.domain === d && q.difficulty === 'easy'), 1, random),
        ...take(bank.part1.filter(q => q.domain === d && q.difficulty === 'medium'), 1, random)
      ];
    }
    const part1 = dList.flatMap(d => part1Map[d]);

    // ----------------------------------------------------
    // Part 2 도메인 균형 배정 (S1~S6 각 1문항 = 6문항, 하2/중2/상2 = 30점)
    // ----------------------------------------------------
    const sList = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    const shuffledS = shuffled(sList, random);
    const hardS = shuffledS.slice(0, 2);
    const medS = shuffledS.slice(2, 4);
    const easyS = shuffledS.slice(4, 6);

    const part2Map = {};
    for (const s of hardS) {
      part2Map[s] = take(bank.part2.filter(q => q.domain === s && q.difficulty === 'hard'), 1, random)[0];
    }
    for (const s of medS) {
      part2Map[s] = take(bank.part2.filter(q => q.domain === s && q.difficulty === 'medium'), 1, random)[0];
    }
    for (const s of easyS) {
      part2Map[s] = take(bank.part2.filter(q => q.domain === s && q.difficulty === 'easy'), 1, random)[0];
    }
    const part2 = sList.map(s => part2Map[s]);

    return { part1, part2 };
  }

  const part1 = [
    ...take(bank.part1.filter(question => question.difficulty === 'easy' && question.subType === 'concept'), 3, random),
    ...take(bank.part1.filter(question => question.difficulty === 'easy' && question.subType === 'applied'), 1, random),
    ...take(bank.part1.filter(question => question.difficulty === 'medium'), 4, random),
    ...take(bank.part1.filter(question => question.difficulty === 'hard'), 2, random)
  ];
  const part2 = [
    ...take(bank.part2.filter(question => question.difficulty === 'easy'), 2, random),
    ...take(bank.part2.filter(question => question.difficulty === 'medium'), 2, random),
    ...take(bank.part2.filter(question => question.difficulty === 'hard' && question.subType === 'trace'), 1, random),
    ...take(bank.part2.filter(question => question.difficulty === 'hard' && question.subType === 'scenario'), 1, random)
  ];
  return { part1, part2 };
}

function publicAssignment(assignment) {
  return { version: 4, part1: assignment.part1.map(copyPublicPart1), part2: assignment.part2.map(copyPublicPart2) };
}
function teacherReview(assignment, answers = {}) {
  const part1Answers = answers && typeof answers.part1 === 'object' && answers.part1 ? answers.part1 : {};
  const part2Answers = answers && typeof answers.part2 === 'object' && answers.part2 ? answers.part2 : {};
  return {
    version: 4,
    part1: assignment.part1.map(question => copyTeacherPart1(question, part1Answers[question.id])),
    part2: assignment.part2.map(question => copyTeacherPart2(question, part2Answers[question.id]))
  };
}
function normalise(value) { return typeof value === 'string' ? value.toLocaleLowerCase('ko-KR').replace(/\s+/g, '').trim() : ''; }
function gradeAssignment(assignment, answers = {}) {
  const part1Answers = answers && typeof answers.part1 === 'object' && answers.part1 ? answers.part1 : {};
  const part2Answers = answers && typeof answers.part2 === 'object' && answers.part2 ? answers.part2 : {};
  const part1 = assignment.part1.reduce((score, question) => score + (part1Answers[question.id] === question.correctAnswer ? question.points : 0), 0);
  const part2 = assignment.part2.reduce((score, question) => score + (question.answers.some(answer => normalise(answer) === normalise(part2Answers[question.id])) ? question.points : 0), 0);
  return { part1, part2, objectiveTotal: part1 + part2, questionCount: { part1: assignment.part1.length, part2: assignment.part2.length } };
}

function loadEvaluationBank(env = process.env) {
  return parseEvaluationBank(env.EVAL_BANK_V4_JSON);
}

module.exports = { parseEvaluationBank, loadEvaluationBank, assignQuestions, publicAssignment, teacherReview, gradeAssignment };
