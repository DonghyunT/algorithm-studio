class StudentEvalApp {
  constructor() {
    this.currentClass = "2-1";
    this.studentNum = 1;
    this.studentName = "";
    this.sessionStatus = "waiting";
    this.timerInterval = null;
    this.remainingSeconds = 1800; // 30분
    this.currentPart = "part1";
    this.isCbtMode = true;
    this.userToggledMode = false;
    this.userSidebarCollapsed = false;
    this.currentQuestionIndex = 1;
    this.part3SubStep = 1;
    this.isSubmitted = false;
    this.secureQuestions = null;
    this.secureQuestionAttemptId = null;
    this.startingExam = false;
    this.serverScoreState = { status: 'idle', score: null };
    this.serverScorePollTimer = null;
    this.serverScoreRequest = null;
    this.serverScoreRequestKey = null;

    // 답안 보관함
    this.answers = {
      part1: {}, // { qId: optionIndex }
      part2: {}, // { qId: textAnswer }
      part3: {
        selectedThemeId: "theme_greenhouse",
        questionVersion:2,
        blocks: [], // [{ id, shape, text, x, y }]
        connections: [], // [{ id, from, to, fromPort, toPort }]
        isVerified: false
      }
    };

    this.scores = { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null };

    // 인터랙션 상태
    this.blockIdCounter = 1;
    this.isDraggingBlock = false;
    this.draggedBlockId = null;
    this.dragOffset = { x: 0, y: 0 };

    this.isConnecting = false;
    this.connectionSource = null; // { blockId, portType }

    this.studentUnsub = null;
    this.sessionUnsub = null;
    this.isSubmitting = false;
    this.joined = false;
    this.lastResetAt = null;
    this.deadlineMs = null;
    this.lastServerSyncedAnswers = null;
    window.addEventListener("beforeunload", () => this.saveDraft());
    try { window.pendingAssessmentResume=!!sessionStorage.getItem('ALGO_ACTIVE_EXAM'); } catch {}
    window.addEventListener('DOMContentLoaded',()=>this.resumeAssessment());
  }

  async resumeAssessment() {
    let identity;try{identity=JSON.parse(sessionStorage.getItem('ALGO_ACTIVE_EXAM'));}catch{}
    if(!identity)return;
    document.getElementById('eval-st-class').value=identity.classId;
    document.getElementById('eval-st-num').value=identity.num;
    document.getElementById('eval-st-name').value=identity.name;
    switchUnit('eval');this.showScreen('lobby');
    await this.enterWaitingRoom();
  }
  rememberAssessment() {
    try {sessionStorage.setItem('ALGO_ACTIVE_EXAM',JSON.stringify({classId:this.currentClass,num:this.studentNum,name:this.studentName}));}catch{}
  }

  draftKey() { return "ALGO_EXAM_DRAFT_"+(this.ownerUid||'')+"_"+this.currentClass+"_"+this.studentNum+"_"+(this.attemptId||'demo'); }
  saveDraft() {
    if (!this.joined || window.isSessionClosing) return;
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify({answers:this.answers,deadlineMs:this.deadlineMs,studentName:this.studentName,lastResetAt:this.lastResetAt,isSubmitted:this.isSubmitted,visitedPart3:this.visitedPart3,currentPart:this.currentPart,currentQuestionIndex:this.currentQuestionIndex,part3SubStep:this.part3SubStep,isCbtMode:this.isCbtMode,userToggledMode:!!this.userToggledMode,userSidebarCollapsed:!!this.userSidebarCollapsed})); } catch(error) { console.warn("임시 저장 실패",error); }
  }
  restoreDraft(student) {
    this.latestStudent=student;
    this.attemptId=student?.attemptId||null;
    let draft=null; try { draft=JSON.parse(sessionStorage.getItem(this.draftKey())); } catch {}
    const validDraft=draft && draft.studentName===this.studentName && draft.lastResetAt===(student?.resetAt||null);
    if (student?.status==="submitted") { this.answers=student.answers; this.isSubmitted=true; }
    else if(validDraft) {
      this.answers=draft.answers;
      this.deadlineMs=draft.deadlineMs;
      if (typeof draft.userSidebarCollapsed === 'boolean') {
        this.userSidebarCollapsed = draft.userSidebarCollapsed;
      }
      const urlParams = typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined' ? new URLSearchParams(window.location?.search || '') : null;
      const forceClassic = urlParams && urlParams.get('classic') === '1';
      const forceCbt = urlParams && urlParams.get('cbt') === '1';
      if (forceClassic) {
        this.isCbtMode = false;
        this.userToggledMode = true;
      } else if (forceCbt) {
        this.isCbtMode = true;
        this.userToggledMode = true;
      } else if (typeof draft.isCbtMode === 'boolean' && draft.userToggledMode) {
        this.isCbtMode = draft.isCbtMode;
        this.userToggledMode = true;
      } else {
        this.isCbtMode = true;
      }
      if (Number.isInteger(draft.currentQuestionIndex) && draft.currentQuestionIndex >= 1 && draft.currentQuestionIndex <= 17) {
        this.currentQuestionIndex = draft.currentQuestionIndex;
      }
      if (draft.part3SubStep === 1 || draft.part3SubStep === 2) {
        this.part3SubStep = draft.part3SubStep;
      }
    }
    else if(student?.answers) this.answers=student.answers;
    if (student?.answers?.assignedQuestions && !this.answers?.assignedQuestions) {
      this.answers.assignedQuestions = student.answers.assignedQuestions;
    }
    if(!this.answers.part3) this.answers.part3={selectedThemeId:"theme_greenhouse",blocks:[],connections:[],isVerified:false};
    this.visitedPart3=!!this.answers.part3.visited || !!(validDraft && draft.visitedPart3);
    this.currentPart=validDraft&&['part1','part2','part3'].includes(draft.currentPart)?draft.currentPart:'part1';
    this.lastResetAt=student?.resetAt||null;
    this.blockIdCounter=1+Math.max(0,...this.answers.part3.blocks.map(b=>Number(String(b.id).replace("eblk_",""))||0));
  }
  // 1. 대기실 열기 (풀페이지 전환)
  openLobby() {
    if (typeof switchUnit === 'function') {
      switchUnit('eval');
    }
    if (window.authService && !window.authService.isDemo?.()) {
      window.authService.student().catch(() => {});
    }
    this.showScreen(this.isSubmitted ? 'result' : isAssessmentLocked() ? 'exam' : 'lobby');
  }

  async checkSelectedClassStatus() {
    const classSel = document.getElementById('eval-st-class');
    const statusBadge = document.getElementById('eval-lobby-class-status');
    if (!classSel || !statusBadge || !window.evalService) return;
    const classId = classSel.value;
    statusBadge.textContent = "확인 중…";
    statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500";
    if (this.lobbySessionUnsub) {
      this.lobbySessionUnsub();
      this.lobbySessionUnsub = null;
    }

    if (window.authService && !window.authService.isDemo?.()) {
      try {
        await window.authService.student();
      } catch (e) {
        console.warn('Anonymous student auth failed before checking status:', e);
      }
    }

    this.lobbySessionUnsub = window.evalService.listenSession(classId, (session) => {
      const isOpen = session && ['waiting', 'in_progress'].includes(session.status) && !!session.attemptId;
      if (session?.status === 'in_progress' && session.attemptId) {
        statusBadge.textContent = "평가 진행 중";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800";
      } else if (isOpen) {
        statusBadge.textContent = "대기실 열림 (입장 가능)";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
      } else {
        statusBadge.textContent = "대기실 닫힘 (선생님 준비 대기)";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800";
      }
    }, () => {
      statusBadge.textContent = "상태 확인 불가";
      statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500";
    });
  }

  // 풀페이지 내부 서브 화면 전환 (lobby | exam | result)
  showScreen(screenName) {
    if(isAssessmentLocked() && this.joined && screenName==='lobby')screenName='exam';
    if(screenName!=='exam')window.assessmentWorkspace?.leave();
    updateAssessmentNavigation();
    const lobbyEl = document.getElementById('eval-screen-lobby');
    const examEl = document.getElementById('eval-screen-exam');
    const resultEl = document.getElementById('eval-screen-result');

    if (lobbyEl) lobbyEl.classList.add('hidden');
    if (examEl) examEl.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');

    if (screenName === 'lobby' && lobbyEl) {
      lobbyEl.classList.remove('hidden');
      this.checkSelectedClassStatus();
    } else {
      this.lobbySessionUnsub?.();
      this.lobbySessionUnsub = null;
    }
    if (screenName === 'exam' && examEl) examEl.classList.remove('hidden');
    if (screenName === 'result' && resultEl) resultEl.classList.remove('hidden');
  }

  // 2. 대기실 입장 버튼 클릭
  async enterWaitingRoom() {
    this.lobbySessionUnsub?.();
    this.lobbySessionUnsub = null;
    const classSel = document.getElementById('eval-st-class');
    const numInp = document.getElementById('eval-st-num');
    const nameInp = document.getElementById('eval-st-name');

    this.currentClass = classSel ? classSel.value : "2-1";
    this.studentNum = numInp ? Number(numInp.value) : 1;
    this.studentName = nameInp ? nameInp.value.trim() : "";

    if (!this.studentName) {
      alert("⚠️ 이름을 입력해 주세요!");
      if (nameInp) nameInp.focus();
      return;
    }

    if (!Number.isInteger(this.studentNum) || this.studentNum < 1 || this.studentNum > 27) {
      alert("⚠️ 번호는 1번부터 27번 사이로 입력해 주세요!");
      if (numInp) numInp.focus();
      return;
    }

    // 서버/세션에 대기실 입장 등록
    if (window.evalService) {
      try {
        const student=await window.evalService.joinWaitingRoom(this.currentClass,this.studentNum,this.studentName);
        this.ownerUid=student.ownerUid; this.joined=true; this.restoreDraft(student);
        this.makeupAllowed = !!student.makeupAllowed;
        this.sessionUnsub?.(); this.studentUnsub?.(); this.sessionUnsub=null; this.studentUnsub=null;
      } catch(error) { alert(error.message); return; }
    }

    // 대기실 안내 뷰 업데이트
    const waitArea = document.getElementById('eval-lobby-waiting-area');
    const formArea = document.getElementById('eval-lobby-form-area');
    if (formArea) formArea.classList.add('hidden');
    if (waitArea) waitArea.classList.remove('hidden');

    const stInfoLabel = document.getElementById('eval-lobby-student-info');
    if (stInfoLabel) {
      stInfoLabel.textContent = `${this.currentClass}반 ${this.studentNum}번 ${this.studentName}`;
    }
    this.updateLobbyMakeupUI();

    // 풀던 중 재접속하여 이미 시험 진행 중인 경우 즉시 시험장 복구 진입
    if (this.latestStudent?.status === 'in_progress' && !this.isSubmitted) {
      const sessionInfo = this.latestSession || {
        questionVersion: this.latestStudent.answers?.part3?.questionVersion || 4,
        attemptId: this.latestStudent.attemptId,
        deadlineMs: this.latestStudent.deadlineMs
      };
      this.startExam(sessionInfo);
      return;
    }

    // 1) 전체 학급 세션 리스너 구독 (선생님이 [30분 동시 시작] 누를 시 시험장 진입)
    if (window.evalService && !this.sessionUnsub) {
      this.sessionUnsub = window.evalService.listenSession(this.currentClass, (sessionData) => {
        const previous=this.latestSession;
        this.latestSession=sessionData;
        window.pendingAssessmentResume=false;
        if(sessionData?.status==='waiting') {
          sessionStorage.removeItem('ALGO_ACTIVE_EXAM');
          if(previous?.attemptId && previous.attemptId!==sessionData.attemptId){sessionStorage.removeItem(this.draftKey());this.joined=false;location.reload();return;}
          this.sessionStatus='waiting';clearInterval(this.timerInterval);this.timerInterval=null;updateAssessmentNavigation();
        }
        if(sessionData?.status==="ended" && !this.isSubmitted) {
          if (this.makeupAllowed) {
            // 개별 추가 응시생은 전체 학급 세션 종료에 영향받지 않고 개별 30분 타이머 유지
            return;
          }
          this.sessionStatus="ended"; clearInterval(this.timerInterval); this.timerInterval=null;
          switchUnit('eval'); this.renderPartQuestions(); this.showScreen('exam');
          this.submitExam(true); return;
        }
        if (sessionData && sessionData.status === 'in_progress' && !this.isSubmitted) {
          this.startExam(sessionData);
        }
      });
    }

    // 2) 학생 개별 상태 리스너 구독 (교사의 재시험 허용 실시간 감지 및 시험장 자동 복귀)
    if (window.evalService && !this.studentUnsub) {
      this.studentUnsub = window.evalService.listenStudent(this.currentClass, this.studentNum, (stData) => {
        // 교사에 의한 좌석 비우기 (퇴장 처리) 실시간 감지
        if (stData === null && this.joined && !this.isSubmitted) {
          this.sessionUnsub?.(); this.studentUnsub?.();
          this.sessionUnsub = null; this.studentUnsub = null;
          this.joined = false;
          sessionStorage.removeItem(this.draftKey());
          sessionStorage.removeItem('ALGO_ACTIVE_EXAM');
          alert("⚠️ 선생님께서 좌석을 초기화하셨습니다.\n번호와 이름을 다시 확인해 주세요.");
          location.reload();
          return;
        }
        this.latestStudent=stData;
        this.makeupAllowed = !!stData?.makeupAllowed;
        this.updateLobbyMakeupUI();
        // 교사에 의한 강제 정상 제출 실시간 감지
        if (!this.isSubmitted && stData?.status === 'submitted') {
          this.isSubmitted = true;
          clearInterval(this.timerInterval); this.timerInterval = null;
          this.calculateScores();
          this.showScreen('result');
          this.renderResult();
          this.startServerScorePolling();
          alert("🔔 선생님께서 시험을 마감하여 현재 작성 답안으로 정상 제출되었습니다.");
          return;
        }
        if(this.isSubmitted&&stData?.status==='submitted'){
          this.calculateScores();
          if(!document.getElementById('eval-screen-result').classList.contains('hidden'))this.renderResult();
          this.startServerScorePolling();
        }
        if (stData?.resetAt && stData.resetAt !== this.lastResetAt) {
          this.lastResetAt=stData.resetAt;
          alert("🔔 선생님께서 재시험을 허용하셨습니다!\n답안이 초기화되며 시험 화면으로 복귀합니다.");
          this.isSubmitted = false;
          this.sessionStatus = 'waiting';
          window.assessmentWorkspace?.leave();this.visitedPart3=false;this.currentPart='part1';this.currentQuestionIndex=1;this.part3SubStep=1;delete this.answers.part3.visited;
          this.answers.part1 = {};
          this.answers.part2 = {};
          this.answers.part3.blocks = [];
          this.answers.part3.connections = [];
          this.answers.part3.isVerified = false;
          delete this.answers.part3.plan;
          this.scores = { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null };
          this.resetServerScoreState();
          this.lastServerSyncedAnswers = null;

          this.isSubmitting=false;
          if (this.latestSession?.status === 'in_progress') this.startExam(this.latestSession);
          else this.showScreen('lobby');
          this.saveDraft();
        }
      });
    }
    if(this.isSubmitted) { this.calculateScores(); this.renderResult(); this.startServerScorePolling(); }
  }

  // 2-1. 대기실 나가기 (번호·이름 오입력 수정용)
  async leaveWaitingRoom() {
    if (!this.joined || this.isSubmitted || this.sessionStatus !== 'waiting') return;
    if (!confirm('대기실에서 나가시겠습니까?\n번호와 이름을 다시 입력하여 재입장할 수 있습니다.')) return;

    const classId = this.currentClass;
    const studentNum = this.studentNum;

    try {
      if (window.evalService && classId && studentNum) {
        await window.evalService.leaveWaitingRoom(classId, studentNum);
      }
    } catch (error) {
      console.warn('대기실 퇴장 기록 정리 중 알림:', error);
    }

    this.sessionUnsub?.(); this.studentUnsub?.();
    this.sessionUnsub = null; this.studentUnsub = null;
    this.joined = false;
    this.ownerUid = null;
    sessionStorage.removeItem(this.draftKey());
    sessionStorage.removeItem('ALGO_ACTIVE_EXAM');

    const waitArea = document.getElementById('eval-lobby-waiting-area');
    const formArea = document.getElementById('eval-lobby-form-area');
    if (waitArea) waitArea.classList.add('hidden');
    if (formArea) formArea.classList.remove('hidden');

    const numInp = document.getElementById('eval-st-num');
    if (numInp) numInp.focus();

    this.checkSelectedClassStatus();
  }

  updateLobbyMakeupUI() {
    const makeupBox = document.getElementById('eval-lobby-makeup-start-box');
    const normalMsg = document.getElementById('eval-lobby-normal-msg');
    if (this.makeupAllowed && !this.isSubmitted && this.sessionStatus !== 'in_progress') {
      if (makeupBox) makeupBox.classList.remove('hidden');
      if (normalMsg) normalMsg.classList.add('hidden');
    } else {
      if (makeupBox) makeupBox.classList.add('hidden');
      if (normalMsg) normalMsg.classList.remove('hidden');
    }
  }

  // 결시생 개별 30분 추가 응시 시작
  async startMakeupExamNow() {
    if (!this.makeupAllowed || this.sessionStatus === 'in_progress' || this.startingExam) return;
    const startBtn = document.getElementById('eval-lobby-makeup-start-btn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 시험 준비 중...';
    }
    try {
      const res = await window.evalService.startStudentMakeupExam(this.currentClass, this.studentNum, 30);
      this.individualDeadlineMs = res.deadlineMs;
      const sessionInfo = this.latestSession || {
        questionVersion: this.answers?.part3?.questionVersion || 4,
        attemptId: this.attemptId || this.latestStudent?.attemptId || 'makeup',
        deadlineMs: res.deadlineMs
      };
      await this.startExam(sessionInfo);
    } catch (err) {
      alert('개별 평가 시작 중 오류가 발생했습니다: ' + (err.message || err));
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>개별 평가 시작하기 (30분)</span>';
      }
    }
  }

  // 3. 시험장 진입 및 타이머 가동
  async startExam(sessionData) {
    if (this.sessionStatus === 'in_progress' || this.startingExam) return;
    const qVersion = (sessionData && sessionData.questionVersion) || this.answers?.part3?.questionVersion || 1;
    this.startingExam = true;
    if (qVersion === 4) {
      try {
        if (this.secureQuestionAttemptId !== sessionData?.attemptId) this.secureQuestions = null;
        if (!this.secureQuestions) {
          const result = await requestSecureEvaluationQuestions(this.currentClass, this.studentNum);
          if (!result.questions || result.questions.version !== 4 || result.questions.part1?.length !== 10 || result.questions.part2?.length !== 6 || !result.attemptId || result.attemptId !== sessionData?.attemptId) throw Error('실전평가 문항 회차 또는 구성이 완전하지 않습니다.');
          this.secureQuestions = result.questions;
          this.secureQuestionAttemptId = result.attemptId;
        }
      } catch (error) {
        this.startingExam = false;
        alert(error.message + '\n평가 문항을 안전하게 불러올 수 없어 시작하지 않았습니다. 선생님께 알려 주세요.');
        return;
      }
    }
    this.sessionStatus = 'in_progress';
    this.startingExam = false;
    this.lastServerSyncedAnswers = null;
    window.pendingAssessmentResume=false;this.rememberAssessment();
    switchUnit('eval');
    document.body.classList.add('assessment-active');
    this.showScreen('exam');

    // 학생 헤더 정보 렌더링
    const headerInfo = document.getElementById('eval-exam-st-info');
    if (headerInfo) {
      headerInfo.textContent = `${this.currentClass}반 ${this.studentNum}번 ${this.studentName}`;
    }

    // 타이머 계산
    if (this.makeupAllowed && (this.individualDeadlineMs || this.latestStudent?.deadlineMs)) {
      this.deadlineMs = this.individualDeadlineMs || this.latestStudent?.deadlineMs;
    } else if (sessionData?.deadlineMs) {
      this.deadlineMs = sessionData.deadlineMs;
    } else if (sessionData && sessionData.startTime) {
      const startMs = new Date(sessionData.startTime).getTime();
      const totalSec = (sessionData.durationMinutes || 30) * 60;
      this.deadlineMs = startMs + totalSec * 1000;
    } else {
      this.deadlineMs = Date.now() + 1800 * 1000;
    }

    this.remainingSeconds=Math.max(0,Math.ceil((this.deadlineMs-Date.now())/1000));
    this.saveDraft();
    this.renderTimer();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.remainingSeconds = Math.max(0, Math.ceil((this.deadlineMs-Date.now())/1000));
      this.renderTimer();
      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.sessionStatus='ended';
        alert("⏰ 시험 시간이 만료되었습니다. 서버에 저장된 답안을 제출합니다.");
        this.submitExam(true);
      }
    }, 1000);

    // 문제은행 난이도별 문항 추출 보장 (버전 3 이상 또는 미배정 시 결정론적 추출)
    const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
    if (qVersion === 3 && assignFn && !this.answers.assignedQuestions) {
      this.answers.assignedQuestions = assignFn(`${this.attemptId || sessionData?.attemptId || 'demo'}_${this.currentClass}_${this.studentNum}`);
      this.saveDraft();
      this.syncStudentProgress();
    }

    // 디벗/태블릿 및 웹 환경 시험 중 화면 이탈 감지 (부정행위 예방 안내)
    if (!this.visibilityListenerAttached) {
      this.visibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (this.sessionStatus === 'in_progress' && !this.isSubmitted) {
          if (document.hidden) {
            this.answers.blurCount = (this.answers.blurCount || 0) + 1;
            this.syncStudentProgress();
          } else {
            this.showTabWarningNotice();
          }
        }
      });
    }

    // 문항 렌더링 & 순서도 백지 초기화
    this.renderPartQuestions();
    this.initPart3Canvas();
    const urlParams = typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined' ? new URLSearchParams(window.location?.search || '') : null;
    const forceClassic = urlParams && urlParams.get('classic') === '1';
    const forceCbt = urlParams && urlParams.get('cbt') === '1';
    if (forceClassic) {
      this.isCbtMode = false;
      this.userToggledMode = true;
    } else if (forceCbt || window.forceCbtMode) {
      this.isCbtMode = true;
      this.userToggledMode = true;
    } else if (!this.userToggledMode) {
      this.isCbtMode = true;
    }
    this.applyViewMode();
    if (this.isCbtMode) {
      this.goToCbtQuestion(this.currentQuestionIndex || 1);
    } else {
      this.switchPart(this.currentPart || 'part1');
    }
    this.startingExam = false;

    // 시험장 정상 진입 즉시 서버에 풀이 시작(in_progress) 상태 즉각 동기화
    this.syncStudentProgress(true);
  }

  showTabWarningNotice() {
    let toast = document.getElementById('eval-tab-warning-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'eval-tab-warning-toast';
      toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-rose-600 text-white px-5 py-2.5 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2.5 font-bold text-xs sm:text-sm animate-bounce';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-300 text-base"></i><span>시험 화면을 벗어난 기록이 감지되었습니다. 시험에 집중해 주세요.</span>`;
    toast.classList.remove('hidden');
    clearTimeout(this.tabWarningTimer);
    this.tabWarningTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }

  renderTimer() {
    const timerEl = document.getElementById('eval-exam-timer');
    if (!timerEl) return;
    const min = String(Math.floor(this.remainingSeconds / 60)).padStart(2, '0');
    const sec = String(this.remainingSeconds % 60).padStart(2, '0');
    timerEl.textContent = `${min}:${sec}`;

    if (this.remainingSeconds <= 300) {
      timerEl.className = "text-base font-black px-3 py-1 bg-rose-500 text-white rounded-xl animate-pulse font-mono";
    } else {
      timerEl.className = "text-base font-black px-3 py-1 bg-slate-900 text-amber-300 rounded-xl font-mono";
    }
  }

  // Part 1, 2, 3 탭 전환
  switchPart(partName, fromFooter=false) {
    if(!['part1','part2','part3'].includes(partName))return;
    window.assessmentWorkspace?.leave();
    this.currentPart = partName;
    const p1Container = document.getElementById('eval-part1-container');
    const p2Container = document.getElementById('eval-part2-container');
    const p3Container = document.getElementById('eval-part3-container');

    ['part1', 'part2', 'part3'].forEach(p => {
      const btn = document.getElementById(`eval-tab-btn-${p}`);
      if (btn) {
        btn.setAttribute('aria-selected',String(p===partName));
        btn.setAttribute('role','tab');
        if (p === partName) {
          btn.className = "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 text-white shadow-xs transition cursor-pointer";
        } else {
          btn.className = "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer";
        }
      }
    });

    if (p1Container) p1Container.classList.toggle('hidden', partName !== 'part1');
    if (p2Container) p2Container.classList.toggle('hidden', partName !== 'part2');
    if (p3Container) p3Container.classList.toggle('hidden', partName !== 'part3');

    if (partName === 'part3') {
      this.visitedPart3=true;this.answers.part3.visited=true;
      this.renderAssessmentPlan();window.assessmentWorkspace.enter(this);
    }
    this.updatePartNavigation();this.saveDraft();
    if(fromFooter)document.getElementById('eval-'+partName+'-container').scrollIntoView({block:'start'});
  }

  updatePartNavigation() {
    const questions=this.currentQuestions();
    for(const part of ['part1','part2','part3']) {
      const container=document.getElementById('eval-'+part+'-container');
      if(!container) continue;
      let footer=container.querySelector ? container.querySelector('.eval-part-footer') : null;
      if(!footer && container.appendChild){footer=document.createElement('nav');footer.className='eval-part-footer';footer.setAttribute('aria-label',part+' 하단 이동');container.appendChild(footer);}
      if(!footer) continue;
      const index=['part1','part2','part3'].indexOf(part);
      const count=part==='part3'?0:questions[part].filter(q=>part==='part1'?Number.isInteger(this.answers.part1[q.id]):String(this.answers.part2[q.id]||'').trim()).length;
      footer.innerHTML=(index?`<button type="button" onclick="studentEvalApp.switchPart('part${index}',true)">이전: ${index===1?'객관식':'단답형'}</button>`:'')+
        `<div>${index<2?`${questions[part].length}문항 중 ${count}문항 응답`:'작성한 내용을 확인하고 제출하세요.'}${index<2&&count<questions[part].length?'<small>풀지 않은 문제는 나중에 돌아와 풀 수 있어요.</small>':''}</div>`+
        (index<2?`<button type="button" onclick="studentEvalApp.switchPart('part${index+2}',true)">다음: ${index===0?'단답형':'순서도'}</button>`:'<button type="button" data-eval-submit onclick="studentEvalApp.submitExam(false)">최종 제출</button>');
    }
    document.querySelectorAll('[data-eval-submit]').forEach(b=>{b.disabled=this.isSubmitting||this.isSubmitted;b.title=this.visitedPart3?'최종 제출':'Part 3을 확인한 뒤 제출할 수 있어요.';});
    document.querySelectorAll('#eval-part1-list input,#eval-part2-list input').forEach(input=>{input.disabled=this.isSubmitting||this.isSubmitted||this.sessionStatus==='ended';});
  }

  // 문항 DOM 렌더링 (Part 1 10문항, Part 2 단답형 6문항)
  renderPartQuestions() {
    const questions=this.currentQuestions();
    // Part 1. 객관식 10문항
    const p1Box = document.getElementById('eval-part1-list');
    if (p1Box) {
      p1Box.innerHTML = questions.part1.map((q,i) => `
        <div class="eval-question-card p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">${i+1}번 문제</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">${q.desc}</p>
          <div class="eval-question-options space-y-2 pt-1">
            ${q.options.map((opt, optIdx) => `
              <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition text-xs sm:text-sm font-medium">
                <input type="radio" name="${q.id}" value="${optIdx}" ${this.answers.part1[q.id] === optIdx ? 'checked' : ''} onchange="window.studentEvalApp.onSelectPart1('${q.id}', ${optIdx})" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                <span>${escapeHtml(opt)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Part 2. 단답형 6문항 (각 5점, 총 30점)
    const p2Box = document.getElementById('eval-part2-list');
    if (p2Box) {
      p2Box.innerHTML = questions.part2.map((q,i) => `
        <div class="eval-question-card p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">${i+1}번 문제</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">${q.desc}</p>
          <div class="flex items-center gap-2 max-w-md mt-auto pt-2">
            <input type="text" id="${q.id}_input" value="${escapeHtml(this.answers.part2[q.id] || '')}" onfocus="this.scrollIntoView({behavior:'smooth',block:'center'})" oninput="window.studentEvalApp.onInputPart2('${q.id}', this.value)" class="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-800" placeholder="${q.placeholder}">
            <span class="text-xs font-bold text-slate-400">단답형</span>
          </div>
        </div>
      `).join('');
    }
  }

  onSelectPart1(qId, val) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    this.answers.part1[qId] = val;
    this.syncStudentProgress();
  }

  onInputPart2(qId, val) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    this.answers.part2[qId] = val;
    this.syncStudentProgress();
  }
  currentQuestions() {
    const version=this.latestSession?.questionVersion||this.answers?.part3?.questionVersion;
    if(version===4)return this.secureQuestions || {part1:[],part2:[]};
    return evaluationQuestions(this.answers);
  }

  // ============================================================================
  // 📝 국가수준 CBT 단일 문항 집중형 엔진 (V4 표준 & 디벗/데스크탑 최적화)
  // ============================================================================

  applyViewMode() {
    const cbtContainer = document.getElementById('eval-cbt-container');
    const classicContainer = document.getElementById('eval-classic-container');
    const tabs = document.querySelector('.exam-part-tabs');
    const p1 = document.getElementById('eval-part1-container');
    const p2 = document.getElementById('eval-part2-container');
    const p3 = document.getElementById('eval-part3-container');
    const modeBtnText = document.getElementById('eval-view-mode-text');

    if (this.isCbtMode) {
      if (cbtContainer) cbtContainer.classList.remove('hidden');
      if (classicContainer) classicContainer.classList.add('hidden');
      if (tabs) tabs.classList.add('hidden');
      if (p1) p1.classList.add('hidden');
      if (p2) p2.classList.add('hidden');
      if (p3) p3.classList.add('hidden');
      if (modeBtnText) modeBtnText.textContent = "모아서 보기";
    } else {
      if (cbtContainer) cbtContainer.classList.add('hidden');
      if (classicContainer) classicContainer.classList.remove('hidden');
      if (tabs) tabs.classList.remove('hidden');
      if (modeBtnText) modeBtnText.textContent = "한 문제씩 보기";
      const sharedWs = document.getElementById('eval-shared-workspace');
      const planGuide = document.getElementById('eval-plan-guide');
      const p3Container = document.getElementById('eval-part3-container');
      if (sharedWs && p3Container && !p3Container.contains(sharedWs)) {
        p3Container.appendChild(sharedWs);
      }
      if (planGuide && p3Container && !p3Container.contains(planGuide)) {
        p3Container.appendChild(planGuide);
      }
    }
  }

  toggleCbtMode() {
    this.isCbtMode = !this.isCbtMode;
    this.userToggledMode = true;
    this.applyViewMode();
    if (this.isCbtMode) {
      if (this.currentPart === 'part1' && this.currentQuestionIndex > 10) this.currentQuestionIndex = 1;
      else if (this.currentPart === 'part2' && (this.currentQuestionIndex < 11 || this.currentQuestionIndex > 16)) this.currentQuestionIndex = 11;
      else if (this.currentPart === 'part3') this.currentQuestionIndex = 17;
      this.goToCbtQuestion(this.currentQuestionIndex || 1);
    } else {
      if (this.currentQuestionIndex <= 10) this.switchPart('part1');
      else if (this.currentQuestionIndex <= 16) this.switchPart('part2');
      else this.switchPart('part3');
    }
    this.saveDraft();
  }

  goToCbtQuestion(qIndex) {
    if (!Number.isInteger(qIndex) || qIndex < 1 || qIndex > 17) return;
    const prevIndex = this.currentQuestionIndex;
    this.currentQuestionIndex = qIndex;

    if (prevIndex === 17 && qIndex !== 17) {
      if (window.assessmentWorkspace?.active) {
        window.assessmentWorkspace.leave();
      }
    }

    if (qIndex <= 10) {
      this.currentPart = 'part1';
      this.toggleCbtSidebar(this.userSidebarCollapsed || false);
    } else if (qIndex <= 16) {
      this.currentPart = 'part2';
      this.toggleCbtSidebar(this.userSidebarCollapsed || false);
    } else {
      this.currentPart = 'part3';
      this.visitedPart3 = true;
      this.answers.part3.visited = true;
      if (this.part3SubStep === 2) {
        this.toggleCbtSidebar(true);
      } else {
        this.toggleCbtSidebar(this.userSidebarCollapsed || false);
      }
    }

    this.renderCbtSidebar();
    this.renderCbtQuestion();
    this.updateCbtFooter();
    this.updatePartNavigation();
    this.saveDraft();
  }

  toggleCbtSidebar(force, isUserAction = false) {
    const container = document.getElementById('eval-cbt-container');
    const sidebar = document.getElementById('eval-cbt-sidebar');
    if (!container && !sidebar) return;

    let shouldCollapse;
    if (typeof force === 'boolean') {
      shouldCollapse = force;
    } else if (sidebar) {
      shouldCollapse = !sidebar.classList.contains('collapsed');
    } else if (container) {
      shouldCollapse = !container.classList.contains('cbt-sidebar-collapsed');
    } else {
      shouldCollapse = false;
    }

    if (isUserAction) {
      this.userSidebarCollapsed = shouldCollapse;
    }

    if (container) container.classList.toggle('cbt-sidebar-collapsed', shouldCollapse);
    if (sidebar) sidebar.classList.toggle('collapsed', shouldCollapse);
  }

  goToCbtPart3Step(step = 1) {
    this.currentQuestionIndex = 17;
    this.currentPart = 'part3';
    this.visitedPart3 = true;
    this.answers.part3.visited = true;
    this.part3SubStep = step;
    this.renderCbtSidebar();
    this.renderCbtQuestion();
    this.switchPart3SubStep(step);
    this.updateCbtFooter();
    this.updatePartNavigation();
    this.saveDraft();
  }

  nextCbtQuestion() {
    if (this.currentQuestionIndex < 17) {
      this.goToCbtQuestion(this.currentQuestionIndex + 1);
    } else if (this.currentQuestionIndex === 17 && (this.part3SubStep || 1) === 1) {
      this.switchPart3SubStep(2);
    } else if (this.currentQuestionIndex === 17 && this.part3SubStep === 2) {
      this.submitExam(false);
    }
  }

  prevCbtQuestion() {
    if (this.currentQuestionIndex === 17 && this.part3SubStep === 2) {
      this.switchPart3SubStep(1);
    } else if (this.currentQuestionIndex > 1) {
      this.goToCbtQuestion(this.currentQuestionIndex - 1);
    }
  }

  switchPart3SubStep(step) {
    if (step !== 1 && step !== 2) return;
    this.part3SubStep = step;

    const tab1 = document.getElementById('eval-cbt-step1-tab');
    const tab2 = document.getElementById('eval-cbt-step2-tab');
    const view1 = document.getElementById('eval-cbt-step1-view');
    const view2 = document.getElementById('eval-cbt-step2-view');

    const cbtContainer = document.getElementById('eval-cbt-container');
    const cbtBody = document.getElementById('eval-cbt-body');
    if (step === 1) {
      if (cbtContainer) cbtContainer.classList.remove('cbt-step2-unclamped');
      if (cbtBody) {
        cbtBody.classList.add('justify-center');
        cbtBody.classList.add('overflow-hidden');
        cbtBody.classList.remove('overflow-y-auto');
      }
      this.toggleCbtSidebar(this.userSidebarCollapsed || false);
      if (tab1) { tab1.className = 'px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white transition cursor-pointer flex items-center gap-1.5'; }
      if (tab2) { tab2.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1.5'; }
      if (view1) view1.classList.remove('hidden');
      if (view2) view2.classList.add('hidden');

      const host = document.getElementById('eval-cbt-prescription-host');
      const guide = document.getElementById('eval-plan-guide');
      if (host && guide && !host.contains(guide)) {
        host.appendChild(guide);
      }
      if (guide) guide.hidden = false;
      this.renderAssessmentPlan();
    } else {
      if (cbtContainer) cbtContainer.classList.add('cbt-step2-unclamped');
      if (cbtBody) {
        cbtBody.classList.remove('justify-center');
        cbtBody.classList.remove('overflow-hidden');
        cbtBody.classList.add('overflow-y-auto');
      }
      this.toggleCbtSidebar(true);
      if (tab1) { tab1.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1.5'; }
      if (tab2) { tab2.className = 'px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white transition cursor-pointer flex items-center gap-1.5'; }
      if (view1) view1.classList.add('hidden');
      if (view2) view2.classList.remove('hidden');

      const plan = this.getAssessmentPlan();
      const summaryEl = document.getElementById('eval-cbt-plan-summary');
      const safeEsc = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div><strong class="text-indigo-900">🚩 현재 상태:</strong> <span class="font-medium text-slate-800">${safeEsc(plan.current || '(아직 작성하지 않음)')}</span></div>
          <div><strong class="text-indigo-900">🎯 목표 상태:</strong> <span class="font-medium text-slate-800">${safeEsc(plan.goal || '(아직 작성하지 않음)')}</span></div>
          <div><strong class="text-indigo-900">📋 지켜야 할 규칙(조건):</strong> <span class="font-medium text-slate-800 whitespace-pre-line">${safeEsc(plan.conditions || '(없음)')}</span></div>
        `;
      }

      const wsHost = document.getElementById('eval-cbt-workspace-host');
      const sharedWs = document.getElementById('eval-shared-workspace');
      if (wsHost && sharedWs && !wsHost.contains(sharedWs)) {
        wsHost.appendChild(sharedWs);
      }
      this.renderAssessmentPlan();
      if (!window.assessmentWorkspace?.active) {
        window.assessmentWorkspace?.enter(this);
      }
    }
    this.renderCbtSidebar();
    this.updateCbtFooter();
    this.saveDraft();
  }

  renderCbtSidebar() {
    const questions = this.currentQuestions();
    const p1Container = document.getElementById('eval-cbt-palette-part1');
    const p2Container = document.getElementById('eval-cbt-palette-part2');
    const p3Container = document.getElementById('eval-cbt-palette-part3');
    const ratioEl = document.getElementById('eval-cbt-answered-ratio');

    const mod1 = document.getElementById('eval-cbt-mod-part1');
    const mod2 = document.getElementById('eval-cbt-mod-part2');
    const mod3 = document.getElementById('eval-cbt-mod-part3');
    const current = this.currentQuestionIndex;

    if (mod1) mod1.className = `w-full py-1.5 px-3 rounded-xl text-xs text-center mb-2 transition select-none ${current <= 10 ? 'cbt-module-active' : 'cbt-module-inactive'}`;
    if (mod2) mod2.className = `w-full py-1.5 px-3 rounded-xl text-xs text-center mb-2 transition select-none ${current >= 11 && current <= 16 ? 'cbt-module-active' : 'cbt-module-inactive'}`;
    if (mod3) mod3.className = `w-full py-1.5 px-3 rounded-xl text-xs text-center mb-2 transition select-none ${current === 17 ? 'cbt-module-active' : 'cbt-module-inactive'}`;

    let p1Answered = 0;
    let p2Answered = 0;
    let p3Answered = (this.answers.part3.blocks?.length > 1) || this.hasAssessmentPlan();

    // Part 1 (1~10)
    if (p1Container && questions.part1) {
      p1Container.innerHTML = questions.part1.map((q, idx) => {
        const qNum = idx + 1;
        const isCurrent = (this.currentQuestionIndex === qNum);
        const answered = Number.isInteger(this.answers.part1[q.id]);
        if (answered) p1Answered++;
        const stateClass = isCurrent ? 'cbt-omr-current' : (answered ? 'cbt-omr-answered' : 'cbt-omr-unanswered');
        return `<button type="button" onclick="window.studentEvalApp.goToCbtQuestion(${qNum})" class="cbt-omr-tile ${stateClass} cursor-pointer" title="${qNum}번 객관식">${qNum}</button>`;
      }).join('');
    }

    // Part 2 (11~16)
    if (p2Container && questions.part2) {
      p2Container.innerHTML = questions.part2.map((q, idx) => {
        const qNum = idx + 11;
        const isCurrent = (this.currentQuestionIndex === qNum);
        const answered = String(this.answers.part2[q.id] || '').trim().length > 0;
        if (answered) p2Answered++;
        const stateClass = isCurrent ? 'cbt-omr-current' : (answered ? 'cbt-omr-answered' : 'cbt-omr-unanswered');
        return `<button type="button" onclick="window.studentEvalApp.goToCbtQuestion(${qNum})" class="cbt-omr-tile ${stateClass} cursor-pointer" title="${qNum}번 단답형">${qNum}</button>`;
      }).join('');
    }

    // Part 3 (17-1, 17-2 분할 버튼)
    if (p3Container) {
      const isStep1 = (this.currentQuestionIndex === 17 && (this.part3SubStep || 1) === 1);
      const isStep2 = (this.currentQuestionIndex === 17 && this.part3SubStep === 2);
      const step1Answered = this.hasAssessmentPlan();
      const step2Answered = (this.answers.part3.blocks?.length > 1);

      const state1 = isStep1 ? 'cbt-omr-current' : (step1Answered ? 'cbt-omr-answered' : 'cbt-omr-unanswered');
      const state2 = isStep2 ? 'cbt-omr-current' : (step2Answered ? 'cbt-omr-answered' : 'cbt-omr-unanswered');

      p3Container.innerHTML = `
        <div class="grid grid-cols-2 gap-1.5">
          <button type="button" onclick="window.studentEvalApp.goToCbtPart3Step(1)" class="w-full py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${state1}" title="17-1. 문제 분석 및 계획 수립">
            <span>17-1. 분석</span>
          </button>
          <button type="button" onclick="window.studentEvalApp.goToCbtPart3Step(2)" class="w-full py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${state2}" title="17-2. 순서도 조립 및 검증">
            <span>17-2. 조립</span>
          </button>
        </div>
      `;
    }

    const totalAnswered = p1Answered + p2Answered + (p3Answered ? 1 : 0);
    if (ratioEl) ratioEl.textContent = `${totalAnswered} / 17`;

    const railCurBadge = document.getElementById('eval-cbt-rail-cur-badge');
    const railRatio = document.getElementById('eval-cbt-rail-ratio');
    if (railCurBadge) {
      railCurBadge.textContent = current === 17 ? (this.part3SubStep === 2 ? '17-2' : '17-1') : current;
    }
    if (railRatio) {
      railRatio.textContent = `${totalAnswered}/17`;
    }
  }

  formatCbtPrompt(rawDesc) {
    if (!rawDesc) return '';
    const safeEsc = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));
    let text = String(rawDesc).trim();

    const cleanCondition = (s) => {
      let trimmed = s.trim();
      // 단일 감싸기 [규칙: ...] 또는 [조건: ...] 인 경우 대괄호 및 머리말 정리
      if (/^\[(?:규칙|조건|상황|조리법|반복 규칙)\s*:\s*([^\]]+)\]$/.test(trimmed)) {
        trimmed = trimmed.replace(/^\[(?:규칙|조건|상황|조리법|반복 규칙)\s*:\s*([^\]]+)\]$/, '$1').trim();
      }
      return trimmed;
    };

    const renderBox = (intro, cond, question) => {
      const cleanIntro = intro ? intro.trim() : '';
      const cleanQ = question ? question.trim() : '';
      return `
        ${cleanIntro ? `<div class="font-extrabold text-slate-900 mb-2 leading-snug">${safeEsc(cleanIntro)}</div>` : ''}
        <div class="cbt-condition-box">
          <div class="cbt-condition-title"><i class="fa-solid fa-clipboard-list text-blue-500"></i> <span>지켜야 할 규칙 / 조건</span></div>
          <div class="cbt-condition-content">${safeEsc(cleanCondition(cond))}</div>
        </div>
        ${cleanQ ? `<div class="font-black text-slate-900 mt-2.5 leading-snug">${safeEsc(cleanQ)}</div>` : ''}
      `.trim();
    };

    // 0. 단락이 하나이거나 지문 전체에서 조건/알고리즘을 추출할 수 있는지 선제 검사
    const tryExtract = (target) => {
      // 0-1. 알고리즘(...) 형태 (예: 귤 14개를 3개씩 상자에 담는 알고리즘(남은 귤 >= 3 인 동안 [상자수 = 상자수 + 1, 남은 귤 = 남은 귤 - 3])이 종료되었을 때...)
      const mAlgoParen = target.match(/^([가-힣0-9\s]+?(?:알고리즘|순서도(?:\s*흐름)?))\s*\(([\s\S]+?)\)\s*(?:(이|을|은|에서)\s*)?([\s\S]*)$/);
      if (mAlgoParen) {
        let intro = mAlgoParen[1].trim();
        if (!intro.endsWith('입니다.') && !intro.endsWith(':')) intro += '입니다.';
        let cond = mAlgoParen[2].trim();
        let particle = mAlgoParen[3] || '이';
        let q = mAlgoParen[4].trim();
        if (/^(?:종료|실행|끝|완료|수행)/.test(q)) {
          q = '알고리즘' + particle + ' ' + q;
        }
        return { intro, cond, q };
      }

      // 0-2. 알고리즘[...] 형태
      const mAlgoBracket = target.match(/^([가-힣0-9\s]+?(?:알고리즘|순서도(?:\s*흐름)?))\s*\[([\s\S]+?)\]\s*(?:(이|을|은|에서)\s*)?([\s\S]*)$/);
      if (mAlgoBracket) {
        let intro = mAlgoBracket[1].trim();
        if (!intro.endsWith('입니다.') && !intro.endsWith(':')) intro += '입니다.';
        let cond = mAlgoBracket[2].trim();
        let particle = mAlgoBracket[3] || '이';
        let q = mAlgoBracket[4].trim();
        if (/^(?:종료|실행|끝|완료|수행)/.test(q)) {
          q = '알고리즘' + particle + ' ' + q;
        }
        return { intro, cond, q };
      }

      // 0-3. [조건이/조건은/조건: [식] 입니다. 질문] 형태 (예: 청소년 요금 적용 조건이 [나이 >= 14 이고 나이 < 19]입니다. 이 조건의...)
      const mCondBracket = target.match(/^([가-힣0-9\s]+?(?:조건|규칙)(?:이|은|:)?)\s*\[([^\]]+)\]\s*(?:입니다|이다|일 때|인 경우)?\.?\s*([\s\S]*)$/);
      if (mCondBracket) {
        let rawIntro = mCondBracket[1].replace(/[이은:]$/, '').trim();
        let intro = (rawIntro === '조건' || rawIntro === '규칙') ? '' : (rawIntro.endsWith('입니다') || rawIntro.endsWith('이다') ? rawIntro + '.' : rawIntro + '입니다.');
        let cond = mCondBracket[2].trim();
        let q = mCondBracket[3].trim();
        return { intro, cond, q };
      }

      // 0-4. ...에 [식] 라는 판단 기호가 있습니다. 질문
      const mDecision = target.match(/^([가-힣0-9\s]+?)\s*에\s*\[([^\]]+)\]\s*(?:라[는고]|인)\s*(?:판단\s*기호[가이]?\s*있습니다\.?|조건[이은]?\s*(?:있습니다|적용됩니다)\.?)\s*([\s\S]*)$/);
      if (mDecision) {
        let intro = mDecision[1].trim() + '의 판단 기호입니다.';
        let cond = mDecision[2].trim();
        let q = mDecision[3].trim();
        return { intro, cond, q };
      }

      // 0-5. [태그] '내용'와 같이 ... (제어 구조 식별)
      const mTagQuote = target.match(/^(\[[^\]]+\])\s*['"]([^'"]+)['"]\s*와\s*같이\s*([\s\S]*)$/);
      if (mTagQuote) {
        let intro = mTagQuote[1].trim();
        let cond = mTagQuote[2].trim();
        let q = '위와 같이 ' + mTagQuote[3].trim();
        return { intro, cond, q };
      }

      // 0-6. 단일 단락 내 [조건: ...] 또는 [규칙: ...] 블록 분리
      if (/\[(?:조건|규칙|상황|조리법|반복 규칙|순서도|알고리즘)[^\]]*\]/.test(target)) {
        const parts = target.split(/(?=\[(?:조건|규칙|상황|조리법|반복 규칙|순서도|알고리즘)[^\]]*\])/);
        if (parts.length >= 2) {
          const intro = parts[0].trim();
          const rest = parts.slice(1).join('');
          const mBlock = rest.match(/^(\[(?:조건|규칙|상황|조리법|반복 규칙|순서도|알고리즘)[^\]]*\][\s\S]*?)(?=[가-힣A-Za-z0-9]+[가-힣A-Za-z0-9\s'"]*?(?:쓰시오|얼마|무엇|몇|구하시오|출력되는|결과는|\?).*|$)/);
          if (mBlock) {
            const cond = mBlock[1].trim();
            const q = rest.slice(mBlock[1].length).trim();
            return { intro, cond, q };
          }
        }
      }

      return null;
    };

    // 단일 단락인 경우 선제 추출
    if (!text.includes('\n\n')) {
      const extracted = tryExtract(text);
      if (extracted) {
        return renderBox(extracted.intro, extracted.cond, extracted.q);
      }
    }

    // 단일 \n으로만 구분된 경우 중 [조건...] 또는 [규칙...] 또는 [순서도...] 또는 [알고리즘...]이 있으면 \n\n으로 정규화
    if (!text.includes('\n\n') && text.includes('\n')) {
      if (/\[(?:조건|규칙|상황|조리법|순서도|알고리즘)/.test(text)) {
        text = text.replace(/([^\n])\n(\[(?:조건|규칙|상황|조리법|순서도|알고리즘))/g, '$1\n\n$2')
                   .replace(/(\n[^\n]+)\n([가-힣A-Za-z0-9]+.*(?:쓰시오|얼마|무엇|몇|구하시오|출력되는|결과는|\?))/g, '$1\n\n$2');
      }
    }

    // 여러 단락(\n\n)으로 구성된 경우 분할 처리
    const paragraphs = text.split(/\n{2,}/);
    if (paragraphs.length > 1) {
      return paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (/^\[(?:조건|규칙|상황|조리법|반복 규칙|순서도|알고리즘)/.test(trimmed) || /^(?:조건|규칙)\s*:/.test(trimmed)) {
          return `
            <div class="cbt-condition-box">
              <div class="cbt-condition-title"><i class="fa-solid fa-clipboard-list text-blue-500"></i> <span>지켜야 할 규칙 / 조건</span></div>
              <div class="cbt-condition-content">${safeEsc(cleanCondition(trimmed))}</div>
            </div>
          `;
        }
        const pExtracted = tryExtract(trimmed);
        if (pExtracted && pExtracted.cond) {
          return renderBox(pExtracted.intro, pExtracted.cond, pExtracted.q);
        }
        const isLast = (pIdx === paragraphs.length - 1);
        return `<div class="${isLast ? 'font-black text-slate-900 mt-2.5' : 'font-extrabold text-slate-900'}">${safeEsc(trimmed)}</div>`;
      }).join('');
    }

    return safeEsc(text);
  }

  renderCbtQuestion() {
    const questions = this.currentQuestions();
    const idx = this.currentQuestionIndex;
    const canEdit = this.canEditPlan();
    const safeEsc = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));

    const partBadge = document.getElementById('eval-cbt-part-badge');
    const qnumBadge = document.getElementById('eval-cbt-qnum-badge');
    const pointsBadge = document.getElementById('eval-cbt-points-badge');
    const promptContainer = document.getElementById('eval-cbt-prompt-container');
    const promptEl = document.getElementById('eval-cbt-prompt');

    const optionsArea = document.getElementById('eval-cbt-options');
    const shortArea = document.getElementById('eval-cbt-short-answer');
    const part3Area = document.getElementById('eval-cbt-part3-area');
    const questionGrid = document.getElementById('eval-cbt-question-grid');
    const part3TitleWrap = document.getElementById('eval-cbt-part3-title-wrap');
    const cbtBody = document.getElementById('eval-cbt-body');

    const cbtContainer = document.getElementById('eval-cbt-container');

    // 1~16번 문항은 스크롤 제로 고정 바디 유지
    if (idx >= 1 && idx <= 16) {
      if (cbtContainer) cbtContainer.classList.remove('cbt-step2-unclamped');
      if (cbtBody) {
        cbtBody.classList.add('justify-center');
        cbtBody.classList.add('overflow-hidden');
        cbtBody.classList.remove('overflow-y-auto');
      }
    }

    // 부드러운 토스/애플 스타일 문항 전환 애니메이션
    if (questionGrid) {
      questionGrid.classList.remove('cbt-smooth-enter');
      void questionGrid.offsetWidth;
      questionGrid.classList.add('cbt-smooth-enter');
    }

    const svgBadge = `<svg class="flex-shrink-0 rounded-xl shadow-xs mt-0.5" width="36" height="36" xmlns="http://www.w3.org/2000/svg" role="img" focusable="false"><rect width="100%" height="100%" rx="10" fill="#0d6efd"></rect><text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle" fill="#fff" dy=".1em" font-weight="900" font-size="16">${idx}</text></svg>`;

    if (idx >= 1 && idx <= 10) {
      const q = questions.part1 && questions.part1[idx - 1];
      if (!q) return;
      if (questionGrid) questionGrid.classList.remove('hidden');
      if (part3TitleWrap) part3TitleWrap.classList.add('hidden');
      if (part3Area) part3Area.classList.add('hidden');

      if (partBadge) { partBadge.textContent = 'Part 1. 객관식'; partBadge.className = 'text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100'; }
      if (qnumBadge) qnumBadge.textContent = `${idx}번 문제`;
      if (pointsBadge) pointsBadge.textContent = `${q.points || 3}점`;
      if (promptEl) promptEl.textContent = q.desc;
      if (promptContainer) {
        promptContainer.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-start gap-3.5">
              ${svgBadge}
              <div class="flex-1 text-base sm:text-lg md:text-xl font-extrabold text-slate-900 leading-snug whitespace-pre-line pt-0.5">
                ${this.formatCbtPrompt(q.desc)}
              </div>
            </div>
            <div class="cbt-notice-strip">
              <i class="fa-solid fa-circle-info text-blue-600"></i>
              <span>정답을 선택한 후, 하단의 <strong class="text-indigo-600">"다음 문항"</strong> 버튼을 클릭하세요.</span>
            </div>
          </div>
        `;
      }

      if (optionsArea) {
        optionsArea.classList.remove('hidden');
        optionsArea.innerHTML = q.options.map((opt, optIdx) => {
          const isSelected = this.answers.part1[q.id] === optIdx;
          const numSymbol = ['①', '②', '③', '④', '⑤'][optIdx] || `${optIdx + 1}.`;
          return `
            <label class="cbt-option-card flex items-center gap-4 p-4 sm:p-4.5 rounded-2xl border ${isSelected ? 'selected' : 'border-slate-200 bg-white hover:bg-slate-50'} cursor-pointer select-none">
              <input type="radio" name="cbt_${q.id}" value="${optIdx}" ${isSelected ? 'checked' : ''} ${canEdit ? '' : 'disabled'} onchange="window.studentEvalApp.onSelectCbtPart1('${q.id}', ${optIdx})" class="w-4 h-4 text-blue-600 focus:ring-blue-500">
              <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}">${numSymbol}</span>
              <span class="text-sm sm:text-base font-bold text-slate-800 leading-normal">${safeEsc(opt)}</span>
            </label>
          `;
        }).join('');
      }
      if (shortArea) shortArea.classList.add('hidden');
    } else if (idx >= 11 && idx <= 16) {
      const q = questions.part2 && questions.part2[idx - 11];
      if (!q) return;
      if (questionGrid) questionGrid.classList.remove('hidden');
      if (part3TitleWrap) part3TitleWrap.classList.add('hidden');
      if (part3Area) part3Area.classList.add('hidden');

      if (partBadge) { partBadge.textContent = 'Part 2. 단답형'; partBadge.className = 'text-xs font-black px-3 py-1 bg-amber-50 text-amber-800 rounded-xl border border-amber-200'; }
      if (qnumBadge) qnumBadge.textContent = `${idx}번 문제`;
      if (pointsBadge) pointsBadge.textContent = `${q.points || 5}점`;
      if (promptEl) promptEl.textContent = q.desc;
      if (promptContainer) {
        promptContainer.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-start gap-3.5">
              ${svgBadge}
              <div class="flex-1 text-base sm:text-lg md:text-xl font-extrabold text-slate-900 leading-snug whitespace-pre-line pt-0.5">
                ${this.formatCbtPrompt(q.desc)}
              </div>
            </div>
            <div class="cbt-notice-strip">
              <i class="fa-solid fa-circle-info text-blue-600"></i>
              <span>정답을 입력한 후, 하단의 <strong class="text-indigo-600">"다음 문항"</strong> 버튼을 클릭하세요.</span>
            </div>
          </div>
        `;
      }

      if (shortArea) {
        shortArea.classList.remove('hidden');
        shortArea.innerHTML = `
          <div class="space-y-3 w-full">
            <div class="flex items-center gap-3">
              <input type="text" id="cbt_inp_${q.id}" value="${safeEsc(this.answers.part2[q.id] || '')}" ${canEdit ? '' : 'disabled'} oninput="window.studentEvalApp.onInputCbtPart2('${q.id}', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();window.studentEvalApp.nextCbtQuestion();}" class="flex-1 text-base sm:text-lg px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white font-extrabold text-slate-900 transition shadow-inner" placeholder="${q.placeholder || '단답형 정답을 입력하세요'}">
              <span class="text-xs font-black text-slate-400 bg-slate-100 px-3 py-2 rounded-xl shrink-0">단답형</span>
            </div>
          </div>
        `;
        if (canEdit) {
          setTimeout(() => {
            const inp = document.getElementById(`cbt_inp_${q.id}`);
            if (inp && typeof inp.focus === 'function') {
              try {
                inp.focus();
                const len = inp.value ? inp.value.length : 0;
                if (typeof inp.setSelectionRange === 'function') inp.setSelectionRange(len, len);
              } catch(e) {}
            }
          }, 50);
        }
      }
      if (optionsArea) optionsArea.classList.add('hidden');
    } else if (idx === 17) {
      if (questionGrid) questionGrid.classList.add('hidden');
      if (part3TitleWrap) part3TitleWrap.classList.remove('hidden');
      if (part3Area) part3Area.classList.remove('hidden');

      if (partBadge) { partBadge.textContent = 'Part 3. 알고리즘 설계'; partBadge.className = 'text-xs font-black px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200'; }
      if (qnumBadge) qnumBadge.textContent = `17번 문제`;
      if (pointsBadge) pointsBadge.textContent = `40점`;
      const promptText = '문제 상황을 분석하여 나만의 문제 해결 계획을 세우고, 순서도를 완성하여 실행 결과를 검증하세요.';
      if (promptEl) promptEl.textContent = promptText;

      if (optionsArea) optionsArea.classList.add('hidden');
      if (shortArea) shortArea.classList.add('hidden');
      const theme = EVAL_QUESTIONS.part3Themes.find(item => item.id === this.answers.part3.selectedThemeId);
      const sitEl = document.getElementById('eval-cbt-situation');
      const inpEl = document.getElementById('eval-cbt-input');
      const reqEl = document.getElementById('eval-cbt-requirement');
      if (sitEl) sitEl.textContent = theme?.situation || (this.isFreeDesign() ? '우리 주변의 생활 속 문제를 분석하여 알고리즘으로 해결해 보세요.' : '');
      if (inpEl) inpEl.textContent = theme?.input || (this.isFreeDesign() ? '문제 해결에 필요한 초기 자료 및 조건' : '');
      if (reqEl) reqEl.textContent = theme?.requirement || (this.isFreeDesign() ? '문제를 해결한 최종 결과 상태' : '');
      this.switchPart3SubStep(this.part3SubStep || 1);
    }
  }

  updateCbtFooter() {
    const questions = this.currentQuestions();
    const idx = this.currentQuestionIndex;
    const prevBtn = document.getElementById('eval-cbt-prev-btn');
    const nextBtn = document.getElementById('eval-cbt-next-btn');
    const nextText = document.getElementById('eval-cbt-next-text');
    const progressText = document.getElementById('eval-cbt-progress-text');

    let p1Count = questions.part1 ? questions.part1.filter(q => Number.isInteger(this.answers.part1[q.id])).length : 0;
    let p2Count = questions.part2 ? questions.part2.filter(q => String(this.answers.part2[q.id] || '').trim()).length : 0;
    let p3Count = ((this.answers.part3.blocks?.length > 1) || this.hasAssessmentPlan()) ? 1 : 0;
    let totalCount = p1Count + p2Count + p3Count;

    if (progressText) {
      progressText.textContent = `17문항 중 ${totalCount}문항 응답 완료`;
    }

    if (prevBtn) {
      prevBtn.disabled = (idx === 1 && (this.part3SubStep || 1) === 1);
    }

    if (nextBtn && nextText) {
      if (idx < 17) {
        nextText.textContent = '다음 문항';
        nextBtn.className = 'px-4 sm:px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm transition shadow-xs flex items-center gap-1.5 cursor-pointer';
      } else if (idx === 17 && (this.part3SubStep || 1) === 1) {
        nextText.textContent = '다음 단계: 순서도 조립';
        nextBtn.className = 'px-4 sm:px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm transition shadow-xs flex items-center gap-1.5 cursor-pointer';
      } else if (idx === 17 && this.part3SubStep === 2) {
        nextText.textContent = '답안 검토 및 최종 제출';
        nextBtn.className = 'px-4 sm:px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm transition shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer';
      }
    }
  }

  onSelectCbtPart1(qId, val) {
    this.onSelectPart1(qId, val);
    this.renderCbtSidebar();
    this.renderCbtQuestion();
    this.updateCbtFooter();
  }

  onInputCbtPart2(qId, val) {
    this.onInputPart2(qId, val);
    this.renderCbtSidebar();
    this.updateCbtFooter();
  }

  // ============================================================================
  // 📐 Part 3. 순서도 나만의 백지 공방 풀 이식 캔버스 시스템
  // ============================================================================

  initPart3Canvas() {
    const free=this.isFreeDesign();
    document.querySelector('#eval-part3-container .eval-task-chooser').hidden=free;
    document.querySelector('#eval-part3-container .eval-task-brief').hidden=free;
    document.getElementById('eval-free-design').hidden=!free;
    document.getElementById('eval-condition-editor').hidden=!free;
    if(free){
      document.getElementById('eval-condition-candidates').replaceChildren();
      document.getElementById('eval-condition-status').textContent='직접 적어도 되고, 제안받은 조건을 고쳐서 사용해도 됩니다.';
      this.answers.part3.selectedThemeId='custom';
      if(!this.answers.part3.blocks.length)this.answers.part3.blocks=[{id:'eblk_start',shape:'terminal',text:'시작',x:100,y:30}];
      this.renderAssessmentPlan();return;
    }
    // 1. 4가지 균등 난이도 테마 선택기 렌더링
    const themeSelectBox = document.getElementById('eval-part3-theme-selector');
    if (themeSelectBox) {
      themeSelectBox.replaceChildren();
      EVAL_QUESTIONS.part3Themes.forEach(theme=>{
        const button=document.createElement('button');button.type='button';button.id='eval-btn-theme-'+theme.id;
        button.textContent=theme.title;button.onclick=()=>this.selectPart3Theme(theme.id);themeSelectBox.appendChild(button);
      });
    }
    // 3. 현재 테마 로드
    this.selectPart3Theme(this.answers.part3.selectedThemeId || "theme_greenhouse");
  }

  // 테마 선택 시 좌측 자연어 카드 & 캔버스 초기화
  selectPart3Theme(themeId) {
    if(this.isFreeDesign())return;
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    if (!EVAL_QUESTIONS.part3Themes.some(theme=>theme.id===themeId)) return;
    const sameTheme=this.answers.part3.selectedThemeId===themeId;
    if (!sameTheme && (this.answers.part3.blocks.length>1 || this.hasAssessmentPlan()) && !confirm("다른 문제를 선택하면 작성한 처방전과 순서도가 초기화됩니다. 변경할까요?")) return;
    const mounted=window.assessmentWorkspace?.active; if(mounted)window.assessmentWorkspace.leave();
    this.answers.part3.selectedThemeId = themeId;
    this.answers.part3.isVerified = false;

    EVAL_QUESTIONS.part3Themes.forEach(theme=>{
      const button=document.getElementById('eval-btn-theme-'+theme.id);
      if(button){button.className='eval-theme-button';button.setAttribute('aria-pressed',String(theme.id===themeId));}
    });
    if(!sameTheme) delete this.answers.part3.plan;
    this.renderAssessmentPlan();
    // 캔버스 초기화: [시작] 단말 기호 하나만 기본 배치
    if (!sameTheme || !this.answers.part3.blocks.length) {
      this.answers.part3.blocks = [{id:"eblk_start",shape:"terminal",type:"terminal",text:"시작",x:220,y:30}];
      this.answers.part3.connections=[]; this.blockIdCounter=1;
    }
    this.saveDraft();

    this.renderPart3Canvas();
    this.updatePart3ScoreBadge(0);
    if(mounted)window.assessmentWorkspace.enter(this);
    this.syncStudentProgress();
  }

  getAssessmentPlan() {
    const part=this.answers.part3;
    if(!part.plan || typeof part.plan!=='object')part.plan={current:'',goal:'',steps:[]};
    if(!Array.isArray(part.plan.steps))part.plan.steps=[];
    return part.plan;
  }
  isFreeDesign(){return (this.latestSession?.questionVersion||this.answers.part3.questionVersion)>=3;}
  hasAssessmentPlan() {
    const plan=this.getAssessmentPlan();
    return !!(plan.current || plan.goal || plan.steps.some(step=>step.text?.trim()));
  }
  canEditPlan() { return !this.isSubmitted && !this.isSubmitting && this.sessionStatus!=='ended'; }
  setAssessmentPlanField(field,value) {
    if(!this.canEditPlan() || !['current','goal','conditions'].includes(field))return;
    this.getAssessmentPlan()[field]=value.slice(0,field==='conditions'?1000:500);this.syncStudentProgress();
  }
  addAssessmentStep(type='seq') { if(window.assessmentWorkspace?.active&&this.canEditPlan())addNlCard(type); }
  renderAssessmentSteps() { if(window.assessmentWorkspace?.active)renderNlCards(); }
  renderAssessmentPlan() {
    const theme=EVAL_QUESTIONS.part3Themes.find(item=>item.id===this.answers.part3.selectedThemeId);
    for(const [id,text] of [['eval-task-situation',theme?.situation||''],['eval-task-input',theme?.input||''],['eval-task-requirement',theme?.requirement||'']]){
      const element=document.getElementById(id);if(element)element.textContent=text;
    }
    const plan=this.getAssessmentPlan();
    for(const field of ['current','goal','conditions']){const input=document.getElementById('eval-plan-'+field);if(input){input.value=plan[field]||'';input.disabled=!this.canEditPlan();}}
    this.renderAssessmentSteps();
  }
  async suggestConditions(){
    if(!this.canEditPlan()||!this.isFreeDesign()||this.requestingConditions)return;
    const plan=this.getAssessmentPlan(),context=JSON.stringify([plan.current,plan.goal]);
    const status=document.getElementById('eval-condition-status'),box=document.getElementById('eval-condition-candidates'),button=document.getElementById('eval-suggest-conditions');
    if(!plan.current.trim()||!plan.goal.trim()){status.textContent='현재 상태와 목표 상태를 먼저 적어 주세요.';return;}
    this.requestingConditions=true;button.disabled=true;box.replaceChildren();status.textContent='조건 아이디어를 확인하고 있습니다…';
    try{
      const result=await requestAssessmentAI({purpose:'conditions',current:plan.current,goal:plan.goal});
      if(!this.canEditPlan()||this.getAssessmentPlan()!==plan||JSON.stringify([plan.current,plan.goal])!==context){status.textContent='내용이 변경되었습니다. 필요하면 다시 요청해 주세요.';return;}
      status.textContent=result.demo?'💡 마음에 드는 조건을 클릭하면 바로 추가됩니다. (로컬 예시)':'💡 마음에 드는 조건을 클릭하여 추가하고, 상황에 맞게 수치를 다듬어 보세요.';
      const safeEsc = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));
      result.conditions.forEach(text=>{
        const choice=document.createElement('button');
        choice.type='button';
        choice.className='cbt-condition-chip';
        choice.innerHTML=`<i class="fa-solid fa-plus text-[10px] text-blue-500"></i> <span>${safeEsc(text)}</span>`;
        choice.onclick=()=>{
          if(!this.canEditPlan())return;
          const lines=(plan.conditions||'').split('\n').filter(Boolean);
          if(!lines.includes(text))lines.push(text);
          this.setAssessmentPlanField('conditions',lines.join('\n'));
          const inp = document.getElementById('eval-plan-conditions');
          if (inp) inp.value=plan.conditions;
          choice.disabled=true;
          choice.innerHTML=`<i class="fa-solid fa-check text-emerald-600"></i> <span class="line-through opacity-60">${safeEsc(text)}</span>`;
        };
        box.appendChild(choice);
      });
    }catch(error){status.textContent=error.message+' 조건을 직접 작성하여 계속할 수 있습니다.';}
    finally{this.requestingConditions=false;button.disabled=!this.canEditPlan();}
  }

  // Compatibility entry points all use the common studio now.
  addPart3Block(shape) { if(window.assessmentWorkspace?.active&&this.canEditPlan())addCanvasBlock(shape); }
  handlePart3BlockText(id,text) { if(window.assessmentWorkspace?.active&&this.canEditPlan())handleBlockTextChange(id,text); }
  renderPart3Canvas() { if(window.assessmentWorkspace?.active)renderFreeCanvas(); }
  renderPart3Connections() { if(window.assessmentWorkspace?.active)renderFreeConnections(); }
  verifyPart3Flowchart() { if(window.assessmentWorkspace?.active)window.assessmentWorkspace.run(); }

  updatePart3ScoreBadge(score) {
    const badge=document.getElementById("eval-part3-score-badge");
    if(badge) badge.textContent=score===40?"표시된 입력 확인 완료":"실행 결과를 확인해 보세요";
  }

  syncStudentProgress(immediate = false) {
    this.updatePartNavigation();this.saveDraft();
    if(!this.joined||this.isSubmitted||this.isSubmitting||this.sessionStatus!=="in_progress")return;
    const status=document.getElementById('eval-save-status');
    clearTimeout(this.progressTimeout);
    const executeSync = () => {
      if(this.isSubmitted||this.isSubmitting)return;
      const currentPayloadStr = JSON.stringify(this.answers || {});
      if(currentPayloadStr === this.lastServerSyncedAnswers) {
        if(status)status.textContent=window.evalService.isDemo()?'로컬 시연에 저장됨':'서버에 저장됨';
        return;
      }
      if(status)status.textContent='이 창에 임시 저장 · 서버 저장 중';
      this.progressPromise=window.evalService.updateStudentProgress(this.currentClass,this.studentNum,{part1:Object.keys(this.answers.part1).length,part2:Object.values(this.answers.part2).filter(v=>String(v).trim()).length,part3:this.answers.part3.blocks.length>1?1:0},this.answers)
        .then(()=>{
          this.lastServerSyncedAnswers = currentPayloadStr;
          if(status)status.textContent=window.evalService.isDemo()?'로컬 시연에 저장됨':'서버에 저장됨';
        })
        .catch(error=>{if(status)status.textContent='서버 저장 실패 · 이 창을 유지해 주세요';console.warn("서버 임시 저장 실패",error);});
    };
    if (immediate) {
      executeSync();
    } else {
      this.progressTimeout=setTimeout(executeSync,2500);
    }
  }
  // V4의 객관·단답 점수는 학생 브라우저가 계산하지 않는다. 교사만 서버 결과를 확인한다.
  calculateScores() {
    const version=this.latestSession?.questionVersion||this.answers.part3.questionVersion||1;
    if(version===4){const result={scores:{part1:null,part2:null,part3:null,objectiveTotal:null,total:null,teacherOverride:null,pendingReview:true,serverGraded:true},feedback:{part1:'교사 서버 채점 대기',part2:'교사 서버 채점 대기',part3:'자유 설계 답안은 교사 검토 후 점수가 확정됩니다.'}};this.scores=result.scores;return result;}
    const result=gradeEvaluation(this.answers,version); result.scores=applyConfirmedAssessmentReview(result.scores,this.latestStudent);this.scores=result.scores; return result;
  }

  isSecureServerScore() {
    return (this.latestSession?.questionVersion || this.answers?.part3?.questionVersion) === 4;
  }

  stopServerScorePolling() {
    clearTimeout(this.serverScorePollTimer);
    this.serverScorePollTimer = null;
    this.serverScoreRequest = null;
    this.serverScoreRequestKey = null;
  }

  resetServerScoreState() {
    this.stopServerScorePolling();
    this.serverScoreState = { status: 'idle', score: null };
  }

  startServerScorePolling(force = false) {
    if (!this.isSubmitted || !this.isSecureServerScore() || !this.currentClass || !this.studentNum) return;
    const key = `${this.currentClass}:${this.studentNum}:${this.attemptId || ''}`;
    if (force || this.serverScoreRequestKey !== key) {
      this.stopServerScorePolling();
      this.serverScoreRequestKey = key;
      this.serverScoreState = { status: 'loading', score: null };
    }
    if (this.serverScoreRequest || this.serverScorePollTimer || this.serverScoreState.status === 'ready') {
      this.renderServerScoreReveal();
      return;
    }
    this.serverScoreState = { status: 'loading', score: null };
    this.renderServerScoreReveal();
    this.pollServerScore(key);
  }

  async pollServerScore(key) {
    if (this.serverScoreRequest || key !== this.serverScoreRequestKey) return;
    this.serverScoreRequest = requestSecureEvaluationStudentScore(this.currentClass, this.studentNum)
      .then(result => {
        if (!this.isSubmitted || key !== this.serverScoreRequestKey) return;
        if (result?.ready && result.score && Number.isFinite(Number(result.score.objectiveTotal))) {
          const part3Score = (result.score.part3 != null) ? Number(result.score.part3) : null;
          const part3Status = result.score.part3Status || (part3Score != null ? 'first_graded' : 'pending');
          this.serverScoreState = {
            status: 'ready',
            score: {
              part1: Number(result.score.part1) || 0,
              part2: Number(result.score.part2) || 0,
              objectiveTotal: Number(result.score.objectiveTotal) || 0,
              part3: part3Score,
              part3Status: part3Status,
              criteria: result.score.criteria || null
            }
          };
          this.renderResult();

          // Part 3 채점이 아직 대기 중이면 3초 간격으로 계속 폴링
          if (part3Status === 'pending') {
            this.serverScorePollTimer = setTimeout(() => this.pollServerScore(key), 3000);
            if (typeof this.serverScorePollTimer?.unref === 'function') this.serverScorePollTimer.unref();
          }
          return;
        }
        this.serverScoreState = { status: 'pending', score: null };
        this.renderServerScoreReveal();
        this.serverScorePollTimer = setTimeout(() => this.pollServerScore(key), 2500);
        if (typeof this.serverScorePollTimer?.unref === 'function') this.serverScorePollTimer.unref();
      })
      .catch(error => {
        if (!this.isSubmitted || key !== this.serverScoreRequestKey) return;
        this.serverScoreState = { status: 'error', score: null };
        this.renderServerScoreReveal();
        console.warn('서버 점수 확인 실패', error);
      })
      .finally(() => {
        if (key === this.serverScoreRequestKey) this.serverScoreRequest = null;
      });
  }

  bindScoreRevealButton() {
    const button = document.getElementById('eval-result-score-reveal-button');
    const label = document.getElementById('eval-result-score-reveal-label');
    const panel = document.getElementById('eval-result-score-reveal-panel');
    if (!button || !panel || button._scoreRevealBound || typeof button.addEventListener !== 'function') return;
    const hide = () => {
      panel.hidden = true;
      panel.textContent = '';
      button.setAttribute('aria-pressed', 'false');
      const scoreTotalEl = document.getElementById('eval-result-total-score');
      if (scoreTotalEl && this.scores?.serverGraded) {
        scoreTotalEl.textContent = '🔒 • • / 60점';
      }
      const part1El = document.getElementById('eval-result-part1-score');
      const part2El = document.getElementById('eval-result-part2-score');
      if (part1El && this.scores?.serverGraded) part1El.textContent = '🔒 •• / 30점';
      if (part2El && this.scores?.serverGraded) part2El.textContent = '🔒 •• / 30점';
      if (label && this.serverScoreState.status === 'ready') label.textContent = '👁️ 누르고 있는 동안 점수 확인';
    };
    const show = () => {
      const score = this.serverScoreState.score;
      if (this.serverScoreState.status !== 'ready' || !score) return;
      const scoreTotalEl = document.getElementById('eval-result-total-score');
      if (scoreTotalEl) scoreTotalEl.textContent = `${score.objectiveTotal} / 60점`;
      const part1El = document.getElementById('eval-result-part1-score');
      const part2El = document.getElementById('eval-result-part2-score');
      if (part1El) part1El.textContent = `${score.part1} / 30점`;
      if (part2El) part2El.textContent = `${score.part2} / 30점`;
      if (label) label.textContent = '점수 확인 중...';
      panel.textContent = `객관·단답 자동채점 참고 점수: ${score.objectiveTotal} / 60점 (객관식 ${score.part1}/30점 · 단답형 ${score.part2}/30점)`;
      panel.hidden = false;
      button.setAttribute('aria-pressed', 'true');
    };
    button.addEventListener('pointerdown', event => {
      if (button.disabled || this.serverScoreState.status !== 'ready') return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      show();
    });
    button.addEventListener('pointerup', event => {
      hide();
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    });
    button.addEventListener('pointercancel', hide);
    button.addEventListener('lostpointercapture', hide);
    button.addEventListener('pointerleave', hide);
    button.addEventListener('blur', hide);
    button.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        show();
      }
    });
    button.addEventListener('keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hide();
      }
    });
    button.addEventListener('click', () => {
      if (this.serverScoreState.status === 'error') this.startServerScorePolling(true);
    });
    button._scoreRevealBound = true;
  }

  renderServerScoreReveal() {
    const box = document.getElementById('eval-result-score-reveal');
    const button = document.getElementById('eval-result-score-reveal-button');
    const label = document.getElementById('eval-result-score-reveal-label');
    const status = document.getElementById('eval-result-score-reveal-status');
    const panel = document.getElementById('eval-result-score-reveal-panel');
    if (!box || !button || !label || !status || !panel) return;
    this.bindScoreRevealButton();
    if (!this.isSubmitted || !this.isSecureServerScore()) {
      box.hidden = true;
      button.disabled = true;
      panel.hidden = true;
      button.setAttribute('aria-pressed', 'false');
      return;
    }
    box.hidden = false;
    const state = this.serverScoreState.status;
    if (state === 'ready' && this.serverScoreState.score) {
      button.disabled = false;
      label.textContent = '👁️ 누르고 있는 동안 점수 확인';
      status.textContent = '누르는 동안만 표시됩니다.';
      panel.hidden = true;
      panel.textContent = '';
      button.setAttribute('aria-label', '점수 보기. 누르는 동안만 표시됩니다.');
      const scoreTotalEl = document.getElementById('eval-result-total-score');
      if (scoreTotalEl && this.scores?.serverGraded && button.getAttribute('aria-pressed') !== 'true') {
        scoreTotalEl.textContent = '🔒 • • / 60점';
      }
      const part1El = document.getElementById('eval-result-part1-score');
      const part2El = document.getElementById('eval-result-part2-score');
      if (part1El && this.scores?.serverGraded && button.getAttribute('aria-pressed') !== 'true') {
        part1El.textContent = '🔒 •• / 30점';
      }
      if (part2El && this.scores?.serverGraded && button.getAttribute('aria-pressed') !== 'true') {
        part2El.textContent = '🔒 •• / 30점';
      }
      return;
    }
    panel.hidden = true;
    panel.textContent = '';
    button.setAttribute('aria-pressed', 'false');
    if (state === 'error') {
      button.disabled = false;
      label.textContent = '점수 다시 확인';
      status.textContent = '점수를 확인하지 못했습니다. 버튼을 눌러 다시 시도해 주세요.';
      return;
    }
    button.disabled = true;
    label.textContent = '점수 준비 중';
    status.textContent = '서버 채점 결과를 확인하고 있습니다.';
  }

  // 5. 최종 제출 처리
  async submitExam(isAuto = false) {
    if (this.isSubmitted || this.isSubmitting) return;
    if(!isAuto&&!this.visitedPart3){
      alert('Part 3(알고리즘 설계) 문제를 확인한 뒤 제출해 주세요.\n문제를 다 풀지 못했더라도 제출할 수 있습니다.');
      this.switchPart('part3',true);
      return;
    }
    window.assessmentWorkspace?.capture();
    if (!isAuto && !confirm("정말로 수행평가 답안을 최종 제출하시겠습니까?\n제출 후에는 교사의 재시험 승인이 있어야 답안을 다시 작성할 수 있습니다.")) {
      return;
    }

    document.activeElement?.blur();
    this.isSubmitting = true;this.updatePartNavigation();window.assessmentWorkspace?.setReadOnly(true);
    clearTimeout(this.progressTimeout);
    this.saveDraft();
    await this.progressPromise;

    // 자동 채점 실행
    const gradeResult = this.calculateScores();

    // 서버로 최종 제출 전송
    try {
      if (!window.evalService) throw new Error("저장 서비스에 연결되지 않았습니다.");
      await window.evalService.submitStudentExam(this.currentClass, this.studentNum, {
        answers: this.answers,
        scores: gradeResult.scores,
        feedback: gradeResult.feedback
      });
    } catch(error) {
      this.isSubmitting=false;this.updatePartNavigation();window.assessmentWorkspace?.setReadOnly(this.sessionStatus==='ended'); this.saveDraft();
      alert("제출을 저장하지 못했습니다. 답안은 이 창에 유지됩니다. 다시 제출해 주세요.\n"+error.message);
      return;
    }
    this.isSubmitting=false; this.isSubmitted=true;
    clearInterval(this.timerInterval); this.timerInterval=null;
    document.body.classList.remove("assessment-active");
    this.saveDraft();

    this.renderResult();
    this.startServerScorePolling();
  }

  renderResult() {
    window.assessmentWorkspace?.leave();
    window.pendingAssessmentResume=false;sessionStorage.removeItem('ALGO_ACTIVE_EXAM');updateAssessmentNavigation();
    this.showScreen('result');
    const scoreTotalEl = document.getElementById('eval-result-total-score');
    const scoreBreakdownEl = document.getElementById('eval-result-breakdown');
    const reviewStatusEl = document.querySelector('.eval-review-status');
    const serverScoreReady = this.scores.serverGraded && this.serverScoreState.status === 'ready';
    if (scoreTotalEl) {
      scoreTotalEl.textContent = this.scores.serverGraded
        ? (serverScoreReady ? '🔒 • • / 60점' : '점수 확인 중...')
        : (this.scores.pendingReview ? `${this.scores.objectiveTotal} / 60점` : `${this.scores.total}점`);
    }
    if (reviewStatusEl) {
      reviewStatusEl.textContent = this.scores.serverGraded
        ? 'Part 3(순서도)은 선생님 검토 후 반영됩니다.'
        : (this.scores.pendingReview ? 'Part 1·2 참고 점수 · Part 3 교사 채점 대기' : (this.isFreeDesign() ? '교사 검토 완료' : '교사 검토 전'));
    }
    if (scoreBreakdownEl) {
      const part1Text = this.scores.serverGraded ? (serverScoreReady ? '🔒 •• / 30점' : '채점 중...') : `${this.scores.part1} / 30점`;
      const part2Text = this.scores.serverGraded ? (serverScoreReady ? '🔒 •• / 30점' : '채점 중...') : `${this.scores.part2} / 30점`;
      const part3Text = this.scores.pendingReview ? '선생님 검토 대기' : `${this.scores.part3} / 40점`;
      scoreBreakdownEl.innerHTML = `
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div class="text-xs font-bold text-indigo-700">Part 1. 객관식 (10문항)</div>
            <div id="eval-result-part1-score" class="text-xl font-black text-indigo-900 mt-1 font-mono">${part1Text}</div>
          </div>
          <div class="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div class="text-xs font-bold text-amber-800">Part 2. 단답형 (6문항)</div>
            <div id="eval-result-part2-score" class="text-xl font-black text-amber-900 mt-1 font-mono">${part2Text}</div>
          </div>
          <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div class="text-xs font-bold text-emerald-800">Part 3. 순서도 조립</div>
            <div class="text-xl font-black text-emerald-900 mt-1">${part3Text}</div>
          </div>
        </div>
      `;
    }
    this.renderServerScoreReveal();

    // Part 3 1차 채점 카드 렌더링
    const part3Card = document.getElementById('eval-result-part3-card');
    if (part3Card) {
      const serverScore = this.serverScoreState.score;
      const part3Score = serverScore?.part3 ?? (this.scores.serverGraded ? null : this.scores.part3);
      const part3Status = serverScore?.part3Status || (this.scores.serverGraded ? (part3Score != null ? 'first_graded' : 'pending') : 'confirmed');

      if (part3Score != null && part3Status !== 'pending') {
        part3Card.classList.remove('hidden');
        const badgeEl = document.getElementById('eval-result-part3-badge');
        const scoreEl = document.getElementById('eval-result-part3-score-display');
        const grandTotalEl = document.getElementById('eval-result-grand-total-score');
        const noticeEl = document.getElementById('eval-result-part3-notice');

        const isConfirmed = part3Status === 'confirmed';
        if (badgeEl) {
          badgeEl.textContent = isConfirmed ? '선생님 확정 완료' : '1차 채점 완료';
          badgeEl.className = isConfirmed
            ? 'text-[11px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200'
            : 'text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900';
        }
        if (scoreEl) {
          scoreEl.textContent = `${part3Score} / 40점`;
        }
        if (grandTotalEl) {
          const objScore = serverScore ? serverScore.objectiveTotal : ((this.scores.part1 || 0) + (this.scores.part2 || 0));
          grandTotalEl.textContent = `${objScore + part3Score}점`;
        }
        if (noticeEl) {
          noticeEl.textContent = isConfirmed
            ? '※ 선생님께서 검토 후 최종 확정한 점수입니다.'
            : '※ 본 점수는 1차 채점(AI 분석) 결과이며, 선생님의 최종 검토 및 확인 후 최종 확정됩니다.';
        }
      } else {
        part3Card.classList.add('hidden');
      }
    }
  }

  // 문항별 내 답안 및 정답 확인 모달 닫기
  closeReviewModal() {
    const modal = document.getElementById('student-eval-review-modal');
    if (modal) modal.classList.add('hidden');
  }

  // 문항별 내 답안 및 정답 확인 모달 열기
  async openReviewModal() {
    const modal = document.getElementById('student-eval-review-modal');
    const content = document.getElementById('student-review-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div class="py-12 text-center text-slate-500 space-y-3">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-indigo-600"></i>
        <p class="font-bold text-sm">답안과 채점 결과를 불러오고 있습니다...</p>
      </div>
    `;

    try {
      if (this.isSecureServerScore() && typeof requestSecureEvaluationStudentReview === 'function' && !window.authService?.isDemo?.()) {
        const res = await requestSecureEvaluationStudentReview(this.currentClass, this.studentNum);
        if (res.sessionStatus === 'in_progress') {
          content.innerHTML = `
            <div class="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
              <div class="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
                <i class="fa-solid fa-shield-halved"></i>
              </div>
              <h4 class="font-black text-amber-900 text-base">시험이 아직 진행 중입니다</h4>
              <p class="text-xs sm:text-sm text-amber-800 leading-relaxed max-w-md mx-auto">
                공정한 평가를 위해 다른 친구들이 시험을 모두 마칠 때까지 상세 정답과 해설은 공개되지 않습니다.<br>
                선생님께서 시험을 종료하신 후 다시 확인해 주세요.
              </p>
              <div class="pt-2 text-xs font-bold text-slate-600">
                내 지필 자동채점 참고 점수: <span class="text-indigo-600 font-mono text-sm">${(res.scores?.part1 || 0) + (res.scores?.part2 || 0)}점</span> / 60점
              </div>
            </div>
          `;
          return;
        }

        this.renderReviewModalContent(content, res.review, res.studentAnswers, res.scores);
      } else {
        this.renderLocalReviewModalContent(content);
      }
    } catch (err) {
      console.error('[OPEN_REVIEW_MODAL_ERROR]', err);
      content.innerHTML = `
        <div class="p-6 bg-red-50 rounded-2xl border border-red-200 text-center space-y-2">
          <i class="fa-solid fa-triangle-exclamation text-red-500 text-2xl"></i>
          <h4 class="font-black text-red-900">결과를 불러오지 못했습니다</h4>
          <p class="text-xs text-red-700">${String(err.message || '네트워크 연결을 확인한 뒤 다시 시도해 주세요.').replace(/</g, '&lt;')}</p>
        </div>
      `;
    }
  }

  // V4 서버 리뷰 결과 렌더링
  renderReviewModalContent(container, reviewData, studentAnswers, scores) {
    if (!reviewData) {
      container.innerHTML = `<p class="text-center text-slate-400 py-8">확인 가능한 검토 데이터가 없습니다.</p>`;
      return;
    }

    const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const part1Items = reviewData.part1 || [];
    const part2Items = reviewData.part2 || [];
    const part3 = reviewData.part3 || {};

    let html = `
      <!-- 요약 헤더 배너 -->
      <div class="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs font-bold text-indigo-600">수행평가 채점 결과 요약</div>
          <div class="text-base sm:text-lg font-black text-slate-800">
            객관·단답 지필소계: <span class="text-indigo-600 font-mono">${(scores?.part1 || 0) + (scores?.part2 || 0)}점</span> / 60점
          </div>
        </div>
        <div class="text-right">
          <div class="text-xs font-bold text-slate-500">Part 3 순서도 설계</div>
          <div class="text-sm sm:text-base font-black ${part3.proposal?.score != null || part3.confirmed?.score != null ? 'text-emerald-700' : 'text-slate-400'}">
            ${part3.confirmed?.score != null ? `${part3.confirmed.score}점 (교사 확정)` : (part3.proposal?.score != null ? `${part3.proposal.score}점 (1차 채점)` : '채점 대기')}
          </div>
        </div>
      </div>
    `;

    // Part 1 객관식 (10문항)
    html += `
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-black">Part 1</span>
          <h4 class="font-black text-slate-800 text-sm sm:text-base">객관식 (10문항 / 문항당 3점)</h4>
        </div>
        <div class="space-y-3">
    `;

    part1Items.forEach((item, idx) => {
      const isCorrect = item.isCorrect === true;
      const myChoiceText = item.myChoice != null ? `${item.myChoice + 1}번` : '미응답';
      const ansText = item.answer != null ? `${item.answer + 1}번` : '미지정';
      html += `
        <div class="p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} space-y-2">
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-black ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}">
              Q${idx + 1}. [배점 3점] ${escape(item.prompt)}
            </span>
            <span class="text-xs font-black px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} shrink-0">
              ${isCorrect ? '⭕ 정답 (+3점)' : '❌ 오답 (0점)'}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">내가 선택한 답:</span>
              <span class="font-black ${isCorrect ? 'text-emerald-700' : 'text-rose-700'} ml-1">${escape(myChoiceText)}</span>
            </div>
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">실제 정답:</span>
              <span class="font-black text-indigo-700 ml-1">${escape(ansText)}</span>
            </div>
          </div>
          ${item.explanation ? `
            <div class="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
              💡 <strong>해설:</strong> ${escape(item.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div></div>`;

    // Part 2 단답형 (6문항)
    html += `
      <div class="space-y-4 pt-2">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-black">Part 2</span>
          <h4 class="font-black text-slate-800 text-sm sm:text-base">단답형 (6문항 / 문항당 5점)</h4>
        </div>
        <div class="space-y-3">
    `;

    part2Items.forEach((item, idx) => {
      const isCorrect = item.isCorrect === true;
      const myText = item.myInput ? String(item.myInput).trim() : '미입력';
      const acceptable = Array.isArray(item.acceptableAnswers) ? item.acceptableAnswers.join(', ') : (item.answer || '');
      html += `
        <div class="p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} space-y-2">
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-black ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}">
              Q${idx + 11}. [배점 5점] ${escape(item.prompt)}
            </span>
            <span class="text-xs font-black px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} shrink-0">
              ${isCorrect ? '⭕ 정답 (+5점)' : '❌ 오답 (0점)'}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">내가 입력한 답:</span>
              <span class="font-black ${isCorrect ? 'text-emerald-700' : 'text-rose-700'} ml-1">${escape(myText)}</span>
            </div>
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">인정 정답:</span>
              <span class="font-black text-indigo-700 ml-1">${escape(acceptable)}</span>
            </div>
          </div>
          ${item.explanation ? `
            <div class="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
              💡 <strong>해설:</strong> ${escape(item.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div></div>`;

    // Part 3 순서도 설계 (40점)
    const p3Review = part3.confirmed || part3.proposal || {};
    const criteria = p3Review.criteria || {};
    const p3Score = p3Review.score != null ? p3Review.score : null;
    const isP3Confirmed = part3.confirmed != null;

    html += `
      <div class="space-y-4 pt-2">
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black">Part 3</span>
            <h4 class="font-black text-slate-800 text-sm sm:text-base">순서도 설계 (배점 40점)</h4>
          </div>
          <span class="text-xs font-black px-2.5 py-0.5 rounded-full ${isP3Confirmed ? 'bg-violet-100 text-violet-800' : (p3Score != null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}">
            ${isP3Confirmed ? '선생님 확정 완료' : (p3Score != null ? '1차 채점 완료' : '채점 진행 중')}
          </span>
        </div>

        <!-- 4대 평가 기준별 피드백 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="flex items-center justify-between font-bold text-slate-700">
              <span>1. 문제 해결 계획의 적절성</span>
              <span class="font-mono text-indigo-600 font-black">${criteria.planScore != null ? criteria.planScore + ' / 10점' : '--'}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">${escape(criteria.planFeedback || '검토 전입니다.')}</p>
          </div>

          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="flex items-center justify-between font-bold text-slate-700">
              <span>2. 시작/종료 기호의 올바른 사용</span>
              <span class="font-mono text-indigo-600 font-black">${criteria.terminalScore != null ? criteria.terminalScore + ' / 10점' : '--'}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">${escape(criteria.terminalFeedback || '검토 전입니다.')}</p>
          </div>

          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="flex items-center justify-between font-bold text-slate-700">
              <span>3. 제어 구조(순차·선택·반복) 구현</span>
              <span class="font-mono text-indigo-600 font-black">${criteria.structureScore != null ? criteria.structureScore + ' / 10점' : '--'}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">${escape(criteria.structureFeedback || '검토 전입니다.')}</p>
          </div>

          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="flex items-center justify-between font-bold text-slate-700">
              <span>4. 실행 결과의 올바름</span>
              <span class="font-mono text-indigo-600 font-black">${criteria.executionScore != null ? criteria.executionScore + ' / 10점' : '--'}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">${escape(criteria.executionFeedback || '검토 전입니다.')}</p>
          </div>
        </div>

        <!-- Part 3 총평 -->
        <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black text-emerald-900">순서도 설계 종합 점수</span>
            <span class="text-lg font-black text-emerald-950 font-mono">${p3Score != null ? p3Score + ' / 40점' : '채점 중...'}</span>
          </div>
          <p class="text-xs text-emerald-800 leading-relaxed">
            ${escape(p3Review.feedback || '선생님의 최종 확인 후 피드백이 확정됩니다.')}
          </p>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // 로컬/모의평가(V3) 리뷰 모달 렌더링
  renderLocalReviewModalContent(container) {
    const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const questions = this.currentQuestions();
    const p1Questions = questions.part1 || [];
    const p2Questions = questions.part2 || [];

    let html = `
      <div class="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
        모의평가(실습) 답안과 정답 해설입니다. 내가 작성한 내용과 비교해 보세요.
      </div>
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-black">Part 1</span>
          <h4 class="font-black text-slate-800 text-sm sm:text-base">객관식 문항</h4>
        </div>
        <div class="space-y-3">
    `;

    p1Questions.forEach((q, idx) => {
      const myChoice = this.answers.part1[q.id];
      const isCorrect = Number(myChoice) === Number(q.answer);
      const myChoiceText = myChoice != null ? `${myChoice + 1}번` : '미응답';
      const ansText = q.answer != null ? `${q.answer + 1}번` : '미지정';
      html += `
        <div class="p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} space-y-2">
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-black ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}">
              Q${idx + 1}. ${escape(q.prompt)}
            </span>
            <span class="text-xs font-black px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} shrink-0">
              ${isCorrect ? '⭕ 정답 (+3점)' : '❌ 오답 (0점)'}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">내가 선택한 답:</span>
              <span class="font-black ${isCorrect ? 'text-emerald-700' : 'text-rose-700'} ml-1">${escape(myChoiceText)}</span>
            </div>
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">실제 정답:</span>
              <span class="font-black text-indigo-700 ml-1">${escape(ansText)}</span>
            </div>
          </div>
          ${q.explanation ? `
            <div class="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
              💡 <strong>해설:</strong> ${escape(q.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div></div>`;

    // Part 2 단답형
    html += `
      <div class="space-y-4 pt-2">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-black">Part 2</span>
          <h4 class="font-black text-slate-800 text-sm sm:text-base">단답형 문항</h4>
        </div>
        <div class="space-y-3">
    `;

    p2Questions.forEach((q, idx) => {
      const myText = String(this.answers.part2[q.id] ?? '').trim();
      const acceptable = Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [q.answer];
      const isCorrect = acceptable.some(a => String(a).trim().toLowerCase() === myText.toLowerCase());
      html += `
        <div class="p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'} space-y-2">
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-black ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}">
              Q${idx + 11}. ${escape(q.prompt)}
            </span>
            <span class="text-xs font-black px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} shrink-0">
              ${isCorrect ? '⭕ 정답 (+5점)' : '❌ 오답 (0점)'}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">내가 입력한 답:</span>
              <span class="font-black ${isCorrect ? 'text-emerald-700' : 'text-rose-700'} ml-1">${escape(myText || '미입력')}</span>
            </div>
            <div class="p-2 rounded-xl bg-white/80 border border-slate-200">
              <span class="text-slate-500 font-bold">인정 정답:</span>
              <span class="font-black text-indigo-700 ml-1">${escape(acceptable.join(', '))}</span>
            </div>
          </div>
          ${q.explanation ? `
            <div class="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
              💡 <strong>해설:</strong> ${escape(q.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div></div>`;

    container.innerHTML = html;
  }

  // 시험장 나가기 (로드맵으로 복귀)
  exitExam() {
    this.resetServerScoreState();
    this.saveDraft();
    if (typeof switchUnit === 'function') {
      switchUnit('roadmap');
    }
  }
}

window.studentEvalApp = new StudentEvalApp();
