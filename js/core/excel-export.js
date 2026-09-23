/**
 * ==============================================================================
 * 📊 [ExcelExportService: 순수 웹 표준 올인원 엑셀 성적표 생성 엔진]
 * ==============================================================================
 * - 외부 라이브러리(CDN 등) 의존성 없는 순수 Vanilla JS 기반 OpenXML(.xlsx) 생성
 * - PK0304 Store(무압축) ZIP 구조 및 표준 OpenXML SpreadsheetML 명세 준수
 * - 구성 시트:
 *   1. [학급종합]: 전체 종합 성적표 (학급명 날짜 왜곡 버그 차단, 지필소계, 1차 채점 반영)
 *   2. [01_강수아] ~ [27_장성모]: 학생별 A4 1장 인쇄 맞춤형 개별 성적표
 *   3. [나이스(NEIS) 양식]: 나이스 지필·수행평가 입력 시스템 복사/가져오기 전용 표준 표
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ExcelExportService = factory();
    root.excelExportService = new root.ExcelExportService();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // CRC-32 Lookup Table
  const crcTable = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function encodeUtf8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8');
    }
    const bin = unescape(encodeURIComponent(str));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function concatUint8Arrays(arrays) {
    let totalLen = 0;
    for (let i = 0; i < arrays.length; i++) totalLen += arrays[i].length;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < arrays.length; i++) {
      result.set(arrays[i], offset);
      offset += arrays[i].length;
    }
    return result;
  }

  function createZip(files) {
    const localEntries = [];
    const centralEntries = [];
    let offset = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nameBuf = encodeUtf8(file.name);
      const dataBuf = typeof file.data === 'string' ? encodeUtf8(file.data) : file.data;
      const crc = crc32(dataBuf);
      const size = dataBuf.length;

      // Local Header (30 bytes + nameBuf.length)
      const localHeader = new Uint8Array(30 + nameBuf.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);  // version needed
      lv.setUint16(6, 0, true);   // general purpose flag
      lv.setUint16(8, 0, true);   // method = store (0)
      lv.setUint16(10, 0, true);  // mod time
      lv.setUint16(12, 0, true);  // mod date
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBuf.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBuf, 30);

      // Central Directory Header (46 bytes + nameBuf.length)
      const centralHeader = new Uint8Array(46 + nameBuf.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);  // version made by
      cv.setUint16(6, 20, true);  // version needed
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBuf.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBuf, 46);

      localEntries.push(localHeader, dataBuf);
      centralEntries.push(centralHeader);

      offset += localHeader.length + dataBuf.length;
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (let i = 0; i < centralEntries.length; i++) centralSize += centralEntries[i].length;

    // End of Central Directory (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);

    return concatUint8Arrays([...localEntries, ...centralEntries, eocd]);
  }

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return String(iso);
    }
  }

  const RUBRIC_DEF = [
    { id: 'problem', label: '1. 문제·조건의 명확성', defaultScore: 10, defaultEv: '문제와 조건이 명확하게 정의됨' },
    { id: 'logic', label: '2. 자연어 알고리즘의 논리성', defaultScore: 10, defaultEv: '해결 단계가 논리적으로 구성됨' },
    { id: 'consistency', label: '3. 자연어와 순서도의 일치', defaultScore: 10, defaultEv: '기획서와 순서도 블록이 잘 대응됨' },
    { id: 'flow', label: '4. 순서도 구조·동작의 타당성', defaultScore: 10, defaultEv: '순서도 제어 흐름 및 분기가 타당함' }
  ];

  function extractPart3Scores(review = {}, score = {}, student = {}) {
    if(typeof assessmentVersion==='function'&&assessmentVersion(student)==='open-design-v2'){
      const effective=assessmentEffectiveReview({...student,review});
      const proposal=assessmentEffectiveReview({...student,review:{proposal:review.proposal}});
      return {proposal:proposal?.total??null,confirmed:effective?.confirmed?effective.total:null,final:effective?.total??null,effective,isV2:true};
    }
    const sReview = student?.review || {};
    const sScore = student?.scores || student?.score || {};

    const calcCriteriaTotal = (crit) => {
      if (Array.isArray(crit) && crit.length > 0) {
        return crit.reduce((sum, c) => sum + (Number(c.score) || 0), 0);
      }
      if (crit && typeof crit === 'object' && crit !== null) {
        const p = Number(crit.planScore);
        const t = Number(crit.terminalScore);
        const s = Number(crit.structureScore);
        const e = Number(crit.executionScore);
        const vals = [p, t, s, e].filter(v => !isNaN(v));
        if (vals.length > 0) return vals.reduce((a, b) => a + b, 0);
      }
      return null;
    };

    const propCrit = calcCriteriaTotal(review?.proposal?.criteria) ?? calcCriteriaTotal(sReview?.proposal?.criteria) ?? calcCriteriaTotal(review?.criteria);
    const propTotal = review?.proposal?.score !== undefined && review.proposal.score !== null
      ? Number(review.proposal.score)
      : (sReview?.proposal?.score !== undefined && sReview.proposal.score !== null
          ? Number(sReview.proposal.score)
          : (review?.proposal?.total !== undefined && review.proposal.total !== null
              ? Number(review.proposal.total)
              : (sReview?.proposal?.total !== undefined && sReview.proposal.total !== null
                  ? Number(sReview.proposal.total)
                  : (propCrit !== null ? propCrit : (typeof score.part3 === 'number' ? score.part3 : (typeof sScore.part3 === 'number' ? sScore.part3 : null))))));

    const confCrit = calcCriteriaTotal(review?.confirmed?.criteria) ?? calcCriteriaTotal(sReview?.confirmed?.criteria);
    const confTotal = review?.confirmed?.score !== undefined && review.confirmed.score !== null
      ? Number(review.confirmed.score)
      : (sReview?.confirmed?.score !== undefined && sReview.confirmed.score !== null
          ? Number(sReview.confirmed.score)
          : (review?.confirmed?.total !== undefined && review.confirmed.total !== null
              ? Number(review.confirmed.total)
              : (sReview?.confirmed?.total !== undefined && sReview.confirmed.total !== null
                  ? Number(sReview.confirmed.total)
                  : (confCrit !== null ? confCrit : (typeof score.teacherOverride === 'number' ? score.teacherOverride : (typeof sScore.teacherOverride === 'number' ? sScore.teacherOverride : null))))));

    return {
      proposal: propTotal,
      confirmed: confTotal,
      final: confTotal !== null ? confTotal : (propTotal !== null ? propTotal : null)
    };
  }

  /**
   * 학생 원본 데이터(Firestore s)와 서버 채점 데이터(classGrades g)를 안전하게 병합
   * - g.review는 Part 1·2 문항 검토 데이터만 포함하므로, s.review의 Part 3 AI 제안/교사 확정이 덮어씌워지지 않도록 깊은 병합
   */
  function mergeStudentGradeData(student = {}, gradeInfo = {}) {
    const s = student || {};
    const g = gradeInfo || {};
    const sScore = s.scores || s.score || {};
    const gScore = g.scores || g.score || {};
    const mergedScore = { ...sScore, ...gScore };

    const sReview = s.review || {};
    const gReview = g.review || {};

    const proposal = gReview.proposal || sReview.proposal || g.proposal || s.proposal || null;
    const confirmed = gReview.confirmed || sReview.confirmed || g.confirmed || s.confirmed || null;

    const mergedReview = {
      ...sReview,
      ...gReview,
      proposal,
      confirmed,
      part1: (Array.isArray(gReview.part1) && gReview.part1.length > 0) ? gReview.part1 : (sReview.part1 || []),
      part2: (Array.isArray(gReview.part2) && gReview.part2.length > 0) ? gReview.part2 : (sReview.part2 || [])
    };

    return { score: mergedScore, review: mergedReview };
  }

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <!-- 0: 기본 본문 (9pt) -->
    <font><sz val="9.5"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 1: 컬럼 헤더 볼드 (10pt) -->
    <font><b/><sz val="10"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 2: 대제목 볼드 (15pt 블루) -->
    <font><b/><sz val="15"/><color rgb="FF1E3A8A"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 3: 중제목 볼드 (11pt 인디고) -->
    <font><b/><sz val="11"/><color rgb="FF3730A3"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 4: 정답 볼드 (에메랄드) -->
    <font><b/><sz val="10"/><color rgb="FF047857"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 5: 오답 볼드 (로즈) -->
    <font><b/><sz val="10"/><color rgb="FFB91C1C"/><name val="맑은 고딕"/><family val="2"/></font>
    <!-- 6: 하이라이트 볼드 (12pt 블루) -->
    <font><b/><sz val="12"/><color rgb="FF0D6EFD"/><name val="맑은 고딕"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <!-- 2: 연회색 (F1F5F9) 헤더용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <!-- 3: 연블루 (E0E7FF) 강조 헤더용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/></patternFill></fill>
    <!-- 4: 연에메랄드 (DCFCE7) 정답용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>
    <!-- 5: 연로즈 (FEE2E2) 오답용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <!-- 6: 연호박 (FEF3C7) 1차채점용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <!-- 7: 매우 연한 슬레이트 (F8FAFC) 서브용 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <!-- 1: 정갈한 실선 테두리 -->
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="13">
    <!-- 0: 일반 텍스트 좌측정렬 -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 1: 일반 텍스트 중앙정렬 -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 2: 테이블 헤더 (회색 배경, 볼드, 중앙) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 3: 대제목 (15pt 볼드 블루) -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 4: 소제목 띠지 (11pt 볼드 인디고, 연블루 배경) -->
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 5: 정답 강조 셀 (연에메랄드, 볼드 초록, 중앙) -->
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 6: 오답 강조 셀 (연로즈, 볼드 빨강, 중앙) -->
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 7: 1차채점 강조 셀 (연호박 배경, 볼드, 중앙) -->
    <xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 8: 총점 하이라이트 셀 (12pt 볼드 블루, 중앙) -->
    <xf numFmtId="0" fontId="6" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 9: 긴 줄바꿈 텍스트 좌측정렬 -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <!-- 10: 라벨 셀 (연회색 배경, 볼드, 중앙, 자동 줄바꿈) -->
    <xf numFmtId="0" fontId="1" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 11: 소계/합계 행 볼드 중앙 -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 12: 피드백용 긴 줄바꿈 텍스트 좌측 상단정렬 -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;

  class ExcelExportService {
    constructor() {}

    /**
     * 학생 번호와 이름을 안전한 엑셀 시트 이름(최대 31자, 특수문자 제거)으로 생성
     */
    sanitizeSheetName(name) {
      return String(name || '시트')
        .replace(/[*?:/\\\[\]]/g, '')
        .trim()
        .slice(0, 31);
    }

    /**
     * 단일 통합 엑셀 워크북 시트 빌드
     */
    buildWorkbookXmls(arg1, arg2, arg3, arg4) {
      let classId, className, studentList, classGrades;
      if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
        ({ classId, className, studentList = [], classGrades = {} } = arg1);
      } else {
        classId = arg1;
        if (Array.isArray(arg2)) {
          className = `${classId}반`;
          studentList = arg2;
          classGrades = arg3 || {};
        } else {
          className = arg2 || `${classId}반`;
          studentList = Array.isArray(arg3) ? arg3 : [];
          classGrades = arg4 || {};
        }
      }

      const sheets = [];

      // 1. 첫 번째 시트: [학급종합]
      sheets.push({
        name: '학급종합',
        xml: this.renderClassSummarySheet({ classId, className, studentList, classGrades })
      });

      // 2. 중간 시트들: [01_강수아], [02_고서누] ... (학생수만큼)
      const sortedStudents = [...(studentList || [])].sort((a, b) => a.num - b.num);
      for (const s of sortedStudents) {
        const numStr = s.numStr || String(s.num).padStart(2, '0');
        const sheetName = this.sanitizeSheetName(`${numStr}_${s.name}`);
        const gradeInfo = (classGrades && classGrades[numStr]) ? classGrades[numStr] : null;
        sheets.push({
          name: sheetName,
          xml: this.renderIndividualStudentSheet({ classId, className, student: s, gradeInfo })
        });
      }

      // 3. 마지막 시트: [나이스(NEIS) 양식]
      sheets.push({
        name: '나이스(NEIS) 양식',
        xml: this.renderNeisSheet({ classId, className, studentList: sortedStudents, classGrades })
      });

      return sheets;
    }

    /**
     * 시트 1: [학급종합] 렌더링
     */
    renderClassSummarySheet({ classId, className, studentList, classGrades }) {
      const displayClass = className || `${classId}반`;
      let rows = '';
      let r = 1;

      // 대제목 (행 1)
      rows += `<row r="${r}" ht="32" customHeight="1">
        <c r="A${r}" s="3" t="inlineStr"><is><t>${escapeXml(displayClass)} 정보 알고리즘 수행평가 종합 성적표</t></is></c>
      </row>`;
      r++;

      // 메타 정보 (행 2)
      const submittedCount = studentList.filter(s => s.status === 'submitted').length;
      rows += `<row r="${r}" ht="20" customHeight="1">
        <c r="A${r}" s="10" t="inlineStr"><is><t>학급</t></is></c>
        <c r="B${r}" s="1" t="inlineStr"><is><t>${escapeXml(displayClass)}</t></is></c>
        <c r="C${r}" s="10" t="inlineStr"><is><t>총원/제출</t></is></c>
        <c r="D${r}" s="1" t="inlineStr"><is><t>${studentList.length}명 중 ${submittedCount}명 제출</t></is></c>
        <c r="I${r}" s="10" t="inlineStr"><is><t>출력일시</t></is></c>
        <c r="J${r}" s="1" t="inlineStr"><is><t>${formatTime(new Date())}</t></is></c>
      </row>`;
      r += 2; // 빈 줄

      // 테이블 헤더 (행 4)
      const headers = [
        ['A', '학급', 12],
        ['B', '번호', 8],
        ['C', '이름', 12],
        ['D', '응시상태', 12],
        ['E', '객관식/30', 12],
        ['F', '단답형/30', 12],
        ['G', '지필소계/60', 13],
        ['H', '1차 채점/40', 13],
        ['I', '교사 확정', 12],
        ['J', '최종 점수', 13],
        ['K', '제출시각', 18], ['L','환산점수/30',14], ['M','성적 상태',14]
      ];

      rows += `<row r="${r}" ht="26" customHeight="1">`;
      for (const [col, title] of headers) {
        rows += `<c r="${col}${r}" s="2" t="inlineStr"><is><t>${escapeXml(title)}</t></is></c>`;
      }
      rows += `</row>`;
      r++;

      // 학생 데이터 행
      for (const s of studentList) {
        const numStr = s.numStr || String(s.num).padStart(2, '0');
        const g = (classGrades && classGrades[numStr]) ? classGrades[numStr] : {};
        const { score, review } = mergeStudentGradeData(s, g);

        const statusMap = { submitted: '제출완료', in_progress: '풀이중', waiting: '대기중' };
        const statusText = statusMap[s.status] || s.status || '미접속';

        // 서버 점수가 반영된 객관식, 단답형, 지필소계
        let part1 = s.status === 'submitted' ? (score.part1 !== undefined && score.part1 !== null ? Number(score.part1) : '-') : '-';
        let part2 = s.status === 'submitted' ? (score.part2 !== undefined && score.part2 !== null ? Number(score.part2) : '-') : '-';
        let writtenSub = (typeof part1 === 'number' && typeof part2 === 'number') ? (part1 + part2) : (typeof score.writtenSubtotal === 'number' ? score.writtenSubtotal : '-');

        // 1차 채점 및 교사 확정 점수 (Part 3)
        const p3Scores = extractPart3Scores(review, score, s);
        const part3Proposal = p3Scores.proposal !== null ? p3Scores.proposal : (s.status === 'submitted' ? '대기' : '-');
        const teacherConfirmed = p3Scores.confirmed !== null ? p3Scores.confirmed : '-';

        // 최종 점수: 확정점수가 있으면 확정+지필, 없으면 1차채점+지필
        let finalScore = '-';
        if (typeof teacherConfirmed === 'number' && typeof writtenSub === 'number') {
          finalScore = writtenSub + teacherConfirmed;
        } else if (typeof part3Proposal === 'number' && typeof writtenSub === 'number') {
          finalScore = writtenSub + part3Proposal;
        } else if (!p3Scores.isV2&&typeof score.finalScore === 'number') {
          finalScore = score.finalScore;
        } else if (!p3Scores.isV2&&typeof score.total === 'number') {
          finalScore = score.total;
        }

        const submittedAtText = formatTime(s.submittedAt);

        rows += `<row r="${r}" ht="22" customHeight="1">
          <c r="A${r}" s="1" t="inlineStr"><is><t>${escapeXml(displayClass)}</t></is></c>
          <c r="B${r}" s="1"><v>${s.num}</v></c>
          <c r="C${r}" s="1" t="inlineStr"><is><t>${escapeXml(s.name)}</t></is></c>
          <c r="D${r}" s="1" t="inlineStr"><is><t>${escapeXml(statusText)}</t></is></c>
          <c r="E${r}" s="1">${typeof part1 === 'number' ? `<v>${part1}</v>` : `<t>${part1}</t>`}</c>
          <c r="F${r}" s="1">${typeof part2 === 'number' ? `<v>${part2}</v>` : `<t>${part2}</t>`}</c>
          <c r="G${r}" s="1">${typeof writtenSub === 'number' ? `<v>${writtenSub}</v>` : `<t>${writtenSub}</t>`}</c>
          <c r="H${r}" s="7">${typeof part3Proposal === 'number' ? `<v>${part3Proposal}</v>` : `<t>${part3Proposal}</t>`}</c>
          <c r="I${r}" s="1">${typeof teacherConfirmed === 'number' ? `<v>${teacherConfirmed}</v>` : `<t>${teacherConfirmed}</t>`}</c>
          <c r="J${r}" s="8">${typeof finalScore === 'number' ? `<v>${finalScore}</v>` : `<t>${finalScore}</t>`}</c>
          <c r="K${r}" s="1" t="inlineStr"><is><t>${escapeXml(submittedAtText)}</t></is></c>
          <c r="L${r}" s="8">${typeof finalScore==='number'?`<v>${2*Math.ceil(finalScore*0.3/2)}</v>`:'<v/>'}</c>
          <c r="M${r}" s="1" t="inlineStr"><is><t>${escapeXml(p3Scores.effective?.status||(teacherConfirmed!=='-'?'교사 확정':'1차 채점'))}</t></is></c>
        </row>`;
        r++;
      }

      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="13" customWidth="1"/>
    <col min="2" max="2" width="8" customWidth="1"/>
    <col min="3" max="3" width="13" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="12" customWidth="1"/>
    <col min="6" max="6" width="12" customWidth="1"/>
    <col min="7" max="7" width="13" customWidth="1"/>
    <col min="8" max="8" width="13" customWidth="1"/>
    <col min="9" max="9" width="12" customWidth="1"/>
    <col min="10" max="10" width="13" customWidth="1"/>
    <col min="11" max="11" width="18" customWidth="1"/>
    <col min="12" max="13" width="15" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:M1"/>
    <mergeCell ref="D2:H2"/>
  </mergeCells>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
    }

    /**
     * 시트 2~N: [학생별 개별 성적표 (A4 1장 출력용)] 렌더링
     */
    renderIndividualStudentSheet({ classId, className, student, gradeInfo }) {
      const displayClass = className || `${classId}반`;
      const s = student;
      const g = gradeInfo || {};
      const { score, review } = mergeStudentGradeData(s, g);

      // 점수 계산
      const part1Score = typeof score.part1 === 'number' ? score.part1 : (Number(score.part1) || 0);
      const part2Score = typeof score.part2 === 'number' ? score.part2 : (Number(score.part2) || 0);
      const writtenSubtotal = (typeof score.writtenSubtotal === 'number') ? score.writtenSubtotal : (part1Score + part2Score);
      const p3Scores = extractPart3Scores(review, score, s);
      const isV2=typeof assessmentVersion==='function'&&assessmentVersion(s)==='open-design-v2';
      const rubric=isV2?assessmentRules('open-design-v2'):RUBRIC_DEF.map(r=>({...r,max:10}));
      const part3Proposal = p3Scores.proposal;
      const part3Confirmed = p3Scores.confirmed;
      const part3Final = p3Scores.final !== null ? p3Scores.final : (isV2?'대기':0);
      const totalScore = isV2?((p3Scores.effective&&Number.isFinite(score.part1)&&Number.isFinite(score.part2))?writtenSubtotal+part3Final:null):(typeof score.finalScore === 'number' && part3Confirmed !== null)
        ? score.finalScore
        : (writtenSubtotal + part3Final);
      const gradeStatusLabel = isV2?'('+ (p3Scores.effective?.status||'채점 대기')+')':part3Confirmed !== null ? '(교사 확정)' : (part3Proposal !== null ? '(1차 채점 반영)' : '(검토 대기)');

      // Part 1 & Part 2 문제 및 답안 목록 복원 (review 데이터 우선, 미존재 시 eval-questions 또는 answers 매핑)
      let p1List = Array.isArray(review.part1) && review.part1.length > 0 ? review.part1 : [];
      if (s.questionVersion!==4&&p1List.length === 0 && typeof EVAL_QUESTIONS !== 'undefined' && Array.isArray(EVAL_QUESTIONS.part1)) {
        const sP1 = s.answers?.part1 || {};
        p1List = EVAL_QUESTIONS.part1.map((eq, idx) => {
          const studentAnsIdx = Array.isArray(sP1) ? sP1[idx] : (sP1[eq.id] !== undefined ? sP1[eq.id] : sP1[idx]);
          const hasAnswered = studentAnsIdx !== undefined && studentAnsIdx !== null;
          const isCorrect = hasAnswered && Number(studentAnsIdx) === eq.correctAnswer;
          return {
            qnum: idx + 1,
            title: eq.title,
            options: eq.options,
            studentAnswer: hasAnswered ? Number(studentAnsIdx) : null,
            correctAnswer: eq.correctAnswer,
            isCorrect: isCorrect,
            points: eq.points || 3
          };
        });
      }

      let p2List = Array.isArray(review.part2) && review.part2.length > 0 ? review.part2 : [];
      if (s.questionVersion!==4&&p2List.length === 0 && typeof EVAL_QUESTIONS !== 'undefined' && Array.isArray(EVAL_QUESTIONS.part2)) {
        const sP2 = s.answers?.part2 || {};
        p2List = EVAL_QUESTIONS.part2.map((eq, idx) => {
          const studentAnsText = (Array.isArray(sP2) ? sP2[idx] : (sP2[eq.id] || sP2[idx] || '')).trim();
          const hasAnswered = studentAnsText.length > 0;
          const cleaned = studentAnsText.toLowerCase().replace(/\s+/g, '');
          const isCorrect = hasAnswered && Array.isArray(eq.answers) && eq.answers.some(ans => ans.toLowerCase().replace(/\s+/g, '') === cleaned);
          return {
            qnum: idx + 11,
            title: eq.title,
            answers: eq.answers,
            studentAnswer: hasAnswered ? studentAnsText : null,
            isCorrect: isCorrect,
            points: eq.points || 5
          };
        });
      }

      let rows = '';

      // 1. 대제목 (행 1)
      rows += `<row r="1" ht="30" customHeight="1">
        <c r="A1" s="3" t="inlineStr"><is><t>정보 알고리즘 스튜디오 수행평가 개인 성적표</t></is></c>
        <c r="B1" s="3"/><c r="C1" s="3"/><c r="D1" s="3"/><c r="E1" s="3"/><c r="F1" s="3"/>
      </row>`;

      // 2. 학생 기본 정보 카드 (행 2)
      rows += `<row r="2" ht="22" customHeight="1">
        <c r="A2" s="10" t="inlineStr"><is><t>학급</t></is></c>
        <c r="B2" s="1" t="inlineStr"><is><t>${escapeXml(displayClass)}</t></is></c>
        <c r="C2" s="10" t="inlineStr"><is><t>번호 / 이름</t></is></c>
        <c r="D2" s="1" t="inlineStr"><is><t>${s.num}번  ${escapeXml(s.name)}</t></is></c>
        <c r="E2" s="10" t="inlineStr"><is><t>제출시각</t></is></c>
        <c r="F2" s="1" t="inlineStr"><is><t>${formatTime(s.submittedAt)}</t></is></c>
      </row>`;

      // 3. 종합 성적 요약 카드 (행 3)
      rows += `<row r="3" ht="26" customHeight="1">
        <c r="A3" s="10" t="inlineStr"><is><t>지필평가 소계</t></is></c>
        <c r="B3" s="1" t="inlineStr"><is><t>${isV2&&(!Number.isFinite(score.part1)||!Number.isFinite(score.part2))?'대기':writtenSubtotal}점 / 60점 (객관 ${isV2&&!Number.isFinite(score.part1)?'대기':part1Score} + 단답 ${isV2&&!Number.isFinite(score.part2)?'대기':part2Score})</t></is></c>
        <c r="C3" s="10" t="inlineStr"><is><t>${isV2?'순서도 '+(p3Scores.effective?.status||'채점 대기'):'순서도 1차 채점'}</t></is></c>
        <c r="D3" s="7" t="inlineStr"><is><t>${part3Final}점 / 40점</t></is></c>
        <c r="E3" s="10" t="inlineStr"><is><t>종합 최종 점수</t></is></c>
        <c r="F3" s="8" t="inlineStr"><is><t>${totalScore??'대기'}점 / 100점</t></is></c>
      </row>`;

      // 4. 지필평가(Part 1 & 2) 통합 헤더 띠지 (행 4)
      rows += `<row r="4" ht="22" customHeight="1">
        <c r="A4" s="4" t="inlineStr"><is><t>Part 1 &amp; Part 2. 지필평가 문항별 상세 결과 (60점 만점 / 16문항) — 획득 점수: ${writtenSubtotal}점</t></is></c>
        <c r="B4" s="4"/><c r="C4" s="4"/><c r="D4" s="4"/><c r="E4" s="4"/><c r="F4" s="4"/>
      </row>`;

      // 5. 좌우 2단 테이블 컬럼 헤더 (행 5)
      rows += `<row r="5" ht="20" customHeight="1">
        <c r="A5" s="2" t="inlineStr"><is><t>번호</t></is></c>
        <c r="B5" s="2" t="inlineStr"><is><t>Part 1. 객관식 (내 선택 / 정답)</t></is></c>
        <c r="C5" s="2" t="inlineStr"><is><t>채점 (3점)</t></is></c>
        <c r="D5" s="2" t="inlineStr"><is><t>번호</t></is></c>
        <c r="E5" s="2" t="inlineStr"><is><t>Part 2. 단답형 (내 작성답 / 정답)</t></is></c>
        <c r="F5" s="2" t="inlineStr"><is><t>채점 (5점)</t></is></c>
      </row>`;

      // 6. 지필평가 좌우 2단 본문 (행 6 ~ 15, 총 10줄)
      for (let i = 0; i < 10; i++) {
        const r = 6 + i;
        // --- [좌측: Part 1 객관식 Q1 ~ Q10] ---
        const q1 = p1List[i];
        let p1NumText = `Q${i + 1}`;
        let p1AnsText = '답안 데이터 대기 중';
        let p1ScoreBadge = '-';
        let p1ScoreStyle = 1;

        if (q1) {
          let isCorrect = false;
          if (typeof q1.isCorrect === 'boolean') {
            isCorrect = q1.isCorrect;
          } else if (typeof q1.score === 'number' && q1.score > 0) {
            isCorrect = true;
          } else if (q1.studentAnswer !== undefined && q1.studentAnswer !== null && q1.correctAnswer !== undefined && q1.correctAnswer !== null) {
            isCorrect = Number(q1.studentAnswer) === Number(q1.correctAnswer);
          } else if (q1.myChoice !== undefined && q1.myChoice !== null && q1.answer !== undefined && q1.answer !== null) {
            isCorrect = Number(q1.myChoice) === Number(q1.answer);
          }

          let myChoiceStr = '미응답';
          if (q1.studentAnswer !== undefined && q1.studentAnswer !== null) {
            myChoiceStr = typeof q1.studentAnswer === 'number' ? `${q1.studentAnswer + 1}번` : String(q1.studentAnswer);
            if (q1.options && typeof q1.studentAnswer === 'number' && q1.options[q1.studentAnswer]) {
              myChoiceStr += `(${q1.options[q1.studentAnswer]})`;
            }
          } else if (q1.myChoice !== undefined && q1.myChoice !== null) {
            myChoiceStr = typeof q1.myChoice === 'number' ? `${q1.myChoice + 1}번` : String(q1.myChoice);
          }

          let correctStr = '';
          if (q1.correctAnswer !== undefined && q1.correctAnswer !== null) {
            correctStr = typeof q1.correctAnswer === 'number' ? `${q1.correctAnswer + 1}번` : String(q1.correctAnswer);
            if (q1.options && typeof q1.correctAnswer === 'number' && q1.options[q1.correctAnswer]) {
              correctStr += `(${q1.options[q1.correctAnswer]})`;
            }
          } else if (q1.answer !== undefined && q1.answer !== null) {
            correctStr = typeof q1.answer === 'number' ? `${q1.answer + 1}번` : String(q1.answer);
          }

          const pts = q1.points || 3;
          if (isCorrect) {
            p1AnsText = `선택: ${myChoiceStr} (정답)`;
            p1ScoreBadge = `⭕ ${pts}점`;
            p1ScoreStyle = 5;
          } else {
            p1AnsText = `선택: ${myChoiceStr}${correctStr ? ` (정답: ${correctStr})` : ''}`;
            p1ScoreBadge = '❌ 0점';
            p1ScoreStyle = 6;
          }
        }

        // --- [우측: Part 2 단답형 Q11 ~ Q16 및 채점 안내 박스] ---
        let p2ColsXml = '';
        if (i < 6) {
          const q2 = p2List[i];
          let p2NumText = `Q${i + 11}`;
          let p2AnsText = '답안 데이터 대기 중';
          let p2ScoreBadge = '-';
          let p2ScoreStyle = 1;

          if (q2) {
            let isCorrect = false;
            if (typeof q2.isCorrect === 'boolean') {
              isCorrect = q2.isCorrect;
            } else if (typeof q2.score === 'number' && q2.score > 0) {
              isCorrect = true;
            } else {
              const norm = str => typeof str === 'string' ? str.toLocaleLowerCase('ko-KR').replace(/\s+/g, '').trim() : String(str || '').replace(/\s+/g, '').trim();
              const myInput = norm(q2.studentAnswer ?? q2.myInput ?? '');
              if (myInput.length > 0) {
                if (Array.isArray(q2.answers) && q2.answers.length > 0) {
                  isCorrect = q2.answers.some(ans => norm(ans) === myInput);
                } else if (q2.answer) {
                  isCorrect = norm(q2.answer) === myInput;
                } else if (q2.correctAnswer) {
                  isCorrect = norm(q2.correctAnswer) === myInput;
                }
              }
            }

            const myInputStr = q2.studentAnswer || q2.myInput || '미작성';
            let correctStr = '';
            if (Array.isArray(q2.answers) && q2.answers.length > 0) {
              correctStr = q2.answers[0];
            } else if (q2.answer) {
              correctStr = q2.answer;
            } else if (q2.correctAnswer) {
              correctStr = q2.correctAnswer;
            }

            const pts = q2.points || 5;
            if (isCorrect) {
              p2AnsText = `입력: ${myInputStr} (정답)`;
              p2ScoreBadge = `⭕ ${pts}점`;
              p2ScoreStyle = 5;
            } else {
              p2AnsText = `입력: ${myInputStr}${correctStr ? ` (정답: ${correctStr})` : ''}`;
              p2ScoreBadge = '❌ 0점';
              p2ScoreStyle = 6;
            }
          }

          p2ColsXml = `
            <c r="D${r}" s="1" t="inlineStr"><is><t>${p2NumText}</t></is></c>
            <c r="E${r}" s="0" t="inlineStr"><is><t>${escapeXml(p2AnsText)}</t></is></c>
            <c r="F${r}" s="${p2ScoreStyle}" t="inlineStr"><is><t>${p2ScoreBadge}</t></is></c>
          `;
        } else if (i === 6) {
          // 행 12: 지필평가 채점 기준 안내 카드 시작 (D12:F15 병합)
          p2ColsXml = `
            <c r="D${r}" s="9" t="inlineStr"><is><t>※ 지필평가 배점 안내&#10;• 객관식(Q1~Q10): 문항당 3점 (총 30점)&#10;• 단답형(Q11~Q16): 문항당 5점 (총 30점)&#10;• 단답형은 띄어쓰기 및 유사 정답 기준 자동 반영</t></is></c>
            <c r="E${r}" s="9"/><c r="F${r}" s="9"/>
          `;
        } else {
          // 행 13, 14, 15: 안내 카드 병합 영역 하위 셀
          p2ColsXml = `
            <c r="D${r}" s="9"/><c r="E${r}" s="9"/><c r="F${r}" s="9"/>
          `;
        }

        rows += `<row r="${r}" ht="20" customHeight="1">
          <c r="A${r}" s="1" t="inlineStr"><is><t>${p1NumText}</t></is></c>
          <c r="B${r}" s="0" t="inlineStr"><is><t>${escapeXml(p1AnsText)}</t></is></c>
          <c r="C${r}" s="${p1ScoreStyle}" t="inlineStr"><is><t>${p1ScoreBadge}</t></is></c>
          ${p2ColsXml}
        </row>`;
      }

      // 7. Part 3. 순서도 설계 및 채점 결과 (행 16)
      const p3HeaderLabel = part3Confirmed !== null ? '최종 채점' : '1차 채점';
      rows += `<row r="16" ht="22" customHeight="1">
        <c r="A16" s="4" t="inlineStr"><is><t>Part 3. 알고리즘 및 순서도 설계 평가 (40점 만점) — ${p3HeaderLabel}: ${part3Final}점 ${gradeStatusLabel}</t></is></c>
        <c r="B16" s="4"/><c r="C16" s="4"/><c r="D16" s="4"/><c r="E16" s="4"/><c r="F16" s="4"/>
      </row>`;

      // 8. 문제 해결 계획 요약 (행 17)
      const p3Ans = s.answers?.part3 || {};
      const plan = p3Ans.plan || p3Ans;
      const curState = plan.situation || plan.current || '(미작성)';
      const goalState = plan.goal || '(미작성)';
      const condRules = plan.conditions || plan.variables || '(미작성)';

      const planMaxLen = Math.max(curState.length, goalState.length, condRules.length);
      const planRowHt = planMaxLen > 25 ? 30 : 22;

      rows += `<row r="17" ht="${planRowHt}" customHeight="1">
        <c r="A17" s="10" t="inlineStr"><is><t>현재상태</t></is></c>
        <c r="B17" s="9" t="inlineStr"><is><t>${escapeXml(curState)}</t></is></c>
        <c r="C17" s="10" t="inlineStr"><is><t>목표상태</t></is></c>
        <c r="D17" s="9" t="inlineStr"><is><t>${escapeXml(goalState)}</t></is></c>
        <c r="E17" s="10" t="inlineStr"><is><t>조건</t></is></c>
        <c r="F17" s="9" t="inlineStr"><is><t>${escapeXml(condRules)}</t></is></c>
      </row>`;

      // 9. 4대 평가 기준별 헤더 (행 18)
      const scoreColHeader = part3Confirmed !== null ? '확정 점수' : '1차 채점';
      rows += `<row r="18" ht="20" customHeight="1">
        <c r="A18" s="2" t="inlineStr"><is><t>번호</t></is></c>
        <c r="B18" s="2" t="inlineStr"><is><t>평가 기준 항목${isV2?'':' (각 10점 만점)'}</t></is></c>
        <c r="C18" s="2" t="inlineStr"><is><t>${scoreColHeader}</t></is></c>
        <c r="D18" s="2" t="inlineStr"><is><t>평가 근거 및 상세 피드백 (AI 분석)</t></is></c>
        <c r="E18" s="2"/><c r="F18" s="2"/>
      </row>`;

      // 10. 4대 평가 기준 본문 (행 19 ~ 22)
      const criteriaData = isV2?(p3Scores.effective?.criteria||[]):review.confirmed?.criteria || review.proposal?.criteria || s.review?.confirmed?.criteria || s.review?.proposal?.criteria || {};
      let criteriaList = [];
      if (Array.isArray(criteriaData) && criteriaData.length > 0) {
        criteriaList = criteriaData.map((c, idx) => {
          const matchedDef = rubric.find(r => r.id === c.id) || rubric[idx] || { label: `항목 ${idx + 1}`, defaultEv: '특이사항 없음' };
          const title = (c.title && !c.title.startsWith('항목')) ? c.title : matchedDef.label;
          return {
            title, max:matchedDef.max||10,
            score: c.score !== undefined ? Number(c.score) : 0,
            evidence: c.evidence || c.feedback || matchedDef.defaultEv
          };
        });
      } else if (!isV2&&typeof criteriaData === 'object' && criteriaData !== null) {
        criteriaList = [
          { title: RUBRIC_DEF[0].label, score: criteriaData.planScore ?? 10, evidence: criteriaData.planFeedback || RUBRIC_DEF[0].defaultEv },
          { title: RUBRIC_DEF[1].label, score: criteriaData.terminalScore ?? 10, evidence: criteriaData.terminalFeedback || RUBRIC_DEF[1].defaultEv },
          { title: RUBRIC_DEF[2].label, score: criteriaData.structureScore ?? 10, evidence: criteriaData.structureFeedback || RUBRIC_DEF[2].defaultEv },
          { title: RUBRIC_DEF[3].label, score: criteriaData.executionScore ?? 10, evidence: criteriaData.executionFeedback || RUBRIC_DEF[3].defaultEv }
        ];
      }

      while (criteriaList.length < rubric.length) {
        const idx = criteriaList.length;
        criteriaList.push({
          title: rubric[idx]?.label || `항목 ${idx + 1}`, max:rubric[idx]?.max||10,
          score: isV2?null:0,
          evidence: '평가 데이터 대기 중'
        });
      }

      criteriaList.slice(0, rubric.length).forEach((c, idx) => {
        const crRow = 19 + idx;
        const sc = c.score !== undefined ? Number(c.score) : 0;
        const ev = c.evidence || '특이사항 없음';

        // 텍스트 길이에 따른 동적 행 높이 계산 (글자 겹침 방지 및 1페이지 출력 조화)
        const linesByBreak = ev.split(/\r?\n/).length;
        const linesByLen = Math.ceil(ev.length / 38);
        const totalLines = Math.max(1, linesByBreak, linesByLen);
        const rowHt = Math.min(85, Math.max(28, totalLines * 14 + 6));

        rows += `<row r="${crRow}" ht="${rowHt}" customHeight="1">
          <c r="A${crRow}" s="1"><v>${idx + 1}</v></c>
          <c r="B${crRow}" s="0" t="inlineStr"><is><t>${escapeXml(c.title)}</t></is></c>
          <c r="C${crRow}" s="7" t="inlineStr"><is><t>${c.score===null?'대기':sc} / ${c.max||10}점</t></is></c>
          <c r="D${crRow}" s="12" t="inlineStr"><is><t>${escapeXml(ev)}</t></is></c>
          <c r="E${crRow}" s="12"/><c r="F${crRow}" s="12"/>
        </row>`;
      });

      // 11. 교사 서명 및 종합 피드백란 (행 23)
      const fr=19+rubric.length;
      const generalFeedback = isV2?`${gradeStatusLabel} 항목 합계 ${p3Scores.effective?.rawTotal??'대기'}점 · 최저점 보정 +${p3Scores.effective?.minimumAdjustment??0}점. 환산 ${totalScore!==null?2*Math.ceil(totalScore*0.3/2):'대기'} / 30점. 이의가 있으면 선생님께 알려 주세요.`:review.confirmed?.feedback || review.proposal?.feedback || s.review?.proposal?.feedback || (part3Confirmed !== null ? `선생님 최종 확정 점수: ${part3Confirmed}점 / 40점` : '선생님께서 최종 검토 중입니다.');
      rows += `<row r="${fr}" ht="44" customHeight="1">
        <c r="A${fr}" s="10" t="inlineStr"><is><t>종합 안내</t></is></c>
        <c r="B${fr}" s="9" t="inlineStr"><is><t>${escapeXml(generalFeedback)}</t></is></c>
        <c r="C${fr}" s="9"/><c r="D${fr}" s="9"/>
        <c r="E${fr}" s="10" t="inlineStr"><is><t>교사 서명(인)</t></is></c>
        <c r="F${fr}" s="1" t="inlineStr"><is><t>(인)</t></is></c>
      </row>`;

      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <cols>
    <col min="1" max="1" width="8" customWidth="1"/>
    <col min="2" max="2" width="29" customWidth="1"/>
    <col min="3" max="3" width="12" customWidth="1"/>
    <col min="4" max="4" width="11" customWidth="1"/>
    <col min="5" max="5" width="28" customWidth="1"/>
    <col min="6" max="6" width="14" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
  <mergeCells count="${6+rubric.length}">
    <mergeCell ref="A1:F1"/>
    <mergeCell ref="A4:F4"/>
    <mergeCell ref="D12:F15"/>
    <mergeCell ref="A16:F16"/>
    <mergeCell ref="D18:F18"/>
    ${rubric.map((_,i)=>`<mergeCell ref="D${19+i}:F${19+i}"/>`).join('')}
    <mergeCell ref="B${fr}:D${fr}"/>
  </mergeCells>
  <pageSetup orientation="portrait" paperSize="9" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;
    }

    /**
     * 시트 3 (마지막 시트): [나이스(NEIS) 양식] 렌더링
     */
    renderNeisSheet({ classId, className, studentList, classGrades }) {
      const displayClass = className || `${classId}반`;
      let rows = '';
      let r = 1;

      // 헤더
      const headers = [
        ['A', '학급', 12],
        ['B', '번호', 8],
        ['C', '이름', 12],
        ['D', '응시상태', 12],
        ['E', '객관식/30', 12],
        ['F', '단답형/30', 12],
        ['G', '지필소계/60', 13],
        ['H', '순서도(1차)/40', 14],
        ['I', '교사확정', 12],
        ['J', '최종점수', 13],
        ['K', '제출일시', 18], ['L','환산점수/30',14], ['M','성적 상태',14]
      ];

      rows += `<row r="${r}" ht="24" customHeight="1">`;
      for (const [col, title] of headers) {
        rows += `<c r="${col}${r}" s="2" t="inlineStr"><is><t>${escapeXml(title)}</t></is></c>`;
      }
      rows += `</row>`;
      r++;

      // 학생 데이터
      for (const s of studentList) {
        const numStr = s.numStr || String(s.num).padStart(2, '0');
        const g = (classGrades && classGrades[numStr]) ? classGrades[numStr] : {};
        const { score, review } = mergeStudentGradeData(s, g);

        const statusMap = { submitted: '제출완료', in_progress: '풀이중', waiting: '대기중' };
        const statusText = statusMap[s.status] || s.status || '미접속';

        let part1 = s.status === 'submitted' ? (score.part1 !== undefined && score.part1 !== null ? Number(score.part1) : '') : '';
        let part2 = s.status === 'submitted' ? (score.part2 !== undefined && score.part2 !== null ? Number(score.part2) : '') : '';
        let writtenSub = (typeof part1 === 'number' && typeof part2 === 'number') ? (part1 + part2) : (typeof score.writtenSubtotal === 'number' ? score.writtenSubtotal : '');

        const p3Scores = extractPart3Scores(review, score, s);
        const part3Proposal = p3Scores.proposal !== null ? p3Scores.proposal : '';
        const teacherConfirmed = p3Scores.confirmed !== null ? p3Scores.confirmed : '';

        let finalScore = '';
        if (typeof teacherConfirmed === 'number' && typeof writtenSub === 'number') {
          finalScore = writtenSub + teacherConfirmed;
        } else if (typeof part3Proposal === 'number' && typeof writtenSub === 'number') {
          finalScore = writtenSub + part3Proposal;
        } else if (!p3Scores.isV2&&typeof score.finalScore === 'number') {
          finalScore = score.finalScore;
        } else if (!p3Scores.isV2&&typeof score.total === 'number') {
          finalScore = score.total;
        }

        const submittedAtText = formatTime(s.submittedAt);

        rows += `<row r="${r}" ht="20" customHeight="1">
          <c r="A${r}" s="1" t="inlineStr"><is><t>${escapeXml(displayClass)}</t></is></c>
          <c r="B${r}" s="1"><v>${s.num}</v></c>
          <c r="C${r}" s="1" t="inlineStr"><is><t>${escapeXml(s.name)}</t></is></c>
          <c r="D${r}" s="1" t="inlineStr"><is><t>${escapeXml(statusText)}</t></is></c>
          <c r="E${r}" s="1">${typeof part1 === 'number' ? `<v>${part1}</v>` : `<t>${part1}</t>`}</c>
          <c r="F${r}" s="1">${typeof part2 === 'number' ? `<v>${part2}</v>` : `<t>${part2}</t>`}</c>
          <c r="G${r}" s="1">${typeof writtenSub === 'number' ? `<v>${writtenSub}</v>` : `<t>${writtenSub}</t>`}</c>
          <c r="H${r}" s="1">${typeof part3Proposal === 'number' ? `<v>${part3Proposal}</v>` : `<t>${part3Proposal}</t>`}</c>
          <c r="I${r}" s="1">${typeof teacherConfirmed === 'number' ? `<v>${teacherConfirmed}</v>` : `<t>${teacherConfirmed}</t>`}</c>
          <c r="J${r}" s="1">${typeof finalScore === 'number' ? `<v>${finalScore}</v>` : `<t>${finalScore}</t>`}</c>
          <c r="K${r}" s="1" t="inlineStr"><is><t>${escapeXml(submittedAtText)}</t></is></c>
          <c r="L${r}" s="1">${typeof finalScore==='number'?`<v>${2*Math.ceil(finalScore*0.3/2)}</v>`:'<v/>'}</c>
          <c r="M${r}" s="1" t="inlineStr"><is><t>${escapeXml(p3Scores.effective?.status||(teacherConfirmed!==''?'교사 확정':'1차 채점'))}</t></is></c>
        </row>`;
        r++;
      }

      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="13" customWidth="1"/>
    <col min="2" max="2" width="8" customWidth="1"/>
    <col min="3" max="3" width="13" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="12" customWidth="1"/>
    <col min="6" max="6" width="12" customWidth="1"/>
    <col min="7" max="7" width="13" customWidth="1"/>
    <col min="8" max="8" width="14" customWidth="1"/>
    <col min="9" max="9" width="12" customWidth="1"/>
    <col min="10" max="10" width="13" customWidth="1"/>
    <col min="11" max="11" width="18" customWidth="1"/>
    <col min="12" max="13" width="15" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
    }

    /**
     * OpenXML ZIP에 포함될 모든 XML 파일 객체 배열 생성
     */
    generateWorkbookFiles(arg1, arg2, arg3, arg4) {
      const sheets = this.buildWorkbookXmls(arg1, arg2, arg3, arg4);
      const files = [];

      // [Content_Types].xml
      let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
`;
      sheets.forEach((_, i) => {
        contentTypes += `  <Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
      });
      contentTypes += '</Types>';
      files.push({ name: '[Content_Types].xml', data: contentTypes, content: contentTypes });

      // _rels/.rels
      const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
      files.push({ name: '_rels/.rels', data: rootRels, content: rootRels });

      // xl/_rels/workbook.xml.rels
      let wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
