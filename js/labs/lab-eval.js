/**
 * ==============================================================================
 * 📝 [학생용 30분 실시간 수행평가 엔진 및 자동 채점기 (lab-eval.js)]
 * ==============================================================================
 * - 대상: 중학교 2학년 정보과 '알고리즘과 프로그래밍'
 * - 화면 모드: 풀페이지 전체 화면 (view-eval)
 * - 3단 문항 구성 (총점 100점 만점):
 *   * Part 1. 객관식 10문항 (30점 / 각 3점 / 핵심 개념 망라)
 *   * Part 2. 주관식 단답형 5문항 (30점 / 각 6점 / 객관식 비중복 단답 용어)
 *   * Part 3. 순서도 조립 실전 (40점 / 4가지 자연어 테마 선택 후 백지 캔버스 직접 조립)
 */

const EVAL_QUESTIONS = {
  // Part 1. 객관식 10문항 (각 3점, 총 30점)
  part1: [
    {
      id: "p1_q1",
      title: "1. 문제 해결과 상태 분석",
      desc: "어떤 문제를 해결하기 위해 현재의 조건과 상황인 '현재 상태'를 파악하고, 최종적으로 도달하고자 하는 바람직한 상태를 정하는 과정을 무엇이라고 할까요?",
      options: [
        "목표 상태 설정",
        "순서도 기호 암기",
        "프로그래밍 언어 번역",
        "컴퓨터 하드웨어 점검"
      ],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_q2",
      title: "2. 생각 다이어트 (추상화의 개념)",
      desc: "지하철 노선도처럼 복잡한 지리적 곡선이나 지형 정보는 과감히 생략하고, 역의 순서와 환승 정보 등 문제 해결에 '꼭 필요한 핵심 요소만 단순화'하는 과정을 무엇이라고 할까요?",
      options: [
        "모듈화",
        "추상화 (Abstraction)",
        "디지털화",
        "최적화"
      ],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_q3",
      title: "3. 불필요한 정보(노이즈) 제거",
      desc: "다음 중 '샌드위치 조리 로봇'을 만들기 위해 필요한 핵심 재료 정보가 아닌, 제거해야 할 불필요한 정보는 무엇일까요?",
      options: [
        "식빵 2장과 딸기잼의 양",
        "치즈와 슬라이스 햄의 유무",
        "도마의 색상과 주방 타일의 무늬",
        "전자레인지 데우는 시간 (30초)"
      ],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_q4",
      title: "4. 알고리즘의 정의",
      desc: "주어진 문제를 해결하기 위해 문제를 단계별 명령으로 나누고, 명확한 순서대로 나열한 절차나 명령어의 모임을 무엇이라고 할까요?",
      options: [
        "데이터베이스",
        "운영체제",
        "알고리즘 (Algorithm)",
        "컴파일러"
      ],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_q5",
      title: "5. 알고리즘의 조건 - 명확성",
      desc: "컴퓨터에게 명령을 내릴 때 지켜야 할 조건 중, 명령어의 뜻이 모호하거나 주관적이지 않고 '누가 읽어도 단 하나의 동작으로 실행'되어야 한다는 조건은 무엇일까요?",
      options: [
        "명확성 (Definiteness)",
        "유한성 (Finiteness)",
        "수행가능성 (Effectiveness)",
        "입력 (Input)"
      ],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_q6",
      title: "6. 알고리즘의 조건 - 유한성",
      desc: "명령어가 끝없이 반복되어 컴퓨터가 멈추지 않는 무한 루프를 방지하고, '반드시 일정한 단계 후에 스스로 끝나야 한다'는 조건은 무엇일까요?",
      options: [
        "명확성",
        "유한성 (Finiteness)",
        "입력의 다양성",
        "출력의 화려함"
      ],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_q7",
      title: "7. 알고리즘의 조건 - 수행가능성",
      desc: "제시된 모든 명령어는 컴퓨터나 실행 주체가 '실제로 물리적/논리적으로 실행할 수 있어야 한다'는 조건은 무엇일까요?",
      options: [
        "수행가능성 (Effectiveness)",
        "보안성",
        "확장성",
        "심미성"
      ],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_q8",
      title: "8. 순서도 4대 기호 - 단말 🟣",
      desc: "순서도 기호 중 양 끝이 둥근 타원형(⬭) 기호로, 알고리즘의 '시작'과 '끝'을 나타내는 기호의 이름은 무엇일까요?",
      options: [
        "처리 기호",
        "판단 기호",
        "단말 기호",
        "자료 기호"
      ],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_q9",
      title: "9. 순서도 4대 기호 - 자료(입출력) 🟢",
      desc: "순서도 기호 중 평행사변형(▱) 기호로, 센서 값 측정, 키보드 입력, 화면 출력 등 '데이터의 입력과 출력'을 나타내는 기호의 이름은 무엇일까요?",
      options: [
        "단말 기호",
        "자료(입출력) 기호",
        "처리 기호",
        "반복 기호"
      ],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_q10",
      title: "10. 순서도 4대 기호 - 처리 🔵",
      desc: "순서도 기호 중 직사각형(▭) 기호로, 사칙연산, 값 계산, 모터 구동 등 '실제 연산이나 동작을 수행'하는 기호의 이름은 무엇일까요?",
      options: [
        "판단 기호",
        "자료 기호",
        "단말 기호",
        "처리 기호"
      ],
      correctAnswer: 3,
      points: 3
    }
  ],

  // Part 2. 주관식 단답형 5문항 (각 6점, 총 30점) - 객관식과 중복 없는 핵심 용어
  part2: [
    {
      id: "p2_q1",
      title: "1. 알고리즘의 3대 제어 구조 (기본)",
      desc: "명령어가 위에서 아래로 한 줄씩 순서대로 차례차례 실행되는 가장 기본적인 알고리즘 구조의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["순차", "순차구조", "순차 구조"],
      points: 6
    },
    {
      id: "p2_q2",
      title: "2. 조건에 따른 두 갈래 길",
      desc: "주어진 조건이 참(Yes)인지 거짓(No)인지에 따라 서로 다른 명령을 선택하여 실행하는 제어 구조의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["선택", "선택구조", "선택 구조", "조건문"],
      points: 6
    },
    {
      id: "p2_q3",
      title: "3. 되풀이 실행 제어 구조",
      desc: "특정 조건을 만족하는 동안 정해진 명령 블록을 계속해서 되풀이하여 실행하는 제어 구조(루프)의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["반복", "반복구조", "반복 구조", "루프"],
      points: 6
    },
    {
      id: "p2_q4",
      title: "4. 순서도 4대 기호 중 마름모 기호",
      desc: "순서도에서 조건을 검사하여 '예'와 '아니오'로 두 갈래의 분기선을 만들어내는 마름모꼴(◇) 기호의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 기호",
      answers: ["판단", "판단기호", "판단 기호", "조건"],
      points: 6
    },
    {
      id: "p2_q5",
      title: "5. 변하는 데이터 보관함",
      desc: "프로그래밍과 알고리즘에서 온도, 점수, 나이처럼 실행 과정에서 계속 변하는 값을 임시로 저장해두는 기억 공간을 무엇이라고 부를까요? (단답형)",
      placeholder: "두 글자 용어",
      answers: ["변수"],
      points: 6
    }
  ],

  // Part 3. 순서도 조립 실전 (40점) - 4가지 프리셋 자연어 알고리즘 테마
  part3Themes: [
    {
      id: "theme_greenhouse",
      title: "🌡️ [선택 구조] 스마트 온실 자동 환기 시스템",
      structure: "선택 구조 (Selection)",
      summary: "기온 센서로부터 현재 온도를 측정하여 28℃ 초과 시 창문을 열고, 그렇지 않으면 창문을 닫는 환경 제어 시스템",
      difficulty: "중2 표준",
      steps: [
        "1단계: 온실 온도 센서로부터 현재 기온 입력 (▱)",
        "2단계: 현재 기온이 28℃를 초과하는지 판단 (◇)",
        "3단계 [Yes 분기]: 환기 창문을 열고 송풍팬 가동 (▭)",
        "4단계 [No 분기]: 환기 창문을 닫고 보온 유지 (▭)",
        "5단계: 합류 후 종료 단말로 이동 (⬭)"
      ],
      requiredCheck: { minBlocks: 5, hasDecision: true, hasIO: true, hasProcess: true }
    },
    {
      id: "theme_password",
      title: "🔒 [반복 구조] 비밀번호 3회 검증 및 보안 잠금 시스템",
      structure: "반복 + 선택 구조 (Loop & Decision)",
      summary: "비밀번호를 입력받아 일치 여부를 검사하고, 3회 연속 불일치 시 시스템을 긴급 잠금하는 보안 알고리즘",
      difficulty: "중2 심화",
      steps: [
        "1단계: 실패 카운트 = 0 초기화 (▭)",
        "2단계: 사용자로부터 4자리 비밀번호 입력 (▱)",
        "3단계: 입력한 비밀번호가 올바른지 판단 (◇)",
        "4단계 [Yes]: 출입문 잠금 해제 안내 출력 후 종료 (▭, ⬭)",
        "5단계 [No]: 실패 횟수 1 증가 ➔ 실패 횟수 >= 3 판단 (◇)",
        "6단계: 3회 미만이면 2단계로 루프백(되돌아가기), 3회 이상이면 경보 울림 후 종료 (▭, ⬭)"
      ],
      requiredCheck: { minBlocks: 6, hasDecision: true, hasIO: true, hasProcess: true, hasLoop: true }
    },
    {
      id: "theme_transit",
      title: "🚌 [선택 구조] 지하철 청소년 할인 요금 판별기",
      structure: "선택 구조 (Selection)",
      summary: "탑승객의 나이를 입력받아 만 13세~18세 청소년인지 판단 후 할인 요금(720원) 또는 일반 요금(1400원)을 차감하는 자동 개찰구",
      difficulty: "중2 표준",
      steps: [
        "1단계: 교통카드로부터 탑승객 나이와 카드 잔액 입력 (▱)",
        "2단계: 나이가 13세 이상 18세 이하인지 조건 판단 (◇)",
        "3단계 [Yes 분기]: 청소년 요금 720원 차감 연산 (▭)",
        "4단계 [No 분기]: 일반 요금 1,400원 차감 연산 (▭)",
        "5단계: 합류 후 잔액 출력 및 개찰구 통과 처리 (▱, ⬭)"
      ],
      requiredCheck: { minBlocks: 5, hasDecision: true, hasIO: true, hasProcess: true }
    },
    {
      id: "theme_updown",
      title: "🎯 [반복 구조] 숫자 맞히기 업앤다운 (Up & Down)",
      structure: "반복 + 선택 구조 (Loop & Decision)",
      summary: "비밀 숫자 7을 맞힐 때까지 사용자가 숫자를 계속 추측 입력하는 게임 알고리즘 (맞히면 축하 후 종료, 틀리면 반복)",
      difficulty: "중2 심화",
      steps: [
        "1단계: 컴퓨터의 비밀 정답 숫자 = 7 설정 (▭)",
        "2단계: 사용자로부터 추측할 숫자 입력 (▱)",
        "3단계: 추측 숫자 == 정답(7) 일치 여부 판단 (◇)",
        "4단계 [Yes]: '정답입니다! 축하합니다' 출력 후 종료 (▱, ⬭)",
        "5단계 [No]: '틀렸습니다' 안내 후 다시 2단계(입력)로 루프백 (▭, 🔄)"
      ],
      requiredCheck: { minBlocks: 5, hasDecision: true, hasIO: true, hasProcess: true, hasLoop: true }
    }
  ]
};

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
        blocks: [], // 학생이 직접 조립한 블록 목록
        connections: [],
        isVerified: false
      }
    };

    this.scores = { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null };

    // 순서도 캔버스 블록 ID 카운터
    this.blockIdCounter = 1;
  }

  // 1. 대기실 열기 (풀페이지 전환)
  openLobby() {
    if (typeof switchUnit === 'function') {
      switchUnit('eval');
    }
    this.showScreen('lobby');
  }

  // 풀페이지 내부 서브 화면 전환 (lobby | exam | result)
  showScreen(screenName) {
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
    this.studentNum = numInp ? parseInt(numInp.value, 10) : 1;
    this.studentName = nameInp ? nameInp.value.trim() : "";

    if (!this.studentName) {
      alert("⚠️ 이름을 입력해 주세요!");
      if (nameInp) nameInp.focus();
      return;
    }

    if (isNaN(this.studentNum) || this.studentNum < 1 || this.studentNum > 27) {
      alert("⚠️ 번호는 1번부터 27번 사이로 입력해 주세요!");
      if (numInp) numInp.focus();
      return;
    }

    // 서버/세션에 대기실 입장 등록
    if (window.evalService) {
      await window.evalService.joinWaitingRoom(this.currentClass, this.studentNum, this.studentName);
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

    // 세션 실시간 리스너 구독 시작 (선생님이 [시작] 누르면 0.5초 내 감지)
    if (window.evalService) {
      window.evalService.listenSession(this.currentClass, (sessionData) => {
        if (sessionData && sessionData.status === 'in_progress') {
          this.startExam(sessionData);
        }
      });
    }
  }

  // 3. 시험장 진입 및 타이머 가동
  startExam(sessionData) {
    if (this.sessionStatus === 'in_progress') return;
    this.sessionStatus = 'in_progress';
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

    this.renderTimer();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.renderTimer();
      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert("⏰ 30분 시험 시간이 만료되었습니다! 답안이 자동으로 제출됩니다.");
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
  }

  // 문항 DOM 렌더링 (Part 1 10문항, Part 2 5단답형)
  renderPartQuestions() {
    // Part 1. 객관식 10문항
    const p1Box = document.getElementById('eval-part1-list');
    if (p1Box) {
      p1Box.innerHTML = EVAL_QUESTIONS.part1.map((q, idx) => `
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">${q.title}</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${q.desc}</p>
          <div class="space-y-2 pt-1">
            ${q.options.map((opt, optIdx) => `
              <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition text-xs sm:text-sm font-medium">
                <input type="radio" name="${q.id}" value="${optIdx}" onchange="window.studentEvalApp.onSelectPart1('${q.id}', ${optIdx})" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Part 2. 주관식 단답형 5문항
    const p2Box = document.getElementById('eval-part2-list');
    if (p2Box) {
      p2Box.innerHTML = EVAL_QUESTIONS.part2.map((q, idx) => `
        <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black px-3 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">${q.title}</span>
            <span class="text-xs font-black text-slate-400 font-mono">${q.points}점</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${q.desc}</p>
          <div class="flex items-center gap-2 max-w-md">
            <input type="text" id="${q.id}_input" oninput="window.studentEvalApp.onInputPart2('${q.id}', this.value)" class="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-800" placeholder="${q.placeholder}">
            <span class="text-xs font-bold text-slate-400">단답형</span>
          </div>
        </div>
      `).join('');
    }
  }

  onSelectPart1(qId, val) {
    this.answers.part1[qId] = val;
    this.syncStudentProgress();
  }

  onInputPart2(qId, val) {
    this.answers.part2[qId] = val;
    this.syncStudentProgress();
  }

  // ============================================================================
  // 📐 Part 3. 순서도 나만의 백지 조립 캔버스 시스템
  // ============================================================================

  initPart3Canvas() {
    // 4가지 테마 선택 탭 렌더링
    const themeSelectBox = document.getElementById('eval-part3-theme-selector');
    if (themeSelectBox) {
      themeSelectBox.innerHTML = EVAL_QUESTIONS.part3Themes.map(t => `
        <button type="button" onclick="window.studentEvalApp.selectPart3Theme('${t.id}')" id="btn-theme-${t.id}" class="p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${t.id === this.answers.part3.selectedThemeId ? 'bg-indigo-50 border-indigo-400 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}">
          <div class="text-xs font-black text-slate-900 truncate">${t.title}</div>
          <div class="text-[11px] text-slate-500 flex items-center justify-between">
            <span class="font-bold text-indigo-700">${t.structure}</span>
            <span class="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] font-mono">${t.difficulty}</span>
          </div>
        </button>
      `).join('');
    }

    this.selectPart3Theme(this.answers.part3.selectedThemeId || "theme_greenhouse");
  }

  // 테마 선택 시 레시피 및 캔버스 리셋
  selectPart3Theme(themeId) {
    this.answers.part3.selectedThemeId = themeId;
    this.answers.part3.isVerified = false; // 테마 변경 시 채점 리셋!

    // 테마 버튼 하이라이트
    EVAL_QUESTIONS.part3Themes.forEach(t => {
      const btn = document.getElementById(`btn-theme-${t.id}`);
      if (btn) {
        if (t.id === themeId) {
          btn.className = "p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer bg-indigo-50 border-indigo-500 shadow-xs";
        } else {
          btn.className = "p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer bg-white border-slate-200 hover:bg-slate-50";
        }
      }
    });

    const theme = EVAL_QUESTIONS.part3Themes.find(t => t.id === themeId);
    if (!theme) return;

    // 좌측 자연어 단계별 레시피 렌더링
    const recipeList = document.getElementById('eval-part3-recipe-list');
    const themeSummary = document.getElementById('eval-part3-theme-summary');
    if (themeSummary) themeSummary.textContent = theme.summary;
    if (recipeList) {
      recipeList.innerHTML = theme.steps.map(step => `
        <li class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 flex items-start gap-2">
          <span class="text-indigo-600 font-mono">▶</span>
          <span>${step}</span>
        </li>
      `).join('');
    }

    // 캔버스 초기화: 초기에는 [시작] 단말 기호 하나만 놓여 있는 '진짜 백지' 상태!
    this.answers.part3.blocks = [
      { id: "b_start", type: "terminal", label: "시작", x: 180, y: 30 }
    ];
    this.blockIdCounter = 1;
    this.renderPart3Canvas();
    this.updatePart3ScoreBadge(0);
  }

  // 블록 추가 (팔레트에서 클릭 시 캔버스에 추가)
  addPart3Block(type) {
    const id = `b_${this.blockIdCounter++}`;
    let label = "명령어 입력";
    let defaultY = 40 + (this.answers.part3.blocks.length * 75);

    if (type === 'terminal') label = "끝";
    if (type === 'io') label = "데이터 입력/출력";
    if (type === 'process') label = "동작 및 연산 처리";
    if (type === 'decision') label = "조건 판단 (Yes/No)";

    this.answers.part3.blocks.push({
      id: id,
      type: type,
      label: label,
      x: 180,
      y: defaultY
    });

    this.answers.part3.isVerified = false; // 변경되면 재검사 필요
    this.updatePart3ScoreBadge(0);
    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 블록 순서 위/아래 이동
  movePart3Block(id, direction) {
    const idx = this.answers.part3.blocks.findIndex(b => b.id === id);
    if (idx <= 0 && direction === 'up') return; // 시작 블록(0번) 위로는 이동 불가
    if (idx === 0) return; // 시작 블록 자체는 이동 불가
    if (idx >= this.answers.part3.blocks.length - 1 && direction === 'down') return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx === 0) return; // 시작 블록 자리로는 이동 불가

    const temp = this.answers.part3.blocks[idx];
    this.answers.part3.blocks[idx] = this.answers.part3.blocks[targetIdx];
    this.answers.part3.blocks[targetIdx] = temp;

    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 블록 삭제
  deletePart3Block(id) {
    if (id === 'b_start') {
      alert("시작 단말 기호는 삭제할 수 없습니다.");
      return;
    }
    this.answers.part3.blocks = this.answers.part3.blocks.filter(b => b.id !== id);
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Canvas();
    this.syncStudentProgress();
  }

  // 블록 텍스트 수정
  editPart3BlockLabel(id, newText) {
    const b = this.answers.part3.blocks.find(item => item.id === id);
    if (b) {
      b.label = newText;
      this.answers.part3.isVerified = false;
      this.updatePart3ScoreBadge(0);
    }
  }

  // 캔버스 렌더링
  renderPart3Canvas() {
    const stage = document.getElementById('eval-part3-stage');
    if (!stage) return;

    if (this.answers.part3.blocks.length === 0) {
      stage.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-bold">좌측 팔레트에서 기호를 추가하여 순서도를 조립하세요.</div>`;
      return;
    }

    let html = `
      <div class="flex flex-col items-center space-y-3 py-4">
    `;

    const totalBlocks = this.answers.part3.blocks.length;

    this.answers.part3.blocks.forEach((b, idx) => {
      let colorClass = "bg-violet-600 text-white rounded-full px-6 py-2.5 font-black text-xs shadow-md";
      let icon = "🟣";

      if (b.type === 'io') {
        colorClass = "bg-emerald-600 text-white rounded-lg px-6 py-2.5 font-black text-xs shadow-md skew-x-[-8deg]";
        icon = "🟢";
      } else if (b.type === 'decision') {
        colorClass = "bg-amber-500 text-white rounded-xl px-7 py-3 font-black text-xs shadow-md border-2 border-amber-300";
        icon = "🟠";
      } else if (b.type === 'process') {
        colorClass = "bg-blue-600 text-white rounded-lg px-6 py-2.5 font-black text-xs shadow-md";
        icon = "🔵";
      }

      const isStartBlock = (b.id === 'b_start');
      const canMoveUp = (!isStartBlock && idx > 1);
      const canMoveDown = (!isStartBlock && idx < totalBlocks - 1);

      html += `
        <div class="relative group flex items-center gap-1.5">
          <div class="${colorClass} flex items-center gap-2 cursor-pointer transition hover:brightness-110">
            <span>${icon}</span>
            <input type="text" value="${b.label}" onchange="window.studentEvalApp.editPart3BlockLabel('${b.id}', this.value)" class="bg-transparent border-b border-white/30 text-white font-bold text-center focus:outline-none focus:border-white w-40 sm:w-56 text-xs">
          </div>
          ${!isStartBlock ? `
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
              <button type="button" onclick="window.studentEvalApp.movePart3Block('${b.id}', 'up')" class="w-6 h-6 rounded-lg ${canMoveUp ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} flex items-center justify-center text-[10px] font-black transition" title="위로 이동">▲</button>
              <button type="button" onclick="window.studentEvalApp.movePart3Block('${b.id}', 'down')" class="w-6 h-6 rounded-lg ${canMoveDown ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} flex items-center justify-center text-[10px] font-black transition" title="아래로 이동">▼</button>
              <button type="button" onclick="window.studentEvalApp.deletePart3Block('${b.id}')" class="w-6 h-6 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center justify-center text-[10px] font-black transition cursor-pointer" title="블록 삭제">✕</button>
            </div>
          ` : `
            <span class="text-[10px] text-slate-400 font-bold px-1.5 py-0.5 bg-slate-100 rounded">고정</span>
          `}
        </div>
      `;

      if (idx < totalBlocks - 1) {
        html += `
          <div class="text-slate-400 text-xs font-bold font-mono">▼</div>
        `;
      }
    });

    html += `</div>`;
    stage.innerHTML = html;
  }

  // [ 🧪 순서도 자동 검사 및 채점 ] 버튼 클릭
  verifyPart3Flowchart() {
    const blocks = this.answers.part3.blocks;
    const theme = EVAL_QUESTIONS.part3Themes.find(t => t.id === this.answers.part3.selectedThemeId);
    const minRequired = theme?.requiredCheck?.minBlocks || 4;

    // 1. 최소 블록 개수 검사
    if (blocks.length < minRequired) {
      alert(`⚠️ 순서도 블록이 부족합니다!\n[${theme.title}] 레시피를 완성하려면 최소 ${minRequired}개 이상의 기호 블록이 필요합니다. (현재: ${blocks.length}개)`);
      this.updatePart3ScoreBadge(0);
      return;
    }

    // 2. 단말 기호(시작, 끝) 검사
    const terminals = blocks.filter(b => b.type === 'terminal');
    if (terminals.length < 2) {
      alert("⚠️ 순서도에는 반드시 '시작' 단말과 마지막 '끝' 단말 기호(🟣)가 각각 온전히 배치되어야 합니다.");
      this.updatePart3ScoreBadge(10);
      return;
    }

    // 마지막 블록이 단말 기호인지 검사
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock.type !== 'terminal') {
      alert("⚠️ 순서도의 맨 마지막 기호는 알고리즘 종료를 나타내는 '끝 단말 기호(🟣)'이어야 합니다.");
      this.updatePart3ScoreBadge(15);
      return;
    }

    // 3. 판단 기호(◇) 검사
    const hasDecision = blocks.some(b => b.type === 'decision');
    if (!hasDecision) {
      alert("⚠️ 선택/반복 구조 구현을 위한 '판단 기호(🟠 마름모)'가 누락되었습니다!\n조건에 따라 참/거짓으로 분기하는 판단 기호를 팔레트에서 추가하세요.");
      this.updatePart3ScoreBadge(20);
      return;
    }

    // 4. 입출력 및 처리 기호 검사
    const hasIO = blocks.some(b => b.type === 'io');
    const hasProcess = blocks.some(b => b.type === 'process');
    if (!hasIO) {
      alert("⚠️ 센서 측정값이나 사용자 입력을 받는 '자료 입출력 기호(🟢 평행사변형)'가 누락되었습니다.");
      this.updatePart3ScoreBadge(25);
      return;
    }
    if (!hasProcess) {
      alert("⚠️ 동작을 실행하거나 값을 연산하는 '처리 기호(🔵 직사각형)'가 누락되었습니다.");
      this.updatePart3ScoreBadge(25);
      return;
    }

    // 5. 블록 텍스트 기본값 방치 검사 (성실도 검사)
    const hasUneditedPlaceholder = blocks.some(b => 
      b.id !== 'b_start' && (b.label === "명령어 입력" || b.label.trim() === "")
    );
    if (hasUneditedPlaceholder) {
      alert("⚠️ 기호 블록 안에 '명령어 입력' 문구가 그대로 남아있습니다!\n블록을 클릭하여 선택한 레시피에 맞는 구체적인 명령어나 조건으로 수정해 주세요.");
      this.updatePart3ScoreBadge(30);
      return;
    }

    // 모든 조건 합격! 40점 만점 부여
    this.answers.part3.isVerified = true;
    this.updatePart3ScoreBadge(40);
    alert(`🎉 완벽합니다! [${theme.title}]의 4대 기호 표준 준수, 판단 기호 분기, 단말 기호 수렴 및 논리적 완결성 검증을 100% 통과했습니다! (40점 만점 획득)`);
  }

  updatePart3ScoreBadge(score) {
    const badge = document.getElementById('eval-part3-score-badge');
    if (badge) {
      if (score >= 40) {
        badge.innerHTML = `<span class="text-emerald-700 font-black flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> 검증 통과: 40 / 40점 획득!</span>`;
        badge.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-200 flex items-center gap-2";
      } else {
        badge.innerHTML = `<span class="text-slate-500 font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-info"></i> 검사 대기중: ${score} / 40점</span>`;
        badge.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 border border-slate-200 flex items-center gap-2";
      }
    }
  }

  // 실시간 진행도 백그라운드 동기화
  syncStudentProgress() {
    const p1Count = Object.keys(this.answers.part1).length;
    const p2Count = Object.keys(this.answers.part2).length;
    const p3Done = this.answers.part3.isVerified ? 1 : 0;

    if (window.evalService) {
      window.evalService.updateStudentProgress(this.currentClass, this.studentNum, {
        part1: p1Count,
        part2: p2Count,
        part3: p3Done
      });
    }
  }

  // 4. 100% 완전 자동 채점 계산
  calculateScores() {
    // Part 1. 객관식 10문항 채점 (총 30점)
    let p1Score = 0;
    EVAL_QUESTIONS.part1.forEach(q => {
      if (this.answers.part1[q.id] === q.correctAnswer) {
        p1Score += q.points;
      }
    });

    // Part 2. 주관식 단답형 5문항 채점 (총 30점)
    let p2Score = 0;
    let p2FeedbackArr = [];
    EVAL_QUESTIONS.part2.forEach(q => {
      const userRaw = (this.answers.part2[q.id] || "").trim().toLowerCase().replace(/\s+/g, '');
      const isCorrect = q.answers.some(ans => ans.toLowerCase().replace(/\s+/g, '') === userRaw);

      if (isCorrect) {
        p2Score += q.points;
        p2FeedbackArr.push(`${q.title}: 정답 (+${q.points}점)`);
      } else {
        p2FeedbackArr.push(`${q.title}: 오답 (0점)`);
      }
    });

    // Part 3. 순서도 조립 채점 (총 40점)
    // 검사 버튼을 눌러 isVerified가 true인 경우에만 40점, 아니면 0점!
    const p3Score = this.answers.part3.isVerified ? 40 : 0;

    const total = p1Score + p2Score + p3Score;
    this.scores = {
      part1: p1Score,
      part2: p2Score,
      part3: p3Score,
      total: total,
      teacherOverride: null
    };

    return {
      scores: this.scores,
      feedback: {
        part2: p2FeedbackArr.join(" | "),
        part3: this.answers.part3.isVerified ? "4대 기호 조립 및 판단 분기 검증 완료 (40점)" : "순서도 미완성 또는 검사 미실행 (0점)"
      }
    };
  }

  // 5. 최종 제출 처리
  async submitExam(isAuto = false) {
    if (this.isSubmitted) return;
    if (!isAuto && !confirm("정말로 수행평가 답안을 최종 제출하시겠습니까?\n제출 후에는 답안을 수정할 수 없습니다.")) {
      return;
    }

    this.isSubmitted = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    // 자동 채점 실행
    const gradeResult = this.calculateScores();

    // 서버로 최종 제출 전송
    if (window.evalService) {
      await window.evalService.submitStudentExam(this.currentClass, this.studentNum, {
        answers: this.answers,
        scores: gradeResult.scores,
        feedback: gradeResult.feedback
      });
    }

    // 결과 화면 렌더링
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
            <div class="text-xs font-bold text-amber-800">Part 2. 단답형 (5문항)</div>
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
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (typeof switchUnit === 'function') {
      switchUnit('roadmap');
    }
  }
}

window.studentEvalApp = new StudentEvalApp();
