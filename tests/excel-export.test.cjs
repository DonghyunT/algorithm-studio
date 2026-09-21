const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const excelExportCode = fs.readFileSync(path.join(root, 'js/core/excel-export.js'), 'utf8');

function createSandbox() {
  const sandbox = {
    window: {},
    document: {
      createElement(tag) {
        return {
          tagName: tag,
          href: '',
          download: '',
          click() { this.clicked = true; }
        };
      },
      body: {
        appendChild() {},
        removeChild() {}
      }
    },
    URL: {
      createObjectURL(blob) { return 'blob://mock-excel-' + Date.now(); },
      revokeObjectURL() {}
    },
    Blob: class MockBlob {
      constructor(chunks, options) {
        this.chunks = chunks;
        this.options = options;
        this.size = chunks.reduce((acc, c) => acc + (c.byteLength || c.length || 0), 0);
      }
    },
    setTimeout,
    clearTimeout,
    Uint8Array,
    console
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(excelExportCode, ctx);
  return ctx;
}

test('excel-export: generateXlsxBinary produces valid PK0304 ZIP archive', () => {
  const ctx = createSandbox();
  const exportService = ctx.excelExportService;
  assert.ok(exportService, 'excelExportService should be available on window');

  const files = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types/>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8"?><workbook/>' }
  ];

  const binary = exportService.generateXlsxBinary(files);
  assert.ok(binary && (binary instanceof ctx.Uint8Array || binary.byteLength > 50), 'Output should have valid ZIP length');

  // Check PK0304 magic header (0x50, 0x4B, 0x03, 0x04)
  assert.equal(binary[0], 0x50, 'Byte 0 should be P');
  assert.equal(binary[1], 0x4B, 'Byte 1 should be K');
  assert.equal(binary[2], 0x03, 'Byte 2 should be 0x03');
  assert.equal(binary[3], 0x04, 'Byte 3 should be 0x04');
});

