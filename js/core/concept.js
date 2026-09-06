/**
 * ==============================================================================
 * 📚 [정보 알고리즘 스튜디오 단원별 독립 개념 학습실 인터랙션 엔진]
 * ==============================================================================
 * - 3대 단원(추상화 / 알고리즘 설계 / 순서도 연구소) 1:1 완전 격리 렌더링
 * - 생각 다이어트 노이즈 버리기 미니 게임 & 지하철 노선도 토글
 * - 샌드위치 로봇 명확성(Definiteness) & 유한성(Finiteness) 실험기
 * - 순서도 4대 표준 기호 ➔ 엔트리 블록 매핑 쇼룸 & 3대 제어구조 라이트 플로우 시뮬레이터
 */

let activeConceptUnit = 'unit1';

/**
 * 1. 단원별 독립 개념관 전환 함수
 */
function selectConceptUnit(unitId) {
  activeConceptUnit = unitId;

  const unit1Panel = document.getElementById('concept-unit1');
  const unit2Panel = document.getElementById('concept-unit2');
  const unit3Panel = document.getElementById('concept-unit3');

  if (unit1Panel) unit1Panel.classList.toggle('hidden', unitId !== 'unit1');
  if (unit2Panel) unit2Panel.classList.toggle('hidden', unitId !== 'unit2');
  if (unit3Panel) unit3Panel.classList.toggle('hidden', unitId !== 'unit3');

  // 단원별 상단 3단계 헤더 뱃지 및 제목 동기화
  const titleEl = document.getElementById('concept-header-title');
  const badgeEl = document.getElementById('concept-header-badge');
  const iconEl = document.getElementById('concept-header-icon');

  if (unitId === 'unit1') {
    if (titleEl) titleEl.textContent = "문제 추상화";
    if (badgeEl) badgeEl.textContent = "1. 핵심 개념";
    if (iconEl) iconEl.textContent = "💡";
  } else if (unitId === 'unit2') {
    if (titleEl) titleEl.textContent = "알고리즘 설계";
    if (badgeEl) badgeEl.textContent = "1. 핵심 개념";
    if (iconEl) iconEl.textContent = "🤖";
  } else if (unitId === 'unit3') {
    if (titleEl) titleEl.textContent = "순서도 연구소";
    if (badgeEl) badgeEl.textContent = "1. 핵심 개념";
    if (iconEl) iconEl.textContent = "📐";
  }
}

// 레거시 호환 레이어
function selectConceptModule(modNum) {
  if (modNum === 1) selectConceptUnit('unit1');
  else if (modNum === 2) selectConceptUnit('unit2');
  else if (modNum === 3) selectConceptUnit('unit3');
  else selectConceptUnit('unit1');
}

/* ==============================================================================
 * 💡 [단원 1: 문제 추상화 인터랙션 로직]
 * ============================================================================== */

// 1. 상태 분석 4요소 상세 탭
function showStateDetail(type) {
  const box = document.getElementById('state-detail-box');
  const cards = ['init', 'curr', 'cond', 'goal'];
  cards.forEach(c => {
    const el = document.getElementById(`card-st-${c}`);
    if (!el) return;
    if (c === type) {
      el.className = "p-4 rounded-2xl border-2 border-violet-500 bg-violet-50/80 cursor-pointer transition text-center shadow-xs transform scale-[1.02]";
    } else {
      el.className = "p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition text-center";
    }
  });

  if (!box) return;
  if (type === 'init') {
    box.innerHTML = "🏁 <strong>[초기 상태]</strong>: 문제가 발생하기 전의 본래 상황입니다.<br><span class='text-slate-600'>• 예시: 아침 7시 30분, 침대에서 막 눈을 뜬 평온한 상태 (아직 지각 위기가 아님)</span>";
  } else if (type === 'curr') {
    box.innerHTML = "📍 <strong>[현재 상태]</strong>: 해결해야 할 문제가 발생한 현시점의 구체적인 상황입니다.<br><span class='text-slate-600'>• 예시: 현재 시각 8시 10분, 아직 집에 있고 학교까지 버스로 20분 걸리는 급박한 상태</span>";
  } else if (type === 'cond') {
    box.innerHTML = "📋 <strong>[조건/제약]</strong>: 문제를 해결하기 위해 반드시 지켜야 할 규칙이나 한계입니다.<br><span class='text-slate-600'>• 예시: 등교 시간은 8시 40분까지이며, 신호등을 준수하고 반드시 안전한 인도로만 통행할 것</span>";
  } else if (type === 'goal') {
    box.innerHTML = "🎯 <strong>[목표 상태]</strong>: 문제가 성공적으로 완전히 해결된 이상적인 최종 상태입니다.<br><span class='text-slate-600'>• 예시: 지각하지 않고 8시 35분까지 교실 내 내 자리에 안전하게 착석한 상태</span>";
  }
}

