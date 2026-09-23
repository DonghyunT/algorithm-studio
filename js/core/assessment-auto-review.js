/**
 * ==============================================================================
 * 🤖 [수행평가 Part 3 백그라운드 AI 자동 초벌 채점 큐]
 * ==============================================================================
 * - 학생이 Part 3를 제출(submitted)하면 교사 관제탑 백그라운드에서 순차적으로 Solar AI 초벌 채점(proposal) 요청
 * - API Rate Limit(분당 10회)를 철저히 준수하기 위해 요청 간 최소 6.8초 안전 간격 유지 (분당 최대 ~8.8회)
 * - 상태/조건/자연어/의미 있는 순서도가 모두 비면 AI 없이 처리한다. V2는 최저 6점.
 * - V2 proposal은 배부용 잠정점수이며 교사 정정이 항상 우선한다. 이전 기준은 유지한다.
 */

class AssessmentAutoReviewQueue {
  constructor(options = {}) {
    this.classId = null;
    this.attemptId = null;
    this.questionVersion = null;
    this.rubricVersion = 'open-design-v1';
    this.isTeacher = false;
    this.queue = [];
    this.processing = false;
    this.processingStudentNum = null;
    this.processedKeys = new Set();
    this.intervalMs = options.intervalMs || 6800; // 분당 최대 ~8.8회로 10회 제한 엄격 준수
    this.onStatusChange = options.onStatusChange || (() => {});
    this.savePart3Review = options.savePart3Review || ((...args) => (window.evalService?.savePart3Review ? window.evalService.savePart3Review(...args) : Promise.resolve()));
    this.requestAssessmentAI = options.requestAssessmentAI || ((...args) => (typeof requestAssessmentAI === 'function' ? requestAssessmentAI(...args) : Promise.reject(new Error('AI service unavailable'))));
    this.timerId = null;
    this.totalProcessedInBatch = 0;
    this.totalQueuedInBatch = 0;
  }

  static isPart3Empty(student) {
    if(typeof assessmentIsEmpty==='function')return assessmentIsEmpty(student?.answers?.part3);
    const part3 = student?.answers?.part3;
    if (!part3) return true;
    const blocks = Array.isArray(part3.blocks) ? part3.blocks : [];
    const plan = part3.plan || {};
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    const current = String(plan.current || '').trim();
    const goal = String(plan.goal || '').trim();

    // 순서도 블록이 1개 이하(단말 기호 1개만 있거나 0개)이고 기획서 내용(현재, 목표, 단계)도 없는 경우 빈 답안으로 판정
    return blocks.length <= 1 && steps.length === 0 && !current && !goal;
  }

  static createZeroProposal(student, sourceKey) {
    if(typeof assessmentVersion==='function'&&assessmentVersion(student)==='open-design-v2'){
      const criteria=assessmentEmptyCriteria();return {criteria,...assessmentTotals(criteria,'open-design-v2'),sourceKey,attemptId:student.attemptId,rubricVersion:'open-design-v2',model:'deterministic-empty',uncertainties:[],createdAt:new Date().toISOString()};
    }
    return {
      criteria: [
        { id: 'problem', score: 0, evidence: '제출된 기획서 내용 및 문제 조건 증거가 없습니다.' },
        { id: 'logic', score: 0, evidence: '제출된 알고리즘 제어 구조 및 카드 증거가 없습니다.' },
        { id: 'consistency', score: 0, evidence: '기획서 단계와 순서도 블록 간 대응 증거가 없습니다.' },
        { id: 'flow', score: 0, evidence: '순서도 단말 기호 및 흐름선 증거가 없습니다.' }
      ],
      uncertainties: ['미제출 또는 빈 답안으로 0점 처리 제안되었습니다. 필요시 교사가 직접 점수를 확정해 주세요.'],
      total: 0,
      sourceKey,
      attemptId: student.attemptId,
      rubricVersion: 'open-design-v1',
      model: 'system-rule-zero-fill',
      createdAt: new Date().toISOString()
    };
  }

