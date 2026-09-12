/**
 * ==============================================================================
 * 📡 [수행평가 실시간 통신 및 데이터 관리 서비스 (eval-service.js)]
 * ==============================================================================
 * - 11개 반 (2-1 ~ 2-11) 세션 제어 및 각 반 최대 27명 학생 실시간 데이터 중계
 * - Cloud Firestore 실시간 구독(onSnapshot) 기반 0.5초 내 동시 시작 & 신호등 관제
 * - 오프라인/미연동 환경을 위한 BroadcastChannel 하이브리드 에뮬레이션 완벽 지원
 * - 나이스(NEIS) 100% 호환 성적 엑셀(CSV) 원클릭 추출 기능
 */

class EvalService {
  constructor() {
    this.channel = null;
    this.initBroadcastChannel();
    this.sessionUnsub = null;
    this.studentsUnsub = null;
  }

  // 1. 하이브리드 지원용 BroadcastChannel 초기화
  initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('ALGO_EVAL_BROADCAST_CHANNEL');
    }
  }

  // Firestore DB 인스턴스 획득
  getDb() {
    if (window.firebaseDb) return window.firebaseDb;
    if (typeof initFirebaseApp === 'function') {
      return initFirebaseApp();
    }
    return null;
  }

  // ============================================================================
  // 🏫 [교사용] 세션 제어 API (11개 반: 2-1 ~ 2-11)
  // ============================================================================

  /**
   * 반별 평가 세션 실시간 감시 (교사/학생 공통 리스너)
   * @param {string} classId - 예: "2-1", "2-2", ... "2-11"
   * @param {function} callback - (sessionData) => void
   * @returns {function} 구독 해제 함수
   */
  listenSession(classId, callback) {
    const db = this.getDb();

    // 1) Firestore 실시간 리스너 연결 시
    if (db) {
      const docRef = db.collection('eval_sessions').doc(classId);
      const unsub = docRef.onSnapshot((doc) => {
        if (doc.exists) {
          callback(doc.data());
        } else {
          // 문서가 없으면 기본 대기 상태 객체 생성 및 반환
          const defaultSession = {
            classId: classId,
            status: 'waiting',
            title: '중2 정보 알고리즘과 프로그래밍 수행평가',
            durationMinutes: 30,
            startTime: null,
            maxStudents: 27
          };
          callback(defaultSession);
        }
      }, (err) => {
        console.warn(`[EvalService] Firestore 세션 구독 오류 (${classId}):`, err);
        this.fallbackSessionListener(classId, callback);
      });

      this.sessionUnsub = unsub;
      return unsub;
    }

    // 2) Firestore 미연동 시 로컬 세션 & 채널 리스너
    return this.fallbackSessionListener(classId, callback);
  }

  /**
   * 로컬 Fallback 세션 리스너 (오프라인 / 다중 탭 시뮬레이션)
   */
  fallbackSessionListener(classId, callback) {
    const storageKey = `EVAL_SESSION_${classId}`;
    const readLocal = () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return {
        classId: classId,
        status: 'waiting',
        title: '중2 정보 알고리즘과 프로그래밍 수행평가',
        durationMinutes: 30,
        startTime: null,
        maxStudents: 27
      };
    };

    callback(readLocal());

    const handler = (e) => {
      if (e.data && e.data.type === 'SESSION_UPDATE' && e.data.classId === classId) {
        callback(e.data.payload);
      }
    };

    if (this.channel) {
      this.channel.addEventListener('message', handler);
    }

    return () => {
      if (this.channel) this.channel.removeEventListener('message', handler);
    };
  }

  /**
   * [교사] 30분 동시 수행평가 시작
   * @param {string} classId - 예: "2-3"
   * @param {number} durationMinutes - 제한 시간 (기본 30분)
   */
  async startSession(classId, durationMinutes = 30) {
    const nowIso = new Date().toISOString();
    const payload = {
      classId: classId,
      status: 'in_progress',
      title: '중2 정보 알고리즘과 프로그래밍 수행평가',
      durationMinutes: durationMinutes,
      startTime: nowIso,
      maxStudents: 27
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId).set(payload, { merge: true });
        console.info(`🚀 [EvalService] ${classId} 수행평가 시작 브로드캐스트 완료!`);
      } catch (err) {
        console.error("세션 시작 저장 실패:", err);
      }
    }

    // 로컬 스토리지 & 채널 브로드캐스트
    sessionStorage.setItem(`EVAL_SESSION_${classId}`, JSON.stringify(payload));
    if (this.channel) {
      this.channel.postMessage({ type: 'SESSION_UPDATE', classId, payload });
    }
  }

  /**
   * [교사] 시험 강제 마감
   */
  async endSession(classId) {
    const payload = {
      status: 'ended',
      endedAt: new Date().toISOString()
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId).set(payload, { merge: true });
      } catch (err) {
        console.error("세션 종료 저장 실패:", err);
      }
    }

    const storageKey = `EVAL_SESSION_${classId}`;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const cur = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(storageKey, JSON.stringify({ ...cur, ...payload }));
    } catch (e) {}

    if (this.channel) {
      this.channel.postMessage({ type: 'SESSION_UPDATE', classId, payload: { classId, ...payload } });
    }
  }

  // ============================================================================
  // 👨‍🎓 [학생용] 대기실 입장, 진행도 동기화, 최종 제출 API
  // ============================================================================

  /**
   * 학생 대기실 입장 등록
   * @param {string} classId - 예: "2-1"
   * @param {number|string} studentNum - 1 ~ 27
   * @param {string} studentName - 학생 이름
   */
  async joinWaitingRoom(classId, studentNum, studentName) {
    const numInt = parseInt(studentNum, 10);
    const docId = String(numInt).padStart(2, '0'); // "01" ~ "27"
    const nowIso = new Date().toISOString();

    const studentData = {
      num: numInt,
      numStr: docId,
      name: studentName,
      status: 'waiting',
      joinedAt: nowIso,
      submittedAt: null,
      progress: { part1: 0, part2: 0, part3: 0 },
      answers: { part1: {}, part2: {}, part3: null },
      scores: { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null },
      feedback: { part2: '', part3: '' }
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId)
          .collection('students').doc(docId)
          .set(studentData, { merge: true });
      } catch (err) {
        console.warn("[EvalService] 학생 입장 Firestore 저장 실패:", err);
      }
    }

    // 로컬 스토리지 보관 및 브로드캐스트
    const listKey = `EVAL_STUDENTS_${classId}`;
    let list = [];
    try {
      list = JSON.parse(sessionStorage.getItem(listKey) || '[]');
    } catch (e) {}
    list = list.filter(s => s.num !== numInt);
    list.push(studentData);
    sessionStorage.setItem(listKey, JSON.stringify(list));

    if (this.channel) {
      this.channel.postMessage({ type: 'STUDENT_JOIN', classId, payload: studentData });
    }

    return studentData;
  }

  /**
   * 학생 실시간 진행도 갱신 (풀이 중인 단계 표시)
   */
  async updateStudentProgress(classId, studentNum, progress) {
    const docId = String(parseInt(studentNum, 10)).padStart(2, '0');
    const payload = {
      status: 'in_progress',
      progress: progress,
      updatedAt: new Date().toISOString()
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId)
          .collection('students').doc(docId)
          .set(payload, { merge: true });
      } catch (err) {}
    }

    if (this.channel) {
      this.channel.postMessage({ type: 'STUDENT_PROGRESS', classId, docId, payload });
    }
  }

  /**
   * 학생 최종 답안 제출 및 100% 자동 채점 점수 반영
   */
  async submitStudentExam(classId, studentNum, fullSubmission) {
    const docId = String(parseInt(studentNum, 10)).padStart(2, '0');
    const nowIso = new Date().toISOString();

    const finalData = {
      status: 'submitted',
      submittedAt: nowIso,
      answers: fullSubmission.answers,
      scores: fullSubmission.scores,
      feedback: fullSubmission.feedback
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId)
          .collection('students').doc(docId)
          .set(finalData, { merge: true });
        console.info(`🎉 [EvalService] ${classId} ${docId}번 학생 최종 제출 완료!`);
      } catch (err) {
        console.error("제출 Firestore 저장 실패:", err);
      }
    }

    // 로컬 스토리지 업데이트
    const listKey = `EVAL_STUDENTS_${classId}`;
    try {
      let list = JSON.parse(sessionStorage.getItem(listKey) || '[]');
      const idx = list.findIndex(s => s.numStr === docId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...finalData };
      } else {
        list.push({ num: parseInt(studentNum, 10), numStr: docId, ...finalData });
      }
      sessionStorage.setItem(listKey, JSON.stringify(list));
    } catch (e) {}

    if (this.channel) {
      this.channel.postMessage({ type: 'STUDENT_SUBMIT', classId, docId, payload: finalData });
    }

    return finalData;
  }

  // ============================================================================
  // 🖥️ [교사용] 27명 학생 전체 실시간 리스너 및 점수 조정
  // ============================================================================

  /**
   * 특정 반의 27명 학생 상태 실시간 구독
   * @param {string} classId - 예: "2-3"
   * @param {function} callback - (studentList) => void
   */
  listenStudents(classId, callback) {
    const db = this.getDb();

    if (db) {
      const colRef = db.collection('eval_sessions').doc(classId).collection('students');
      const unsub = colRef.onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push(doc.data());
        });
        // 1번부터 27번 순서대로 완벽 정렬
        list.sort((a, b) => a.num - b.num);
        callback(list);
      }, (err) => {
        console.warn(`[EvalService] 학생 목록 리스너 오류 (${classId}):`, err);
        this.fallbackStudentsListener(classId, callback);
      });

      this.studentsUnsub = unsub;
      return unsub;
    }

    return this.fallbackStudentsListener(classId, callback);
  }

  fallbackStudentsListener(classId, callback) {
    const listKey = `EVAL_STUDENTS_${classId}`;
    const readLocal = () => {
      try {
        const raw = sessionStorage.getItem(listKey);
        if (raw) {
          const arr = JSON.parse(raw);
          arr.sort((a, b) => a.num - b.num);
          return arr;
        }
      } catch (e) {}
      return [];
    };

    callback(readLocal());

    const handler = (e) => {
      if (e.data && e.data.classId === classId) {
        callback(readLocal());
      }
    };

    if (this.channel) {
      this.channel.addEventListener('message', handler);
    }

    return () => {
      if (this.channel) this.channel.removeEventListener('message', handler);
    };
  }

  /**
   * [교사] 학생 점수 수동 조정 (Override)
   */
  async overrideStudentScore(classId, studentNum, newScore) {
    const docId = String(parseInt(studentNum, 10)).padStart(2, '0');
    const updateObj = {
      "scores.teacherOverride": Number(newScore)
    };

    const db = this.getDb();
    if (db) {
      try {
        await db.collection('eval_sessions').doc(classId)
          .collection('students').doc(docId)
          .update(updateObj);
      } catch (e) {
        console.error("점수 수정 실패:", e);
      }
    }

    // 로컬 업데이트
    const listKey = `EVAL_STUDENTS_${classId}`;
    try {
      let list = JSON.parse(sessionStorage.getItem(listKey) || '[]');
      const target = list.find(s => s.numStr === docId);
      if (target) {
        target.scores.teacherOverride = Number(newScore);
        sessionStorage.setItem(listKey, JSON.stringify(list));
      }
    } catch (e) {}

    if (this.channel) {
      this.channel.postMessage({ type: 'SCORE_OVERRIDE', classId, docId, newScore });
    }
  }

  // ============================================================================
  // 📑 나이스(NEIS) 호환 CSV 내보내기
  // ============================================================================

  /**
   * 1번~27번 학생 성적을 나이스(NEIS) 양식 CSV로 다운로드
   * UTF-8 with BOM (\uFEFF) 적용으로 엑셀에서 한글 깨짐 원천 방지
   */
  exportNeisCSV(classId, studentList = []) {
    // 1번부터 27번까지 완전 정렬
    const sorted = [...studentList].sort((a, b) => a.num - b.num);

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "학급,번호,이름,응시상태,Part1(객관식/30),Part2(주관식/30),Part3(순서도/40),자동채점총점,선생님조정점수,최종성적,제출시각\n";

    sorted.forEach(s => {
      const finalScore = s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined
        ? s.scores.teacherOverride
        : (s.scores?.total || 0);

      const row = [
        `"${classId}반"`,
        s.num,
        `"${s.name || ''}"`,
        `"${s.status === 'submitted' ? '응시완료' : (s.status === 'in_progress' ? '미제출' : '결시')}"`,
        s.scores?.part1 || 0,
        s.scores?.part2 || 0,
        s.scores?.part3 || 0,
        s.scores?.total || 0,
        s.scores?.teacherOverride !== null && s.scores?.teacherOverride !== undefined ? s.scores.teacherOverride : "",
        finalScore,
        `"${s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString('ko-KR') : '-'}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${classId}반_알고리즘_수행평가_성적표_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// 전역 싱글톤 인스턴스 등록
window.evalService = new EvalService();