// 2. 생각 다이어트 (노이즈 버리기) 미니 체험
let discardedNoiseCount = 0;
function discardNoise(cardId, isNoise) {
  const card = document.getElementById(cardId);
  const msgBox = document.getElementById('noise-game-msg');
  if (!card) return;

  if (isNoise) {
    if (card.classList.contains('discarded')) return;
    card.classList.add('discarded');
    discardedNoiseCount++;
    if (typeof playSfx === 'function') playSfx('pop');

    if (msgBox) {
      msgBox.className = "p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs sm:text-sm font-bold text-violet-900";
      msgBox.innerHTML = `🗑️ <strong>노이즈 정보 버리기 성공!</strong> 문제 해결에 상관없는 군더더기 정보(세부사항)를 성공적으로 덜어냈습니다. (${discardedNoiseCount}/3)`;
    }

    if (discardedNoiseCount >= 3) {
      const clearBanner = document.getElementById('noise-game-clear');
      if (clearBanner) clearBanner.classList.remove('hidden');
      if (typeof playSfx === 'function') playSfx('complete');
    }
  } else {
    // 핵심 정보 클릭 시
    if (typeof playSfx === 'function') playSfx('btn');
    if (msgBox) {
      msgBox.className = "p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-bold text-emerald-900";
      msgBox.innerHTML = `✨ <strong>정답입니다!</strong> 이 정보는 문제 해결을 위해 절대로 버려선 안 되는 <strong>핵심 요소(시간/거리/목표)</strong>입니다.`;
    }
  }
}

function resetNoiseGame() {
  discardedNoiseCount = 0;
  for (let i = 1; i <= 6; i++) {
    const c = document.getElementById(`noise-card-${i}`);
    if (c) c.classList.remove('discarded');
  }
  const clearBanner = document.getElementById('noise-game-clear');
  if (clearBanner) clearBanner.classList.add('hidden');
  const msgBox = document.getElementById('noise-game-msg');
  if (msgBox) {
    msgBox.className = "p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-600 font-medium";
    msgBox.innerHTML = "💡 문제를 해결하는 데 <strong>불필요한 세부 정보(노이즈)</strong> 카드를 클릭하여 밖으로 날려보세요!";
  }
}