  sync({ classId, session, students, isTeacher }) {
    if (!classId || !session || !students) return;

    if (this.classId !== classId || this.attemptId !== session.attemptId) {
      this.reset();
      this.classId = classId;
      this.attemptId = session.attemptId;
      this.questionVersion = session.questionVersion;
      this.isTeacher = !!isTeacher;
    } else {
      this.questionVersion = session.questionVersion;
      this.isTeacher = !!isTeacher;
    }

    this.rubricVersion=session.assessmentRubricVersion||'open-design-v1';
    // 실전평가 회차(4)이고 교사 권한일 때만 자동 초벌 채점 수행 (모의평가 3은 토큰 절약을 위해 제외)
    if (this.questionVersion !== 4 || !this.isTeacher) {
      return;
    }

    const helperSourceKey = typeof assessmentSourceKey === 'function' ? assessmentSourceKey : (() => '');

    for (const student of students) {
      const version=student.assessmentRubricVersion||this.rubricVersion;
      if (student.status !== 'submitted') continue;
      if (student.attemptId !== this.attemptId) continue;

      const sourceKey = helperSourceKey(student.answers?.part3);
      const studentNum = student.numStr || String(student.num).padStart(2, '0');

      // 이미 proposal 또는 confirmed가 저장되어 있다면 건너뜀
      const hasProposal = student.review?.proposal &&
        student.review.proposal.sourceKey === sourceKey &&
        student.review.proposal.attemptId === this.attemptId && (student.review.proposal.rubricVersion||'open-design-v1')===version;
      const hasConfirmed = student.review?.confirmed &&
        student.review.confirmed.sourceKey === sourceKey &&
        student.review.confirmed.attemptId === this.attemptId && (student.review.confirmed.rubricVersion||'open-design-v1')===version;

      if (hasProposal || hasConfirmed) continue;

      const itemKey = `${this.classId}:${this.attemptId}:${version}:${studentNum}:${sourceKey}`;
      if (this.processedKeys.has(itemKey)) continue;
      if (this.queue.some(q => q.itemKey === itemKey)) continue;
      if (this.processingStudentNum === studentNum) continue;

      // 빈 답안 감지 시 API를 호출하지 않고 즉시 0점 Proposal 저장
      if (AssessmentAutoReviewQueue.isPart3Empty(student)) {
        this.processedKeys.add(itemKey);
        this.saveZeroProposalImmediate({...student,assessmentRubricVersion:version}, sourceKey);
        continue;
      }

      // 정상 답안은 큐에 등록하여 순차 실행
      this.queue.push({
        itemKey,
        studentNum,
        rawNum: student.num,
        studentName: student.name,
        sourceKey,
        student,
        retryCount: 0
      });
      this.totalQueuedInBatch++;
    }

    this.notifyStatus();
    this.processNext();
  }

  async saveZeroProposalImmediate(student, sourceKey) {
    try {
      const zeroProposal = AssessmentAutoReviewQueue.createZeroProposal(student, sourceKey);
      await this.savePart3Review(this.classId, student.num, sourceKey, zeroProposal, 'proposal');
      this.totalProcessedInBatch++;
      this.notifyStatus();
    } catch (e) {
      console.warn('[AI Review Queue] 빈 답안 0점 제안 저장 실패:', student.num, e.message);
    }
  }

  async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const currentItem = this.queue.shift();
    this.processingStudentNum = currentItem.studentNum;
    this.notifyStatus();

    try {
      const result = await this.requestAssessmentAI({
        purpose: 'review',
        classId: this.classId,
        studentNum: currentItem.studentNum
      });
      await this.savePart3Review(this.classId, currentItem.rawNum, currentItem.sourceKey, result, 'proposal');
      this.processedKeys.add(currentItem.itemKey);
      this.totalProcessedInBatch++;
    } catch (error) {
      console.warn(`[AI Review Queue] ${currentItem.studentNum}번 학생 AI 초벌 채점 실패:`, error.message);
      const isTemporary = error.message && (error.message.includes('429') || error.message.includes('기다린 뒤') || error.message.includes('503'));
      if (currentItem.retryCount < 1 && isTemporary) {
        currentItem.retryCount++;
        this.queue.push(currentItem);
      } else {
        this.processedKeys.add(currentItem.itemKey);
      }
    } finally {
      this.processingStudentNum = null;
      this.notifyStatus();

      if (this.queue.length > 0) {
        this.timerId = setTimeout(() => {
          this.processing = false;
          this.processNext();
        }, this.intervalMs);
      } else {
        this.processing = false;
        this.notifyStatus();
      }
    }
  }

  notifyStatus() {
    this.onStatusChange({
      pendingCount: this.queue.length,
      currentProcessing: this.processingStudentNum,
      isBusy: this.processing || this.queue.length > 0,
      totalQueued: this.totalQueuedInBatch,
      totalProcessed: this.totalProcessedInBatch
    });
  }

  reset() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.queue = [];
    this.processing = false;
    this.processingStudentNum = null;
    this.processedKeys.clear();
    this.totalProcessedInBatch = 0;
    this.totalQueuedInBatch = 0;
    this.notifyStatus();
  }
}

if (typeof window !== 'undefined') {
  window.AssessmentAutoReviewQueue = AssessmentAutoReviewQueue;
}

if (typeof module !== 'undefined') {
  module.exports = { AssessmentAutoReviewQueue };
}