`;
      sheets.forEach((_, i) => {
        wbRels += `  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>\n`;
      });
      wbRels += '</Relationships>';
      files.push({ name: 'xl/_rels/workbook.xml.rels', data: wbRels, content: wbRels });

      // xl/workbook.xml
      let wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
`;
      sheets.forEach((s, i) => {
        wbXml += `    <sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>\n`;
      });
      wbXml += `  </sheets>
</workbook>`;
      files.push({ name: 'xl/workbook.xml', data: wbXml, content: wbXml });

      // xl/styles.xml
      // Keep authoring comments out of sequence-valued style collections for spreadsheet readers.
      const styles=STYLES_XML.replace(/<!--[\s\S]*?-->/g,'').replace('</styleSheet>','<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
      files.push({ name: 'xl/styles.xml', data: styles, content: styles });

      // sheets
      sheets.forEach((s, i) => {
        const xml=s.xml.replace(/<c (r="[A-Z]+\d+" s="\d+")><t>([\s\S]*?)<\/t><\/c>/g,'<c $1 t="inlineStr"><is><t>$2</t></is></c>');
        files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml, content: xml });
      });

      return files;
    }

    /**
     * 최종 .xlsx 바이너리 Blob/Buffer 생성
     */
    generateXlsxBinary(arg1, arg2, arg3, arg4) {
      if (Array.isArray(arg1)) {
        const mapped = arg1.map(f => ({ name: f.name, data: f.data || f.content }));
        return createZip(mapped);
      }
      const files = this.generateWorkbookFiles(arg1, arg2, arg3, arg4);
      return createZip(files);
    }

    /**
     * 브라우저에서 직접 .xlsx 파일 다운로드 실행
     */
    exportAssessmentWorkbook(classId, arg2, arg3, arg4) {
      let className, studentList, classGrades;
      if (Array.isArray(arg2)) {
        className = `${classId}반`;
        studentList = arg2;
        classGrades = arg3 || {};
      } else {
        className = arg2 || `${classId}반`;
        studentList = Array.isArray(arg3) ? arg3 : [];
        classGrades = arg4 || {};
      }

      const u8 = this.generateXlsxBinary({ classId, className, studentList, classGrades });
      const blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `${className || classId}_수행평가_성적표.xlsx`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

  return ExcelExportService;
});