// 3. 지하철 노선도 토글
let isMapAbstract = true;
function toggleMapMode() {
  const box = document.getElementById('map-demo-box');
  const btn = document.getElementById('btn-map-mode');
  const visual = document.getElementById('map-demo-visual');
  isMapAbstract = !isMapAbstract;

  if (isMapAbstract) {
    if (btn) {
      btn.textContent = "노선도 (추상화 모드 ON)";
      btn.className = "text-xs px-3.5 py-1.5 rounded-xl bg-violet-600 text-white font-bold transition shadow-xs";
    }
    if (box) {
      box.innerHTML = "🗺️ <strong>추상화된 지하철 노선도</strong>: 실제 땅의 굴곡, 도로의 굽은 각도, 지상 건물을 모두 과감히 지우고, 승객에게 꼭 필요한 <strong>역의 순서와 환승역 정보</strong>만 깔끔한 직선과 점으로 표현했습니다.";
    }
    if (visual) {
      visual.innerHTML = `
        <div class="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-violet-200 font-black text-xs text-violet-900">
          <span class="px-2.5 py-1 bg-violet-100 rounded-lg">● 시청역</span>
          <span class="text-violet-400 font-mono">─── [1호선] ───</span>
          <span class="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg">⯁ 종로3가 (환승)</span>
          <span class="text-violet-400 font-mono">─── [3호선] ───</span>
          <span class="px-2.5 py-1 bg-violet-100 rounded-lg">● 안국역</span>
        </div>
      `;
    }
  } else {
    if (btn) {
      btn.textContent = "실제 지형 지도 (비추상화 모드)";
      btn.className = "text-xs px-3.5 py-1.5 rounded-xl bg-slate-700 text-white font-bold transition";
    }
    if (box) {
      box.innerHTML = "🌍 <strong>실제 지형 지도</strong>: 산, 한강의 굽이치는 곡선, 복잡한 골목길, 건물 위치가 모두 포함되어 있어, 지하철 환승 경로만 빠르게 확인하기에는 눈이 피로하고 비효율적입니다.";
    }
    if (visual) {
      visual.innerHTML = `
        <div class="p-3 bg-slate-100 rounded-xl border border-slate-300 font-medium text-xs text-slate-600 leading-relaxed">
          ⛰️ 북한산 자락 ➔ 꼬불꼬불 세종대로 400m ➔ 한옥마을 지형 고도 45m ➔ 강변북로 곡선 도로망 혼잡... (너무 많은 정보!)
        </div>
      `;
    }
  }
}

// 4. 문제 분해 탭
function switchDecompTab(type) {
  const ramyeonBtn = document.getElementById('tab-decomp-ramyeon');
  const schoolBtn = document.getElementById('tab-decomp-school');
  const content = document.getElementById('decomp-tab-content');
  if (!content) return;

  if (type === 'ramyeon') {
    if (ramyeonBtn) ramyeonBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-violet-600 text-white shadow-xs";
    if (schoolBtn) schoolBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    content.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
        <div class="p-4 bg-violet-50/70 border border-violet-200 rounded-2xl space-y-1.5">
          <div class="font-black text-violet-950 flex items-center gap-1.5"><span>1단계</span> <span>물 끓이기</span></div>
          <p class="text-slate-600 text-xs">냄비에 물 550ml를 붓고 가스레인지 불을 켜서 팔팔 끓을 때까지 기다립니다.</p>
        </div>
        <div class="p-4 bg-violet-50/70 border border-violet-200 rounded-2xl space-y-1.5">
          <div class="font-black text-violet-950 flex items-center gap-1.5"><span>2단계</span> <span>면과 스프 넣기</span></div>
          <p class="text-slate-600 text-xs">물이 끓으면 라면 면발과 분말 스프, 건더기 스프를 조심스럽게 넣습니다.</p>
        </div>
        <div class="p-4 bg-violet-50/70 border border-violet-200 rounded-2xl space-y-1.5">
          <div class="font-black text-violet-950 flex items-center gap-1.5"><span>3단계</span> <span>4분간 익히기</span></div>
          <p class="text-slate-600 text-xs">면이 쫄깃해지도록 젓가락으로 저어주며 4분간 익힌 뒤 불을 끕니다.</p>
        </div>
      </div>
    `;
  } else {
    if (ramyeonBtn) ramyeonBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (schoolBtn) schoolBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-violet-600 text-white shadow-xs";
    content.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
        <div class="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
          <div class="font-black text-indigo-950 flex items-center gap-1.5"><span>1단계</span> <span>외출 준비</span></div>
          <p class="text-slate-600 text-xs">세수하고 교복을 입은 뒤, 가방에 교과서와 필기구를 챙깁니다.</p>
        </div>
        <div class="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
          <div class="font-black text-indigo-950 flex items-center gap-1.5"><span>2단계</span> <span>교통편 이동</span></div>
          <p class="text-slate-600 text-xs">버스 정류장으로 걸어가 8시 20분 마을버스를 타고 학교 앞 정류장으로 이동합니다.</p>
        </div>
        <div class="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
          <div class="font-black text-indigo-950 flex items-center gap-1.5"><span>3단계</span> <span>교실 입실</span></div>
          <p class="text-slate-600 text-xs">교문을 통과하여 2층 교실로 이동한 뒤 8시 35분까지 자기 자리에 앉습니다.</p>
        </div>
      </div>
    `;
  }
}

