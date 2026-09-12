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

  draftKey() { return "ALGO_EXAM_DRAFT_"+(this.ownerUid||'')+"_"+this.currentClass+"_"+this.studentNum; }
  saveDraft() {
    if (!this.joined || window.isSessionClosing) return;
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify({answers:this.answers,deadlineMs:this.deadlineMs,studentName:this.studentName,lastResetAt:this.lastResetAt,isSubmitted:this.isSubmitted})); } catch(error) { console.warn("임시 저장 실패",error); }
  }
  restoreDraft(student) {
    let draft=null; try { draft=JSON.parse(sessionStorage.getItem(this.draftKey())); } catch {}
    if (student?.status==="submitted") { this.answers=student.answers; this.isSubmitted=true; }
    else if(draft && draft.studentName===this.studentName && draft.lastResetAt===(student?.resetAt||null)) { this.answers=draft.answers; this.deadlineMs=draft.deadlineMs; }
    else if(student?.answers) this.answers=student.answers;
    if(!this.answers.part3) this.answers.part3={selectedThemeId:"theme_greenhouse",blocks:[],connections:[],isVerified:false};
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
        this.latestSession=sessionData;
        window.pendingAssessmentResume=false;
        if(sessionData?.status==='waiting') {sessionStorage.removeItem('ALGO_ACTIVE_EXAM');updateAssessmentNavigation();}
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
    this.switchPart('part1');
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
  switchPart(partName) {
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
      this.renderAssessmentPlan();this.renderPart3Canvas();
      setTimeout(() => this.renderPart3Connections(), 50);
    }
  }

  // 문항 DOM 렌더링 (Part 1 10문항, Part 2 단답형 6문항)
  renderPartQuestions() {
    // Part 1. 객관식 10문항
    const p1Box = document.getElementById('eval-part1-list');
    if (p1Box) {
      p1Box.innerHTML = EVAL_QUESTIONS.part1.map((q) => `
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">${q.title}</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${q.desc}</p>
          <div class="space-y-2 pt-1">
            ${q.options.map((opt, optIdx) => `
              <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition text-xs sm:text-sm font-medium">
                <input type="radio" name="${q.id}" value="${optIdx}" ${this.answers.part1[q.id] === optIdx ? 'checked' : ''} onchange="window.studentEvalApp.onSelectPart1('${q.id}', ${optIdx})" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Part 2. 단답형 6문항 (각 5점, 총 30점)
    const p2Box = document.getElementById('eval-part2-list');
    if (p2Box) {
      p2Box.innerHTML = EVAL_QUESTIONS.part2.map((q) => `
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">${q.title}</span>
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
    // 2. 캔버스 마우스 드래그 및 포트 연결 이벤트 전역 바인딩 (최초 1회)
    if (!this.canvasEventsBound) {
      this.canvasEventsBound = true;
      const canvasEl = document.getElementById('eval-part3-canvas');

      window.addEventListener('mousemove', (e) => {
        if (this.isDraggingBlock && this.draggedBlockId) {
          const b = this.answers.part3.blocks.find(x => x.id === this.draggedBlockId);
          if (b && canvasEl) {
            const rect = canvasEl.getBoundingClientRect();
            b.x = Math.max(10, Math.min(canvasEl.scrollWidth - 230, e.clientX - rect.left + canvasEl.scrollLeft - this.dragOffset.x));
            b.y = Math.max(10, Math.min(canvasEl.scrollHeight - 130, e.clientY - rect.top + canvasEl.scrollTop - this.dragOffset.y));

            const domEl = document.getElementById(`eval-blk-${b.id}`);
            if (domEl) {
              domEl.style.left = `${b.x}px`;
              domEl.style.top = `${b.y}px`;
            }
            this.renderPart3Connections();
          }
        }
      });

      window.addEventListener('mouseup', () => {
        if (this.isDraggingBlock) {
          this.isDraggingBlock = false;
          this.draggedBlockId = null;
          this.syncStudentProgress();
        }
        if (this.isConnecting) {
          this.isConnecting = false;
          this.connectionSource = null;
        }
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
  addAssessmentStep() {
    if(!this.canEditPlan())return;
    this.getAssessmentPlan().steps.push({id:crypto.randomUUID(),text:''});
    this.renderAssessmentSteps();this.syncStudentProgress();
    document.querySelector('#eval-plan-steps li:last-child textarea')?.focus();
  }
  changeAssessmentStep(id,value) {
    if(!this.canEditPlan())return;
    const step=this.getAssessmentPlan().steps.find(item=>item.id===id);
    if(step){step.text=value.slice(0,1000);this.syncStudentProgress();}
  }
  moveAssessmentStep(id,direction) {
    if(!this.canEditPlan())return;
    const steps=this.getAssessmentPlan().steps,index=steps.findIndex(item=>item.id===id),target=index+direction;
    if(index<0||target<0||target>=steps.length)return;
    [steps[index],steps[target]]=[steps[target],steps[index]];
    this.renderAssessmentSteps();this.syncStudentProgress();
    document.getElementById('eval-plan-step-'+id)?.focus();
  }
  removeAssessmentStep(id) {
    if(!this.canEditPlan())return;
    const plan=this.getAssessmentPlan();plan.steps=plan.steps.filter(step=>step.id!==id);
    this.renderAssessmentSteps();this.syncStudentProgress();
  }
  renderAssessmentSteps() {
    const list=document.getElementById('eval-plan-steps');if(!list)return;list.replaceChildren();
    const steps=this.getAssessmentPlan().steps;
    steps.forEach((step,index)=>{
      const row=document.createElement('li'),label=document.createElement('label'),input=document.createElement('textarea'),actions=document.createElement('div');
      label.textContent=(index+1)+'단계';input.id='eval-plan-step-'+step.id;label.htmlFor=input.id;
      input.value=step.text||'';input.rows=2;input.maxLength=1000;input.placeholder='이 단계에서 할 일을 짧게 적어 보세요';input.disabled=!this.canEditPlan();
      input.oninput=()=>this.changeAssessmentStep(step.id,input.value);actions.className='eval-step-actions';
      for(const [text,action,disabled] of [['위로',()=>this.moveAssessmentStep(step.id,-1),index===0],['아래로',()=>this.moveAssessmentStep(step.id,1),index===steps.length-1],['삭제',()=>this.removeAssessmentStep(step.id),false]]) {
        const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',(index+1)+'단계 '+text);button.onclick=action;button.disabled=disabled||!this.canEditPlan();actions.appendChild(button);
      }
      row.append(label,input,actions);list.appendChild(row);
    });
    document.getElementById('eval-plan-empty').hidden=steps.length>0;
  }
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

  // 기호 보관함에서 클릭 시 블록 추가
  addPart3Block(shapeType) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    const id = `eblk_${this.blockIdCounter++}`;
    const defaultLabels = {
      terminal: "종료",
      io: "내용 입력",
      decision: "내용 입력",
      process: "내용 입력"
    };

    // 추가할 Y좌표 계산
    const lastY = this.answers.part3.blocks.reduce((max, b) => Math.max(max, b.y), 30);
    const newY = lastY + 130;
    const newX = shapeType === 'decision' ? 210 : 220;

    const newBlock = {
      id: id,
      shape: shapeType,
      type: shapeType,
      text: defaultLabels[shapeType] || "내용 입력",
      x: newX,
      y: newY
    };

    this.answers.part3.blocks.push(newBlock);
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);

    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 블록 삭제
  removePart3Block(blockId) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    if (blockId === 'eblk_start') {
      alert("알고리즘의 '시작' 단말 기호는 삭제할 수 없습니다.");
      return;
    }
    this.answers.part3.blocks = this.answers.part3.blocks.filter(b => b.id !== blockId);
    this.answers.part3.connections = this.answers.part3.connections.filter(c => c.from !== blockId && c.to !== blockId);
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);

    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 블록 텍스트 수정
  handlePart3BlockText(blockId, text) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    const b = this.answers.part3.blocks.find(x => x.id === blockId);
    if (b) {
      b.text = text.trim() || "내용 입력";
      this.answers.part3.isVerified = false;
      this.updatePart3ScoreBadge(0);
      this.renderPart3Connections();
      this.syncStudentProgress();
    }
  }

  // 블록 드래그 시작
  handlePart3BlockMouseDown(blockId, e) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    if (e.target.classList.contains('flow-port') || e.target.isContentEditable || e.target.tagName === 'BUTTON') return;
    this.isDraggingBlock = true;
    this.draggedBlockId = blockId;

    const domEl = document.getElementById(`eval-blk-${blockId}`);
    if (domEl) {
      const rect = domEl.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }

  // 포트 연결 시작
  startPart3Connecting(blockId, portType, e) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    e.stopPropagation();
    this.isConnecting = true;
    this.connectionSource = { blockId, portType };
  }

  // 포트 연결 완료
  handlePart3PortMouseUp(targetBlockId, targetPortType) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    if (!this.isConnecting || !this.connectionSource) return;
    const fromBlockId = this.connectionSource.blockId;
    const fromPort = this.connectionSource.portType;

    // 자기 자신에게 연결 방지
    if (fromBlockId === targetBlockId) return;

    // 이미 동일한 연결이 존재하는지 확인
    const exists = this.answers.part3.connections.some(c => 
      c.from === fromBlockId && c.to === targetBlockId && c.fromPort === fromPort
    );

    if (!exists) {
      this.answers.part3.connections.push({
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        from: fromBlockId,
        to: targetBlockId,
        fromPort: fromPort,
        toPort: targetPortType
      });

      this.answers.part3.isVerified = false;
      this.updatePart3ScoreBadge(0);
      this.renderPart3Connections();
      this.syncStudentProgress();
    }

    this.isConnecting = false;
    this.connectionSource = null;
  }

  // 연결선 삭제
  removePart3Connection(connId) {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    this.answers.part3.connections = this.answers.part3.connections.filter(c => c.id !== connId);
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Connections();
    this.syncStudentProgress();
  }

  // 블록 및 캔버스 전체 DOM 렌더링
  renderPart3Canvas() {
    const stage = document.getElementById('eval-part3-stage');
    if(stage){stage.style.minHeight=Math.max(460,...this.answers.part3.blocks.map(b=>b.y+180))+'px';stage.style.minWidth=Math.max(620,...this.answers.part3.blocks.map(b=>b.x+240))+'px';}
    if (!stage) return;

    // 기존 블록 요소 제거 (SVG는 보존)
    stage.querySelectorAll('.free-block').forEach(b => b.remove());

    // 블록 DOM 생성 및 배치
    this.answers.part3.blocks.forEach(b => {
      const el = this.createPart3BlockDOM(b);
      stage.appendChild(el);
    });

    // 연결선 렌더링
    this.renderPart3Connections();
  }

  // Step 5와 100% 동일한 고품질 순서도 블록 DOM 생성기
  createPart3BlockDOM(b) {
    const div = document.createElement('div');
    div.id = `eval-blk-${b.id}`;
    div.style.left = `${b.x}px`;
    div.style.top = `${b.y}px`;

    const isStart = (b.id === 'eblk_start');
    const isDecision = (b.shape === 'decision');
    const isTerminal = (b.shape === 'terminal');
    const isIO = (b.shape === 'io');

    // 4방향 포트 HTML
    let portsHtml = '';

    // 상단 포트 (시작 기호 제외)
    if (!isStart) {
      portsHtml += `
        <div class="flow-port port-top" 
             title="상단 연결점"
             onmousedown="window.studentEvalApp.startPart3Connecting('${b.id}', 'in', event)"
             onmouseup="window.studentEvalApp.handlePart3PortMouseUp('${b.id}', 'in')"></div>
      `;
    }

    // 하단 포트 (종료 기호 제외)
    if (!b.text.includes('종료')) {
      const pName = isDecision ? 'yes' : 'out';
      portsHtml += `
        <div class="flow-port port-bottom ${isDecision ? '!bg-emerald-600' : ''}" 
             title="${isDecision ? '[예] 분기점' : '하단 연결점'}"
             onmousedown="window.studentEvalApp.startPart3Connecting('${b.id}', '${pName}', event)"
             onmouseup="window.studentEvalApp.handlePart3PortMouseUp('${b.id}', '${pName}')"></div>
      `;
    }

    // 좌측 포트
    portsHtml += `
      <div class="flow-port port-left ${isDecision ? '!bg-amber-500' : ''}" 
           title="${isDecision ? '조건 분기점 (좌측)' : '좌측 연결점'}"
           onmousedown="window.studentEvalApp.startPart3Connecting('${b.id}', 'left', event)"
           onmouseup="window.studentEvalApp.handlePart3PortMouseUp('${b.id}', 'left')"></div>
    `;

    // 우측 포트
    const rightName = isDecision ? 'no' : 'right';
    portsHtml += `
      <div class="flow-port port-right ${isDecision ? '!bg-rose-500' : ''}" 
           title="${isDecision ? '[아니오] 분기점 (우측)' : '우측 연결점'}"
           onmousedown="window.studentEvalApp.startPart3Connecting('${b.id}', '${rightName}', event)"
           onmouseup="window.studentEvalApp.handlePart3PortMouseUp('${b.id}', '${rightName}')"></div>
    `;

    const deleteBtn = !isStart 
      ? `<button type="button" onclick="window.studentEvalApp.removePart3Block('${b.id}')" class="text-slate-400 hover:text-rose-600 transition ml-1" title="블록 삭제"><i class="fa-solid fa-xmark text-[10px]"></i></button>` 
      : '';

    if (isDecision) {
      div.className = "free-block shape-decision-block select-none";
      div.innerHTML = `
        <svg class="decision-svg-bg" viewBox="0 0 220 120" preserveAspectRatio="none">
          <polygon points="110,4 216,60 110,116 4,60" />
        </svg>
        ${portsHtml}
        <div class="decision-content">
          <div class="w-full flex items-center justify-between text-[11px] text-amber-800/80 mb-0.5 pointer-events-none">
            <span class="font-extrabold">◇ 판단</span>
            <div class="flex items-center gap-1">${deleteBtn}</div>
          </div>
          <div class="block-text-label w-full px-1.5 py-0.5 cursor-text text-center text-xs font-black text-amber-950 focus:outline-none leading-snug" 
               contenteditable="true" 
               oninput="window.studentEvalApp.handlePart3BlockText('${b.id}', this.innerText)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${escapeHtml(b.text)}</div>
        </div>
      `;
    } else {
      let shapeClass = "shape-process-block";
      let shapeName = "▭ 처리";
      let headerColor = "text-blue-600";

      if (isTerminal) {
        shapeClass = "shape-terminal-block";
        shapeName = "⬭ 단말";
        headerColor = "text-violet-600";
      } else if (isIO) {
        shapeClass = "shape-io-block";
        shapeName = "▱ 자료";
        headerColor = "text-emerald-700";
      }

      div.className = `free-block ${shapeClass} select-none`;
      div.innerHTML = `
        ${portsHtml}
        <div class="w-full h-full flex flex-col justify-between p-2">
          <div class="flex items-center justify-between text-[10px] font-black ${headerColor}">
            <span>${shapeName}</span>
            <div>${deleteBtn}</div>
          </div>
          <div class="block-text-label flex-1 flex items-center justify-center text-center text-xs font-black text-slate-800 focus:outline-none cursor-text px-1" 
               contenteditable="true" 
               oninput="window.studentEvalApp.handlePart3BlockText('${b.id}', this.innerText)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${escapeHtml(b.text)}</div>
        </div>
      `;
    }

    div.addEventListener('mousedown', (e) => this.handlePart3BlockMouseDown(b.id, e));
    return div;
  }

  // 맨해튼 직각 라우팅 알고리즘 기반 SVG 연결선 렌더링
  renderPart3Connections() {
    const svg = document.getElementById('eval-part3-svg');
    if (!svg) return;

    // SVG 정의 및 마커
    svg.innerHTML = `
      <defs>
        <marker id="eval-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4f46e5" />
        </marker>
        <marker id="eval-arrow-yes" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
        </marker>
        <marker id="eval-arrow-no" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#e11d48" />
        </marker>
      </defs>
    `;

    this.answers.part3.connections.forEach(conn => {
      const fromB = this.answers.part3.blocks.find(b => b.id === conn.from);
      const toB = this.answers.part3.blocks.find(b => b.id === conn.to);
      if (!fromB || !toB) return;

      const pt1 = this.getPortCoordinates(fromB, conn.fromPort);
      const pt2 = this.getPortCoordinates(toB, conn.toPort);

      // 맨해튼 직각 라우팅 경로 계산
      const d = this.calculateManhattanPath(pt1, pt2, conn.fromPort, conn.toPort);

      const isYes = (conn.fromPort === 'yes');
      const isNo = (conn.fromPort === 'no');
      let strokeColor = "#4f46e5";
      let markerId = "eval-arrow";
      let labelText = "";

      if (isYes) {
        strokeColor = "#059669";
        markerId = "eval-arrow-yes";
        labelText = "예";
      } else if (isNo) {
        strokeColor = "#e11d48";
        markerId = "eval-arrow-no";
        labelText = "아니오";
      }

      // 1. 클릭 삭제 가능한 넓은 투명 패스
      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("d", d);
      hitPath.setAttribute("stroke", "transparent");
      hitPath.setAttribute("stroke-width", "16");
      hitPath.setAttribute("fill", "none");
      hitPath.setAttribute("class", "cursor-pointer");
      hitPath.addEventListener("click", () => this.removePart3Connection(conn.id));

      // 2. 실물 화살표 패스
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", strokeColor);
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("fill", "none");
      path.setAttribute("marker-end", `url(#${markerId})`);
      path.setAttribute("class", "transition-all hover:stroke-rose-600 cursor-pointer");
      path.addEventListener("click", () => this.removePart3Connection(conn.id));

      svg.appendChild(hitPath);
      svg.appendChild(path);

      // 분기선 라벨 (예 / 아니오)
      if (labelText) {
        const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textEl.setAttribute("x", pt1.x + (isNo ? 12 : -8));
        textEl.setAttribute("y", pt1.y + (isYes ? 14 : 4));
        textEl.setAttribute("fill", strokeColor);
        textEl.setAttribute("font-size", "10px");
        textEl.setAttribute("font-weight", "900");
        textEl.textContent = labelText;
        svg.appendChild(textEl);
      }
    });
  }

  // 포트 중심 좌표 계산
  getPortCoordinates(b, portType) {
    const isDecision = (b.shape === 'decision');
    const width = isDecision ? 220 : 180;
    const height = isDecision ? 120 : 70;

    switch (portType) {
      case 'in':
      case 'top':
        return { x: b.x + width / 2, y: b.y };
      case 'out':
      case 'yes':
      case 'bottom':
        return { x: b.x + width / 2, y: b.y + height };
      case 'left':
        return { x: b.x, y: b.y + height / 2 };
      case 'no':
      case 'right':
        return { x: b.x + width, y: b.y + height / 2 };
      default:
        return { x: b.x + width / 2, y: b.y + height };
    }
  }

  // 1px 오차 없는 맨해튼 직각 경로
  calculateManhattanPath(p1, p2, fromPort, toPort) {
    if (fromPort === 'out' || fromPort === 'yes') {
      const midY = p1.y + (p2.y - p1.y) / 2;
      return `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`;
    } else if (fromPort === 'no' || fromPort === 'right') {
      const midX = p1.x + 30;
      return `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y - 20} L ${p2.x} ${p2.y - 20} L ${p2.x} ${p2.y}`;
    } else if (fromPort === 'left') {
      const midX = p1.x - 30;
      return `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y - 20} L ${p2.x} ${p2.y - 20} L ${p2.x} ${p2.y}`;
    }
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }

  // 자동 정렬
  autoAlignPart3Canvas() {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === 'ended') return;
    let curY = 30;
    this.answers.part3.blocks.forEach(b => {
      const isDecision = (b.shape === 'decision');
      b.x = isDecision ? 200 : 220;
      b.y = curY;
      curY += isDecision ? 130 : 85;
    });

    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 비우기
  clearPart3Canvas() {
    if (this.isSubmitted || this.isSubmitting || this.sessionStatus === "ended") return;
    if (!confirm("캔버스의 모든 블록과 연결선을 비우시겠습니까?")) return;
    this.answers.part3.blocks = [
      { id: "eblk_start", shape: "terminal", type: "terminal", text: "시작", x: 220, y: 30 }
    ];
    this.answers.part3.connections = [];
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // [ 🧪 순서도 완성 검사 및 40점 획득 ]
  verifyPart3Flowchart() {
    const inspection=inspectAssessmentFlow(this.answers.part3);
    this.answers.part3.isVerified=inspection.passed;
    document.querySelectorAll("#eval-part3-stage .execution-issue").forEach(el=>el.classList.remove("execution-issue"));
    inspection.issues.forEach(issue=>{if(issue.blockId)document.getElementById("eval-blk-"+issue.blockId)?.classList.add("execution-issue");});
    const panel=document.getElementById("eval-execution-feedback");
    if(panel) {
      panel.replaceChildren();
      for(const issue of inspection.issues) {const p=document.createElement("p");p.textContent=issue.message;panel.appendChild(p);}
      for(const result of inspection.cases) {const p=document.createElement("p");p.textContent=result.input+"：예상"+" "+result.expected+" / 실제 "+result.actual;panel.appendChild(p);}
      if(inspection.passed) {const p=document.createElement("p");p.textContent="표시된 입력에서 예상한 결과가 나왔어요.";panel.appendChild(p);}
    }
    this.updatePart3ScoreBadge(inspection.passed?40:0); this.syncStudentProgress();
  }

  updatePart3ScoreBadge(score) {
    const badge=document.getElementById("eval-part3-score-badge");
    if(badge) badge.textContent=score===40?"표시된 입력 확인 완료":"실행 결과를 확인해 보세요";
  }

  syncStudentProgress() {
    this.saveDraft();
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
  calculateScores() { const result=gradeEvaluation(this.answers); this.scores=result.scores; return result; }

  // 5. 최종 제출 처리
  async submitExam(isAuto = false) {
    if (this.isSubmitted || this.isSubmitting) return;
    if (!isAuto && !confirm("정말로 수행평가 답안을 최종 제출하시겠습니까?\n제출 후에는 교사의 재시험 승인이 있어야 답안을 다시 작성할 수 있습니다.")) {
      return;
    }

    document.activeElement?.blur();
    this.isSubmitting = true;
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
      this.isSubmitting=false; this.saveDraft();
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
    window.pendingAssessmentResume=false;sessionStorage.removeItem('ALGO_ACTIVE_EXAM');updateAssessmentNavigation();
    // 자동 계산은 교사 검토 전 참고값입니다.
    this.showScreen('result');
    const scoreTotalEl = document.getElementById('eval-result-total-score');
    const scoreBreakdownEl = document.getElementById('eval-result-breakdown');
    if (scoreTotalEl) scoreTotalEl.textContent = `${this.scores.total}점 (교사 검토 전)`;
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
