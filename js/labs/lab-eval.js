/**
 * ==============================================================================
 * 📝 [학생용 30분 실시간 수행평가 엔진 및 자동 채점기 (lab-eval.js)]
 * ==============================================================================
 * - 대상: 중학교 2학년 정보과 '알고리즘과 프로그래밍'
 * - 화면 모드: 풀페이지 전체 화면 (view-eval)
 * - 3단 문항 구성 (총점 100점 만점):
 *   * Part 1. 객관식 10문항 (30점 / 각 3점 / 핵심 개념 이해)
 *   * Part 2. 단답형 6문항 (30점 / 각 5점 / 알고리즘 핵심 용어)
 *   * Part 3. 순서도 나만의 백지 조립 실전 (40점 / 4대 표준 테마 선택 후 캔버스 직접 조립)
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

  // Part 2. 단답형 6문항 (각 5점, 총 30점) - 핵심 알고리즘 개념과 제어 구조
  part2: [
    {
      id: "p2_q1",
      title: "1. 알고리즘의 3대 제어 구조 (순서 실행)",
      desc: "명령어가 위에서 아래로 한 줄씩 순서대로 차례차례 실행되는 가장 기본적인 알고리즘 구조의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["순차", "순차구조", "순차 구조"],
      points: 5
    },
    {
      id: "p2_q2",
      title: "2. 조건에 따른 두 갈래 길 (갈림길 실행)",
      desc: "주어진 조건이 참(Yes)인지 거짓(No)인지에 따라 서로 다른 명령을 선택하여 실행하는 제어 구조의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["선택", "선택구조", "선택 구조", "조건문"],
      points: 5
    },
    {
      id: "p2_q3",
      title: "3. 되풀이 실행 제어 구조 (되돌아 실행)",
      desc: "특정 조건을 만족하는 동안 정해진 명령 블록을 계속해서 되풀이하여 실행하는 제어 구조(루프)의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 구조",
      answers: ["반복", "반복구조", "반복 구조", "루프"],
      points: 5
    },
    {
      id: "p2_q4",
      title: "4. 순서도 4대 기호 중 마름모 기호",
      desc: "순서도에서 조건을 검사하여 '예'와 '아니오'로 두 갈래의 분기선을 만들어내는 마름모꼴(◇) 기호의 이름은 무엇일까요? (단답형)",
      placeholder: "예: OO 기호",
      answers: ["판단", "판단기호", "판단 기호", "조건", "조건기호"],
      points: 5
    },
    {
      id: "p2_q5",
      title: "5. 변하는 데이터 보관함",
      desc: "프로그래밍과 알고리즘에서 온도, 점수, 나이처럼 실행 과정에서 계속 변하는 값을 임시로 저장해두는 기억 공간을 무엇이라고 부를까요? (단답형)",
      placeholder: "두 글자 용어",
      answers: ["변수"],
      points: 5
    },
    {
      id: "p2_q6",
      title: "6. 알고리즘의 오류 찾기와 수정",
      desc: "작성한 알고리즘이나 프로그램이 의도대로 동작하지 않을 때, 잘못된 원인을 찾아 바르게 고치는 과정을 무엇이라고 할까요? (단답형)",
      placeholder: "예: OO 수정 또는 영어 용어",
      answers: ["오류수정", "오류 수정", "디버깅", "디버그", "오류찾기와수정", "오류 찾기와 수정"],
      points: 5
    }
  ],

  // Part 3. 순서도 나만의 백지 조립 실전 (40점) - 난이도 균일 4대 표준 자연어 알고리즘 테마
  part3Themes: [
    {
      id: "theme_greenhouse",
      title: "🌡️ 스마트 온실 자동 환기 제어",
      structure: "선택 구조 (Selection)",
      summary: "온도 센서로부터 온도를 입력받아 28℃ 초과 시 창문을 열고, 그렇지 않으면 창문을 닫는 제어 시스템",
      difficulty: "중2 표준 (난이도 균일)",
      cards: [
        { type: "seq", title: "1단계: 현재 기온 측정", desc: "온실 온도 센서로부터 현재 기온을 입력받는다." },
        { type: "sel", title: "2단계: 28℃ 초과 판단", desc: "현재 기온이 28℃를 초과하는지 조건을 판단한다.", yesAction: "환기 창문을 열고 팬을 돌린다.", noAction: "환기 창문을 닫고 보온한다." },
        { type: "seq", title: "3단계: 창문 동작 실행", desc: "판단 결과에 따라 알맞은 창문 제어 동작을 실행한다." },
        { type: "seq", title: "4단계: 제어 완료", desc: "온도 조절 제어를 마치고 종료한다." }
      ],
      steps: [
        "1단계: 온실 온도 센서로부터 현재 기온 입력 (▱ 자료 기호)",
        "2단계: 현재 기온이 28℃를 초과하는지 조건 판단 (◇ 판단 기호)",
        "3단계 [Yes 분기]: 환기 창문을 열고 팬 가동 (▭ 처리 기호)",
        "4단계 [No 분기]: 환기 창문을 닫고 보온 유지 (▭ 처리 기호)",
        "5단계: 합류 후 종료 단말로 이동 (⬭ 단말 기호)"
      ]
    },
    {
      id: "theme_vending",
      title: "🥤 스마트 음료수 자동판매기",
      structure: "선택 구조 (Selection)",
      summary: "동전 투입구로부터 투입 금액을 입력받아 1,000원 이상이면 음료수를 배출하고, 부족하면 안내하는 시스템",
      difficulty: "중2 표준 (난이도 균일)",
      cards: [
        { type: "seq", title: "1단계: 투입 금액 입력", desc: "동전 투입구로부터 투입 금액을 입력받는다." },
        { type: "sel", title: "2단계: 1,000원 이상 판단", desc: "투입 금액이 1,000원 이상인지 조건을 판단한다.", yesAction: "시원한 캔 음료수를 배출한다.", noAction: "화면에 잔액 부족을 안내한다." },
        { type: "seq", title: "3단계: 판매 동작 실행", desc: "판단 결과에 맞게 음료 배출 또는 안내 메시지를 출력한다." },
        { type: "seq", title: "4단계: 판매 완료", desc: "자판기 판매 절차를 마치고 종료한다." }
      ],
      steps: [
        "1단계: 동전 투입구로부터 투입 금액 입력 (▱ 자료 기호)",
        "2단계: 투입 금액이 1,000원 이상인지 조건 판단 (◇ 판단 기호)",
        "3단계 [Yes 분기]: 시원한 캔 음료수 배출 (▭ 처리 기호)",
        "4단계 [No 분기]: 화면에 '잔액 부족' 메시지 출력 (▭ 처리 기호)",
        "5단계: 합류 후 종료 단말로 이동 (⬭ 단말 기호)"
      ]
    },
    {
      id: "theme_transit",
      title: "🚌 지하철 청소년 할인 요금 판별기",
      structure: "선택 구조 (Selection)",
      summary: "탑승객의 나이를 입력받아 만 13세~18세 청소년이면 할인 요금(720원), 아니면 일반 요금(1,400원)을 차감하는 개찰구",
      difficulty: "중2 표준 (난이도 균일)",
      cards: [
        { type: "seq", title: "1단계: 탑승객 나이 입력", desc: "교통카드 단말기로부터 탑승객 나이를 입력받는다." },
        { type: "sel", title: "2단계: 청소년(13~18세) 판단", desc: "나이가 13세 이상 18세 이하인지 조건을 판단한다.", yesAction: "청소년 할인 요금 720원을 차감한다.", noAction: "일반 성인 요금 1,400원을 차감한다." },
        { type: "seq", title: "3단계: 요금 차감 실행", desc: "판단 결과에 따른 버스/지하철 요금을 결제한다." },
        { type: "seq", title: "4단계: 개찰구 통과 완료", desc: "개찰구 게이트를 열고 탑승 절차를 완료한다." }
      ],
      steps: [
        "1단계: 교통카드 단말기로부터 탑승객 나이 입력 (▱ 자료 기호)",
        "2단계: 나이가 13세 이상 18세 이하인지 조건 판단 (◇ 판단 기호)",
        "3단계 [Yes 분기]: 청소년 할인 요금 720원 차감 (▭ 처리 기호)",
        "4단계 [No 분기]: 일반 성인 요금 1,400원 차감 (▭ 처리 기호)",
        "5단계: 합류 후 종료 단말로 이동 (⬭ 단말 기호)"
      ]
    },
    {
      id: "theme_traffic",
      title: "🚦 스마트 횡단보도 보행자 신호등",
      structure: "선택 구조 (Selection)",
      summary: "보행자 호출 버튼 입력을 감지하고 대기 시간 경과 여부를 판단하여 초록불을 켜거나 빨간불을 유지하는 제어기",
      difficulty: "중2 표준 (난이도 균일)",
      cards: [
        { type: "seq", title: "1단계: 보행자 버튼 감지", desc: "횡단보도 보행자 호출 버튼 신호를 입력받는다." },
        { type: "sel", title: "2단계: 대기 시간(30초) 판단", desc: "차량 통행 대기 시간 30초가 지났는지 판단한다.", yesAction: "보행자 신호등을 초록불로 바꾼다.", noAction: "차량 통행을 위해 빨간불을 유지한다." },
        { type: "seq", title: "3단계: 신호등 점등 제어", desc: "판단 결과에 맞게 신호등 램프를 전환한다." },
        { type: "seq", title: "4단계: 신호 제어 완료", desc: "보행자 횡단 주기를 마치고 종료한다." }
      ],
      steps: [
        "1단계: 횡단보도 보행자 호출 버튼 신호 입력 (▱ 자료 기호)",
        "2단계: 차량 통행 대기 시간 30초 경과 판단 (◇ 판단 기호)",
        "3단계 [Yes 분기]: 보행자 신호등 초록불 켜기 (▭ 처리 기호)",
        "4단계 [No 분기]: 차량 통행을 위해 빨간불 유지 (▭ 처리 기호)",
        "5단계: 합류 후 종료 단말로 이동 (⬭ 단말 기호)"
      ]
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

    // 1) 전체 학급 세션 리스너 구독 (선생님이 [30분 동시 시작] 누를 시 시험장 진입)
    if (window.evalService && !this.sessionUnsub) {
      this.sessionUnsub = window.evalService.listenSession(this.currentClass, (sessionData) => {
        if (sessionData && sessionData.status === 'in_progress' && !this.isSubmitted) {
          this.startExam(sessionData);
        }
      });
    }

    // 2) 학생 개별 상태 리스너 구독 (교사의 재시험 허용 실시간 감지 및 시험장 자동 복귀)
    if (window.evalService && !this.studentUnsub) {
      this.studentUnsub = window.evalService.listenStudent(this.currentClass, this.studentNum, (stData) => {
        if (stData && stData.status === 'in_progress' && this.isSubmitted) {
          alert("🔔 선생님께서 재시험을 허용하셨습니다!\n답안이 초기화되며 시험 화면으로 복귀합니다.");
          this.isSubmitted = false;
          this.sessionStatus = 'waiting';
          this.answers.part1 = {};
          this.answers.part2 = {};
          this.answers.part3.blocks = [];
          this.answers.part3.connections = [];
          this.answers.part3.isVerified = false;
          this.scores = { part1: 0, part2: 0, part3: 0, total: 0, teacherOverride: null };

          this.startExam();
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

    if (partName === 'part3') {
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
            <input type="text" id="${q.id}_input" value="${this.answers.part2[q.id] || ''}" oninput="window.studentEvalApp.onInputPart2('${q.id}', this.value)" class="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-800" placeholder="${q.placeholder}">
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
  // 📐 Part 3. 순서도 나만의 백지 공방 풀 이식 캔버스 시스템
  // ============================================================================

  initPart3Canvas() {
    // 1. 4가지 균등 난이도 테마 선택기 렌더링
    const themeSelectBox = document.getElementById('eval-part3-theme-selector');
    if (themeSelectBox) {
      themeSelectBox.innerHTML = EVAL_QUESTIONS.part3Themes.map(t => `
        <button type="button" onclick="window.studentEvalApp.selectPart3Theme('${t.id}')" id="eval-btn-theme-${t.id}" class="p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${t.id === this.answers.part3.selectedThemeId ? 'bg-indigo-50 border-indigo-500 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}">
          <div class="text-xs font-black text-slate-900 truncate">${t.title}</div>
          <div class="text-[11px] text-slate-500 flex items-center justify-between">
            <span class="font-bold text-indigo-700">${t.structure}</span>
            <span class="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] font-mono">${t.difficulty}</span>
          </div>
        </button>
      `).join('');
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
            b.x = Math.max(10, Math.min(rect.width - 210, e.clientX - rect.left - this.dragOffset.x));
            b.y = Math.max(10, Math.min(rect.height - 80, e.clientY - rect.top - this.dragOffset.y));

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
    this.answers.part3.selectedThemeId = themeId;
    this.answers.part3.isVerified = false;

    // 테마 버튼 하이라이트
    EVAL_QUESTIONS.part3Themes.forEach(t => {
      const btn = document.getElementById(`eval-btn-theme-${t.id}`);
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

    // 좌측 1단 패널: Step 5와 동일한 자연어 카드 리스트 렌더링
    const recipeList = document.getElementById('eval-part3-recipe-list');
    if (recipeList) {
      recipeList.innerHTML = theme.cards.map((c, idx) => {
        if (c.type === 'seq') {
          return `
            <div class="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
              <div class="flex items-center gap-1.5 text-xs font-black text-blue-800">
                <span class="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[10px]">${idx + 1}</span>
                <span>${c.title}</span>
              </div>
              <p class="text-[11px] font-bold text-slate-700 leading-tight pl-5">${c.desc}</p>
            </div>
          `;
        } else if (c.type === 'sel') {
          return `
            <div class="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-black text-amber-800">
                <span class="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center text-[10px]">${idx + 1}</span>
                <span>${c.title}</span>
              </div>
              <div class="text-[11px] font-bold text-amber-950 bg-white/80 p-1.5 rounded-lg border border-amber-200 leading-tight">
                🤔 ${c.desc}
              </div>
              <div class="grid grid-cols-2 gap-1 text-[10px] font-bold">
                <div class="p-1 rounded bg-emerald-100/70 text-emerald-900 leading-tight">
                  <span class="text-emerald-700 font-black">[예]</span> ${c.yesAction || '동작 실행'}
                </div>
                <div class="p-1 rounded bg-rose-100/70 text-rose-900 leading-tight">
                  <span class="text-rose-700 font-black">[아니오]</span> ${c.noAction || '동작 실행'}
                </div>
              </div>
            </div>
          `;
        }
      }).join('');
    }

    // 캔버스 초기화: [시작] 단말 기호 하나만 기본 배치
    this.answers.part3.blocks = [
      { id: "eblk_start", shape: "terminal", type: "terminal", text: "시작", x: 220, y: 30 }
    ];
    this.answers.part3.connections = [];
    this.blockIdCounter = 1;

    this.renderPart3Canvas();
    this.updatePart3ScoreBadge(0);
  }

  // 기호 보관함에서 클릭 시 블록 추가
  addPart3Block(shapeType) {
    const id = `eblk_${this.blockIdCounter++}`;
    const defaultLabels = {
      terminal: "종료",
      io: "기온 센서값 입력",
      decision: "온도가 28℃ 초과인가?",
      process: "환기 창문 열기"
    };

    // 추가할 Y좌표 계산
    const lastY = this.answers.part3.blocks.reduce((max, b) => Math.max(max, b.y), 30);
    const newY = Math.min(380, lastY + 80);
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
    const b = this.answers.part3.blocks.find(x => x.id === blockId);
    if (b) {
      b.text = text.trim() || "내용 입력";
      this.answers.part3.isVerified = false;
      this.updatePart3ScoreBadge(0);
      this.renderPart3Connections();
    }
  }

  // 블록 드래그 시작
  handlePart3BlockMouseDown(blockId, e) {
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
    e.stopPropagation();
    this.isConnecting = true;
    this.connectionSource = { blockId, portType };
  }

  // 포트 연결 완료
  handlePart3PortMouseUp(targetBlockId, targetPortType) {
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
    this.answers.part3.connections = this.answers.part3.connections.filter(c => c.id !== connId);
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Connections();
    this.syncStudentProgress();
  }

  // 블록 및 캔버스 전체 DOM 렌더링
  renderPart3Canvas() {
    const stage = document.getElementById('eval-part3-stage');
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
               onblur="window.studentEvalApp.handlePart3BlockText('${b.id}', this.innerText)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${b.text}</div>
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
               onblur="window.studentEvalApp.handlePart3BlockText('${b.id}', this.innerText)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${b.text}</div>
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
    const height = isDecision ? 120 : 64;

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
    let curY = 30;
    this.answers.part3.blocks.forEach(b => {
      const isDecision = (b.shape === 'decision');
      b.x = isDecision ? 200 : 220;
      b.y = curY;
      curY += isDecision ? 130 : 85;
    });

    this.renderPart3Canvas();
  }

  // 비우기
  clearPart3Canvas() {
    if (!confirm("캔버스의 모든 블록과 연결선을 비우시겠습니까?")) return;
    this.answers.part3.blocks = [
      { id: "eblk_start", shape: "terminal", type: "terminal", text: "시작", x: 220, y: 30 }
    ];
    this.answers.part3.connections = [];
    this.answers.part3.isVerified = false;
    this.updatePart3ScoreBadge(0);
    this.renderPart3Canvas();
  }

  // [ 🧪 순서도 완성 검사 및 40점 획득 ]
  verifyPart3Flowchart() {
    const blocks = this.answers.part3.blocks;
    const conns = this.answers.part3.connections;
    const theme = EVAL_QUESTIONS.part3Themes.find(t => t.id === this.answers.part3.selectedThemeId);

    // 1. 최소 블록 개수 검사
    if (blocks.length < 5) {
      alert(`⚠️ 순서도 블록이 부족합니다!\n[${theme.title}]를 완성하려면 최소 5개 이상의 블록이 필요합니다. (현재: ${blocks.length}개)`);
      this.updatePart3ScoreBadge(0);
      return;
    }

    // 2. 단말 기호(시작, 끝) 검사
    const terminals = blocks.filter(b => b.shape === 'terminal');
    const hasEnd = terminals.some(b => b.text.includes('종료') || b.text.includes('끝'));
    if (terminals.length < 2 || !hasEnd) {
      alert("⚠️ 순서도에는 반드시 '시작' 단말과 마지막 '종료' 단말 기호(🟣)가 각각 배치되어야 합니다.");
      this.updatePart3ScoreBadge(10);
      return;
    }

    // 3. 판단 기호(◇) 검사
    const hasDecision = blocks.some(b => b.shape === 'decision');
    if (!hasDecision) {
      alert("⚠️ 조건에 따라 두 갈래로 나뉘는 '판단 기호(🟠 마름모)'가 누락되었습니다!\n팔레트에서 판단 기호를 추가해 보세요.");
      this.updatePart3ScoreBadge(15);
      return;
    }

    // 4. 입출력 및 처리 기호 검사
    const hasIO = blocks.some(b => b.shape === 'io');
    const hasProcess = blocks.some(b => b.shape === 'process');
    if (!hasIO) {
      alert("⚠️ 센서값이나 사용자 입력을 받는 '자료 입출력 기호(🟢 평행사변형)'가 필요합니다.");
      this.updatePart3ScoreBadge(20);
      return;
    }
    if (!hasProcess) {
      alert("⚠️ 동작을 실행하거나 값을 제어하는 '처리 기호(🔵 직사각형)'가 필요합니다.");
      this.updatePart3ScoreBadge(20);
      return;
    }

    // 5. 연결선(화살표) 흐름 검사
    if (conns.length < 4) {
      alert(`⚠️ 기호 간 연결선(화살표)이 부족합니다!\n알고리즘 흐름이 이어지도록 파란색 점을 드래그해 최소 4개 이상의 연결선을 만들어 주세요. (현재: ${conns.length}개)`);
      this.updatePart3ScoreBadge(25);
      return;
    }

    // 6. 판단 기호의 예/아니오 분기선 검사
    const decisionBlock = blocks.find(b => b.shape === 'decision');
    const decisionConns = conns.filter(c => c.from === decisionBlock.id);
    if (decisionConns.length < 2) {
      alert("⚠️ 판단 기호(◇)에서는 조건의 '예'와 '아니오'에 따른 두 갈래 분기 화살표가 각각 나와야 합니다.");
      this.updatePart3ScoreBadge(30);
      return;
    }

    // 7. 블록 기본 텍스트 방치 여부 (성실도)
    const hasPlaceholder = blocks.some(b => b.id !== 'eblk_start' && (b.text === "내용 입력" || b.text.trim() === ""));
    if (hasPlaceholder) {
      alert("⚠️ 블록에 '내용 입력' 기본 문구가 남아있습니다!\n블록을 클릭하여 선택한 레시피에 맞게 내용을 구체적으로 적어주세요.");
      this.updatePart3ScoreBadge(35);
      return;
    }

    // 모든 조건 통과! 40점 만점 부여!
    this.answers.part3.isVerified = true;
    this.updatePart3ScoreBadge(40);
    alert(`🎉 완벽합니다!\n[${theme.title}]의 4대 기호 표준 준수, 판단 기호 분기선 연결, 알고리즘 논리적 완결성 검증을 100% 통과했습니다!\n(Part 3 순서도 조립 40점 만점 획득)`);
  }

  updatePart3ScoreBadge(score) {
    const badge = document.getElementById('eval-part3-score-badge');
    if (badge) {
      if (score >= 40) {
        badge.innerHTML = `<span class="text-emerald-700 font-black flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> 검증 완료: 40 / 40점 획득!</span>`;
        badge.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 flex items-center gap-2 shadow-2xs";
      } else {
        badge.innerHTML = `<span class="text-slate-500 font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-info"></i> 검사 대기: ${score} / 40점</span>`;
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

  // 4. 100% 완전 자동 채점 계산 (총점 100점)
  calculateScores() {
    // Part 1. 객관식 10문항 채점 (총 30점 / 각 3점)
    let p1Score = 0;
    EVAL_QUESTIONS.part1.forEach(q => {
      if (this.answers.part1[q.id] === q.correctAnswer) {
        p1Score += q.points;
      }
    });

    // Part 2. 단답형 6문항 채점 (총 30점 / 각 5점)
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
    if (!isAuto && !confirm("정말로 수행평가 답안을 최종 제출하시겠습니까?\n제출 후에는 교사의 재시험 승인이 있어야 답안을 다시 작성할 수 있습니다.")) {
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
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (typeof switchUnit === 'function') {
      switchUnit('roadmap');
    }
  }
}

window.studentEvalApp = new StudentEvalApp();