/* ==============================================================================
 * 🤖 [단원 2: 알고리즘 설계 인터랙션 로직]
 * ============================================================================== */

// 1. 알고리즘 5대 조건 램프 점등
const ALGO_5_CONDITIONS = {
  input: {
    title: "1. 입력 (Input)",
    badge: "0개 이상",
    desc: "외부에서 알고리즘으로 들어오는 자료입니다. 입력이 아예 없는 알고리즘(예: 'Hello'를 출력하는 프로그램)도 가능하므로 <strong>0개 이상</strong>이어야 합니다."
  },
  output: {
    title: "2. 출력 (Output)",
    badge: "1개 이상 필수",
    desc: "알고리즘을 수행한 결과물입니다. 문제를 해결했으면 반드시 눈에 보이는 결과가 나와야 하므로 <strong>최소 1개 이상의 출력</strong>이 필수입니다."
  },
  definite: {
    title: "3. 명확성 (Definiteness)",
    badge: "모호함 제로",
    desc: "모든 명령어는 누가 읽더라도 오해의 여지가 없이 <strong>명확하고 구체적</strong>이어야 합니다. 컴퓨터는 '적당히', '알아서'를 이해하지 못합니다."
  },
  finite: {
    title: "4. 유한성 (Finiteness)",
    badge: "반드시 종료",
    desc: "알고리즘은 일정한 수의 단계를 거친 후 <strong>반드시 종료</strong>되어야 합니다. 영원히 끝나지 않고 멈추지 않는 것은 알고리즘이 아닙니다."
  },
  feasible: {
    title: "5. 수행 가능성 (Feasibility)",
    badge: "실제 실행 가능",
    desc: "모든 명령은 현재의 컴퓨터나 인간이 <strong>실제로 실행할 수 있는 현실적인 동작</strong>이어야 합니다. (예: '순간이동하라'는 불가능)"
  }
};

function toggleLampCondition(key) {
  const meta = ALGO_5_CONDITIONS[key];
  if (!meta) return;

  ['input', 'output', 'definite', 'finite', 'feasible'].forEach(k => {
    const card = document.getElementById(`lamp-card-${k}`);
    if (!card) return;
    if (k === key) {
      card.className = "lamp-card active p-3 sm:p-4 rounded-2xl border-2 border-amber-400 bg-amber-50/90 text-center shadow-md";
      const icon = card.querySelector('.lamp-icon');
      if (icon) icon.className = "lamp-icon text-2xl sm:text-3xl mb-1 text-amber-500 lamp-glow";
    } else {
      card.className = "lamp-card p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center";
      const icon = card.querySelector('.lamp-icon');
      if (icon) icon.className = "lamp-icon text-2xl sm:text-3xl mb-1 text-slate-400";
    }
  });

  const detailBox = document.getElementById('lamp-detail-box');
  if (detailBox) {
    detailBox.innerHTML = `
      <div class="flex items-center gap-2 mb-1">
        <span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-xs">${meta.badge}</span>
        <h4 class="text-sm sm:text-base font-black text-amber-950">${meta.title}</h4>
      </div>
      <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">${meta.desc}</p>
    `;
  }
  if (typeof playSfx === 'function') playSfx('btn');
}