test('excel-export: buildWorkbookXmls produces multi-sheet structure with summary, student sheets, and NEIS sheet', () => {
  const ctx = createSandbox();
  const exportService = ctx.excelExportService;

  const classId = '2-6';
  const studentList = [
    {
      num: 1,
      numStr: '01',
      name: '강수아',
      status: 'submitted',
      submittedAt: '2026-09-21T09:30:00.000Z',
      scores: {
        serverGraded: true,
        part1: 0,
        part2: 0,
        total: 0
      },
      answers: {
        part3: {
          situation: '아침 기상 알람',
          goal: '정해진 시간에 깨우기',
          variables: '현재시간, 목표시간',
          conditions: '목표시간이 되면 소리 울리기'
        }
      }
    },
    {
      num: 2,
      numStr: '02',
      name: '고서누',
      status: 'submitted',
      submittedAt: '2026-09-21T09:32:00.000Z',
      scores: {
        serverGraded: true
      }
    }
  ];

  const classGrades = {
    '01': {
      scores: {
        part1: 27,
        part2: 25,
        writtenSubtotal: 52,
        part3: 38,
        total: 90,
        finalScore: 90,
        pendingReview: false
      },
      review: {
        proposal: {
          score: 38,
          criteria: {
            planScore: 10,
            planFeedback: '목표와 변수가 명확함',
            terminalScore: 10,
            terminalFeedback: '시작/끝 기호 정상',
            structureScore: 9,
            structureFeedback: '선택 구조 적절',
            executionScore: 9,
            executionFeedback: '정상 작동'
          },
          feedback: '매우 훌륭한 알고리즘 설계입니다.'
        },
        part1: [
          { qnum: 1, prompt: '추상화의 정의', myChoice: 1, answer: 1, isCorrect: true, score: 3, explanation: '핵심 요소 추출' }
        ],
        part2: [
          { qnum: 11, prompt: '단말 기호의 이름', myInput: '시작', answer: '시작/끝', isCorrect: true, score: 5, explanation: '시작과 끝' }
        ]
      }
    },
    '02': {
      scores: {
        part1: 30,
        part2: 30,
        writtenSubtotal: 60,
        part3: 40,
        total: 100,
        finalScore: 100
      }
    }
  };

  const files = exportService.generateWorkbookFiles(classId, studentList, classGrades);

  // 1. Check workbook.xml contains correct sheet names
  const workbookXml = files.find(f => f.name === 'xl/workbook.xml')?.content;
  assert.ok(workbookXml, 'xl/workbook.xml should exist');
  assert.ok(workbookXml.includes('name="학급종합"'), 'Workbook should have 학급종합 sheet');
  assert.ok(workbookXml.includes('name="01_강수아"'), 'Workbook should have 01_강수아 sheet');
  assert.ok(workbookXml.includes('name="02_고서누"'), 'Workbook should have 02_고서누 sheet');
  assert.ok(workbookXml.includes('name="나이스(NEIS) 양식"'), 'Workbook should have 나이스 양식 sheet');

  // 2. Check class summary sheet prevents Excel date coercion
  const summarySheet = files.find(f => f.name === 'xl/worksheets/sheet1.xml')?.content;
  assert.ok(summarySheet, 'sheet1.xml should be summary sheet');
  assert.ok(summarySheet.includes('inlineStr'), 'Cells should use inlineStr to prevent date coercion');
  assert.ok(summarySheet.includes('2-6') || summarySheet.includes('2학년 6반'), 'Class ID should be preserved without conversion to Feb-06');
  // 1차 채점 terminology
  assert.ok(summarySheet.includes('1차 채점'), 'Summary sheet should use 1차 채점 terminology instead of AI초벌채점');
  // Graded scores reflected
  assert.ok(summarySheet.includes('27'), 'Part 1 score 27 should be reflected in summary');
  assert.ok(summarySheet.includes('25'), 'Part 2 score 25 should be reflected in summary');
  assert.ok(summarySheet.includes('52'), 'Written subtotal 52 should be reflected in summary');

  // 3. Check individual student sheet (sheet 2 for student 1)
  const studentSheet = files.find(f => f.name === 'xl/worksheets/sheet2.xml')?.content;
  assert.ok(studentSheet, 'sheet2.xml should be student 1 sheet');
  assert.ok(studentSheet.includes('정보 알고리즘 스튜디오 수행평가 개인 성적표'), 'Student sheet should have individual report header');
  assert.ok(studentSheet.includes('아침 기상 알람'), 'Student sheet should contain Part 3 plan situation');
  assert.ok(studentSheet.includes('목표와 변수가 명확함'), 'Student sheet should contain plan feedback');
  assert.ok(studentSheet.includes('매우 훌륭한 알고리즘 설계입니다'), 'Student sheet should contain general feedback');
  assert.ok(studentSheet.includes('1차 채점'), 'Student sheet should use 1차 채점 terminology');

  // 4. Check NEIS sheet (last sheet, sheet 4)
  const neisSheet = files.find(f => f.name === 'xl/worksheets/sheet4.xml')?.content;
  assert.ok(neisSheet, 'sheet4.xml should be NEIS sheet');
  assert.ok(neisSheet.includes('순서도(1차)/40'), 'NEIS sheet should have 순서도(1차)/40 header');
  assert.ok(neisSheet.includes('지필소계/60'), 'NEIS sheet should have 지필소계/60 header');
  assert.ok(neisSheet.includes('52'), 'NEIS sheet should include written subtotal 52');
  assert.ok(neisSheet.includes('38'), 'NEIS sheet should include flowchart score 38');
});

test('excel-export: exportAssessmentWorkbook triggers download', () => {
  const ctx = createSandbox();
  const exportService = ctx.excelExportService;

  let clicked = false;
  let downloadedName = '';
  ctx.document.createElement = (tag) => {
    return {
      tagName: tag,
      href: '',
      set download(val) { downloadedName = val; },
      get download() { return downloadedName; },
      click() { clicked = true; }
    };
  };

  exportService.exportAssessmentWorkbook('2-6', [
    { num: 1, numStr: '01', name: '강수아', status: 'submitted', scores: {} }
  ], {});

  assert.ok(clicked, 'Download link click should have been triggered');
  assert.ok(downloadedName.includes('2-6') && downloadedName.endsWith('.xlsx'), 'File name should contain class ID and .xlsx extension');
});
