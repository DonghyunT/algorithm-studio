/**
 * ==============================================================================
 * 📝 [단원별 개념 쏙쏙 퀴즈 엔진 (중학교 2학년 정보 교과 맞춤)]
 * ==============================================================================
 * - 추상화, 알고리즘 설계, 순서도 각 단원별 3~4문항의 흥미로운 퀴즈 제공
 * - 정답/오답 즉시 해설 및 인터랙티브 피드백
 * - 퀴즈 통과 시 실전 실습실로의 자연스러운 연동 지원
 */

const UNIT_QUIZ_DATA = {
  abstraction: {
    title: "💡 문제 추상화 쏙쏙 퀴즈",
    desc: "문제의 핵심만 쏙 뽑아내는 추상화 개념을 확인해 보세요!",
    questions: [
      {
        id: 1,
        q: "화가 몬드리안의 나무 그림이나 지하철 노선도처럼, 복잡하고 불필요한 세부 사항은 덜어내고 꼭 필요한 핵심만 남기는 과정을 무엇이라고 할까요?",
        options: [
          { text: "① 알고리즘 인코딩", correct: false },
          { text: "② 추상화", correct: true },
          { text: "③ 알고리즘 분류", correct: false },
          { text: "④ 완전 탐색", correct: false }
        ],
        explanation: "정답은 ②번입니다! '추상화'는 복잡한 문제에서 불필요한 정보는 버리고, 문제 해결에 꼭 필요한 핵심 요소(특징)만 뽑아내는 생각의 다이어트 기법입니다."
      },
      {
        id: 2,
        q: "문제 상황을 분석할 때 '문제가 발생하기 전의 원래 상태'를 [초기 상태]라고 합니다. 그렇다면 '문제가 완전히 해결된 바라는 최종 모습'을 무엇이라고 할까요?",
        options: [
          { text: "① 제약 조건", correct: false },
          { text: "② 현재 상태", correct: false },
          { text: "③ 목표 상태", correct: true },
          { text: "④ 중간 상태", correct: false }
        ],
        explanation: "정답은 ③번입니다! 문제 해결은 [현재 상태]에서 제약 [조건]을 지키며 [목표 상태]에 도달하는 과정입니다."
      },
      {
        id: 3,
        q: "거대하고 복잡한 문제를 한 번에 해결하기 어려울 때, 작고 다루기 쉬운 여러 개의 작은 하위 문제로 쪼개어 해결하는 방법을 무엇이라고 할까요?",
        options: [
          { text: "① 문제 분해", correct: true },
          { text: "② 무한 반복", correct: false },
          { text: "③ 자료 은닉", correct: false },
          { text: "④ 강제 실행", correct: false }
        ],
        explanation: "정답은 ①번입니다! 복잡한 문제를 작은 단위로 쪼개어 하나씩 해결하는 기법을 '문제 분해'라고 합니다."
      },
      {
        id: 4,
        q: "복잡한 문제에서 문제 해결과 직접적인 관련이 없는 불필요한 정보(노이즈)를 덜어내고, 꼭 필요한 핵심 데이터나 기준만 남기는 것을 무엇이라고 할까요?",
        options: [
          { text: "① 핵심 요소 추출", correct: true },
          { text: "② 무조건 외우기", correct: false },
          { text: "③ 무작위 대입", correct: false },
          { text: "④ 프로그램 복사", correct: false }
        ],
        explanation: "정답은 ①번입니다! 문제 해결에 꼭 필요한 핵심 데이터와 기준만 뽑아내는 과정을 '핵심 요소 추출(생각 다이어트)'이라고 합니다."
      }
    ]
  },

  algorithm: {
    title: "🤖 알고리즘 설계 쏙쏙 퀴즈",
    desc: "컴퓨터에게 일을 시키기 위한 완벽한 레시피와 5대 조건을 점검해 보세요!",
    questions: [
      {
        id: 1,
        q: "컴퓨터에게 내리는 명령어는 '적당히 빵을 굽는다'처럼 애매하면 안 되고, 누구나 똑같이 이해할 수 있도록 명확해야 합니다. 이 알고리즘 조건을 무엇이라고 할까요?",
        options: [
          { text: "① 유한성", correct: false },
          { text: "② 명확성", correct: true },
          { text: "③ 입력", correct: false },
          { text: "④ 최적성", correct: false }
        ],
        explanation: "정답은 ②번입니다! '명확성'은 알고리즘의 각 단계가 모호하지 않고 명확하게 정의되어야 한다는 조건입니다."
      },
      {
        id: 2,
        q: "알고리즘은 명령을 계속 수행하다가 언젠가는 반드시 끝나야(종료되어야) 합니다. 영원히 멈추지 않는 무한 루프에 빠지면 안 된다는 이 조건은?",
        options: [
          { text: "① 유한성", correct: true },
          { text: "② 수행 가능성", correct: false },
          { text: "③ 다중성", correct: false },
          { text: "④ 출력성", correct: false }
        ],
        explanation: "정답은 ①번입니다! '유한성'은 한정된 횟수의 단계를 거친 후 반드시 작업이 끝나야 한다는 조건입니다."
      },
      {
        id: 3,
        q: "알고리즘의 모든 명령어는 컴퓨터나 사람이 실제로 실행할 수 있어야 한다는 조건을 무엇이라고 할까요?",
        options: [
          { text: "① 수행 가능성", correct: true },
          { text: "② 무한 반복성", correct: false },
          { text: "③ 다중 선택성", correct: false },
          { text: "④ 불확실성", correct: false }
        ],
        explanation: "정답은 ①번입니다! '수행 가능성'은 주어진 명령어가 현실적으로 실행 가능한 동작이어야 한다는 조건입니다."
      },
      {
        id: 4,
        q: "라면 끓이기처럼 명령어를 위에서 아래로 차례대로 하나씩 실행하는 알고리즘의 가장 기본적인 제어 구조는 무엇일까요?",
        options: [
          { text: "① 선택 구조", correct: false },
          { text: "② 순차 구조", correct: true },
          { text: "③ 반복 구조", correct: false },
          { text: "④ 분기 구조", correct: false }
        ],
        explanation: "정답은 ②번입니다! '순차 구조'는 정해진 순서대로 하나씩 차례차례 명령을 실행하는 가장 기본적인 흐름입니다."
      }
    ]
  },

  flowchart: {
    title: "📐 순서도 기호 쏙쏙 퀴즈",
    desc: "알고리즘 표현의 기초가 되는 4대 순서도 표준 기호를 확인해 보세요!",
    questions: [
      {
        id: 1,
        q: "순서도에서 알고리즘의 [시작]과 [끝(종료)]을 나타내는 둥근 타원(모서리가 둥근 사각형) 기호의 이름은 무엇일까요?",
        options: [
          { text: "① 단말 ⬭", correct: true },
          { text: "② 판단 ◇", correct: false },
          { text: "③ 처리 ▭", correct: false },
          { text: "④ 입출력 ▱", correct: false }
        ],
        explanation: "정답은 ①번입니다! '단말' 기호는 순서도의 가장 첫 시작과 최종 종료를 알리는 기호입니다."
      },
      {
        id: 2,
        q: "'현재 기온을 입력받는다' 또는 '추천 옷차림을 화면에 출력한다'처럼 데이터를 입력받거나 결과를 출력할 때 사용하는 평행사변형 기호는?",
        options: [
          { text: "① 처리 ▭", correct: false },
          { text: "② 입출력 ▱", correct: true },
          { text: "③ 판단 ◇", correct: false },
          { text: "④ 단말 ⬭", correct: false }
        ],
        explanation: "정답은 ②번입니다! '입출력' 기호는 외부에서 자료를 받거나 처리된 결과를 보여줄 때 사용하는 평행사변형 모양입니다."
      },
      {
        id: 3,
        q: "'기온이 4℃ 이하인가?'처럼 조건을 따져서 [예(참)] 또는 [아니오(거짓)]의 두 갈래 길로 나눌 때 사용하는 마름모 모양의 기호는?",
        options: [
          { text: "① 단말 ⬭", correct: false },
          { text: "② 처리 ▭", correct: false },
          { text: "③ 판단 ◇", correct: true },
          { text: "④ 입출력 ▱", correct: false }
        ],
        explanation: "정답은 ③번입니다! '판단' 기호는 마름모 모양으로, 조건의 참/거짓에 따라 실행 흐름을 나눌 때(선택 구조) 사용합니다."
      },
      {
        id: 4,
        q: "순서도에서 명령이나 계산, 데이터 가공 등의 구체적인 동작 처리를 나타내는 직사각형 모양의 기호는 무엇일까요?",
        options: [
          { text: "① 처리 ▭", correct: true },
          { text: "② 단말 ⬭", correct: false },
          { text: "③ 판단 ◇", correct: false },
          { text: "④ 입출력 ▱", correct: false }
        ],
        explanation: "정답은 ①번입니다! 직사각형 모양의 '처리' 기호는 명령을 실행하거나 계산을 수행하는 구체적인 동작을 나타냅니다."
      }
    ]
  }
};