// 2. 샌드위치 로봇의 명확성(Definiteness) 실험기
function runRobotDefiniteness(mode) {
  const screen = document.getElementById('robot-screen');
  const btnVague = document.getElementById('btn-robot-vague');
  const btnClear = document.getElementById('btn-robot-clear');
  if (!screen) return;

  if (mode === 'vague') {
    if (btnVague) btnVague.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-rose-600 text-white shadow-xs";
    if (btnClear) btnClear.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (typeof playSfx === 'function') playSfx('wrong');

    screen.className = "p-4 sm:p-5 rounded-2xl bg-rose-950 text-rose-100 border-2 border-rose-500 space-y-2.5 font-mono";
    screen.innerHTML = `
      <div class="flex items-center justify-between text-xs border-b border-rose-800 pb-2">
        <span class="font-black text-rose-400">🤖 샌드위치 로봇 CPU: ERROR #404</span>
        <span class="text-rose-300 animate-pulse">● 명령 모호함 감지</span>
      </div>
      <div class="text-sm font-bold text-white">입력된 명령: "식빵에 잼 좀 발라줘"</div>
      <div class="text-xs text-rose-200 leading-relaxed">
        💥 <strong>[사고 발생!]</strong> 로봇이 딸기잼 병 뚜껑도 안 열고 유리병 통째로 식빵 위에 내리찍었습니다!<br>
        • 로봇의 불평: "어느 잼인지, 숟가락을 쓸지 손을 쓸지, 잼을 몇 스푼 바를지 아무것도 정해주지 않았잖아요!"
      </div>
    `;
  } else {
    if (btnVague) btnVague.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (btnClear) btnClear.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 text-white shadow-xs";
    if (typeof playSfx === 'function') playSfx('correct');

    screen.className = "p-4 sm:p-5 rounded-2xl bg-emerald-950 text-emerald-100 border-2 border-emerald-500 space-y-2.5 font-mono";
    screen.innerHTML = `
      <div class="flex items-center justify-between text-xs border-b border-emerald-800 pb-2">
        <span class="font-black text-emerald-400">🤖 샌드위치 로봇 CPU: SUCCESS 100%</span>
        <span class="text-emerald-300">● 완벽한 명령 인식</span>
      </div>
      <div class="text-sm font-bold text-white">입력된 명령: "버터나이프로 딸기잼 1스푼을 식빵 한 면에 골고루 펴 바른다"</div>
      <div class="text-xs text-emerald-200 leading-relaxed">
        🥪✨ <strong>[임무 완수!]</strong> 로봇이 정량의 딸기잼을 빵 표면에 얇고 고르게 펴 발랐습니다!<br>
        • 로봇의 감탄: "도구(버터나이프), 재료(딸기잼 1스푼), 동작(한 면에 골고루 펴 바름)이 너무나 명확합니다!"
      </div>
    `;
  }
}

