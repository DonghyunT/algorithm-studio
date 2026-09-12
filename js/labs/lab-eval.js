class StudentEvalApp {
  constructor() {
    this.currentClass = "2-1";
    this.studentNum = 1;
    this.studentName = "";
    this.sessionStatus = "waiting";
    this.timerInterval = null;
    this.remainingSeconds = 1800; // 30분
    this.currentPart = "part1";
    this.isSubmitted = false;

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
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify({answers:this.answers,deadlineMs:this.deadlineMs,studentName:this.studentName,lastResetAt:this.lastResetAt,isSubmitted:this.isSubmitted,visitedPart3:this.visitedPart3,currentPart:this.currentPart})); } catch(error) { console.warn("임시 저장 실패",error); }
  }
  restoreDraft(student) {
    this.attemptId=student?.attemptId||null;
    let draft=null; try { draft=JSON.parse(sessionStorage.getItem(this.draftKey())); } catch {}
    const validDraft=draft && draft.studentName===this.studentName && draft.lastResetAt===(student?.resetAt||null);
    if (student?.status==="submitted") { this.answers=student.answers; this.isSubmitted=true; }
    else if(validDraft) { this.answers=draft.answers; this.deadlineMs=draft.deadlineMs; }
    else if(student?.answers) this.answers=student.answers;
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
    this.showScreen(this.isSubmitted ? 'result' : isAssessmentLocked() ? 'exam' : 'lobby');
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

    if (screenName === 'lobby' && lobbyEl) lobbyEl.classList.remove('hidden');
    if (screenName === 'exam' && examEl) examEl.classList.remove('hidden');
    if (screenName === 'result' && resultEl) resultEl.classList.remove('hidden');
  }

  // 2. 대기실 입장 버튼 클릭
  async enterWaitingRoom() {
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
        if (stData?.resetAt && stData.resetAt !== this.lastResetAt) {
          this.lastResetAt=stData.resetAt;
          alert("🔔 선생님께서 재시험을 허용하셨습니다!\n답안이 초기화되며 시험 화면으로 복귀합니다.");
          this.isSubmitted = false;
          this.sessionStatus = 'waiting';
          window.assessmentWorkspace?.leave();this.visitedPart3=false;this.currentPart='part1';delete this.answers.part3.visited;
          this.answers.part1 = {};
          this.answers.part2 = {};
          this.answers.part3.blocks = [];
          this.answers.part3.connections = [];
          this.answers.part3.isVerified = false;
          delete this.answers.part3.plan;
          this.scores = { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null };

          this.isSubmitting=false;
          if (this.latestSession?.status === 'in_progress') this.startExam(this.latestSession);
          else this.showScreen('lobby');
          this.saveDraft();
        }
      });
    }
    if(this.isSubmitted) { this.calculateScores(); this.renderResult(); }
  }

  // 3. 시험장 진입 및 타이머 가동
  startExam(sessionData) {
    if (this.sessionStatus === 'in_progress') return;
    this.sessionStatus = 'in_progress';
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
    if (sessionData && sessionData.startTime) {
      const startMs = new Date(sessionData.startTime).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - startMs) / 1000);
      const totalSec = (sessionData.durationMinutes || 30) * 60;
      this.remainingSeconds = Math.max(0, totalSec - elapsedSec);
    } else {
      this.remainingSeconds = 1800;
    }

    this.deadlineMs = sessionData?.deadlineMs || (new Date(sessionData.startTime).getTime() + (sessionData.durationMinutes || 30)*60000);
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

    // 문항 렌더링 & 순서도 백지 초기화
    this.renderPartQuestions();
    this.initPart3Canvas();
    this.switchPart(this.currentPart || 'part1');
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
    const questions=evaluationQuestions(this.answers);
    for(const part of ['part1','part2','part3']) {
      const container=document.getElementById('eval-'+part+'-container');
      let footer=container.querySelector('.eval-part-footer');
      if(!footer){footer=document.createElement('nav');footer.className='eval-part-footer';footer.setAttribute('aria-label',part+' 하단 이동');container.appendChild(footer);}
      const index=['part1','part2','part3'].indexOf(part);
      const count=part==='part3'?0:questions[part].filter(q=>part==='part1'?Number.isInteger(this.answers.part1[q.id]):String(this.answers.part2[q.id]||'').trim()).length;
      footer.innerHTML=(index?`<button type="button" onclick="studentEvalApp.switchPart('part${index}',true)">이전: ${index===1?'객관식':'단답형'}</button>`:'')+
        `<div>${index<2?`${questions[part].length}문항 중 ${count}문항 응답`:'작성한 내용을 확인하고 제출하세요.'}${index<2&&count<questions[part].length?'<small>풀지 않은 문제는 나중에 돌아와 풀 수 있어요.</small>':''}</div>`+
        (index<2?`<button type="button" onclick="studentEvalApp.switchPart('part${index+2}',true)">다음: ${index===0?'단답형':'순서도'}</button>`:'<button type="button" data-eval-submit onclick="studentEvalApp.submitExam(false)">최종 제출</button>');
    }
    document.querySelectorAll('[data-eval-submit]').forEach(b=>{b.disabled=!this.visitedPart3||this.isSubmitting||this.isSubmitted;b.title=this.visitedPart3?'최종 제출':'Part 3을 확인한 뒤 제출할 수 있어요.';});
    document.querySelectorAll('#eval-part1-list input,#eval-part2-list input').forEach(input=>{input.disabled=this.isSubmitting||this.isSubmitted||this.sessionStatus==='ended';});
  }

  // 문항 DOM 렌더링 (Part 1 10문항, Part 2 단답형 6문항)
  renderPartQuestions() {
    const questions=evaluationQuestions(this.answers);
    // Part 1. 객관식 10문항
    const p1Box = document.getElementById('eval-part1-list');
    if (p1Box) {
      p1Box.innerHTML = questions.part1.map((q,i) => `
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">${i+1}번 문제</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${q.desc}</p>
          <div class="space-y-2 pt-1">
            ${q.options.map((opt, optIdx) => `
              <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition text-xs sm:text-sm font-medium">
                <input type="radio" name="${q.id}" value="${optIdx}" ${this.answers.part1[q.id] === optIdx ? 'checked' : ''} onchange="window.studentEvalApp.onSelectPart1('${q.id}', ${optIdx})" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                <span>${opt.replace(/\s*\([A-Za-z ]+\)/g,'')}</span>
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
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">${i+1}번 문제</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${q.desc}</p>
          <div class="flex items-center gap-2 max-w-md">
            <input type="text" id="${q.id}_input" value="${escapeHtml(this.answers.part2[q.id] || '')}" oninput="window.studentEvalApp.onInputPart2('${q.id}', this.value)" class="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-800" placeholder="${q.placeholder}">
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

  // ============================================================================
  // 📐 Part 3. 순서도 나만의 백지 공방 풀 이식 캔버스 시스템
  // ============================================================================

  initPart3Canvas() {
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
  hasAssessmentPlan() {
    const plan=this.getAssessmentPlan();
    return !!(plan.current || plan.goal || plan.steps.some(step=>step.text?.trim()));
  }
  canEditPlan() { return !this.isSubmitted && !this.isSubmitting && this.sessionStatus!=='ended'; }
  setAssessmentPlanField(field,value) {
    if(!this.canEditPlan() || !['current','goal'].includes(field))return;
    this.getAssessmentPlan()[field]=value.slice(0,500);this.syncStudentProgress();
  }
  addAssessmentStep(type='seq') { if(assessmentWorkspace.active&&this.canEditPlan())addNlCard(type); }
  renderAssessmentSteps() { if(assessmentWorkspace.active)renderNlCards(); }
  renderAssessmentPlan() {
    const theme=EVAL_QUESTIONS.part3Themes.find(item=>item.id===this.answers.part3.selectedThemeId);
    if(!theme)return;
    for(const [id,text] of [['eval-task-situation',theme.situation],['eval-task-input',theme.input],['eval-task-requirement',theme.requirement]]){
      const element=document.getElementById(id);if(element)element.textContent=text;
    }
    const plan=this.getAssessmentPlan();
    for(const field of ['current','goal']){const input=document.getElementById('eval-plan-'+field);if(input){input.value=plan[field]||'';input.disabled=!this.canEditPlan();}}
    this.renderAssessmentSteps();
  }

  // Compatibility entry points all use the common studio now.
  addPart3Block(shape) { if(assessmentWorkspace.active&&this.canEditPlan())addCanvasBlock(shape); }
  handlePart3BlockText(id,text) { if(assessmentWorkspace.active&&this.canEditPlan())handleBlockTextChange(id,text); }
  renderPart3Canvas() { if(assessmentWorkspace.active)renderFreeCanvas(); }
  renderPart3Connections() { if(assessmentWorkspace.active)renderFreeConnections(); }
  verifyPart3Flowchart() { if(assessmentWorkspace.active)assessmentWorkspace.run(); }

  updatePart3ScoreBadge(score) {
    const badge=document.getElementById("eval-part3-score-badge");
    if(badge) badge.textContent=score===40?"표시된 입력 확인 완료":"실행 결과를 확인해 보세요";
  }

  syncStudentProgress() {
    this.updatePartNavigation();this.saveDraft();
    if(!this.joined||this.isSubmitted||this.isSubmitting||this.sessionStatus!=="in_progress")return;
    const status=document.getElementById('eval-save-status');
    if(status)status.textContent='이 창에 임시 저장 · 서버 저장 중';
    clearTimeout(this.progressTimeout);
    this.progressTimeout=setTimeout(()=>{
      if(this.isSubmitted||this.isSubmitting)return;
      this.progressPromise=window.evalService.updateStudentProgress(this.currentClass,this.studentNum,{part1:Object.keys(this.answers.part1).length,part2:Object.values(this.answers.part2).filter(v=>String(v).trim()).length,part3:this.answers.part3.blocks.length>1?1:0},this.answers)
        .then(()=>{if(status)status.textContent=window.evalService.isDemo()?'로컬 시연에 저장됨':'서버에 저장됨';})
        .catch(error=>{if(status)status.textContent='서버 저장 실패 · 이 창을 유지해 주세요';console.warn("서버 임시 저장 실패",error);});
    },500);
  }
  // 4. 100% 완전 자동 채점 계산 (총점 100점)
  calculateScores() { const result=gradeEvaluation(this.answers,this.latestSession?.questionVersion||this.answers.part3.questionVersion||1); this.scores=result.scores; return result; }

  // 5. 최종 제출 처리
  async submitExam(isAuto = false) {
    if (this.isSubmitted || this.isSubmitting) return;
    if(!isAuto&&!this.visitedPart3){alert('Part 3을 확인한 뒤 제출해 주세요. 미완성 답안도 제출할 수 있습니다.');return;}
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
  }

  renderResult() {
    window.assessmentWorkspace?.leave();
    window.pendingAssessmentResume=false;sessionStorage.removeItem('ALGO_ACTIVE_EXAM');updateAssessmentNavigation();
    // 자동 계산은 교사 검토 전 참고값입니다.
    this.showScreen('result');
    const scoreTotalEl = document.getElementById('eval-result-total-score');
    const scoreBreakdownEl = document.getElementById('eval-result-breakdown');
    if (scoreTotalEl) scoreTotalEl.textContent = `${this.scores.total}점`;
    if (scoreBreakdownEl) {
      scoreBreakdownEl.innerHTML = `
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div class="text-xs font-bold text-indigo-700">Part 1. 객관식 (10문항)</div>
            <div class="text-xl font-black text-indigo-900 mt-1">${this.scores.part1} / 30점</div>
          </div>
          <div class="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div class="text-xs font-bold text-amber-800">Part 2. 단답형 (6문항)</div>
            <div class="text-xl font-black text-amber-900 mt-1">${this.scores.part2} / 30점</div>
          </div>
          <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div class="text-xs font-bold text-emerald-800">Part 3. 순서도 조립</div>
            <div class="text-xl font-black text-emerald-900 mt-1">${this.scores.part3} / 40점</div>
          </div>
        </div>
      `;
    }
  }

  // 시험장 나가기 (로드맵으로 복귀)
  exitExam() {
    this.saveDraft();
    if (typeof switchUnit === 'function') {
      switchUnit('roadmap');
    }
  }
}

window.studentEvalApp = new StudentEvalApp();