let userQuizAnswers = {
  abstraction: {},
  algorithm: {},
  flowchart: {}
};

/**
 * 퀴즈 화면 렌더링 (와이드 대시보드 & 단원별 히어로 배너 & 일관된 UI)
 */
const UNIT_QUIZ_THEMES = {
  abstraction: {
    gradient: "from-slate-900 via-indigo-950 to-slate-900",
    border: "border-indigo-900/50",
    badgeBg: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    badgeText: "💡 1단원: 문제 추상화 쏙쏙 퀴즈",
    title: "생각 다이어트의 핵심 원리를 점검하는 쏙쏙 퀴즈!",
    quoteHighlight: "생각 다이어트",
    desc: "문제 상황 4요소 분석, 핵심 요소 추출, 문제 분해 개념을 한눈에 점검하고 실전 실습실로 전진해 보세요."
  },
  algorithm: {
    gradient: "from-slate-900 via-amber-950 to-slate-900",
    border: "border-amber-900/50",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    badgeText: "🤖 2단원: 알고리즘 설계 쏙쏙 퀴즈",
    title: "컴퓨터에게 내리는 가장 완벽한 명령어 레시피 점검!",
    quoteHighlight: "명령어 레시피",
    desc: "입력, 출력, 명확성, 유한성, 수행가능성의 알고리즘 5대 조건과 3대 제어 구조의 원리를 테스트해 보세요."
  },
  flowchart: {
    gradient: "from-slate-900 via-emerald-950 to-slate-900",
    border: "border-emerald-900/50",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    badgeText: "📐 3단원: 순서도 연구소 쏙쏙 퀴즈",
    title: "4대 표준 기호와 엔트리 블록 매핑을 확인하는 순서도 퀴즈!",
    quoteHighlight: "순서도 4대 기호",
    desc: "단말(시작/끝), 자료(입출력), 처리(명령동작), 판단(조건분기) 기호의 표준 쓰임새와 흐름선 규칙을 점검해 보세요."
  }
};