// 3. 유한성(Finiteness) 시뮬레이터
function runFinitenessSim(mode) {
  const box = document.getElementById('finiteness-screen');
  const btnInf = document.getElementById('btn-finite-inf');
  const btnFin = document.getElementById('btn-finite-fin');
  if (!box) return;

  if (mode === 'infinite') {
    if (btnInf) btnInf.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-rose-600 text-white shadow-xs";
    if (btnFin) btnFin.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (typeof playSfx === 'function') playSfx('wrong');

    box.className = "p-4 sm:p-5 rounded-2xl bg-slate-900 text-slate-100 border-2 border-rose-500 space-y-2 font-mono";
    box.innerHTML = `
      <div class="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <span class="text-rose-400 font-black">🚨 무한루프(Infinite Loop) 발생!</span>
        <span class="text-rose-400 animate-ping">● 경고</span>
      </div>
      <div class="text-sm font-bold text-white">명령어: "물이 찰 때까지 컵에 물을 계속 부어라 (종료 조건 없음)"</div>
      <div class="text-xs text-rose-300 leading-relaxed">
        🌊 물이 100% 찼는데도 멈추라는 규칙이 없어 계속 붓다가 책상과 바닥이 물바다가 되었습니다.<br>
        • <strong>유한성 결여</strong>: 컴퓨터 프로그램이라면 렉이 걸려 화면이 멈추거나 먹통(Freezing)이 됩니다!
      </div>
    `;
  } else {
    if (btnInf) btnInf.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (btnFin) btnFin.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 text-white shadow-xs";
    if (typeof playSfx === 'function') playSfx('correct');

    box.className = "p-4 sm:p-5 rounded-2xl bg-slate-900 text-slate-100 border-2 border-emerald-500 space-y-2 font-mono";
    box.innerHTML = `
      <div class="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <span class="text-emerald-400 font-black">✨ 유한성 만족 (정상 종료)</span>
        <span class="text-emerald-300">● 종료 완료</span>
      </div>
      <div class="text-sm font-bold text-white">명령어: "물이 컵의 80%에 도달할 때까지 붓고, 도달하면 즉시 멈춰라"</div>
      <div class="text-xs text-emerald-300 leading-relaxed">
        🥛 물이 딱 알맞게 찰랑거리는 높이에서 정확히 급수를 멈췄습니다.<br>
        • <strong>유한성 합격</strong>: 유한한 횟수의 실행 후 안전하게 다음 단계로 넘어가거나 종료되었습니다.
      </div>
    `;
  }
}

/* ==============================================================================
 * 📐 [단원 3: 순서도 연구소 인터랙션 로직]
 * ============================================================================== */

// 1. 순서도 4대 표준 기호와 역할 매핑
const SYMBOL_ENTRY_MAP = {
  terminal: {
    shape: "⬭ 단말 (Oval)",
    entryBlock: "🟢 [시작/종료] 알고리즘의 시작과 끝",
    desc: "알고리즘의 가장 첫 시작과 최종 종료를 알리는 기호입니다. 프로그램이 어디서 시작하고 어디서 끝나는지 명확히 표시합니다."
  },
  io: {
    shape: "▱ 입출력 (Parallelogram)",
    entryBlock: "🟠 [입출력] 데이터 입력받기 / 결과 화면 출력",
    desc: "사용자로부터 데이터를 키보드로 입력받거나 화면에 처리 결과를 보여주는 기호입니다. (예: 현재 시각 확인, '탑승 가능' 안내 출력)"
  },
  process: {
    shape: "▭ 처리 (Rectangle)",
    entryBlock: "🟣 [명령/연산] 행동 수행 및 데이터 계산",
    desc: "계산, 변수 값 대입, 조리하기, 이동 등 컴퓨터가 수행해야 할 구체적인 동작이나 연산 명령을 나타냅니다. (예: 세수하기, 냄비에 물 붓기)"
  },
  decision: {
    shape: "◇ 판단 (Diamond)",
    entryBlock: "🔵 [조건/분기] 조건 검사 후 참(예) / 거짓(아니오) 분기",
    desc: "주어진 조건이 참(예)인지 거짓(아니오)인지 검사하여 실행 흐름을 두 갈래 길로 나누는 분기 기호입니다. (예: 현재 시각 <= 07:30?)"
  }
};

function showSymbolEntryDetail(type) {
  const meta = SYMBOL_ENTRY_MAP[type];
  if (!meta) return;

  ['terminal', 'io', 'process', 'decision'].forEach(t => {
    const card = document.getElementById(`sym-card-${t}`);
    if (!card) return;
    if (t === type) {
      card.className = "p-4 rounded-2xl border-2 border-indigo-500 bg-indigo-50/80 cursor-pointer transition text-center shadow-xs transform scale-[1.02]";
    } else {
      card.className = "p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition text-center";
    }
  });

  const detailBox = document.getElementById('symbol-entry-detail-box');
  if (detailBox) {
    detailBox.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2 mb-2">
        <span class="font-black text-slate-900 text-sm sm:text-base">${meta.shape}</span>
        <span class="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-800 font-mono text-xs font-bold">${meta.entryBlock}</span>
      </div>
      <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">${meta.desc}</p>
    `;
  }
  if (typeof playSfx === 'function') playSfx('btn');
}

// 2. 3대 제어 구조 (순차, 선택, 반복) 탭 및 플로우 시뮬레이터
let activeStructure = 'seq';
let isDecisionConditionTrue = true;

function switchStructureTab(type) {
  activeStructure = type;
  const btnSeq = document.getElementById('btn-struct-seq');
  const btnSel = document.getElementById('btn-struct-sel');
  const btnLoop = document.getElementById('btn-struct-loop');
  const diagram = document.getElementById('struct-diagram-view');
  if (!diagram) return;

  if (btnSeq) btnSeq.className = (type === 'seq') ? "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black bg-blue-600 text-white shadow-xs" : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
  if (btnSel) btnSel.className = (type === 'sel') ? "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black bg-amber-600 text-white shadow-xs" : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";
  if (btnLoop) btnLoop.className = (type === 'loop') ? "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 text-white shadow-xs" : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";

  if (type === 'seq') {
    diagram.innerHTML = `
      <div class="flex flex-col items-center gap-2 max-w-sm mx-auto">
        <div id="sim-node-1" class="w-48 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 시작</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-2" class="w-48 py-2 text-center rounded-xl bg-blue-50 border-2 border-blue-500 font-black text-blue-900 text-xs shadow-xs transition-all">▭ 냄비에 물 붓기</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-3" class="w-48 py-2 text-center rounded-xl bg-blue-50 border-2 border-blue-500 font-black text-blue-900 text-xs shadow-xs transition-all">▭ 가스불 켜기</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-4" class="w-48 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 종료</div>
      </div>
    `;
  } else if (type === 'sel') {
    diagram.innerHTML = `
      <div class="flex flex-col items-center gap-2 max-w-md mx-auto">
        <div id="sim-node-1" class="w-44 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 시작</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-2" class="w-48 py-3 text-center rounded-2xl bg-amber-50 border-2 border-amber-500 font-black text-amber-950 text-xs shadow-xs transition-all relative">
          <div>◇ 키 &gt;= 130cm 인가?</div>
          <div class="text-[10px] text-amber-600 mt-0.5">현재 조건: <span id="sim-cond-status" class="font-black text-emerald-600">참 (True)</span></div>
        </div>
        <div class="grid grid-cols-2 gap-6 w-full mt-1">
          <div class="flex flex-col items-center gap-1.5">
            <span class="text-[10px] font-black text-emerald-600">[예] ➔</span>
            <div id="sim-node-3a" class="w-full py-2.5 text-center rounded-xl bg-emerald-50 border-2 border-emerald-500 font-bold text-emerald-950 text-xs shadow-xs transition-all">
              ▭ 롤러코스터 탑승!
            </div>
          </div>
          <div class="flex flex-col items-center gap-1.5">
            <span class="text-[10px] font-black text-rose-600">[아니오] ➔</span>
            <div id="sim-node-3b" class="w-full py-2.5 text-center rounded-xl bg-rose-50 border-2 border-rose-500 font-bold text-rose-950 text-xs shadow-xs transition-all">
              ▭ 회전목마 탑승
            </div>
          </div>
        </div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs mt-1"></i>
        <div id="sim-node-4" class="w-44 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 종료</div>
      </div>
    `;
  } else if (type === 'loop') {
    diagram.innerHTML = `
      <div class="flex flex-col items-center gap-2 max-w-sm mx-auto">
        <div id="sim-node-1" class="w-48 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 시작</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-2" class="w-48 py-2 text-center rounded-xl bg-emerald-50 border-2 border-emerald-500 font-black text-emerald-900 text-xs shadow-xs transition-all">▱ 비밀번호 입력</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-3" class="w-52 py-3 text-center rounded-2xl bg-amber-50 border-2 border-amber-500 font-black text-amber-950 text-xs shadow-xs transition-all relative">
          <div>◇ 비밀번호 일치?</div>
          <span class="absolute -right-16 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
            아니오 ↺
          </span>
        </div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-4" class="w-48 py-2 text-center rounded-xl bg-emerald-50 border-2 border-emerald-500 font-black text-emerald-900 text-xs shadow-xs transition-all">▭ 문 열림 완료</div>
        <i class="fa-solid fa-arrow-down text-slate-400 text-xs"></i>
        <div id="sim-node-5" class="w-48 py-2 text-center rounded-full bg-purple-50 border-2 border-purple-500 font-black text-purple-900 text-xs shadow-xs transition-all">⬭ 종료</div>
      </div>
    `;
  }
}

// 불빛 흐름 실행 애니메이션
function playFlowSim() {
  if (typeof playSfx === 'function') playSfx('btn');

  if (activeStructure === 'seq') {
    const nodes = [1, 2, 3, 4].map(n => document.getElementById(`sim-node-${n}`));
    nodes.forEach(n => n && n.classList.remove('flow-node-active'));

    nodes.forEach((node, idx) => {
      setTimeout(() => {
        nodes.forEach(n => n && n.classList.remove('flow-node-active'));
        if (node) node.classList.add('flow-node-active');
        if (typeof playSfx === 'function') playSfx('pop');
      }, idx * 450);
    });
  } else if (activeStructure === 'sel') {
    isDecisionConditionTrue = !isDecisionConditionTrue;
    const condStatus = document.getElementById('sim-cond-status');
    if (condStatus) {
      condStatus.textContent = isDecisionConditionTrue ? "참 (True)" : "거짓 (False)";
      condStatus.className = isDecisionConditionTrue ? "font-black text-emerald-600" : "font-black text-rose-600";
    }

    const n1 = document.getElementById('sim-node-1');
    const n2 = document.getElementById('sim-node-2');
    const targetBranch = isDecisionConditionTrue ? document.getElementById('sim-node-3a') : document.getElementById('sim-node-3b');
    const n4 = document.getElementById('sim-node-4');

    [n1, n2, targetBranch, n4].forEach((node, idx) => {
      setTimeout(() => {
        [n1, n2, document.getElementById('sim-node-3a'), document.getElementById('sim-node-3b'), n4].forEach(n => n && n.classList.remove('flow-node-active'));
        if (node) node.classList.add('flow-node-active');
        if (typeof playSfx === 'function') playSfx('pop');
      }, idx * 450);
    });
  } else if (activeStructure === 'loop') {
    const n1 = document.getElementById('sim-node-1');
    const n2 = document.getElementById('sim-node-2');
    const n3 = document.getElementById('sim-node-3');
    const n4 = document.getElementById('sim-node-4');
    const n5 = document.getElementById('sim-node-5');

    // 1회 틀려서 루프백 ➔ 2회째 성공하는 시나리오
    const sequence = [n1, n2, n3, n2, n3, n4, n5];
    sequence.forEach((node, idx) => {
      setTimeout(() => {
        [n1, n2, n3, n4, n5].forEach(n => n && n.classList.remove('flow-node-active'));
        if (node) node.classList.add('flow-node-active');
        if (typeof playSfx === 'function') playSfx('pop');
      }, idx * 400);
    });
  }
}

// 전역 바인딩
window.selectConceptUnit = selectConceptUnit;
window.selectConceptModule = selectConceptModule;
window.showStateDetail = showStateDetail;
window.discardNoise = discardNoise;
window.resetNoiseGame = resetNoiseGame;
window.toggleMapMode = toggleMapMode;
window.switchDecompTab = switchDecompTab;
window.toggleLampCondition = toggleLampCondition;
window.runRobotDefiniteness = runRobotDefiniteness;
window.runFinitenessSim = runFinitenessSim;
window.showSymbolEntryDetail = showSymbolEntryDetail;
window.switchStructureTab = switchStructureTab;
window.playFlowSim = playFlowSim;