function renderUnitQuiz(unitKey) {
  const container = document.getElementById(`quiz-container-${unitKey}`);
  if (!container) return;

  const quiz = UNIT_QUIZ_DATA[unitKey];
  if (!quiz) return;

  const theme = UNIT_QUIZ_THEMES[unitKey] || UNIT_QUIZ_THEMES.abstraction;
  const totalAnswered = Object.keys(userQuizAnswers[unitKey]).length;
  const correctCount = Object.values(userQuizAnswers[unitKey]).filter(a => a.isCorrect).length;
  const isAllDone = totalAnswered === quiz.questions.length && correctCount === quiz.questions.length;
  const progressPercent = Math.round((correctCount / quiz.questions.length) * 100);

  let html = `
    <!-- 단원별 퀴즈 히어로 배너 (개념관과 100% UI 통일) -->
    <div class="bg-gradient-to-br ${theme.gradient} rounded-3xl p-6 sm:p-8 text-white border ${theme.border} shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="space-y-2 max-w-2xl">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${theme.badgeBg} text-xs font-black">
          ${theme.badgeText}
        </span>
        <h2 class="text-xl sm:text-2xl font-black text-white leading-snug">
          ${theme.title}
        </h2>
        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
          ${theme.desc}
        </p>
      </div>

      <!-- 우측 성취도 스코어보드 카드 -->
      <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 text-center min-w-[220px] w-full sm:w-auto shadow-sm">
        <div class="text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1">
          <i class="fa-solid fa-bullseye text-amber-400"></i>
          <span>퀴즈 달성률</span>
        </div>
        <div class="text-2xl sm:text-3xl font-black text-white my-1">
          <span class="text-emerald-400">${correctCount}</span> <span class="text-slate-400 text-lg">/ ${quiz.questions.length}</span>
        </div>
        <div class="w-full bg-white/20 h-2 rounded-full overflow-hidden mt-2">
          <div class="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
        </div>
        <p class="text-[10px] text-slate-300 mt-2 font-medium">
          ${isAllDone ? '🎉 모든 문제를 맞혔습니다!' : `${quiz.questions.length - correctCount}문제 남음`}
        </p>
      </div>
    </div>

    <!-- 와이드 2열 문제 대시보드 카드 그리드 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
  `;

  quiz.questions.forEach((q, idx) => {
    const answered = userQuizAnswers[unitKey][q.id];
    const cardBorder = answered 
      ? (answered.isCorrect ? 'border-emerald-300 bg-emerald-50/40' : 'border-rose-300 bg-rose-50/40') 
      : 'border-slate-200 bg-white hover:border-indigo-200';

    html += `
      <div class="p-6 rounded-3xl border-2 ${cardBorder} flex flex-col justify-between gap-4 transition shadow-xs">
        <div>
          <div class="flex items-start gap-3 mb-4">
            <span class="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">${idx + 1}</span>
            <h4 class="font-black text-sm sm:text-base text-slate-900 leading-snug">${q.q}</h4>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    `;

    q.options.forEach((opt, optIdx) => {
      const isSelected = answered && answered.choiceIdx === optIdx;
      let btnClass = "p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm text-left font-bold transition border ";
      if (isSelected) {
        btnClass += opt.correct 
          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
          : "bg-rose-600 text-white border-rose-600 shadow-xs";
      } else {
        btnClass += "bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 border-slate-200 shadow-2xs hover:shadow-xs";
      }

      html += `
        <button onclick="handleQuizAnswer('${unitKey}', ${q.id}, ${optIdx}, ${opt.correct})" class="${btnClass}">
          ${opt.text}
        </button>
      `;
    });

    html += `</div></div>`;

    if (answered) {
      html += `
        <div class="pt-2 border-t border-slate-200/70">
          <div class="p-3 rounded-xl text-xs ${answered.isCorrect ? 'bg-emerald-100/80 text-emerald-950 border border-emerald-200' : 'bg-rose-100/80 text-rose-950 border border-rose-200'} leading-relaxed font-medium">
            <span class="font-bold mr-1.5">${answered.isCorrect ? '🎉 정답입니다!' : '🤔 다시 생각해 볼까요?'}</span>
            <span>${q.explanation}</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
  });

  html += `
    </div>

    <!-- 하단 원스톱 네비게이션 액션 바 -->
    <div class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="text-xs sm:text-sm text-slate-600 font-bold flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${isAllDone ? 'bg-emerald-500' : 'bg-indigo-500'}"></span>
        <span>현재 맞힌 문제: <strong class="text-indigo-600 text-base font-black">${correctCount}</strong> / ${quiz.questions.length} 문제</span>
      </div>
      <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        <button onclick="switchUnitStep('${unitKey}', 'concept')" class="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer">
          👈 1. 핵심 개념 복습
        </button>
        <button onclick="switchUnitStep('${unitKey}', 'lab')" class="px-6 py-2.5 rounded-xl ${isAllDone ? 'btn-3d bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30' : 'btn-3d bg-indigo-600 hover:bg-indigo-700 text-white'} font-black text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer">
          <span>${isAllDone ? '🎉 퀴즈 올패스! 3. 실전 실습실로 이동 👉' : '3. 실전 실습실로 이동 👉'}</span>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * 퀴즈 정답 선택 핸들러
 */
function handleQuizAnswer(unitKey, questionId, choiceIdx, isCorrect) {
  userQuizAnswers[unitKey][questionId] = {
    choiceIdx,
    isCorrect
  };

  if (typeof playSfx === 'function') {
    playSfx(isCorrect ? 'correct' : 'wrong');
  }

  renderUnitQuiz(unitKey);
}

// 전역 노출
window.renderUnitQuiz = renderUnitQuiz;
window.handleQuizAnswer = handleQuizAnswer;
