/**
 * ==============================================================================
 * 📊 [실습 3코스] 순서도 만들기 스튜디오 엔진 (Flowchart Studio 2.0)
 * ==============================================================================
 * - Level 1: 기초 퍼즐 챌린지 (기존 완성본 100% 보존: 라면, 놀이기구, 비밀번호)
 * - Level 2: 선생님과 함께하는 예시 공방 (지각 방지 등교 알고리즘 튜토리얼)
 * - Level 3: 나만의 백지 공방 (자연어 카드 빌더 + 자유 캔버스 + 스마트 유도등)
 * - 띵커보드(ThinkerBoard) 원클릭 이미지 복사 & 제출 파이프라인
 */

// ==========================================
// 1. 5단계 원스톱 수업 로드맵 제어기 (Unified Roadmap Stepper)
// ==========================================
let currentFlowchartStep = 1;
const completedFlowchartSteps = new Set();

function switchFlowchartStep(stepNum) {
  currentFlowchartStep = stepNum;

  // 1. 상단 5단계 버튼 활성 상태 업데이트
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`fc-step-btn-${i}`);
    const checkBadge = document.getElementById(`fc-check-${i}`);
    if (btn) {
      const isCompleted = completedFlowchartSteps.has(i);
      if (checkBadge) {
        checkBadge.classList.toggle('hidden', !isCompleted);
      }

      if (i === stepNum) {
        btn.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 whitespace-nowrap bg-indigo-600 text-white shadow-xs";
      } else {
        const bgClass = isCompleted ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200";
        btn.className = `px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${bgClass}`;
      }
    }
  }

  // 2. 뷰 컨테이너 토글
  const v1 = document.getElementById('fc-level1-view');
  const v2 = document.getElementById('fc-level2-view');
  const v3 = document.getElementById('fc-level3-view');

  const isL1 = stepNum >= 1 && stepNum <= 3;
  const isL2 = stepNum === 4;
  const isL3 = stepNum === 5;

  if (v1) v1.classList.toggle('hidden', !isL1);
  if (v2) v2.classList.toggle('hidden', !isL2);
  if (v3) v3.classList.toggle('hidden', !isL3);

  // 3. 해당 스텝별 초기화
  if (isL1) {
    disableStudioMode();
    selectFlowchartMission(stepNum);
  } else if (isL2) {
    enableStudioMode();
    initLevel2Walkthrough();
  } else if (isL3) {
    enableStudioMode();
    initLevel3FreeStudio();
  }

  if (typeof playSfx === 'function') playSfx('step');
}

function enableStudioMode() {
  document.body.classList.add('studio-mode');
  window.dispatchEvent(new Event('resize'));
}

function disableStudioMode() {
  document.body.classList.remove('studio-mode');
  window.dispatchEvent(new Event('resize'));
}

window.enableStudioMode = enableStudioMode;
window.disableStudioMode = disableStudioMode;

// 하위 호환성 별칭
function switchFlowchartLevel(lvl) {
  if (lvl === 1) switchFlowchartStep(1);
  else if (lvl === 2) switchFlowchartStep(4);
  else if (lvl === 3) switchFlowchartStep(5);
}

function markStepCompleted(stepNum) {
  completedFlowchartSteps.add(stepNum);
  const checkBadge = document.getElementById(`fc-check-${stepNum}`);
  if (checkBadge) checkBadge.classList.remove('hidden');
}

function goToNextFlowchartStep() {
  if (currentFlowchartStep < 5) {
    switchFlowchartStep(currentFlowchartStep + 1);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }
}


// ==========================================
// 2. [Level 1] 기존 기초 퍼즐 챌린지 엔진 (100% 보존)
// ==========================================
let currentMissionIdx = 0;
let placedBlocks = {};
let isSimulating = false;
let isWaitingUserRetry = false;
let typedPw = "";

function selectFlowchartMission(misId) {
  currentMissionIdx = misId - 1;
  const m = missions[currentMissionIdx];
  placedBlocks = {};
  isSimulating = false;
  isWaitingUserRetry = false;

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`fc-mission-tab-${i}`);
    if (btn) {
      btn.className = i === misId
        ? "px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-white text-indigo-600 shadow-xs whitespace-nowrap"
        : "px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900 whitespace-nowrap";
    }
  }

  const stepInd = document.getElementById('mission-step-indicator');
  const titleEl = document.getElementById('mission-title');
  const descEl = document.getElementById('mission-desc');

  if (stepInd) stepInd.textContent = `Mission ${misId} of 3 (${m.type})`;
  if (titleEl) titleEl.textContent = m.title;
  if (descEl) descEl.textContent = m.desc;

  renderInventory(m);
  renderCanvasSlots(m);
  renderIOPanels(m);
  resetFlowchartAIFeedback();
}

function resetFlowchartAIFeedback() {
  const card = document.getElementById('ai-feedback-card');
  const text = document.getElementById('ai-feedback-text');
  if (!card || !text) return;
  card.className = "p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs space-y-1 transition-all";
  text.innerHTML = "순서도를 완성한 후 실행 버튼을 눌러보세요. 논리적 오류가 발생하면 AI가 구체적인 원인을 짚어줍니다.";
}

function updateLoopArrowPosition() {
  const m = missions[currentMissionIdx];
  if (!m || m.id !== 3) return;

  const svg = document.getElementById('mission3-loop-svg');
  const fromEl = document.getElementById('slot-s4_no');
  const toEl = document.getElementById('slot-s2');
  const outerLayout = document.getElementById('flowchart-outer-layout');

  if (!svg || !fromEl || !toEl || !outerLayout) return;

  const cRect = outerLayout.getBoundingClientRect();
  const fRect = fromEl.getBoundingClientRect();
  const tRect = toEl.getBoundingClientRect();

  if (cRect.width === 0 || fRect.width === 0 || tRect.width === 0) return;

  const x1 = Math.round(fRect.right - cRect.left);
  const y1 = Math.round(fRect.top + fRect.height / 2 - cRect.top);
  const x2 = Math.round(tRect.right - cRect.left);
  const y2 = Math.round(tRect.top + tRect.height / 2 - cRect.top);

  const loopRight = Math.max(x1, x2) + 38;

  const path = document.getElementById('loop-path');
  const arr = document.getElementById('loop-arrow');
  if (!path || !arr) return;

  const d = `M ${x1} ${y1} H ${loopRight} V ${y2} H ${x2 + 8}`;
  path.setAttribute('d', d);

  arr.setAttribute('points', `${x2 + 10},${y2 - 5} ${x2},${y2} ${x2 + 10},${y2 + 5}`);
}

function renderInventory(m) {
  const inv = document.getElementById('block-inventory');
  if (!inv) return;
  inv.innerHTML = '';

  const shuffled = [...m.palette].sort(() => Math.random() - 0.5);

  shuffled.forEach(b => {
    const div = document.createElement('div');
    div.id = `block-${b.id}`;
    div.draggable = true;
    div.ondragstart = (e) => handleDragStart(e, b.id);

    let shapeClass = "shape-process";
    if (b.shape === "terminal") shapeClass = "shape-terminal";
    else if (b.shape === "io") shapeClass = "shape-io";
    else if (b.shape === "decision") shapeClass = "shape-decision";

    div.className = `p-3 ${shapeClass} text-xs sm:text-sm font-bold shadow-xs cursor-grab active:cursor-grabbing hover:scale-[1.02] transition select-none flex items-center justify-center text-center`;
    
    if (b.shape === "io") {
      div.innerHTML = `<span class="shape-io-inner">${b.text}</span>`;
    } else {
      div.innerText = b.text;
    }

    inv.appendChild(div);
  });
}

function renderCanvasSlots(m) {
  const canvas = document.getElementById('flowchart-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';

  const outerLayout = document.createElement('div');
  outerLayout.id = "flowchart-outer-layout";
  outerLayout.className = "w-full max-w-[420px] flex flex-col items-center relative pr-4";

  if (m.id === 1) {
    m.slots.forEach((s, idx) => {
      outerLayout.appendChild(createSlotElement(m, s));
      if (idx < m.slots.length - 1) {
        outerLayout.appendChild(createVerticalArrow());
      }
    });
  } else if (m.id === 2) {
    m.slots.forEach((s, idx) => {
      if (s.id === 's4_yes' || s.id === 's4_no') return;

      outerLayout.appendChild(createSlotElement(m, s));

      if (s.id === 's3') {
        const forkRow = document.createElement('div');
        forkRow.className = "w-full flex items-center justify-between text-xs font-black text-slate-400 px-6 py-1";
        forkRow.innerHTML = `<span>[예]</span><span>[아니오]</span>`;
        outerLayout.appendChild(forkRow);

        const forkSlots = document.createElement('div');
        forkSlots.className = "w-full grid grid-cols-2 gap-3";

        const slotYes = m.slots.find(x => x.id === 's4_yes');
        const slotNo = m.slots.find(x => x.id === 's4_no');

        forkSlots.appendChild(createSlotElement(m, slotYes));
        forkSlots.appendChild(createSlotElement(m, slotNo));
        outerLayout.appendChild(forkSlots);

        const mergeArrows = document.createElement('div');
        mergeArrows.className = "w-full flex justify-around py-1 text-slate-400";
        mergeArrows.innerHTML = `
          <i class="fa-solid fa-arrow-down-long text-slate-300 text-sm"></i>
          <i class="fa-solid fa-arrow-down-long text-slate-300 text-sm"></i>
        `;
        outerLayout.appendChild(mergeArrows);
      } else if (idx < m.slots.length - 1) {
        outerLayout.appendChild(createVerticalArrow());
      }
    });
  } else if (m.id === 3) {
    m.slots.forEach((s, idx) => {
      if (s.id === 's4_yes' || s.id === 's4_no') return;

      outerLayout.appendChild(createSlotElement(m, s));

      if (s.id === 's3') {
        const exitRow = document.createElement('div');
        exitRow.className = "w-full flex items-center justify-between text-xs font-black text-slate-400 px-6 py-1";
        exitRow.innerHTML = `<span>[일치: 예]</span><span>[불일치: 아니오]</span>`;
        outerLayout.appendChild(exitRow);

        const forkSlots = document.createElement('div');
        forkSlots.className = "w-full grid grid-cols-2 gap-3";

        const slotYes = m.slots.find(x => x.id === 's4_yes');
        const slotNo = m.slots.find(x => x.id === 's4_no');

        forkSlots.appendChild(createSlotElement(m, slotYes));
        forkSlots.appendChild(createSlotElement(m, slotNo));
        outerLayout.appendChild(forkSlots);

        const mergeArrows = document.createElement('div');
        mergeArrows.className = "w-full flex justify-between px-16 py-1 text-slate-400";
        mergeArrows.innerHTML = `
          <i class="fa-solid fa-arrow-down-long text-slate-300 text-sm"></i>
          <span class="text-[10px] text-amber-500 font-bold">재입력 루프</span>
        `;
        outerLayout.appendChild(mergeArrows);
      } else if (idx < m.slots.length - 1) {
        outerLayout.appendChild(createVerticalArrow());
      }
    });

    const loopSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    loopSvg.id = "mission3-loop-svg";
    loopSvg.setAttribute("class", "absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible");
    loopSvg.innerHTML = `
      <path id="loop-path" d="" fill="none" stroke="#f59e0b" stroke-width="2.5" class="loop-line-flow" />
      <polygon id="loop-arrow" points="" fill="#f59e0b" />
    `;
    outerLayout.appendChild(loopSvg);
  }

  canvas.appendChild(outerLayout);

  if (m.id === 3) {
    setTimeout(updateLoopArrowPosition, 80);
  }
}

function createVerticalArrow() {
  const div = document.createElement('div');
  div.className = "my-1 text-slate-300 flex items-center justify-center";
  div.innerHTML = `<i class="fa-solid fa-arrow-down-long text-sm sm:text-base"></i>`;
  return div;
}

function createSlotElement(m, slot) {
  const el = document.createElement('div');
  el.id = `slot-${slot.id}`;

  let shapeClass = "shape-process";
  if (slot.shape === "terminal") shapeClass = "shape-terminal";
  else if (slot.shape === "io") shapeClass = "shape-io";
  else if (slot.shape === "decision") shapeClass = "shape-decision";

  if (slot.fixed) {
    el.className = `w-full min-h-[52px] sm:min-h-[56px] px-4 py-3 ${shapeClass} flex items-center justify-center font-black text-xs sm:text-base shadow-xs select-none relative z-20`;
    el.innerText = slot.label;
  } else {
    el.className = "w-full min-h-[52px] sm:min-h-[56px] px-4 py-3 slot-target slot-box rounded-2xl flex items-center justify-between text-xs sm:text-base transition relative z-20";
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
    el.ondragleave = () => el.classList.remove('drag-over');
    el.ondrop = (e) => handleDrop(e, slot.id);

    el.innerHTML = `
      <span class="text-slate-400 font-bold text-xs sm:text-sm italic">${slot.hint}</span>
      <span class="text-[10px] text-slate-300 font-bold border border-slate-200 px-1.5 py-0.5 rounded">Drop</span>
    `;
  }
  return el;
}

let draggedBlockId = null;
function handleDragStart(e, bId) {
  draggedBlockId = bId;
  e.dataTransfer.setData('text/plain', bId);
}

function handleDrop(e, slotId) {
  e.preventDefault();
  const slotEl = document.getElementById(`slot-${slotId}`);
  if (!slotEl) return;
  slotEl.classList.remove('drag-over');
  if (!draggedBlockId) return;

  const m = missions[currentMissionIdx];
  const block = m.palette.find(b => b.id === draggedBlockId);
  if (!block) return;

  const oldSlotId = Object.keys(placedBlocks).find(k => placedBlocks[k] === draggedBlockId);
  if (oldSlotId) {
    clearSlot(oldSlotId);
  }

  // 덮어쓰기 시 기존에 놓여있던 블록을 보관함(팔레트)으로 안전 복구
  const existingBlockId = placedBlocks[slotId];
  if (existingBlockId && existingBlockId !== draggedBlockId) {
    const existingEl = document.getElementById(`block-${existingBlockId}`);
    if (existingEl) {
      existingEl.classList.remove('opacity-30', 'pointer-events-none');
    }
  }

  placedBlocks[slotId] = draggedBlockId;

  let shapeClass = "shape-process";
  if (block.shape === "terminal") shapeClass = "shape-terminal";
  else if (block.shape === "io") shapeClass = "shape-io";
  else if (block.shape === "decision") shapeClass = "shape-decision";

  slotEl.className = `w-full min-h-[52px] sm:min-h-[56px] px-4 py-3 ${shapeClass} flex items-center justify-between text-xs sm:text-base font-bold shadow-xs select-none transition relative z-20`;

  let innerText = block.text;
  if (block.shape === "io") {
    innerText = `<span class="shape-io-inner">${block.text}</span>`;
  }

  slotEl.innerHTML = `
    <span class="text-center flex-1">${innerText}</span>
    <button onclick="clearSlot('${slotId}')" class="ml-2 w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center text-slate-400 hover:text-rose-500 transition">
      <i class="fa-solid fa-xmark text-xs"></i>
    </button>
  `;

  const blockEl = document.getElementById(`block-${draggedBlockId}`);
  if (blockEl) blockEl.classList.add('opacity-30', 'pointer-events-none');

  if (typeof playSfx === 'function') playSfx('snap');
  draggedBlockId = null;

  if (m.id === 3) {
    setTimeout(updateLoopArrowPosition, 60);
  }
}

function clearSlot(slotId) {
  const bId = placedBlocks[slotId];
  if (!bId) return;

  delete placedBlocks[slotId];
  const m = missions[currentMissionIdx];
  const slot = m.slots.find(s => s.id === slotId);
  const slotEl = document.getElementById(`slot-${slotId}`);
  if (!slotEl || !slot) return;

  slotEl.className = "w-full min-h-[52px] sm:min-h-[56px] px-4 py-3 slot-target slot-box rounded-2xl flex items-center justify-between text-xs sm:text-base transition relative z-20";
  slotEl.innerHTML = `
    <span class="text-slate-400 font-bold text-xs sm:text-sm italic">${slot.hint}</span>
    <span class="text-[10px] text-slate-300 font-bold border border-slate-200 px-1.5 py-0.5 rounded">Drop</span>
  `;

  const blockEl = document.getElementById(`block-${bId}`);
  if (blockEl) blockEl.classList.remove('opacity-30', 'pointer-events-none');

  if (typeof playSfx === 'function') playSfx('step');

  if (m.id === 3) {
    setTimeout(updateLoopArrowPosition, 60);
  }
}

function resetCurrentMission() {
  selectFlowchartMission(currentMissionIdx + 1);
  if (typeof playSfx === 'function') playSfx('step');
}

function renderIOPanels(m) {
  const inBox = document.getElementById('io-input-container');
  const outBox = document.getElementById('io-output-display');
  const logBox = document.getElementById('tracer-log');
  const badge = document.getElementById('io-input-badge');

  if (badge) badge.classList.add('hidden');
  if (outBox) outBox.textContent = "대기 중...";
  if (logBox) logBox.innerHTML = '<div class="text-slate-500 italic">블록을 배치하고 [실행]을 누르면 데이터가 노드를 따라 이동합니다.</div>';

  if (!inBox) return;

  if (m.id === 1) {
    inBox.innerHTML = `
      <div class="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-600 flex items-center justify-between">
        <span>고정 입력: 물 용량</span>
        <strong class="text-blue-600">500ml</strong>
      </div>
    `;
  } else if (m.id === 2) {
    inBox.innerHTML = `
      <div class="flex items-center gap-2">
        <input type="number" id="test-user-height" value="155" placeholder="키(cm)" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500" />
        <span class="text-xs font-bold text-slate-400 shrink-0">cm</span>
      </div>
    `;
  } else if (m.id === 3) {
    inBox.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <input type="text" id="test-user-pw" maxlength="4" value="1234" placeholder="4자리 번호" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:border-indigo-500" />
          <button onclick="document.getElementById('test-user-pw').value='7777'" class="px-2.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold shrink-0 border border-indigo-200 transition" title="정답 암호 입력">
            정답(7777)
          </button>
        </div>
        <p class="text-[11px] text-slate-400 font-medium leading-tight">* 기본값 '1234'로 실행 시 틀려 루프백되며, '7777' 입력 시 탈출합니다.</p>
      </div>
    `;
  }
}

async function runFlowchartSimulation() {
  if (isSimulating) return;

  const m = missions[currentMissionIdx];
  const outBox = document.getElementById('io-output-display');
  const aiCard = document.getElementById('ai-feedback-card');
  const aiText = document.getElementById('ai-feedback-text');

  const reqSlots = m.slots.filter(s => !s.fixed);
  const isAllFilled = reqSlots.every(s => placedBlocks[s.id]);

  if (!isAllFilled) {
    if (typeof playSfx === 'function') playSfx('error');
    if (aiCard && aiText) {
      aiCard.className = "p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs sm:text-sm space-y-1.5";
      aiText.innerHTML = `
        <div class="font-bold text-rose-800">⚠️ 아직 비어있는 순서도 슬롯이 있습니다!</div>
        <div class="text-rose-600">모든 빈칸에 알맞은 블록을 끌어다 놓은 후 실행 버튼을 눌러주세요.</div>
      `;
    }
    return;
  }

  isSimulating = true;
  const btnText = document.getElementById('btn-run-text');
  if (btnText) btnText.textContent = "시뮬레이션 검증 중...";

  const tracer = document.getElementById('tracer-log');
  if (tracer) tracer.innerHTML = '';
  tracerLog("🚀 [시뮬레이터 시작] 데이터 흐름 추적 시작...", "text-indigo-400");

  const isCorrect = m.validate(placedBlocks);

  if (m.id === 1) {
    await highlightNode('s1', 500);
    tracerLog("① [단말] 알고리즘 시작", "text-slate-300");

    await highlightNode('s2', 600);
    tracerLog("② [입출력] 물 500ml 붓기", "text-emerald-300");

    await highlightNode('s3', 600);
    tracerLog("③ [처리] 가스레인지 켜서 물 끓이기", "text-blue-300");

    await highlightNode('s4', 600);
    tracerLog("④ [처리] 면과 스프 넣고 끓이기", "text-blue-300");

    await highlightNode('s5', 500);
    tracerLog("⑤ [단말] 조리 완료 (종료)", "text-indigo-300");

    if (isCorrect) {
      if (outBox) outBox.textContent = "🍲 라면 완성! 맛있게 드세요.";
      if (typeof playSfx === 'function') playSfx('success');
      tracerLog("✅ [검증 성공] 순차 구조 순서도가 정확합니다!", "text-emerald-400 font-bold");
      if (aiCard && aiText) {
        aiCard.className = "p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm space-y-1.5";
        markStepCompleted(1);
        aiText.innerHTML = `
          <div class="font-bold text-emerald-800">🎉 완벽한 순차 구조 순서도입니다!</div>
          <div class="text-emerald-700">물 붓기 ➔ 끓이기 ➔ 면/스프 넣기 과정이 컴퓨터가 실행하기에 완벽한 순서로 설계되었습니다.</div>
          <div class="pt-2.5">
            <button onclick="switchFlowchartStep(2)" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20">
              <span>다음 단계(2. 선택 퍼즐)로 이동 ➔</span>
            </button>
          </div>
        `;
      }
    } else {
      diagnoseWithSolarAI(m, placedBlocks);
    }

  } else if (m.id === 2) {
    const inputEl = document.getElementById('test-user-height');
    const height = inputEl ? (parseInt(inputEl.value, 10) || 155) : 155;

    await highlightNode('s1', 400);
    tracerLog("① [단말] 탑승 판정기 시작", "text-slate-300");

    await highlightNode('s2', 500);
    tracerLog(`② [입출력] 사용자 키 입력: ${height}cm`, "text-emerald-300");

    await highlightNode('s3', 600);
    const pass = height >= 150;
    tracerLog(`③ [판단] 키(${height}) >= 150 검사 ➔ 결과: ${pass ? '[예]' : '[아니오]'}`, "text-amber-300 font-bold");

    if (pass) {
      await highlightNode('s4_yes', 600);
      tracerLog("④ [분기-예] '탑승 가능' 블록 실행", "text-emerald-300");
      if (outBox) outBox.textContent = "🎢 키 150cm 이상! 탑승 환영합니다.";
    } else {
      await highlightNode('s4_no', 600);
      tracerLog("④ [분기-아니오] '탑승 불가' 블록 실행", "text-rose-300");
      if (outBox) outBox.textContent = "🚫 안전 기준 미달 (150cm 미만) 탑승 불가";
    }

    await highlightNode('s5', 400);
    tracerLog("⑤ [단말] 판정 종료 합류", "text-indigo-300");

    if (isCorrect) {
      if (typeof playSfx === 'function') playSfx('success');
      tracerLog("✅ [검증 성공] 조건 분기 구조가 완벽합니다!", "text-emerald-400 font-bold");
      if (aiCard && aiText) {
        aiCard.className = "p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm space-y-1.5";
        markStepCompleted(2);
        aiText.innerHTML = `
          <div class="font-bold text-emerald-800">🎉 훌륭합니다! 조건 선택 구조를 완벽히 이해했습니다.</div>
          <div class="text-emerald-700">입력된 키에 따라 [예]와 [아니오] 갈림길로 올바르게 분기하여 판단하는 알고리즘입니다.</div>
          <div class="pt-2.5">
            <button onclick="switchFlowchartStep(3)" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20">
              <span>다음 단계(3. 반복 퍼즐)로 이동 ➔</span>
            </button>
          </div>
        `;
      }
    } else {
      diagnoseWithSolarAI(m, placedBlocks);
    }

  } else if (m.id === 3) {
    const inputEl = document.getElementById('test-user-pw');
    typedPw = inputEl ? inputEl.value : "1234";

    await highlightNode('s1', 400);
    tracerLog("① [단말] 도어락 시작", "text-slate-300");

    await highlightNode('s2', 500);
    tracerLog(`② [입출력] 비밀번호 입력: "${typedPw}"`, "text-emerald-300");

    await highlightNode('s3', 600);
    const pass = typedPw === "7777";
    tracerLog(`③ [판단] 비밀번호 == 7777 인가? ➔ 결과: ${pass ? '[예]' : '[아니오]'}`, "text-amber-300 font-bold");

    if (pass) {
      await highlightNode('s4_yes', 600);
      tracerLog("④ [분기-예] '로그인 성공' 출력", "text-emerald-300");
      if (outBox) outBox.textContent = "🔓 문이 열렸습니다! (로그인 성공)";

      await highlightNode('s5', 400);
      tracerLog("⑤ [단말] 인증 완료 후 정상 종료", "text-indigo-300");

      if (isCorrect) {
        if (typeof playSfx === 'function') playSfx('success');
        tracerLog("✅ [검증 성공] 반복 제어 루프가 정확합니다!", "text-emerald-400 font-bold");
        if (aiCard && aiText) {
          aiCard.className = "p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm space-y-1.5";
          markStepCompleted(3);
          aiText.innerHTML = `
            <div class="font-bold text-emerald-800">🎉 반복 제어 구조 마스터!</div>
            <div class="text-emerald-700">틀렸을 때 재입력으로 되돌아가는 루프백 흐름과 성공 시 종료로 빠져나오는 구조가 완벽합니다.</div>
            <div class="pt-2.5">
              <button onclick="switchFlowchartStep(4)" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20">
                <span>다음 단계(4. 예시 공방)로 이동 ➔</span>
              </button>
            </div>
          `;
        }
      } else {
        diagnoseWithSolarAI(m, placedBlocks);
      }

    } else {
      await highlightNode('s4_no', 600);
      tracerLog("④ [분기-아니오] '비밀번호 불일치' 경고 처리", "text-rose-300");
      if (outBox) outBox.textContent = "❌ 비밀번호 오류! 다시 입력하세요.";

      tracerLog("🔄 [루프백 화살표] 2단계(비밀번호 입력)로 되감기 실행!", "text-amber-400 font-bold");
      const path = document.getElementById('loop-path');
      if (path) {
        path.setAttribute('stroke', '#ef4444');
        path.setAttribute('stroke-width', '4');
      }

      await new Promise(r => setTimeout(r, 600));
      if (path) {
        path.setAttribute('stroke', '#f59e0b');
        path.setAttribute('stroke-width', '2.5');
      }

      if (typeof playSfx === 'function') playSfx('error');

      const badge = document.getElementById('io-input-badge');
      if (badge) badge.classList.remove('hidden');

      if (isCorrect) {
        if (aiCard && aiText) {
          aiCard.className = "p-4 rounded-2xl border border-amber-200 bg-amber-50 text-xs sm:text-sm space-y-1.5";
          aiText.innerHTML = `
            <div class="font-bold text-amber-800">🔄 반복 루프 검증 성공 (재입력 대기 중)</div>
            <div class="text-amber-700">비밀번호가 틀렸을 때 이전 단계로 돌아가는 화살표가 올바르게 작동했습니다! 우측 상단 비밀번호를 '7777'로 바꾸고 다시 [실행]을 누르면 탈출합니다.</div>
          `;
        }
      } else {
        diagnoseWithSolarAI(m, placedBlocks);
      }
    }
  }

  isSimulating = false;
  if (btnText) btnText.textContent = "순서도 실행 검증 (Run)";
}

function highlightNode(slotId, duration) {
  return new Promise(resolve => {
    const el = document.getElementById(`slot-${slotId}`);
    if (el) el.classList.add('node-running');
    if (typeof playSfx === 'function') playSfx('step');

    setTimeout(() => {
      if (el) el.classList.remove('node-running');
      resolve();
    }, duration);
  });
}

function tracerLog(msg, colorClass) {
  const tracer = document.getElementById('tracer-log');
  if (!tracer) return;
  const div = document.createElement('div');
  div.className = `flex items-center gap-1.5 ${colorClass || 'text-slate-300'}`;
  div.innerHTML = `<span>•</span> <span>${msg}</span>`;
  tracer.appendChild(div);
  tracer.scrollTop = tracer.scrollHeight;
}

async function diagnoseWithSolarAI(m, placed) {
  const card = document.getElementById('ai-feedback-card');
  const text = document.getElementById('ai-feedback-text');
  if (!card || !text) return;

  if (typeof playSfx === 'function') playSfx('error');
  card.className = "p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs sm:text-sm space-y-1.5";
  text.innerHTML = `
    <div class="font-bold text-rose-800 flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
      <span>Solar AI가 순서도 논리 오류를 진단하고 있습니다...</span>
    </div>
  `;

  const studentState = Object.entries(placed).map(([slot, bId]) => {
    const block = m.palette.find(b => b.id === bId);
    return `[슬롯 ${slot}]에 배치된 블록: "${block ? block.text : '없음'}" (기호형태: ${block ? block.shape : '알수없음'})`;
  }).join('\n');

  const prompt = `당신은 대한민국 중학교 2학년 정보 교과 '알고리즘과 순서도' 단원의 친절한 AI 선생님입니다.
학생이 [${m.title}] 미션에서 순서도 블록을 조립했으나 논리적 오류가 발생했습니다.

[미션 목표]: ${m.desc}
[학생이 배치한 상태]:
${studentState}

[지침]:
1. 학생의 배치가 왜 논리적으로 어색한지 중2 눈높이에서 2문장 이내로 친절하게 짚어주세요.
2. 어떤 블록의 순서나 기호(단말/입출력/처리/판단)를 바꿔야 하는지 명확한 힌트를 1문장 제공하세요.
3. 총 3문장 이내로 다정하게 작성하세요.`;

  try {
    const res = await fetch("https://api.upstage.ai/v1/solar/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${UPSTAGE_API_KEY}`
      },
      body: JSON.stringify({
        model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5
      })
    });

    if (!res.ok) throw new Error("API Response Error");
    const data = await res.json();
    const feedback = data.choices[0].message.content;

    card.className = "p-4 rounded-2xl border border-rose-300 bg-rose-50 text-xs sm:text-sm space-y-1.5";
    text.innerHTML = `
      <div class="font-bold text-rose-800 flex items-center gap-1.5">
        <i class="fa-solid fa-wand-magic-sparkles text-rose-600"></i>
        <span>Solar AI 닥터의 처방전</span>
      </div>
      <div class="text-slate-800 leading-relaxed font-medium">${feedback.replace(/\n/g, '<br>')}</div>
    `;

  } catch (err) {
    card.className = "p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs sm:text-sm space-y-1.5";
    text.innerHTML = `
      <div class="font-bold text-rose-800">⚠️ 블록 순서가 맞지 않습니다!</div>
      <div class="text-rose-700">기호의 형태(입출력 ▱, 처리 ▭, 판단 ◇)와 실제 일어나는 행동 순서를 다시 확인해 보세요.</div>
    `;
  }
}


// ==========================================
// 3. [Level 2 / Step 4] 선생님과 함께하는 예시 공방 인터랙션 엔진
// ==========================================
let l2RevealedStep = 0;

function initLevel2Walkthrough() {
  const container = document.getElementById('fc-level2-view');
  if (!container) return;

  renderL2NaturalCards();
  renderL2Canvas();
}

function resetL2Walkthrough() {
  l2RevealedStep = 0;
  if (typeof playSfx === 'function') playSfx('snap');
  renderL2NaturalCards();
  renderL2Canvas();
}

function revealAllL2Steps() {
  l2RevealedStep = 4;
  markStepCompleted(4);
  if (typeof playSfx === 'function') playSfx('success');
  renderL2NaturalCards();
  renderL2Canvas();
}

function revealL2Step(stepIdx) {
  if (stepIdx <= l2RevealedStep) {
    if (typeof playSfx === 'function') playSfx('step');
    return;
  }

  l2RevealedStep = stepIdx;
  if (l2RevealedStep >= 4) {
    markStepCompleted(4);
    if (typeof playSfx === 'function') playSfx('success');
  } else {
    if (typeof playSfx === 'function') playSfx('step');
  }

  renderL2NaturalCards();
  renderL2Canvas();
}

function renderL2NaturalCards() {
  const cardList = document.getElementById('l2-natural-card-list');
  const counterEl = document.getElementById('l2-step-counter');
  if (counterEl) counterEl.textContent = `진행: ${l2RevealedStep} / 4`;
  if (!cardList) return;

  const data = (typeof level2Walkthrough !== 'undefined' ? level2Walkthrough : (window.level2Walkthrough || { steps: [] }));
  const steps = data.steps || [];

  cardList.innerHTML = steps.map((s, idx) => {
    const sNum = idx + 1;
    const isRevealed = l2RevealedStep >= sNum;
    const isNext = l2RevealedStep === sNum - 1;

    let borderClass = isRevealed ? "border-emerald-300 bg-emerald-50/40" : (isNext ? "border-indigo-400 bg-indigo-50/40 card-pulse-guide" : "border-slate-200 bg-slate-50 opacity-75");
    let checkBadge = isRevealed 
      ? `<span class="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</span>`
      : `<span class="w-5 h-5 rounded-full ${isNext ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[10px] font-black shrink-0">${sNum}</span>`;

    let clickGuide = isNext 
      ? `<div class="mt-2 text-[11px] font-black text-indigo-700 flex items-center gap-1.5"><i class="fa-solid fa-hand-pointer animate-bounce"></i> <span>클릭하여 우측 캔버스에 [${s.symbolShapeName}] 생성하기!</span></div>` 
      : (isRevealed ? `<div class="mt-1 text-[10px] text-emerald-700 font-bold flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> <span>캔버스에 기호 생성 완료 (${s.symbolShapeName})</span></div>` : '');

    if (s.symbolType === 'decision') {
      return `
        <div id="l2-card-step-${sNum}" onclick="revealL2Step(${sNum})" class="p-4 border-2 ${borderClass} rounded-2xl cursor-pointer transition shadow-xs space-y-2 hover:shadow-md">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${checkBadge}
              <span class="text-sm sm:text-base font-black text-slate-900">${s.cardTitle}</span>
            </div>
            <span class="text-[11px] font-black px-2.5 py-0.5 rounded-md border ${s.badgeClass}">${s.cardBadge}</span>
          </div>
          <div class="text-sm sm:text-base text-slate-900 font-black pl-7">
            만약 [ <strong class="text-amber-800">${s.condition}</strong> ] 라면?
          </div>
          <div class="pl-7 space-y-1 text-xs sm:text-sm">
            <div id="l2-card-yes-action" class="text-emerald-700 font-bold">• ${s.yesAction}</div>
            <div id="l2-card-no-action" class="text-rose-600 font-bold">• ${s.noAction}</div>
          </div>
          <div class="pl-7 text-xs text-slate-600 leading-relaxed font-normal">${s.explanation}</div>
          <div class="pl-7">${clickGuide}</div>
        </div>
      `;
    } else {
      return `
        <div id="l2-card-step-${sNum}" onclick="revealL2Step(${sNum})" class="p-4 border-2 ${borderClass} rounded-2xl cursor-pointer transition shadow-xs space-y-2 hover:shadow-md">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${checkBadge}
              <span class="text-sm sm:text-base font-black text-slate-900">${s.cardTitle}</span>
            </div>
            <span class="text-[11px] font-black px-2.5 py-0.5 rounded-md border ${s.badgeClass}">${s.cardBadge}</span>
          </div>
          <div class="text-sm sm:text-base text-slate-900 font-black pl-7">${s.naturalText}</div>
          <div class="pl-7 text-xs text-slate-600 leading-relaxed font-normal">${s.explanation}</div>
          <div class="pl-7">${clickGuide}</div>
        </div>
      `;
    }
  }).join('');
}

function renderL2Canvas() {
  const svg = document.getElementById('l2-svg');
  if (!svg) return;

  const defs = `
    <defs>
      <marker id="arrow-l2" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto">
        <polygon points="0 0, 11 4.5, 0 9" fill="#64748b" />
      </marker>
      <marker id="arrow-l2-yes" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto">
        <polygon points="0 0, 11 4.5, 0 9" fill="#10b981" />
      </marker>
      <marker id="arrow-l2-no" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto">
        <polygon points="0 0, 11 4.5, 0 9" fill="#f43f5e" />
      </marker>
    </defs>
  `;

  let content = defs;

  // 0. 단말: 시작 (항상 표시, 1.35배 확대)
  content += `
    <g id="l2-blk-0" class="pop-in">
      <rect x="235" y="16" width="230" height="48" rx="24" fill="#faf5ff" stroke="#a855f7" stroke-width="3" />
      <text x="350" y="46" fill="#581c87" font-size="15" font-weight="900" text-anchor="middle">⬭ 시작</text>
    </g>
  `;

  // 1. 입출력: 현재 시각 확인 (l2RevealedStep >= 1)
  if (l2RevealedStep >= 1) {
    content += `
      <!-- 0 -> 1 연결선 -->
      <line id="l2-line-0-1" x1="350" y1="64" x2="350" y2="100" stroke="#64748b" stroke-width="3.5" marker-end="url(#arrow-l2)" />

      <!-- 평행사변형 (입출력) -->
      <g id="l2-blk-1" class="pop-in">
        <polygon points="230,102 485,102 455,152 200,152" fill="#ecfdf5" stroke="#10b981" stroke-width="3" />
        <text x="342" y="132" fill="#064e3b" font-size="14" font-weight="800" text-anchor="middle">▱ 현재 시각 확인</text>
      </g>
    `;
  }

  // 2. 처리: 기상 및 세수하기 (l2RevealedStep >= 2)
  if (l2RevealedStep >= 2) {
    content += `
      <!-- 1 -> 2 연결선 -->
      <line id="l2-line-1-2" x1="350" y1="152" x2="350" y2="188" stroke="#64748b" stroke-width="3.5" marker-end="url(#arrow-l2)" />

      <!-- 직사각형 (처리) -->
      <g id="l2-blk-2" class="pop-in">
        <rect x="235" y="190" width="230" height="48" rx="10" fill="#eff6ff" stroke="#3b82f6" stroke-width="3" />
        <text x="350" y="219" fill="#1e3a8a" font-size="14" font-weight="800" text-anchor="middle">▭ 기상 및 세수하기</text>
      </g>
    `;
  }

  // 3. 판단: 현재 시각 <= 07:30 ? 및 2개 분기 (l2RevealedStep >= 3)
  if (l2RevealedStep >= 3) {
    content += `
      <!-- 2 -> 3 연결선 -->
      <line id="l2-line-2-3" x1="350" y1="238" x2="350" y2="276" stroke="#64748b" stroke-width="3.5" marker-end="url(#arrow-l2)" />

      <!-- 마름모 (판단) -->
      <g id="l2-blk-3" class="pop-in">
        <polygon points="350,278 495,325 350,372 205,325" fill="#fffbeb" stroke="#f59e0b" stroke-width="3" />
        <text x="350" y="330" fill="#78350f" font-size="14" font-weight="900" text-anchor="middle">◇ 현재 시각 &lt;= 07:30?</text>
      </g>

      <!-- [예] 좌측 분기선 및 직사각형 -->
      <g id="l2-blk-yes-wrap" class="pop-in">
        <path id="l2-line-yes" d="M 205 325 L 120 325 L 120 392" stroke="#10b981" stroke-width="3.5" fill="none" marker-end="url(#arrow-l2-yes)" />
        <text x="162" y="315" fill="#10b981" font-size="12" font-weight="900" text-anchor="middle">[예]</text>
        <g id="l2-blk-yes">
          <rect x="15" y="396" width="210" height="48" rx="10" fill="#eff6ff" stroke="#3b82f6" stroke-width="3" />
          <text x="120" y="425" fill="#1e3a8a" font-size="13" font-weight="800" text-anchor="middle">▭ 아침밥 든든히 먹기</text>
        </g>
      </g>

      <!-- [아니오] 우측 분기선 및 직사각형 -->
      <g id="l2-blk-no-wrap" class="pop-in">
        <path id="l2-line-no" d="M 495 325 L 580 325 L 580 392" stroke="#f43f5e" stroke-width="3.5" fill="none" marker-end="url(#arrow-l2-no)" />
        <text x="538" y="315" fill="#f43f5e" font-size="12" font-weight="900" text-anchor="middle">[아니오]</text>
        <g id="l2-blk-no">
          <rect x="475" y="396" width="210" height="48" rx="10" fill="#eff6ff" stroke="#3b82f6" stroke-width="3" />
          <text x="580" y="425" fill="#1e3a8a" font-size="13" font-weight="800" text-anchor="middle">▭ 서둘러 즉시 출발</text>
        </g>
      </g>
    `;
  }

  // 4. 합류 & 등교 버스 탑승 및 종료 (l2RevealedStep >= 4)
  if (l2RevealedStep >= 4) {
    content += `
      <!-- 분기 합류선 -->
      <g class="pop-in">
        <path id="l2-line-merge-yes" d="M 120 444 L 120 480 L 290 510" stroke="#64748b" stroke-width="3" fill="none" />
        <path id="l2-line-merge-no" d="M 580 444 L 580 480 L 410 510" stroke="#64748b" stroke-width="3" fill="none" />
        <line id="l2-line-merge-center" x1="350" y1="495" x2="350" y2="522" stroke="#64748b" stroke-width="3.5" marker-end="url(#arrow-l2)" />

        <!-- 직사각형 (처리): 등교 버스 탑승 -->
        <g id="l2-blk-4">
          <rect x="235" y="525" width="230" height="48" rx="10" fill="#eff6ff" stroke="#3b82f6" stroke-width="3" />
          <text x="350" y="554" fill="#1e3a8a" font-size="14" font-weight="800" text-anchor="middle">▭ 등교 버스 탑승</text>
        </g>

        <!-- 종료 단말 연결 -->
        <line id="l2-line-4-end" x1="350" y1="573" x2="350" y2="608" stroke="#64748b" stroke-width="3.5" marker-end="url(#arrow-l2)" />

        <!-- 타원 (단말): 종료 -->
        <g id="l2-blk-end">
          <rect x="235" y="610" width="230" height="48" rx="24" fill="#faf5ff" stroke="#a855f7" stroke-width="3" />
          <text x="350" y="640" fill="#581c87" font-size="15" font-weight="900" text-anchor="middle">⬭ 종료 (등교 성공)</text>
        </g>
      </g>
    `;
  }

  svg.innerHTML = content;
}

// --------------------------------------------------
// [Level 2] 예시 공방 알고리즘 가상 실행 시뮬레이터 (1:1 자연어 비교)
// --------------------------------------------------
let isL2Simulating = false;
let l2SimAbortController = null;

async function runL2WalkthroughSimulation() {
  const btn = document.getElementById('btn-l2-sim-run');

  // 이미 실행 중이면 중지 처리
  if (isL2Simulating) {
    if (l2SimAbortController) {
      l2SimAbortController.abort();
    }
    isL2Simulating = false;
    clearL2SimulationHighlights();
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>실행 시뮬레이션</span>`;
      btn.className = "entry-btn-play px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs";
    }
    return;
  }

  isL2Simulating = true;
  l2SimAbortController = new AbortController();
  const signal = l2SimAbortController.signal;

  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-stop text-[10px]"></i> <span>시뮬레이션 중지</span>`;
    btn.className = "px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer";
  }

  // 1. 전체 블록 드러내기
  revealAllL2Steps();
  clearL2SimulationHighlights();

  const delay = (ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });

  const highlightCard = (cardId) => {
    document.querySelectorAll('.l2-card-simulating').forEach(el => el.classList.remove('l2-card-simulating'));
    if (cardId) {
      const cardEl = document.getElementById(cardId);
      if (cardEl) {
        cardEl.classList.add('l2-card-simulating');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const highlightSvg = (blockId, lineId = null) => {
    document.querySelectorAll('.l2-svg-simulating').forEach(el => el.classList.remove('l2-svg-simulating'));
    document.querySelectorAll('.l2-line-simulating').forEach(el => el.classList.remove('l2-line-simulating'));
    if (blockId) {
      const bEl = document.getElementById(blockId);
      if (bEl) bEl.classList.add('l2-svg-simulating');
    }
    if (lineId) {
      const lEl = document.getElementById(lineId);
      if (lEl) lEl.classList.add('l2-line-simulating');
    }
  };

  try {
    // 0. 시작 단말
    highlightSvg('l2-blk-0');
    if (typeof playSfx === 'function') playSfx('step');
    await delay(600);

    highlightSvg('l2-blk-0', 'l2-line-0-1');
    await delay(400);

    // 1. 입출력: 현재 시각 확인
    highlightCard('l2-card-step-1');
    highlightSvg('l2-blk-1');
    if (typeof playSfx === 'function') playSfx('step');
    await delay(700);

    highlightSvg('l2-blk-1', 'l2-line-1-2');
    await delay(400);

    // 2. 처리: 기상 및 세수하기
    highlightCard('l2-card-step-2');
    highlightSvg('l2-blk-2');
    if (typeof playSfx === 'function') playSfx('step');
    await delay(700);

    highlightSvg('l2-blk-2', 'l2-line-2-3');
    await delay(400);

    // 3. 판단: 현재 시각 <= 07:30 ?
    highlightCard('l2-card-step-3');
    highlightSvg('l2-blk-3');
    if (typeof playSfx === 'function') playSfx('step');

    // 캔버스 중앙에 대화형 분기 선택 팝업 오버레이 표시
    const canvasWrap = document.getElementById('l2-canvas');
    let userChoice = '예';

    if (canvasWrap) {
      // 마름모 판단 기호로 캔버스 스크롤 부드럽게 자동 포커싱 (확장 제안 3)
      const decisionSvg = document.getElementById('l2-blk-3');
      if (decisionSvg) {
        decisionSvg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const overlay = document.createElement('div');
      overlay.className = 'l2-choice-overlay';
      overlay.id = 'l2-sim-choice-overlay';
      overlay.innerHTML = `
        <span class="text-xs font-black text-amber-950 flex items-center gap-1 shrink-0">
          <i class="fa-solid fa-clock text-amber-600"></i>
          <span>등교 시각 분기 선택:</span>
        </span>
        <button id="l2-btn-opt-yes" class="px-3.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1">
          <span>✓ 07:20 (예 ➔ 밥 먹기)</span>
        </button>
        <button id="l2-btn-opt-no" class="px-3.5 py-1 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1">
          <span>✗ 07:45 (아니오 ➔ 즉시 출발)</span>
        </button>
      `;
      canvasWrap.appendChild(overlay);

      userChoice = await new Promise((resolve, reject) => {
        const onAbort = () => {
          overlay.remove();
          reject(new Error('aborted'));
        };
        signal.addEventListener('abort', onAbort, { once: true });

        const btnYes = overlay.querySelector('#l2-btn-opt-yes');
        const btnNo = overlay.querySelector('#l2-btn-opt-no');
        if (btnYes) {
          btnYes.onclick = (e) => {
            e.stopPropagation();
            overlay.remove();
            resolve('예');
          };
        }
        if (btnNo) {
          btnNo.onclick = (e) => {
            e.stopPropagation();
            overlay.remove();
            resolve('아니오');
          };
        }
      });
    }

    if (userChoice === '예') {
      const yesActionEl = document.getElementById('l2-card-yes-action');
      if (yesActionEl) yesActionEl.classList.add('bg-emerald-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-emerald-300');
      highlightSvg(null, 'l2-line-yes');
      await delay(400);

      highlightSvg('l2-blk-yes');
      if (typeof playSfx === 'function') playSfx('step');
      await delay(800);

      highlightSvg('l2-blk-yes', 'l2-line-merge-yes');
      await delay(400);
      if (yesActionEl) yesActionEl.classList.remove('bg-emerald-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-emerald-300');
    } else {
      const noActionEl = document.getElementById('l2-card-no-action');
      if (noActionEl) noActionEl.classList.add('bg-rose-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-rose-300');
      highlightSvg(null, 'l2-line-no');
      await delay(400);

      highlightSvg('l2-blk-no');
      if (typeof playSfx === 'function') playSfx('step');
      await delay(800);

      highlightSvg('l2-blk-no', 'l2-line-merge-no');
      await delay(400);
      if (noActionEl) noActionEl.classList.remove('bg-rose-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-rose-300');
    }

    highlightSvg(null, 'l2-line-merge-center');
    await delay(300);

    // 4. 합류 & 등교 버스 탑승
    highlightCard('l2-card-step-4');
    highlightSvg('l2-blk-4');
    if (typeof playSfx === 'function') playSfx('step');
    await delay(700);

    highlightSvg('l2-blk-4', 'l2-line-4-end');
    await delay(400);

    // 종료
    highlightSvg('l2-blk-end');
    if (typeof playSfx === 'function') playSfx('success');
    await delay(1200);

    alert("🎉 [예시 공방 실행 시뮬레이션 완료!]\n좌측 자연어 명령어 레시피와 우측 순서도 기호가 1:1로 일치하며 등교 성공까지 완벽히 동작했습니다!");
  } catch (err) {
    // 중지됨 (사용자 취소 또는 오류)
  } finally {
    isL2Simulating = false;
    l2SimAbortController = null;
    clearL2SimulationHighlights();
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>실행 시뮬레이션</span>`;
      btn.className = "entry-btn-play px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs";
    }
  }
}

function clearL2SimulationHighlights() {
  document.querySelectorAll('.l2-card-simulating').forEach(el => el.classList.remove('l2-card-simulating'));
  document.querySelectorAll('.l2-svg-simulating').forEach(el => el.classList.remove('l2-svg-simulating'));
  document.querySelectorAll('.l2-line-simulating').forEach(el => el.classList.remove('l2-line-simulating'));
  document.querySelectorAll('.l2-choice-overlay, #l2-sim-choice-overlay').forEach(el => el.remove());
  const yesActionEl = document.getElementById('l2-card-yes-action');
  if (yesActionEl) yesActionEl.classList.remove('bg-emerald-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-emerald-300');
  const noActionEl = document.getElementById('l2-card-no-action');
  if (noActionEl) noActionEl.classList.remove('bg-rose-100', 'px-2', 'py-1', 'rounded-md', 'border', 'border-rose-300');
}

window.runL2WalkthroughSimulation = runL2WalkthroughSimulation;

// ==========================================
// 4. [Level 3] 나만의 백지 공방 & 자연어 카드 빌더 엔진
// ==========================================
let nlCards = [
  { id: "nl-1", type: "seq", text: "아침 알람을 듣고 침대에서 일어난다." },
  { id: "nl-2", type: "seq", text: "세수를 하고 거울을 본다." },
  { id: "nl-3", type: "sel", condition: "배가 고픈가?", yesAction: "토스트를 구워 먹는다.", noAction: "물 한 잔을 마신다." },
  { id: "nl-4", type: "seq", text: "가방을 메고 학교로 출발한다." }
];

let freeBlocks = [];
let freeConnections = [];
let nextBlockId = 1;

// 외부 모듈 및 테스트 환경 연동용 접근자
window.getFreeBlocks = () => freeBlocks;
window.setFreeBlocks = (blocks) => { freeBlocks = blocks; };
window.getFreeConnections = () => freeConnections;
window.setFreeConnections = (conns) => { freeConnections = conns; };
window.getNlCards = () => nlCards;
window.setNlCards = (cards) => { nlCards = cards; };

// AI 설계 검사 통과 및 시뮬레이션 완주 상태 플래그
window.isFlowchartAiPassed = false;
window.isFlowchartSimValidated = false;

// 상단 툴바 띵커보드 제출 버튼 상태 (AI 검사 통과 시 활성화)
function updateThinkerToolbarButton() {
  const btn = document.getElementById('btn-toolbar-thinker-submit');
  if (!btn) return;
  if (window.isFlowchartAiPassed) {
    btn.disabled = false;
    btn.className = "px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/25 active:scale-95 cursor-pointer animate-pulse";
    btn.innerHTML = `<i class="fa-solid fa-paper-plane text-[10px]"></i> <span>띵커보드 제출</span>`;
    btn.title = "AI 검사를 통과했습니다! 띵커보드에 포트폴리오를 제출하세요.";
  } else {
    btn.disabled = false;
    btn.className = "px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer";
    btn.innerHTML = `<i class="fa-solid fa-lock text-[10px] text-amber-500"></i> <span>AI 검사 후 제출</span>`;
    btn.title = "AI 설계 검사 통과 후 띵커보드에 제출할 수 있습니다";
  }
}
window.updateThinkerToolbarButton = updateThinkerToolbarButton;

// 캔버스 드래그 및 선 잇기 상태
let isDraggingBlock = false;
let draggedBlockObj = null;
let dragOffset = { x: 0, y: 0 };

let isConnecting = false;
let connectionSource = null; // { blockId, portType }

// 캔버스 엔트리식 무한 드래그 팬(Pan) 상태
let canvasPanX = 0;
let canvasPanY = 0;
let isPanningCanvas = false;
let panStartMouseX = 0;
let panStartMouseY = 0;
let panStartCanvasX = 0;
let panStartCanvasY = 0;

function applyCanvasPan() {
  const stage = document.getElementById('free-flowchart-stage');
  const canvas = document.getElementById('free-flowchart-canvas');
  if (stage) {
    stage.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px)`;
  }
  if (canvas) {
    canvas.style.backgroundPosition = `${canvasPanX}px ${canvasPanY}px`;
  }
}

window.getCanvasPan = () => ({ x: canvasPanX, y: canvasPanY });
window.setCanvasPan = (x, y) => {
  canvasPanX = x;
  canvasPanY = y;
  applyCanvasPan();
};

function resetCanvasPan() {
  canvasPanX = 0;
  canvasPanY = 0;
  applyCanvasPan();
  if (typeof playSfx === 'function') playSfx('snap');
}

function initCanvasPanning() {
  const canvas = document.getElementById('free-flowchart-canvas');
  if (!canvas || window._canvasPanningInitialized) return;
  window._canvasPanningInitialized = true;

  canvas.addEventListener('mousedown', (e) => {
    // 블록, 포트, 휴지통, 플로팅 제어기, 상단 툴바, 폼 입력 요소 클릭 시 팬 모드 제외
    if (
      e.target.closest('.free-block') || 
      e.target.closest('.flow-port') || 
      e.target.closest('#entry-trash-zone') ||
      e.target.closest('#sim-drag-floating-bar') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('textarea')
    ) {
      return;
    }

    isPanningCanvas = true;
    panStartMouseX = e.clientX;
    panStartMouseY = e.clientY;
    panStartCanvasX = canvasPanX;
    panStartCanvasY = canvasPanY;
    canvas.classList.add('canvas-panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanningCanvas) return;
    const dx = e.clientX - panStartMouseX;
    const dy = e.clientY - panStartMouseY;
    canvasPanX = panStartCanvasX + dx;
    canvasPanY = panStartCanvasY + dy;
    applyCanvasPan();
  });

  window.addEventListener('mouseup', () => {
    if (isPanningCanvas) {
      isPanningCanvas = false;
      const canvas = document.getElementById('free-flowchart-canvas');
      if (canvas) canvas.classList.remove('canvas-panning');
    }
  });
}

function initDraggableSimFloatingBar() {
  const bar = document.getElementById('sim-drag-floating-bar');
  const canvas = document.getElementById('free-flowchart-canvas');
  if (!bar || !canvas || bar._draggableInitialized) return;
  bar._draggableInitialized = true;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let barStartLeft = 0;
  let barStartTop = 0;

  const onDragStart = (e) => {
    // 버튼, 인풋 등 내부 인터랙티브 요소 클릭 시에는 드래그 방지
    if (
      e.target.closest('button') || 
      e.target.closest('input') || 
      e.target.closest('a') || 
      e.target.closest('select')
    ) {
      return;
    }

    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const canvasRect = canvas.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();

    // 캔버스 좌상단 기준 현재 바의 상대 좌표(px) 계산
    barStartLeft = barRect.left - canvasRect.left;
    barStartTop = barRect.top - canvasRect.top;
    startX = clientX;
    startY = clientY;

    // CSS bottom/translateX 기반에서 명시적인 left/top 픽셀 좌표계로 전환
    bar.style.bottom = 'auto';
    bar.style.transform = 'none';
    bar.style.left = `${barStartLeft}px`;
    bar.style.top = `${barStartTop}px`;

    document.body.style.userSelect = 'none';
    bar.classList.add('is-dragging');
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    const canvasRect = canvas.getBoundingClientRect();
    const barWidth = bar.offsetWidth;
    const barHeight = bar.offsetHeight;

    // 캔버스 경계(안쪽 마진 8px) 내에서만 자유 이동
    const minX = 8;
    const maxX = Math.max(minX, canvasRect.width - barWidth - 8);
    const minY = 8;
    const maxY = Math.max(minY, canvasRect.height - barHeight - 8);

    const targetX = Math.max(minX, Math.min(maxX, barStartLeft + dx));
    const targetY = Math.max(minY, Math.min(maxY, barStartTop + dy));

    bar.style.left = `${targetX}px`;
    bar.style.top = `${targetY}px`;
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    bar.classList.remove('is-dragging');
  };

  bar.addEventListener('mousedown', onDragStart);
  bar.addEventListener('touchstart', onDragStart, { passive: false });

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });

  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);
}
window.initDraggableSimFloatingBar = initDraggableSimFloatingBar;

function initLevel3FreeStudio() {
  renderNlCards();
  renderFreeCanvas();
  renderPresetBadges();
  initCanvasPanning();
  initDraggableSimFloatingBar();
}

function autoResizePresTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(30, el.scrollHeight) + 'px';
}

function autoResizeAllPresTextareas() {
  setTimeout(() => {
    document.querySelectorAll('.auto-expand-pres-input').forEach(ta => autoResizePresTextarea(ta));
  }, 30);
}

// --------------------------------------------------
// 자연어 카드 빌더 로직
// --------------------------------------------------
function autoResizeNlTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(34, el.scrollHeight) + 'px';
}

function autoResizeAllNlTextareas() {
  setTimeout(() => {
    document.querySelectorAll('.auto-expand-nl-input').forEach(ta => {
      autoResizeNlTextarea(ta);
    });
  }, 30);
}

function renderNlCards() {
  const container = document.getElementById('nl-cards-container');
  if (!container) return;

  if (nlCards.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 text-xs sm:text-sm space-y-2">
        <div>📝 아직 작성된 자연어 카드가 없습니다.</div>
        <div class="text-[11px] text-slate-400">상단의 [순차], [선택], [반복] 버튼을 눌러 알고리즘 단계를 추가해 보세요!</div>
      </div>
    `;
    return;
  }

  container.innerHTML = nlCards.map((c, idx) => {
    if (c.type === 'seq') {
      return `
        <div id="card-${c.id}" class="p-3 bg-white border-2 border-blue-200 rounded-2xl shadow-xs space-y-2 nl-card-seq transition hover:border-blue-400 group">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center text-[11px]">${idx + 1}</span>
              <span class="font-bold text-blue-700">순차 단계 (행동 실행)</span>
            </div>
            <button onclick="removeNlCard('${c.id}')" class="text-slate-300 hover:text-rose-500 transition p-1" title="카드 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div class="space-y-1">
            <textarea rows="1" 
                      oninput="autoResizeNlTextarea(this); updateNlCardText('${c.id}', this.value)" 
                      placeholder="어떤 행동을 하나요? (예: 자판기 동전 투입구에 동전을 넣는다)" 
                      class="auto-expand-nl-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed overflow-hidden transition-all"
            >${c.text || ''}</textarea>
          </div>
        </div>
      `;
    } else if (c.type === 'sel') {
      return `
        <div id="card-${c.id}" class="p-3 bg-white border-2 border-amber-200 rounded-2xl shadow-xs space-y-2.5 nl-card-sel transition hover:border-amber-400 group">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-lg bg-amber-500 text-white font-black flex items-center justify-center text-[11px]">${idx + 1}</span>
              <span class="font-bold text-amber-700">선택 단계 (조건 분기)</span>
            </div>
            <button onclick="removeNlCard('${c.id}')" class="text-slate-300 hover:text-rose-500 transition p-1" title="카드 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          
          <!-- 1. 조건 검사 (가로 100% full width) -->
          <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-1">
            <div class="flex items-center justify-between text-[11px] font-black text-amber-800">
              <span>🤔 만약 아래 조건이 참(True)이라면?</span>
            </div>
            <textarea rows="1" 
                      oninput="autoResizeNlTextarea(this); updateNlCardField('${c.id}', 'condition', this.value)" 
                      placeholder="검사할 질문/조건 (예: 투입한 동전이 자판기 인식 기준에 맞는가?)" 
                      class="auto-expand-nl-input w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs sm:text-sm font-bold text-amber-950 focus:outline-none focus:border-amber-500 resize-none leading-relaxed overflow-hidden transition-all"
            >${c.condition || ''}</textarea>
          </div>

          <!-- 2. [예] & [아니오] 분기 액션 (각각 가로 100% full width) -->
          <div class="space-y-1.5 text-xs">
            <div class="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
              <div class="flex items-center gap-1 text-[11px] font-black text-emerald-700">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>[예] 참일 때 실행할 행동:</span>
              </div>
              <textarea rows="1" 
                        oninput="autoResizeNlTextarea(this); updateNlCardField('${c.id}', 'yesAction', this.value)" 
                        placeholder="예 일 때 할 일 (예: 원하는 음료수 버튼에 불이 켜진다)" 
                        class="auto-expand-nl-input w-full px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed overflow-hidden transition-all"
              >${c.yesAction || ''}</textarea>
            </div>

            <div class="p-2 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
              <div class="flex items-center gap-1 text-[11px] font-black text-rose-600">
                <i class="fa-solid fa-xmark text-[10px]"></i>
                <span>[아니오] 거짓일 때 실행할 행동:</span>
              </div>
              <textarea rows="1" 
                        oninput="autoResizeNlTextarea(this); updateNlCardField('${c.id}', 'noAction', this.value)" 
                        placeholder="아니오 일 때 할 일 (예: 동전이 인식되지 않아 반환구로 나온다)" 
                        class="auto-expand-nl-input w-full px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500 resize-none leading-relaxed overflow-hidden transition-all"
              >${c.noAction || ''}</textarea>
            </div>
          </div>
        </div>
      `;
    } else if (c.type === 'loop') {
      return `
        <div id="card-${c.id}" class="p-3 bg-white border-2 border-emerald-200 rounded-2xl shadow-xs space-y-2.5 nl-card-loop transition hover:border-emerald-400 group">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-[11px]">${idx + 1}</span>
              <span class="font-bold text-emerald-700">반복 단계 (조건 루프)</span>
            </div>
            <button onclick="removeNlCard('${c.id}')" class="text-slate-300 hover:text-rose-500 transition p-1" title="카드 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>

          <!-- 1. 반복 조건 (가로 100%) -->
          <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1">
            <div class="text-[11px] font-black text-emerald-800">
              <span>🔁 반복 지속 조건 (아래 조건이 참인 동안 반복):</span>
            </div>
            <textarea rows="1" 
                      oninput="autoResizeNlTextarea(this); updateNlCardField('${c.id}', 'condition', this.value)" 
                      placeholder="탈출/지속 조건 (예: 올바른 비밀번호를 입력할 때까지)" 
                      class="auto-expand-nl-input w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs sm:text-sm font-bold text-emerald-950 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed overflow-hidden transition-all"
            >${c.condition || ''}</textarea>
          </div>

          <!-- 2. 반복 실행 행동 (가로 100%) -->
          <div class="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
            <div class="flex items-center gap-1 text-[11px] font-black text-slate-700">
              <i class="fa-solid fa-rotate text-emerald-600 text-[10px]"></i>
              <span>반복할 행동:</span>
            </div>
            <textarea rows="1" 
                      oninput="autoResizeNlTextarea(this); updateNlCardField('${c.id}', 'loopAction', this.value)" 
                      placeholder="반복할 행동 (예: 비밀번호를 다시 입력받는다)" 
                      class="auto-expand-nl-input w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed overflow-hidden transition-all"
            >${c.loopAction || ''}</textarea>
          </div>
        </div>
      `;
    }
  }).join('');

  autoResizeAllNlTextareas();
}

function addNlCard(type) {
  const newId = `nl-${Date.now()}`;
  if (type === 'seq') {
    nlCards.push({ id: newId, type: 'seq', text: '' });
  } else if (type === 'sel') {
    nlCards.push({ id: newId, type: 'sel', condition: '', yesAction: '', noAction: '' });
  } else if (type === 'loop') {
    nlCards.push({ id: newId, type: 'loop', condition: '', loopAction: '' });
  }
  window.isFlowchartAiPassed = false;
  renderNlCards();
  if (typeof playSfx === 'function') playSfx('snap');

  setTimeout(() => {
    const el = document.getElementById(`card-${newId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    autoResizeAllNlTextareas();
  }, 60);
}

function removeNlCard(cardId) {
  nlCards = nlCards.filter(c => c.id !== cardId);
  window.isFlowchartAiPassed = false;
  renderNlCards();
  if (typeof playSfx === 'function') playSfx('step');
}

function updateNlCardText(cardId, text) {
  const c = nlCards.find(x => x.id === cardId);
  if (c) c.text = text;
}

function updateNlCardField(cardId, field, value) {
  const c = nlCards.find(x => x.id === cardId);
  if (c) c[field] = value;
}

// --------------------------------------------------
// 추상화 닥터 재료 바구니 연동
// --------------------------------------------------
function renderPresetBadges() {
  const tray = document.getElementById('abstraction-badge-tray');
  if (!tray) return;

  const pres = window.latestAbstractionPrescription || (window.defaultAbstractionPresets ? window.defaultAbstractionPresets[0] : null);

  if (!pres) {
    tray.innerHTML = `<span class="text-xs text-slate-400 italic">추상화 워크북을 먼저 진행하면 재료가 자동으로 채워집니다.</span>`;
    return;
  }

  const items = [];
  if (pres.currentStatus) items.push({ label: `현재: ${pres.currentStatus}`, type: "current" });
  if (pres.goalStatus) items.push({ label: `목표: ${pres.goalStatus}`, type: "goal" });
  if (pres.conditions) pres.conditions.forEach(c => items.push({ label: `조건: ${c}`, type: "cond" }));
  if (pres.coreVariables) pres.coreVariables.forEach(v => items.push({ label: `변수: ${v}`, type: "var" }));

  tray.innerHTML = items.map(it => `
    <button onclick="applyBadgeToCard('${it.label}')" class="px-2.5 py-1 bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-700 border border-slate-200 rounded-lg text-[11px] font-bold transition shadow-2xs flex items-center gap-1">
      <i class="fa-solid fa-tag text-[9px] text-violet-500"></i>
      <span>${it.label}</span>
    </button>
  `).join('');
}

function applyBadgeToCard(badgeText) {
  addNlCard('seq');
  const lastCard = nlCards[nlCards.length - 1];
  if (lastCard) {
    lastCard.text = badgeText;
    renderNlCards();
  }
}

/// --------------------------------------------------
// 🩺 스마트 문제 분석 & 다단계 순서도 처방전 팝업 엔진
// --------------------------------------------------
const PRESCRIPTION_PRESETS = {
  weather: {
    title: "오늘 날씨별 옷차림 추천",
    goal: "오늘 기온에 맞는 옷차림 결정",
    variables: "현재 기온, 옷차림",
    steps: [
      { type: "seq", text: "오늘 현재 기온 확인하기" },
      { type: "sel", condition: "현재 기온이 4℃ 이하인가?", yesAction: "두꺼운 롱패딩 착용", noAction: "가벼운 외투 착용" },
      { type: "seq", text: "등교 외출 준비 완료" }
    ]
  },
  school: {
    title: "지각 방지 등교 작전",
    goal: "8시 10분 등교 버스 탑승",
    variables: "현재 시각, 알람 소리",
    steps: [
      { type: "seq", text: "오전 7시 알람 듣고 기상" },
      { type: "seq", text: "세수 후 교복 착용" },
      { type: "sel", condition: "현재 시각이 7시 40분 이전인가?", yesAction: "아침 식사 후 정류장 이동", noAction: "서둘러 정류장으로 이동" },
      { type: "seq", text: "등교 버스 안전 탑승" }
    ]
  },
  sandwich: {
    title: "통새우 샌드위치 조리",
    goal: "맛있는 통새우 샌드위치 완성",
    variables: "식빵, 딸기잼, 통새우, 치즈",
    steps: [
      { type: "seq", text: "식빵 2장 굽기" },
      { type: "seq", text: "식빵에 딸기잼 바르기" },
      { type: "seq", text: "양상추와 통새우 올리기" },
      { type: "sel", condition: "치즈를 녹여 먹을 것인가?", yesAction: "전자레인지 20초 데우기", noAction: "신선한 상태로 계속 조리" },
      { type: "seq", text: "나머지 식빵 덮고 자르기" }
    ]
  },
  login: {
    title: "비밀번호 5회 검증",
    goal: "비밀번호 검증 후 로그인",
    variables: "입력 아이디, 입력 비밀번호",
    steps: [
      { type: "seq", text: "아이디와 비밀번호 입력" },
      { type: "sel", condition: "입력한 비밀번호가 일치하는가?", yesAction: "로그인 성공 후 메인 이동", noAction: "오류 안내 후 재입력 요청" },
      { type: "seq", text: "서비스 메인 화면 진입" }
    ]
  },
  study: {
    title: "25분 집중 뽀모도로 타이머",
    goal: "25분 집중 공부 후 5분 휴식",
    variables: "공부 시간(분), 타이머 알람",
    steps: [
      { type: "seq", text: "스마트폰 방해금지 설정" },
      { type: "seq", text: "25분 집중 타이머 시작" },
      { type: "loop", condition: "25분에 도달할 때까지", loopAction: "필기와 공부에만 몰입" },
      { type: "seq", text: "알람 시 5분간 스트레칭 휴식" }
    ]
  }
};

let currentPrescriptionPresetKey = 'sandwich';
let currentPrescriptionSteps = [];

function renderPrescriptionSteps() {
  const container = document.getElementById('pres-steps-list');
  if (!container) return;

  if (!currentPrescriptionSteps || currentPrescriptionSteps.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">등록된 조립 단계가 없습니다. 상단의 '+ 단계 추가' 버튼을 눌러보세요.</div>`;
    return;
  }

  container.innerHTML = currentPrescriptionSteps.map((s, idx) => {
    if (s.type === 'seq') {
      return `
        <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs space-y-1 relative">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>단계 ${idx + 1}. [순차 실행]</span>
            </span>
            <button type="button" onclick="removePrescriptionStep(${idx})" class="text-slate-400 hover:text-rose-500 transition px-1 cursor-pointer" title="단계 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'text', this.value)" 
                    class="auto-expand-pres-input w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none leading-relaxed transition" 
                    placeholder="수행할 핵심 단일 동작 입력 (15자 내외)">${escapeHtml(s.text || '')}</textarea>
        </div>
      `;
    } else if (s.type === 'sel') {
      return `
        <div class="bg-amber-50/50 border border-amber-200 rounded-xl p-2.5 shadow-2xs space-y-1.5 relative">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>단계 ${idx + 1}. [조건 분기 - 선택]</span>
            </span>
            <button type="button" onclick="removePrescriptionStep(${idx})" class="text-amber-400 hover:text-rose-500 transition px-1 cursor-pointer" title="단계 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div class="space-y-1">
            <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'condition', this.value)" 
                      class="auto-expand-pres-input w-full text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-amber-950 focus:outline-none focus:border-amber-500 resize-none leading-relaxed transition" 
                      placeholder="만약 [조건]인가? (15자 내외)">${escapeHtml(s.condition || '')}</textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div class="flex items-center gap-1">
              <span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px] flex-shrink-0">예</span>
              <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'yesAction', this.value)" 
                        class="auto-expand-pres-input flex-1 text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed transition" 
                        placeholder="예 동작 (15자 내외)">${escapeHtml(s.yesAction || '')}</textarea>
            </div>
            <div class="flex items-center gap-1">
              <span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[10px] flex-shrink-0">아니오</span>
              <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'noAction', this.value)" 
                        class="auto-expand-pres-input flex-1 text-xs bg-white border border-rose-300 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:border-rose-500 resize-none leading-relaxed transition" 
                        placeholder="아니오 동작 (15자 내외)">${escapeHtml(s.noAction || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    } else if (s.type === 'loop') {
      return `
        <div class="bg-emerald-50/50 border border-emerald-200 rounded-xl p-2.5 shadow-2xs space-y-1.5 relative">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>단계 ${idx + 1}. [반복 루프]</span>
            </span>
            <button type="button" onclick="removePrescriptionStep(${idx})" class="text-emerald-400 hover:text-rose-500 transition px-1 cursor-pointer" title="단계 삭제">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'condition', this.value)" 
                      class="auto-expand-pres-input w-full text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed transition" 
                      placeholder="[반복 조건] ~할 때까지 (15자 내외)">${escapeHtml(s.condition || '')}</textarea>
            <textarea rows="1" oninput="autoResizePresTextarea(this); updatePrescriptionStep(${idx}, 'loopAction', this.value)" 
                      class="auto-expand-pres-input w-full text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed transition" 
                      placeholder="반복 수행 동작 (15자 내외)">${escapeHtml(s.loopAction || '')}</textarea>
          </div>
        </div>
      `;
    }
    return '';
  }).join('');

  autoResizeAllPresTextareas();
}

function addPrescriptionStep(type) {
  if (type === 'seq') {
    currentPrescriptionSteps.push({ type: 'seq', text: '정해진 순서대로 명령을 수행한다.' });
  } else if (type === 'sel') {
    currentPrescriptionSteps.push({ type: 'sel', condition: '조건을 만족하는가?', yesAction: '예 동작 수행', noAction: '아니오 동작 수행' });
  } else if (type === 'loop') {
    currentPrescriptionSteps.push({ type: 'loop', condition: '목표에 도달할 때까지', loopAction: '동작을 반복 실행한다' });
  }
  renderPrescriptionSteps();
  if (typeof playSfx === 'function') playSfx('snap');
}

function removePrescriptionStep(idx) {
  currentPrescriptionSteps.splice(idx, 1);
  renderPrescriptionSteps();
  if (typeof playSfx === 'function') playSfx('step');
}

function updatePrescriptionStep(idx, key, val) {
  if (currentPrescriptionSteps[idx]) {
    currentPrescriptionSteps[idx][key] = val;
  }
}

function openPrescriptionModal() {
  const modal = document.getElementById('prescription-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // 최신 프리셋 로드
  selectPrescriptionPreset(currentPrescriptionPresetKey || 'sandwich');

  if (typeof playSfx === 'function') playSfx('btn');
}

function closePrescriptionModal() {
  const modal = document.getElementById('prescription-modal');
  if (modal) modal.classList.add('hidden');
}

function switchPrescriptionTab(tabKey) {
  const tabPresets = document.getElementById('pres-tab-presets');
  const tabCustom = document.getElementById('pres-tab-custom');
  const panelPresets = document.getElementById('pres-panel-presets');
  const panelCustom = document.getElementById('pres-panel-custom');

  if (tabKey === 'presets') {
    if (tabPresets) {
      tabPresets.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition bg-violet-600 text-white shadow-xs";
    }
    if (tabCustom) {
      tabCustom.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100";
    }
    if (panelPresets) panelPresets.classList.remove('hidden');
    if (panelCustom) panelCustom.classList.add('hidden');
    selectPrescriptionPreset(currentPrescriptionPresetKey || 'sandwich');
  } else {
    if (tabPresets) {
      tabPresets.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100";
    }
    if (tabCustom) {
      tabCustom.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition bg-violet-600 text-white shadow-xs";
    }
    if (panelPresets) panelPresets.classList.add('hidden');
    if (panelCustom) panelCustom.classList.remove('hidden');

    const curInp = document.getElementById('pres-custom-cur');
    if (curInp && !curInp.value) {
      setCustomIdeaPreset('vending');
    }
  }
  if (typeof playSfx === 'function') playSfx('btn');
}

function setCustomIdeaPreset(type) {
  const curInp = document.getElementById('pres-custom-cur');
  const goalInp = document.getElementById('pres-custom-goal');
  if (type === 'vending') {
    if (curInp) curInp.value = "목이 마른데 동전을 쥐고 자판기 앞에 서 있는 상태";
    if (goalInp) goalInp.value = "동전을 투입하여 원하는 시원한 음료수를 뽑아 마시는 상태";
  } else if (type === 'bus') {
    if (curInp) curInp.value = "아침 7시 40분에 일어나서 등교 버스 도착 시간을 모르는 상태";
    if (goalInp) goalInp.value = "버스 도착 시간을 확인하고 지각하지 않고 등교 버스에 탑승하는 상태";
  } else if (type === 'recycle') {
    if (curInp) curInp.value = "다 마신 플라스틱 음료수 페트병에 라벨이 붙어있는 상태";
    if (goalInp) goalInp.value = "라벨을 떼어내고 세척 후 플라스틱 수거함에 올바르게 분리수거하는 상태";
  } else if (type === 'study') {
    if (curInp) curInp.value = "공부를 시작하려는데 스마트폰 때문에 집중력이 흐트러지는 상태";
    if (goalInp) goalInp.value = "25분 집중 타이머를 가동하고 알람이 울릴 때까지 공부를 마치는 상태";
  }
  if (typeof playSfx === 'function') playSfx('snap');
}

async function requestSolarPrescription() {
  const btn = document.getElementById('btn-solar-prescription');
  const cur = (document.getElementById('pres-custom-cur')?.value || "").trim();
  const goal = (document.getElementById('pres-custom-goal')?.value || "").trim();

  if (!cur || !goal) {
    alert("현재 상태와 목표 상태를 모두 입력해 주세요!");
    return;
  }

  const origBtnHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-amber-300"></i> <span>Solar AI가 입체적 다단계 레시피를 분석 중입니다...</span>`;
  }

  const prompt = `당신은 대한민국 2022 개정 중학교 정보 교과 '알고리즘 설계와 순서도' 단원의 친절한 AI 지도교사입니다.
학생이 입력한 [현재 상태]에서 [목표 상태]에 도달하기 위한 현실적이고 논리적인 다단계 알고리즘 레시피(순차, 선택, 반복 구조 활용)를 작성해 주세요.

[현재 상태]: "${cur}"
[목표 상태]: "${goal}"

[★매우 중요한 작성 원칙 - One Action, One Box]:
1. 중2 학생용 순서도 기호(직사각형, 마름모) 안에 쏙 들어갈 수 있도록, 모든 문장은 반드시 15자 내외(최대 20자)의 단일 핵심 행동/조건으로 아주 짧고 간결하게 작성하세요.
2. 절대로 여러 행동을 접속사(~하고, ~한 뒤, ~하며)로 길게 엮지 마세요!
   - ❌ 절대 금지: "책상 위에 공부 자료만 올려두고, 스마트폰은 무음 모드로 설정한 뒤 서랍에 둔다."
   - ⭕ 바른 작성 예:
     1단계: "스마트폰 방해금지 설정"
     2단계: "스마트폰을 서랍에 보관"
     3단계: "25분 타이머 시작"
3. goal: 10~15자 내외 문제 한 줄 요약
4. variables: 핵심 준비물 또는 상태 변수들 (쉼표로 구분)
5. steps: 학생이 쉽게 이해할 수 있는 3~5개의 단계 배열:
   - type: "seq" (순차 실행), "sel" (조건 선택 분기), "loop" (반복)
   - seq인 경우: {"type": "seq", "text": "15자 이내 핵심 단일 명령"}
   - sel인 경우: {"type": "sel", "condition": "15자 이내 질문형 조건?", "yesAction": "15자 이내 예 동작", "noAction": "15자 이내 아니오 동작"}
   - loop인 경우: {"type": "loop", "condition": "15자 이내 ~할 때까지", "loopAction": "15자 이내 반복 행동"}

반드시 아래 JSON 포맷으로만 응답하세요:
{
  "goal": "...",
  "variables": "...",
  "steps": [
    { "type": "seq", "text": "..." },
    { "type": "sel", "condition": "...", "yesAction": "...", "noAction": "..." },
    { "type": "seq", "text": "..." }
  ]
}`;

  try {
    const res = await fetch("https://api.upstage.ai/v1/solar/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${UPSTAGE_API_KEY}`
      },
      body: JSON.stringify({
        model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error("API Response Error");
    const data = await res.json();
    const raw = data.choices[0].message.content;

    let parsed = null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {}
    }

    if (parsed) {
      if (parsed.goal) document.getElementById('pres-inp-goal').value = parsed.goal;
      if (parsed.variables) document.getElementById('pres-inp-variables').value = parsed.variables;
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        currentPrescriptionSteps = parsed.steps;
      } else {
        // 폴백
        currentPrescriptionSteps = [
          { type: "seq", text: `[${parsed.variables || '데이터'}] 확인` },
          { type: "sel", condition: "조건을 충족하는가?", yesAction: parsed.goal || "성공 처리", noAction: "보완 후 재시도" },
          { type: "seq", text: `${parsed.goal || '목표'} 달성 완료` }
        ];
      }
      renderPrescriptionSteps();
    } else {
      throw new Error("JSON 파싱 실패");
    }

    if (typeof playSfx === 'function') playSfx('success');
  } catch (err) {
    // 안전한 룰 기반 폴백
    document.getElementById('pres-inp-goal').value = goal.slice(0, 15);
    document.getElementById('pres-inp-variables').value = "상태 데이터, 판정 기준";
    currentPrescriptionSteps = [
      { type: "seq", text: "초기 상태 확인 및 데이터 준비" },
      { type: "sel", condition: "목표 조건 충족하는가?", yesAction: goal.slice(0, 15), noAction: "문제 보완 후 재시도" },
      { type: "seq", text: "최종 목표 달성 확인" }
    ];
    renderPrescriptionSteps();
    if (typeof playSfx === 'function') playSfx('snap');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
    }
  }
}

function selectPrescriptionPreset(key) {
  const data = PRESCRIPTION_PRESETS[key];
  if (!data) return;
  currentPrescriptionPresetKey = key;

  // 카드 활성화 보더 갱신
  ['weather', 'school', 'sandwich', 'login'].forEach(k => {
    const card = document.getElementById(`preset-card-${k}`);
    if (card) {
      if (k === key) {
        card.className = "p-3.5 rounded-2xl border-2 border-violet-500 bg-violet-50/60 cursor-pointer transition hover:shadow-xs space-y-1 relative";
      } else {
        card.className = "p-3.5 rounded-2xl border-2 border-slate-200 hover:border-violet-300 bg-white cursor-pointer transition hover:shadow-xs space-y-1 relative";
      }
    }
  });

  // 폼 입력 필드 채우기
  const elGoal = document.getElementById('pres-inp-goal');
  const elVars = document.getElementById('pres-inp-variables');

  if (elGoal) elGoal.value = data.goal;
  if (elVars) elVars.value = data.variables;

  // 다단계 단계 배열 깊은 복사 후 렌더링
  currentPrescriptionSteps = JSON.parse(JSON.stringify(data.steps || []));
  renderPrescriptionSteps();
}

function applyPrescriptionDraft() {
  const goal = (document.getElementById('pres-inp-goal')?.value || "목표 상태 달성").trim();
  const vars = (document.getElementById('pres-inp-variables')?.value || "입력 데이터").trim();
  const customCur = (document.getElementById('pres-custom-cur')?.value || "").trim();
  const customGoal = (document.getElementById('pres-custom-goal')?.value || "").trim();

  const finalGoal = customGoal || goal || "목표 상태 달성";
  const finalCur = customCur || (finalGoal ? `[${finalGoal}] 시작 전 상태` : "알고리즘 문제 발생 및 초기 상태");

  // 1. 띵커보드 및 전역 상태 1순위 즉시 동기화 (버그 원천 해결!)
  window.latestAbstractionPrescription = {
    currentStatus: finalCur,
    goalStatus: finalGoal,
    coreVariables: vars.split(',').map(s => s.trim()).filter(Boolean),
    conditions: currentPrescriptionSteps.filter(s => s.type === 'sel').map(s => s.condition)
  };

  const thinkerCur = document.getElementById('thinker-cur-status');
  const thinkerGoal = document.getElementById('thinker-goal-status');
  if (thinkerCur) thinkerCur.value = finalCur;
  if (thinkerGoal) thinkerGoal.value = finalGoal;

  // 1. 상단 재료 바구니 (badge-tray) 칩 갱신
  const tray = document.getElementById('abstraction-badge-tray');
  if (tray) {
    tray.innerHTML = `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
        <i class="fa-solid fa-flag-checkered text-[9px]"></i> 목표: ${goal}
      </span>
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
        <i class="fa-solid fa-database text-[9px]"></i> 변수: ${vars}
      </span>
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
        <i class="fa-solid fa-list-check text-[9px]"></i> 단계: ${currentPrescriptionSteps.length}단계 레시피
      </span>
    `;
  }

  // 2. 좌측 자연어 기획서 카드 채우기 (다단계 알고리즘 100% 반영!)
  if (currentPrescriptionSteps && currentPrescriptionSteps.length > 0) {
    nlCards = currentPrescriptionSteps.map((s, idx) => {
      const id = `nl-${Date.now()}-${idx}`;
      if (s.type === 'seq') {
        return { id, type: 'seq', text: s.text || '명령 실행' };
      } else if (s.type === 'sel') {
        return {
          id,
          type: 'sel',
          condition: s.condition || '조건 검사',
          yesAction: s.yesAction || '예 실행',
          noAction: s.noAction || '아니오 실행'
        };
      } else if (s.type === 'loop') {
        return {
          id,
          type: 'loop',
          condition: s.condition || '반복 조건',
          loopAction: s.loopAction || '반복 실행'
        };
      }
      return { id, type: 'seq', text: s.text || '실행' };
    });
  } else {
    nlCards = [
      { id: `nl-${Date.now()}-1`, type: "seq", text: `[${vars}] 자료를 준비한다.` },
      { id: `nl-${Date.now()}-2`, type: "seq", text: `${goal} 완료!` }
    ];
  }
  renderNlCards();

  // 3. 우측 자유 캔버스는 완성본 대신, 기본 [시작]과 [종료] 단말 기호만 배치!
  // 학생이 직접 좌측 레시피를 보면서 기호를 꺼내 조립할 수 있도록 학습 주도성 보장!
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  const canvasWidth = stage ? stage.clientWidth : 600;
  const centerX = Math.max(30, Math.floor((canvasWidth - 210) / 2));

  freeBlocks = [
    { id: "blk-start", shape: "terminal", type: "terminal", text: "시작", x: centerX, y: 35 },
    { id: "blk-end", shape: "terminal", type: "terminal", text: "종료", x: centerX, y: 480 }
  ];
  freeConnections = [];

  renderFreeCanvas();
  closePrescriptionModal();

  if (typeof playSfx === 'function') playSfx('success');

  // 학생 가이드 알림 토스트
  alert(`🎉 자연어 알고리즘 기획서가 완성되었습니다!\n\n좌측의 ${nlCards.length}단계 레시피 순서를 보면서, 가운데 기호 보관함에서 필요한 기호(단말, 입출력, 처리, 판단)를 꺼내 캔버스에 나만의 순서도를 직접 완성해 보세요!`);
}

// 하위 호환성 유지 래퍼
function importAbstractionPrescription() {
  openPrescriptionModal();
}

// --------------------------------------------------
// 자유 캔버스 & 스마트 유도등(Port Glow) 엔진
// --------------------------------------------------
function renderFreeCanvas() {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  if (!canvas || !stage) return;

  if (freeBlocks.length === 0) {
    const stageWidth = stage.clientWidth || 600;
    const centerX = Math.max(30, Math.floor((stageWidth - 190) / 2));
    // 기본 시작/종료 블록 초기 배치 (캔버스 중앙 정렬)
    freeBlocks = [
      { id: "blk-start", shape: "terminal", type: "terminal", text: "시작", x: centerX, y: 40 },
      { id: "blk-p1", shape: "process", type: "process", text: "알고리즘 명령 실행", x: centerX, y: 160 },
      { id: "blk-end", shape: "terminal", type: "terminal", text: "종료", x: centerX, y: 300 }
    ];
    freeConnections = [
      { from: "blk-start", fromPort: "out", to: "blk-p1", toPort: "in" },
      { from: "blk-p1", fromPort: "out", to: "blk-end", toPort: "in" }
    ];
  }

  // 1. 기존 블록 요소들 제거
  stage.querySelectorAll('.free-block').forEach(b => b.remove());

  // 2. 블록들 렌더링
  freeBlocks.forEach(b => {
    const el = createFreeBlockDOM(b);
    stage.appendChild(el);
  });

  // 3. SVG 연결선 렌더링
  renderFreeConnections();
  if (typeof updateThinkerToolbarButton === 'function') updateThinkerToolbarButton();
}

// draw.io 스타일 4방향(Top, Bottom, Left, Right) 자석 연결점 생성 함수
function getBlockPortsHTML(b) {
  const isStart = b.id === 'blk-start' || b.text === '시작';
  const isEnd = b.id === 'blk-end' || b.text === '종료';
  const isDecision = b.shape === 'decision';

  let ports = [];

  // 1. 상단 연결점 (시작 기호 제외)
  if (!isStart) {
    ports.push(`
      <div id="port-in-${b.id}" class="flow-port port-top" 
           data-block-id="${b.id}" data-port-type="in"
           title="상단 연결점" 
           onmousedown="startConnecting('${b.id}', 'in', event)"
           onmouseup="handlePortMouseUp('${b.id}', 'in')"></div>
    `);
  }

  // 2. 하단 연결점 (종료 기호 제외)
  if (!isEnd) {
    const pName = isDecision ? 'yes' : 'out';
    ports.push(`
      <div id="port-${pName}-${b.id}" class="flow-port port-bottom ${isDecision ? '!bg-emerald-600' : ''}" 
           data-block-id="${b.id}" data-port-type="${pName}"
           title="${isDecision ? '[예] 분기점 (하단)' : '하단 연결점'}" 
           onmousedown="startConnecting('${b.id}', '${pName}', event)"
           onmouseup="handlePortMouseUp('${b.id}', '${pName}')"></div>
    `);
  }

  // 3. 좌측 연결점
  const leftName = 'left';
  ports.push(`
    <div id="port-${leftName}-${b.id}" class="flow-port port-left ${isDecision ? '!bg-amber-500' : ''}" 
         data-block-id="${b.id}" data-port-type="${leftName}"
         title="${isDecision ? '[분기선] (좌측)' : '좌측 연결점'}" 
         onmousedown="startConnecting('${b.id}', '${leftName}', event)"
         onmouseup="handlePortMouseUp('${b.id}', '${leftName}')"></div>
  `);

  // 4. 우측 연결점
  const rightName = isDecision ? 'no' : 'right';
  ports.push(`
    <div id="port-${rightName}-${b.id}" class="flow-port port-right ${isDecision ? '!bg-amber-500' : ''}" 
         data-block-id="${b.id}" data-port-type="${rightName}"
         title="${isDecision ? '[아니오] 분기점 (우측)' : '우측 연결점'}" 
         onmousedown="startConnecting('${b.id}', '${rightName}', event)"
         onmouseup="handlePortMouseUp('${b.id}', '${rightName}')"></div>
  `);

  return ports.join('');
}

let selectedBlockId = null;

function selectCanvasBlock(blockId) {
  selectedBlockId = blockId;
  document.querySelectorAll('.free-block').forEach(el => {
    el.classList.toggle('selected-block', el.id === `free-blk-${blockId}`);
  });
}

function deselectCanvasBlock() {
  selectedBlockId = null;
  document.querySelectorAll('.free-block').forEach(el => {
    el.classList.remove('selected-block');
  });
}

// draw.io 스타일 전역 키보드 단축키 (Delete / Backspace 키로 선택 블록 삭제)
if (!window._flowchartKeydownAttached) {
  window._flowchartKeydownAttached = true;
  window.addEventListener('keydown', (e) => {
    // 텍스트 입력 중일 때는 블록 삭제 차단
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) {
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
      e.preventDefault();
      removeCanvasBlock(selectedBlockId);
      deselectCanvasBlock();
    }
  });

  // 캔버스 빈 영역 클릭 시 블록 선택 해제
  document.addEventListener('click', (e) => {
    if (e.target.id === 'free-flowchart-canvas' || e.target.id === 'free-flowchart-svg' || e.target.id === 'free-flowchart-stage') {
      deselectCanvasBlock();
    }
  });
}

function createFreeBlockDOM(b) {
  const div = document.createElement('div');
  div.id = `free-blk-${b.id}`;

  const isTerminal = b.shape === "terminal";
  const isIO = b.shape === "io";
  const isDecision = b.shape === "decision";
  const isDeletable = true; // 모든 블록(단말 포함) 자유 삭제 허용

  const portsHtml = getBlockPortsHTML(b);

  if (isDecision) {
    // 4. 판단 (Decision) : 완벽한 45도 다이아몬드 마름모 블록
    div.className = "free-block shape-decision-block select-none";
    div.style.left = `${b.x}px`;
    div.style.top = `${b.y}px`;

    const deleteBtn = isDeletable 
      ? `<button onclick="removeCanvasBlock('${b.id}', event)" class="text-amber-500/60 hover:text-rose-600 transition pointer-events-auto ml-1" title="블록 삭제"><i class="fa-solid fa-xmark text-[10px]"></i></button>`
      : '';

    div.innerHTML = `
      <svg class="decision-svg-bg" viewBox="0 0 220 120" preserveAspectRatio="none">
        <polygon points="110,4 216,60 110,116 4,60" />
      </svg>
      ${portsHtml}
      <div class="decision-content">
        <div class="w-full flex items-center justify-between text-[11px] text-amber-800/80 mb-0.5 pointer-events-none">
          <span class="font-extrabold">◇ 판단</span>
          <div class="flex items-center gap-1">
            <i class="fa-solid fa-pen text-[8px] opacity-60"></i>
            ${deleteBtn}
          </div>
        </div>
        <div class="block-text-label w-full px-1.5 py-0.5 cursor-text text-center text-xs sm:text-sm font-black text-amber-950 focus:outline-none leading-snug" 
             contenteditable="true" 
             onblur="handleBlockTextChange('${b.id}', this.innerText)"
             onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
          ${b.text}
        </div>
      </div>
    `;
  } else {
    // 1. 단말(⬭), 2. 입출력(▱), 3. 처리(▭)
    let shapeClass = "shape-process";
    let badgeText = "▭ 처리";
    let badgeColor = "text-blue-600/80";
    let roundClass = "rounded-xl";

    if (isTerminal) {
      shapeClass = "shape-terminal";
      badgeText = "⬭ 단말";
      badgeColor = "text-purple-700/80";
      roundClass = "rounded-full px-7";
    } else if (isIO) {
      shapeClass = "shape-io";
      badgeText = "▱ 입출력";
      badgeColor = "text-emerald-800/80";
      roundClass = "rounded-xl px-6";
    } else {
      roundClass = "rounded-xl px-5";
    }

    div.className = `free-block ${shapeClass} ${roundClass} py-3 text-sm sm:text-base font-black shadow-md flex flex-col items-center justify-center text-center select-none`;
    div.style.left = `${b.x}px`;
    div.style.top = `${b.y}px`;
    div.style.minWidth = isTerminal ? "200px" : (isIO ? "220px" : "210px");
    div.style.maxWidth = "280px";

    const deleteBtn = isDeletable 
      ? `<button onclick="removeCanvasBlock('${b.id}', event)" class="text-slate-300 hover:text-rose-500 transition ml-1 pointer-events-auto" title="블록 삭제"><i class="fa-solid fa-xmark text-[10px]"></i></button>`
      : '';

    let innerContent = `
      <div class="w-full flex items-center justify-between text-[11px] ${badgeColor} mb-0.5 pointer-events-none">
        <span class="font-extrabold">${badgeText}</span>
        <div class="flex items-center gap-1">
          <i class="fa-solid fa-pen text-[8px] opacity-60"></i>
          ${deleteBtn}
        </div>
      </div>
      <div class="block-text-label w-full px-1.5 py-0.5 cursor-text text-center focus:outline-none leading-snug font-black" 
           contenteditable="true" 
           onblur="handleBlockTextChange('${b.id}', this.innerText)"
           onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
        ${b.text}
      </div>
    `;

    if (isIO) {
      innerContent = `<div class="shape-io-inner w-full flex flex-col items-center">${innerContent}</div>`;
    }

    div.innerHTML = `
      ${portsHtml}
      ${innerContent}
    `;
  }

  // 블록 클릭 시 선택 상태 활성화
  div.addEventListener('click', (e) => {
    if (e.target.classList.contains('flow-port') || e.target.isContentEditable) return;
    selectCanvasBlock(b.id);
  });

  // 블록 드래그 이동 핸들러
  div.addEventListener('mousedown', (e) => handleBlockMouseDown(b.id, e));

  return div;
}

function removeCanvasBlock(blockId, e) {
  if (e) e.stopPropagation();

  freeBlocks = freeBlocks.filter(b => b.id !== blockId);
  freeConnections = freeConnections.filter(c => c.from !== blockId && c.to !== blockId);

  window.isFlowchartAiPassed = false;
  window.isFlowchartSimValidated = false;

  renderFreeCanvas();
  if (typeof playSfx === 'function') playSfx('step');
}

function handleBlockTextChange(blockId, newText) {
  const b = freeBlocks.find(x => x.id === blockId);
  if (b) {
    b.text = newText.trim() || "내용 입력";
    renderFreeConnections();
  }
}

let draggedPaletteShape = null;

function handlePaletteDragStart(e, shape) {
  draggedPaletteShape = shape;
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', shape);
    e.dataTransfer.effectAllowed = 'copy';
  }
}

function handleCanvasDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
}

function handleCanvasDrop(e) {
  e.preventDefault();
  const shape = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || draggedPaletteShape;
  if (!shape) return;

  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  if (!canvas || !stage) return;
  const sRect = stage.getBoundingClientRect();
  const zoom = currentCanvasZoom || 1.0;
  const dropX = Math.max(20, Math.round(((e.clientX - sRect.left) / zoom - 90) / 20) * 20);
  const dropY = Math.max(20, Math.round(((e.clientY - sRect.top) / zoom - 30) / 20) * 20);

  addCanvasBlockAtPosition(shape, dropX, dropY);
  draggedPaletteShape = null;
}

function handleTrashDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('entry-trash-zone');
  if (zone) zone.classList.add('trash-active');
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function handleTrashDragLeave(e) {
  const zone = document.getElementById('entry-trash-zone');
  if (zone) zone.classList.remove('trash-active');
}

function handleTrashDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('entry-trash-zone');
  if (zone) zone.classList.remove('trash-active');

  if (selectedBlockId) {
    removeCanvasBlock(selectedBlockId);
    deselectCanvasBlock();
    if (typeof playSfx === 'function') playSfx('pop');
  }
}

function handleTrashClick() {
  if (selectedBlockId) {
    removeCanvasBlock(selectedBlockId);
    deselectCanvasBlock();
    if (typeof playSfx === 'function') playSfx('pop');
  } else {
    alert("삭제할 블록을 먼저 클릭하여 선택한 후 휴지통을 누르거나, 블록을 휴지통으로 끌어다 놓으세요.");
  }
}

function addCanvasBlockAtPosition(shapeType, x, y) {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  if (!canvas || !stage) return;

  // 💡 단말(시작/종료) 블록 스마트 가드: 이미 시작과 종료가 모두 존재할 경우 불필요한 단말 중복 추가 방지
  if (shapeType === 'terminal') {
    const hasStart = freeBlocks.some(b => b.shape === 'terminal' && (b.text || '').includes('시작'));
    const hasEnd = freeBlocks.some(b => b.shape === 'terminal' && (b.text || '').includes('종료'));

    if (hasStart && hasEnd) {
      if (typeof playSfx === 'function') playSfx('warning');
      alert("💡 순서도에는 '시작'과 '종료' 기호가 각각 하나씩만 있으면 충분해요!\n이미 캔버스에 시작과 종료 기호가 모두 있으니, 자료(▱)·처리(▭)·판단(◇) 기호를 추가해 보세요.");
      return;
    }
  }

  const id = `blk-${Date.now()}`;
  const hasStartTerminal = freeBlocks.some(b => b.shape === 'terminal' && (b.text || '').includes('시작'));
  const defaultLabels = {
    terminal: !hasStartTerminal ? "시작" : "종료",
    io: "데이터 입출력",
    process: "연산 처리 실행",
    decision: "조건 검사 ◇"
  };

  const newBlock = {
    id: id,
    shape: shapeType,
    type: shapeType,
    text: defaultLabels[shapeType] || "블록 내용",
    x: Math.max(-2500, x),
    y: Math.max(-2500, y)
  };

  freeBlocks.push(newBlock);
  window.isFlowchartAiPassed = false;
  window.isFlowchartSimValidated = false;
  const el = createFreeBlockDOM(newBlock);
  stage.appendChild(el);
  selectCanvasBlock(id);

  if (typeof playSfx === 'function') playSfx('snap');
}

function addCanvasBlock(shapeType) {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  const zoom = currentCanvasZoom || 1.0;

  // 💡 뷰포트 기준 현재 보고 있는 정중앙 좌표 스마트 계산 (팬 이동 canvasPanX, canvasPanY 완벽 동기화)
  const cWidth = (canvas && canvas.clientWidth > 0) ? canvas.clientWidth : 800;
  const cHeight = (canvas && canvas.clientHeight > 0) ? canvas.clientHeight : 600;

  const centerX = (cWidth / 2 - canvasPanX) / zoom;
  const centerY = (cHeight / 2 - canvasPanY) / zoom;

  // 약간의 지그재그 오프셋으로 블록이 겹치지 않게 스마트 배치
  const offsetIndex = freeBlocks.length % 5;
  const x = Math.round((centerX - 90 + (offsetIndex - 2) * 15) / 20) * 20;
  const y = Math.round((centerY - 40 + (offsetIndex - 2) * 25) / 20) * 20;

  addCanvasBlockAtPosition(shapeType, x, y);
}

// --------------------------------------------------
// 블록 마우스 드래그 이동 처리 (캔버스 줌 배율 완벽 동기화 & 무한 가상 작업대)
// --------------------------------------------------
function handleBlockMouseDown(blockId, e) {
  if (e.target.classList.contains('flow-port') || e.target.isContentEditable) return;

  const b = freeBlocks.find(x => x.id === blockId);
  if (!b) return;

  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  if (!canvas || !stage) return;

  isDraggingBlock = true;
  draggedBlockObj = b;

  const el = document.getElementById(`free-blk-${b.id}`);
  if (el) el.classList.add('selected');

  const zoom = currentCanvasZoom || 1.0;
  const sRect = stage.getBoundingClientRect();
  const startMouseX = (e.clientX - sRect.left) / zoom;
  const startMouseY = (e.clientY - sRect.top) / zoom;
  const startBlockX = b.x;
  const startBlockY = b.y;

  const onMouseMove = (moveEvent) => {
    if (!isDraggingBlock || !draggedBlockObj) return;

    const curMouseX = (moveEvent.clientX - sRect.left) / zoom;
    const curMouseY = (moveEvent.clientY - sRect.top) / zoom;

    let nx = Math.round(startBlockX + (curMouseX - startMouseX));
    let ny = Math.round(startBlockY + (curMouseY - startMouseY));

    // 💡 광활한 가상 작업대 허용 (화면 중간에서 멈추는 '보이지 않는 벽' 영구 제거!)
    // 무한에 가까운 작업 공간(-2500px ~ +4500px) 지원으로 캔버스를 어디로 이동해도 자유롭게 배치 가능
    nx = Math.max(-2500, Math.min(4500, nx));
    ny = Math.max(-2500, Math.min(4500, ny));

    draggedBlockObj.x = nx;
    draggedBlockObj.y = ny;

    if (el) {
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    }

    // 엔트리 캔버스 휴지통 호버 감지 (모든 블록 삭제 가능 & 시각적 삭제 예고 피드백)
    const trashZone = document.getElementById('entry-trash-zone');
    if (trashZone) {
      const tRect = trashZone.getBoundingClientRect();
      const isOverTrash = (
        moveEvent.clientX >= tRect.left - 12 &&
        moveEvent.clientX <= tRect.right + 12 &&
        moveEvent.clientY >= tRect.top - 12 &&
        moveEvent.clientY <= tRect.bottom + 12
      );
      trashZone.classList.toggle('trash-active', isOverTrash);

      // 휴지통 위 호버 시 블록 투명화 및 축소 피드백
      if (el) {
        if (isOverTrash) {
          el.style.opacity = '0.45';
          el.style.transform = 'scale(0.8)';
          el.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
        } else {
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.transition = '';
        }
      }
    }

    renderFreeConnections();
  };

  const onMouseUp = (upEvent) => {
    isDraggingBlock = false;
    const blockToDelete = draggedBlockObj;
    draggedBlockObj = null;
    if (el) {
      el.classList.remove('selected');
      el.style.opacity = '1';
      el.style.transform = '';
      el.style.transition = '';
    }

    // 휴지통에 드롭 시 삭제 처리 (단말 포함 모든 블록 삭제)
    const trashZone = document.getElementById('entry-trash-zone');
    let droppedInTrash = false;
    if (trashZone) {
      const tRect = trashZone.getBoundingClientRect();
      const isOverTrash = (
        upEvent.clientX >= tRect.left - 12 &&
        upEvent.clientX <= tRect.right + 12 &&
        upEvent.clientY >= tRect.top - 12 &&
        upEvent.clientY <= tRect.bottom + 12
      );
      if (trashZone.classList.contains('trash-active') || isOverTrash) {
        trashZone.classList.remove('trash-active');
        droppedInTrash = true;
      }
    }

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (droppedInTrash && blockToDelete) {
      removeCanvasBlock(blockToDelete.id);
      if (typeof playSfx === 'function') playSfx('pop');
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// --------------------------------------------------
// draw.io 스타일 교과서 표준 Manhattan Orthogonal Routing 함수
// --------------------------------------------------
function generateManhattanPath(x1, y1, fromPort, x2, y2, toPort) {
  // 방향 정규화: 'top', 'bottom', 'left', 'right'
  const getDir = (p) => {
    if (p === 'in' || p === 'top') return 'top';
    if (p === 'out' || p === 'yes' || p === 'bottom') return 'bottom';
    if (p === 'left') return 'left';
    if (p === 'right' || p === 'no') return 'right';
    return 'bottom';
  };

  const fDir = getDir(fromPort);
  const tDir = getDir(toPort || 'in');
  const isLoopback = (y2 <= y1 + 14);

  // 1. 하단(bottom) 포트에서 출발
  if (fDir === 'bottom') {
    if (tDir === 'top') {
      if (isLoopback) {
        // 역방향 루프백: 목표가 좌측이면 좌측 우회, 우측이면 우측 우회
        if (x2 < x1 - 30) {
          const loopX = Math.min(x1 - 40, x2 - 55);
          const entryY = y2 - 20;
          return `M ${x1} ${y1} V ${y1 + 16} H ${loopX} V ${entryY} H ${x2} V ${y2}`;
        } else {
          const loopX = Math.max(x1 + 40, x2 + 55);
          const entryY = y2 - 20;
          return `M ${x1} ${y1} V ${y1 + 16} H ${loopX} V ${entryY} H ${x2} V ${y2}`;
        }
      } else {
        // 순방향 하강
        if (Math.abs(x1 - x2) < 8) {
          return `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
      }
    } else if (tDir === 'left') {
      if (x2 < x1) {
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} V ${midY} H ${x2 - 25} V ${y2} H ${x2}`;
      } else {
        return `M ${x1} ${y1} V ${y2} H ${x2}`;
      }
    } else if (tDir === 'right') {
      if (x2 > x1) {
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} V ${midY} H ${x2 + 25} V ${y2} H ${x2}`;
      } else {
        return `M ${x1} ${y1} V ${y2} H ${x2}`;
      }
    } else {
      // bottom -> bottom
      const maxY = Math.max(y1, y2) + 25;
      return `M ${x1} ${y1} V ${maxY} H ${x2} V ${y2}`;
    }
  }

  // 2. 우측(right) 포트에서 출발 ([아니오] 등)
  if (fDir === 'right') {
    if (tDir === 'top') {
      if (isLoopback) {
        if (x2 < x1 - 25) {
          // 목표가 좌측에 있을 때: 우측으로 살짝 나간 뒤 두 블록 위로 올라가서 좌측 타겟 상단으로 진입
          const topY = Math.min(y1, y2) - 22;
          return `M ${x1} ${y1} H ${x1 + 22} V ${topY} H ${x2} V ${y2}`;
        } else {
          // 우측으로 나와서 위쪽으로 올라간 뒤 타겟 상단 포트로 수직 진입
          const loopX = Math.max(x1 + 35, x2 + 55);
          const entryY = y2 - 20;
          return `M ${x1} ${y1} H ${loopX} V ${entryY} H ${x2} V ${y2}`;
        }
      } else {
        if (x2 > x1 + 25) {
          return `M ${x1} ${y1} H ${x2} V ${y2}`;
        } else {
          const turnX = Math.max(x1 + 35, x2 + 45);
          const midY = (y1 + y2) / 2;
          return `M ${x1} ${y1} H ${turnX} V ${midY} H ${x2} V ${y2}`;
        }
      }
    } else if (tDir === 'left') {
      if (x2 > x1 + 25) {
        const midX = (x1 + x2) / 2;
        return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
      } else {
        const loopX = x1 + 35;
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} H ${loopX} V ${midY} H ${x2 - 25} V ${y2} H ${x2}`;
      }
    } else if (tDir === 'right') {
      const loopX = Math.max(x1, x2) + 45;
      return `M ${x1} ${y1} H ${loopX} V ${y2} H ${x2}`;
    } else {
      return `M ${x1} ${y1} H ${x2} V ${y2}`;
    }
  }

  // 3. 좌측(left) 포트에서 출발 ([분기] 등)
  if (fDir === 'left') {
    if (tDir === 'top') {
      if (isLoopback) {
        if (x2 > x1 + 25) {
          // 목표가 우측에 있을 때: 좌측으로 살짝 나간 뒤 두 블록 위로 올라가서 우측 타겟 상단으로 진입
          const topY = Math.min(y1, y2) - 22;
          return `M ${x1} ${y1} H ${x1 - 22} V ${topY} H ${x2} V ${y2}`;
        } else {
          const loopX = Math.min(x1 - 35, x2 - 55);
          const entryY = y2 - 20;
          return `M ${x1} ${y1} H ${loopX} V ${entryY} H ${x2} V ${y2}`;
        }
      } else {
        if (x2 < x1 - 25) {
          return `M ${x1} ${y1} H ${x2} V ${y2}`;
        } else {
          const turnX = Math.min(x1 - 35, x2 - 45);
          const midY = (y1 + y2) / 2;
          return `M ${x1} ${y1} H ${turnX} V ${midY} H ${x2} V ${y2}`;
        }
      }
    } else if (tDir === 'right') {
      if (x2 < x1 - 25) {
        const midX = (x1 + x2) / 2;
        return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
      } else {
        const loopX = x1 - 35;
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} H ${loopX} V ${midY} H ${x2 + 25} V ${y2} H ${x2}`;
      }
    } else if (tDir === 'left') {
      const loopX = Math.min(x1, x2) - 45;
      return `M ${x1} ${y1} H ${loopX} V ${y2} H ${x2}`;
    } else {
      return `M ${x1} ${y1} H ${x2} V ${y2}`;
    }
  }

  // 4. 상단(top) 포트에서 출발
  if (fDir === 'top') {
    const exitY = y1 - 20;
    if (tDir === 'top') {
      const minY = Math.min(y1, y2) - 25;
      return `M ${x1} ${y1} V ${minY} H ${x2} V ${y2}`;
    } else {
      const midX = (x1 + x2) / 2;
      return `M ${x1} ${y1} V ${exitY} H ${midX} V ${y2} H ${x2}`;
    }
  }

  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

// --------------------------------------------------
// draw.io 스타일 자석 연결점(Port Glow) & 28px Magnet Snap 화살표 연결 엔진
// --------------------------------------------------
let hoveredTargetPort = null;

function startConnecting(blockId, portType, e) {
  e.stopPropagation();
  isConnecting = true;
  connectionSource = { blockId, portType };
  hoveredTargetPort = null;

  const sourceBlock = freeBlocks.find(x => x.id === blockId);
  if (!sourceBlock) return;

  // 타겟 포트 유도등 활성화
  highlightValidPorts(sourceBlock, portType);

  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  const svg = document.getElementById('free-flowchart-svg');
  if (!canvas || !svg || !stage) return;

  const zoom = currentCanvasZoom || 1.0;
  const sRect = stage.getBoundingClientRect();

  // 실시간 가이드 화살표 패스
  const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  tempPath.id = "temp-draw-line";
  tempPath.setAttribute("stroke", "#3b82f6");
  tempPath.setAttribute("stroke-width", "2.5");
  tempPath.setAttribute("stroke-dasharray", "6, 4");
  tempPath.setAttribute("fill", "none");
  tempPath.setAttribute("marker-end", "url(#free-arrowhead)");
  svg.appendChild(tempPath);

  const sourcePortEl = document.getElementById(`port-${portType}-${blockId}`);
  let startX = sourceBlock.x + 80;
  let startY = sourceBlock.y + 50;
  if (sourcePortEl) {
    const pRect = sourcePortEl.getBoundingClientRect();
    startX = (pRect.left + pRect.width / 2 - sRect.left) / zoom;
    startY = (pRect.top + pRect.height / 2 - sRect.top) / zoom;
  }

  const onMouseMove = (moveEvent) => {
    if (!isConnecting) return;

    let targetX = (moveEvent.clientX - sRect.left) / zoom;
    let targetY = (moveEvent.clientY - sRect.top) / zoom;
    let targetPortType = 'in';

    // ★ 28px draw.io 자석 스냅(Magnet Snap) 감지
    let closestPort = null;
    let minDistance = 32;

    document.querySelectorAll('.flow-port.port-valid-glow').forEach(portEl => {
      const pRect = portEl.getBoundingClientRect();
      const pCenterX = pRect.left + pRect.width / 2;
      const pCenterY = pRect.top + pRect.height / 2;
      const dist = Math.hypot(moveEvent.clientX - pCenterX, moveEvent.clientY - pCenterY);
      if (dist < minDistance) {
        minDistance = dist;
        closestPort = {
          el: portEl,
          blockId: portEl.dataset.blockId,
          portType: portEl.dataset.portType,
          x: (pCenterX - sRect.left) / zoom,
          y: (pCenterY - sRect.top) / zoom
        };
      }
    });

    // 모든 포트의 port-active 해제
    document.querySelectorAll('.flow-port.port-active').forEach(p => p.classList.remove('port-active'));

    if (closestPort) {
      targetX = closestPort.x;
      targetY = closestPort.y;
      targetPortType = closestPort.portType;
      closestPort.el.classList.add('port-active');
      hoveredTargetPort = { blockId: closestPort.blockId, portType: closestPort.portType };
    } else {
      hoveredTargetPort = null;
    }

    const d = generateManhattanPath(startX, startY, portType, targetX, targetY, targetPortType);
    tempPath.setAttribute("d", d);
  };

  const onMouseUp = () => {
    isConnecting = false;
    tempPath.remove();
    clearPortGlows();

    // 자석 감지된 타겟 포트가 있다면 즉시 연결 완료!
    if (hoveredTargetPort) {
      handlePortMouseUp(hoveredTargetPort.blockId, hoveredTargetPort.portType);
    }
    hoveredTargetPort = null;
    connectionSource = null;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function highlightValidPorts(sourceBlock, portType) {
  freeBlocks.forEach(b => {
    if (b.id === sourceBlock.id) return;

    ['in', 'out', 'yes', 'left', 'right', 'no'].forEach(pType => {
      const portEl = document.getElementById(`port-${pType}-${b.id}`);
      if (!portEl) return;

      // 이미 동일한 연결이 존재하는지 검사
      const alreadyConnected = freeConnections.some(c => 
        c.from === sourceBlock.id && c.fromPort === portType && c.to === b.id && c.toPort === pType
      );

      const isSourceEnd = sourceBlock.id === 'blk-end' || (sourceBlock.shape === 'terminal' && (sourceBlock.text || '').includes('종료'));
      if (alreadyConnected || isSourceEnd) {
        portEl.classList.add('port-disabled');
      } else {
        portEl.classList.add('port-valid-glow');
      }
    });
  });
}

function clearPortGlows() {
  document.querySelectorAll('.flow-port').forEach(p => {
    p.classList.remove('port-valid-glow', 'port-disabled', 'port-active');
  });
}

function handlePortMouseUp(targetBlockId, targetPortType) {
  if (!connectionSource) return;

  const source = connectionSource;
  const sourceBlock = freeBlocks.find(x => x.id === source.blockId);
  const targetBlock = freeBlocks.find(x => x.id === targetBlockId);

  if (!sourceBlock || !targetBlock) return;
  if (source.blockId === targetBlockId) return;

  // 종료 단말 기호에서 나가는 연결 차단
  if (sourceBlock.id === 'blk-end' || (sourceBlock.shape === 'terminal' && (sourceBlock.text || '').includes('종료'))) {
    if (typeof playSfx === 'function') playSfx('error');
    alert("종료 단말 기호에서는 다른 기호로 나가는 연결을 만들 수 없습니다.");
    return;
  }

  // 중복 연결 방지
  const alreadyConnected = freeConnections.some(c => 
    c.from === source.blockId && c.fromPort === source.portType && c.to === targetBlockId && c.toPort === targetPortType
  );
  if (alreadyConnected) {
    if (typeof playSfx === 'function') playSfx('error');
    return;
  }

  // 연결 등록
  freeConnections.push({
    from: source.blockId,
    fromPort: source.portType,
    to: targetBlockId,
    toPort: targetPortType
  });

  window.isFlowchartAiPassed = false;
  window.isFlowchartSimValidated = false;

  if (typeof playSfx === 'function') playSfx('snap');
  renderFreeConnections();
}

function renderFreeConnections() {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  const svg = document.getElementById('free-flowchart-svg');
  if (!canvas || !svg || !stage) return;

  svg.innerHTML = `
    <defs>
      <marker id="free-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
      </marker>
      <marker id="free-arrowhead-yes" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
      </marker>
      <marker id="free-arrowhead-no" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
      </marker>
      <marker id="free-arrowhead-left" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
      </marker>
    </defs>
  `;

  const sRect = stage.getBoundingClientRect();
  const zoom = currentCanvasZoom || 1.0;

  freeConnections.forEach((conn, idx) => {
    const fromEl = document.getElementById(`free-blk-${conn.from}`);
    const toEl = document.getElementById(`free-blk-${conn.to}`);
    if (!fromEl || !toEl) return;

    const fromPortEl = document.getElementById(`port-${conn.fromPort}-${conn.from}`);
    const toPortEl = document.getElementById(`port-${conn.toPort}-${conn.to}`);

    const fRect = fromPortEl ? fromPortEl.getBoundingClientRect() : fromEl.getBoundingClientRect();
    const tRect = toPortEl ? toPortEl.getBoundingClientRect() : toEl.getBoundingClientRect();

    const x1 = (fRect.left + fRect.width / 2 - sRect.left) / zoom;
    const y1 = (fRect.top + fRect.height / 2 - sRect.top) / zoom;
    const x2 = (tRect.left + tRect.width / 2 - sRect.left) / zoom;
    const y2 = (tRect.top + tRect.height / 2 - sRect.top) / zoom;

    let markerId = "free-arrowhead";
    let lineClass = "flow-line";
    let strokeColor = "#475569";
    let badgeText = "";
    let labelPos = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

    if (conn.fromPort === 'yes') {
      markerId = "free-arrowhead-yes";
      lineClass = "flow-line flow-line-decision-yes";
      strokeColor = "#10b981";
      badgeText = "예";
      labelPos = { x: x1 + 14, y: y1 + 16 };
    } else if (conn.fromPort === 'no') {
      markerId = "free-arrowhead-no";
      lineClass = "flow-line flow-line-decision-no";
      strokeColor = "#f59e0b";
      badgeText = "아니오";
      labelPos = { x: x1 + 22, y: y1 - 10 };
    } else if (conn.fromPort === 'left') {
      markerId = "free-arrowhead-left";
      lineClass = "flow-line flow-line-decision-no";
      strokeColor = "#f59e0b";
      badgeText = "분기";
      labelPos = { x: x1 - 22, y: y1 - 10 };
    }

    // Manhattan 직각 라우팅 생성
    const d = generateManhattanPath(x1, y1, conn.fromPort, x2, y2, conn.toPort || 'in');

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "flow-connection-group");

    // 클릭 편의를 위한 투명한 굵은 타겟 패스 (18px)
    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.setAttribute("d", d);
    hitPath.setAttribute("stroke", "transparent");
    hitPath.setAttribute("stroke-width", "18");
    hitPath.setAttribute("fill", "none");
    hitPath.style.cursor = "pointer";

    // 실제 화면에 보이는 화살표 패스
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", lineClass);
    path.setAttribute("id", `conn-path-${conn.from}-${conn.to}`);
    path.setAttribute("marker-end", `url(#${markerId})`);
    path.style.cursor = "pointer";

    const deleteHandler = (e) => {
      e.stopPropagation();
      if (confirm("이 연결 화살표를 삭제하시겠습니까?")) {
        freeConnections.splice(idx, 1);
        window.isFlowchartAiPassed = false;
        window.isFlowchartSimValidated = false;
        renderFreeConnections();
        if (typeof playSfx === 'function') playSfx('step');
      }
    };

    hitPath.onclick = deleteHandler;
    path.onclick = deleteHandler;

    g.appendChild(hitPath);
    g.appendChild(path);

    // [예], [아니오], [분기] 교과서형 텍스트 배지 렌더링
    if (badgeText) {
      const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      labelGroup.setAttribute("class", "cursor-pointer");
      labelGroup.onclick = deleteHandler;

      const badgeWidth = badgeText.length > 2 ? 42 : 30;
      const badgeHeight = 18;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", labelPos.x - badgeWidth / 2);
      rect.setAttribute("y", labelPos.y - badgeHeight / 2);
      rect.setAttribute("width", badgeWidth);
      rect.setAttribute("height", badgeHeight);
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", strokeColor);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", labelPos.x);
      text.setAttribute("y", labelPos.y + 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#ffffff");
      text.setAttribute("font-size", "10px");
      text.setAttribute("font-weight", "900");
      text.textContent = badgeText;

      labelGroup.appendChild(rect);
      labelGroup.appendChild(text);
      g.appendChild(labelGroup);
    }

    svg.appendChild(g);
  });
}

function clearFreeCanvas() {
  if (confirm("캔버스의 모든 블록과 연결선을 초기화하시겠습니까?")) {
    freeBlocks = [];
    freeConnections = [];
    window.isFlowchartAiPassed = false;
    window.isFlowchartSimValidated = false;
    renderFreeCanvas();
    if (typeof playSfx === 'function') playSfx('step');
  }
}

function autoAlignCanvas() {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  if (!canvas || !stage || freeBlocks.length === 0) return;

  const startX = Math.floor((stage.clientWidth - 190) / 2);
  let curY = 35;

  freeBlocks.forEach(b => {
    b.x = startX;
    b.y = curY;
    const spacing = b.shape === 'decision' ? 125 : 80;
    curY += spacing;
  });

  renderFreeCanvas();
  if (typeof playSfx === 'function') playSfx('snap');
}

/**
 * 엔트리 스타일 캔버스 줌 컨트롤 (축소 / 100% / 확대)
 */
let currentCanvasZoom = 1.0;

function zoomCanvas(direction) {
  const canvas = document.getElementById('free-flowchart-canvas');
  const stage = document.getElementById('free-flowchart-stage') || canvas;
  const display = document.getElementById('entry-zoom-display');
  if (!canvas || !stage) return;

  if (direction === 'in') {
    currentCanvasZoom = Math.min(1.4, Math.round((currentCanvasZoom + 0.1) * 10) / 10);
  } else if (direction === 'out') {
    currentCanvasZoom = Math.max(0.6, Math.round((currentCanvasZoom - 0.1) * 10) / 10);
  } else if (direction === 'reset') {
    currentCanvasZoom = 1.0;
  }

  if (display) {
    display.textContent = `${Math.round(currentCanvasZoom * 100)}%`;
  }

  const bgSize = Math.round(20 * currentCanvasZoom);
  canvas.style.backgroundSize = `${bgSize}px ${bgSize}px`;

  // 단일 Stage 컨테이너 전체에만 scale 적용 (내부 블록과 SVG가 동일한 로컬 좌표계 유지!)
  stage.style.transform = currentCanvasZoom === 1.0 ? '' : `scale(${currentCanvasZoom})`;
  stage.style.transformOrigin = '0 0';

  // 연결선 위치 재계산
  renderFreeConnections();

  if (typeof playSfx === 'function') playSfx('snap');
}

// ==========================================
// 🔍 순수 바닐라 미니 언어 파서 (AST Evaluator)
// ==========================================
function tokenizeFlowchartExpr(s) {
  const t = [];
  let i = 0;
  const isD = c => c >= '0' && c <= '9';
  const isI = c => /[A-Za-z_\uAC00-\uD7A3]/.test(c);
  const isIN = c => /[A-Za-z0-9_\uAC00-\uD7A3]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (isD(c) || (c === '.' && isD(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && (isD(s[j]) || s[j] === '.')) j++;
      t.push({ k: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (isI(c)) {
      let j2 = i;
      while (j2 < s.length && isIN(s[j2])) j2++;
      t.push({ k: 'id', v: s.slice(i, j2) });
      i = j2;
      continue;
    }
    const two = s.substr(i, 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '<>') {
      t.push({ k: 'op', v: two === '<>' ? '!=' : two });
      i += 2;
      continue;
    }
    if ('+-*/%()<>='.indexOf(c) >= 0) {
      t.push({ k: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`사용할 수 없는 기호입니다: '${c}'`);
  }
  return t;
}

function makeFlowchartParser(tk) {
  let p = 0;
  function peek() { return tk[p]; }
  function expr() {
    let n = term();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const o = tk[p++].v;
      n = { k: 'bin', o, l: n, r: term() };
    }
    return n;
  }
  function term() {
    let n = unary();
    while (peek() && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
      const o = tk[p++].v;
      n = { k: 'bin', o, l: n, r: unary() };
    }
    return n;
  }
  function unary() {
    if (peek() && peek().v === '-') {
      p++;
      return { k: 'neg', e: unary() };
    }
    return primary();
  }
  function primary() {
    const t = peek();
    if (!t) throw new Error('수식이 완성되지 않았습니다.');
    if (t.k === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.k === 'id') { p++; return { k: 'var', v: t.v }; }
    if (t.v === '(') {
      p++;
      const e = expr();
      if (!peek() || peek().v !== ')') throw new Error("닫는 괄호 ')'가 빠졌습니다.");
      p++;
      return e;
    }
    throw new Error(`예상하지 못한 수식 요소입니다: '${t.v}'`);
  }
  return {
    expr,
    peek,
    take: () => tk[p++],
    atEnd: () => p >= tk.length
  };
}

function evalFlowchartAST(ast, vars) {
  if (ast.k === 'num') return ast.v;
  if (ast.k === 'var') {
    if (!(ast.v in vars)) {
      throw new Error(`아직 값이 지정되지 않은 변수 '${ast.v}'입니다.`);
    }
    return vars[ast.v];
  }
  if (ast.k === 'neg') return -evalFlowchartAST(ast.e, vars);
  const l = evalFlowchartAST(ast.l, vars);
  const r = evalFlowchartAST(ast.r, vars);
  if (ast.o === '+') return l + r;
  if (ast.o === '-') return l - r;
  if (ast.o === '*') return l * r;
  if (ast.o === '/') {
    if (r === 0) throw new Error('0으로 나눌 수 없습니다.');
    return l / r;
  }
  if (ast.o === '%') {
    if (r === 0) throw new Error('0으로 나눈 나머지를 구할 수 없습니다.');
    return l % r;
  }
  throw new Error(`알 수 없는 연산자: ${ast.o}`);
}

function parseFlowchartAssign(text) {
  const tk = tokenizeFlowchartExpr(text);
  if (tk.length < 3 || tk[0].k !== 'id' || tk[1].v !== '=') {
    throw new Error("처리 기호는 '변수 = 식' 형태로 적어주세요 (예: sum = 0, sum = sum + i)");
  }
  const name = tk[0].v;
  const ps = makeFlowchartParser(tk.slice(2));
  const ast = ps.expr();
  if (!ps.atEnd()) throw new Error('식 뒤에 해석할 수 없는 부분이 남아있습니다.');
  return { name, ast };
}

function parseFlowchartCond(text) {
  const tk = tokenizeFlowchartExpr(text);
  const ps = makeFlowchartParser(tk);
  const left = ps.expr();
  const op = ps.peek();
  if (!op || ['<', '>', '<=', '>=', '==', '!='].indexOf(op.v) < 0) {
    throw new Error("판단 기호는 '식 <  <=  >  >=  ==  != 식' 형태로 적어주세요 (예: i <= 10)");
  }
  ps.take();
  const right = ps.expr();
  if (!ps.atEnd()) throw new Error('조건식 뒤에 해석할 수 없는 부분이 남아있습니다.');
  return { l: left, o: op.v, r: right };
}

function evalFlowchartCond(c, vars) {
  const a = evalFlowchartAST(c.l, vars);
  const b = evalFlowchartAST(c.r, vars);
  switch (c.o) {
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
  }
  return false;
}

// ==========================================
// 🐞 디버그 스튜디오 상태 및 실행 제어 엔진
// ==========================================
let debuggerExec = null;
let debuggerTimer = null;
let debuggerSpeed = 3;

function updateDebuggerSpeed(val) {
  debuggerSpeed = parseInt(val, 10) || 3;
  const chip = document.getElementById('btn-floating-speed-chip');
  if (chip) {
    if (debuggerSpeed >= 4) chip.textContent = '2x';
    else if (debuggerSpeed <= 2) chip.textContent = '0.5x';
    else chip.textContent = '1x';
  }
  const slider = document.getElementById('sim-speed-slider');
  if (slider && slider.value !== String(debuggerSpeed)) {
    slider.value = String(debuggerSpeed);
  }
  if (debuggerTimer) {
    clearInterval(debuggerTimer);
    const intervals = [1000, 750, 500, 300, 150];
    const delay = intervals[debuggerSpeed - 1] || 500;
    debuggerTimer = setInterval(() => {
      stepDebugger();
    }, delay);
  }
}
window.updateDebuggerSpeed = updateDebuggerSpeed;

function cycleFloatingSpeed() {
  // 1x (속도 3) -> 2x (속도 5) -> 0.5x (속도 1) -> 1x (속도 3) 순환
  if (debuggerSpeed === 3) {
    updateDebuggerSpeed(5);
  } else if (debuggerSpeed >= 4) {
    updateDebuggerSpeed(1);
  } else {
    updateDebuggerSpeed(3);
  }
}
window.cycleFloatingSpeed = cycleFloatingSpeed;

function initDebugger() {
  const startBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('시작')) || freeBlocks.find(b => b.id === 'blk-start');
  if (!startBlock) {
    alert("⚠️ 시작 단말 기호가 없습니다!");
    return false;
  }
  
  // 기존 오버레이 정리
  document.querySelectorAll('.sim-choice-overlay').forEach(el => el.remove());

  debuggerExec = {
    curId: startBlock.id,
    prevId: null,
    vars: {},
    prevVars: {},
    lastChanged: null,
    steps: 0,
    done: false,
    isWaitingUserChoice: false,
    wasContinuousRunning: false
  };

  renderVariableWatcher();
  logDebugConsole("🚀 디버그 세션을 시작합니다. [한 단계] 또는 [실행]을 누르세요.");
  setDebuggerStatus("대기 중");
  updateBlockHighlights(startBlock.id);
  syncExecutionButtonUI(false);
  return true;
}

function syncExecutionButtonUI(isRunning) {
  const btnToolbar = document.getElementById('btn-toolbar-sim-run');
  const btnBottom = document.getElementById('btn-sim-run');
  const txtBottom = document.getElementById('txt-sim-run');
  const btnFloating = document.getElementById('btn-floating-sim-run');

  if (btnToolbar) {
    if (isRunning) {
      btnToolbar.innerHTML = `<i class="fa-solid fa-pause text-[10px]"></i> <span>일시정지</span>`;
      btnToolbar.className = "px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer";
      btnToolbar.title = "시뮬레이션 일시정지";
    } else {
      btnToolbar.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>실행 검증</span>`;
      btnToolbar.className = "entry-btn-play px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer";
      btnToolbar.title = "순서도 가상 실행 검증";
    }
  }

  if (btnFloating) {
    if (isRunning) {
      btnFloating.innerHTML = `<i class="fa-solid fa-pause text-[10px]"></i> <span>일시정지</span>`;
      btnFloating.className = "px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-full text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer";
      btnFloating.title = "시뮬레이션 일시정지";
    } else {
      btnFloating.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>실행 검증</span>`;
      btnFloating.className = "entry-btn-play px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs rounded-full";
      btnFloating.title = "순서도 가상 실행 검증";
    }
  }

  if (txtBottom) {
    txtBottom.textContent = isRunning ? '일시정지' : '실행';
  }
  if (btnBottom) {
    btnBottom.innerHTML = `<i class="fa-solid fa-${isRunning ? 'pause' : 'play'} text-[10px]"></i> <span id="txt-sim-run">${isRunning ? '일시정지' : '실행'}</span>`;
  }
}

function logDebugConsole(msg, isErr = false) {
  const c = document.getElementById('debug-terminal-console');
  if (!c) return;
  const d = document.createElement('div');
  d.className = isErr ? 'text-rose-400 font-bold' : 'text-slate-200';
  d.textContent = `> ${msg}`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function clearDebugConsole() {
  const c = document.getElementById('debug-terminal-console');
  if (c) c.innerHTML = '<div class="text-slate-500 text-[10px]">> 콘솔이 초기화되었습니다.</div>';
}

function renderVariableWatcher() {
  const tbody = document.getElementById('var-watcher-tbody');
  const countBadge = document.getElementById('var-count-badge');
  if (!tbody) return;

  if (!debuggerExec || Object.keys(debuggerExec.vars).length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-slate-400 text-[10px]">등록된 변수가 없습니다</td></tr>';
    if (countBadge) countBadge.textContent = '0개';
    return;
  }

  const keys = Object.keys(debuggerExec.vars);
  if (countBadge) countBadge.textContent = `${keys.length}개`;

  tbody.innerHTML = keys.map(k => {
    const isChanged = debuggerExec.lastChanged === k;
    const curVal = debuggerExec.vars[k];
    const prevVal = (k in debuggerExec.prevVars) ? debuggerExec.prevVars[k] : '-';
    const flashClass = isChanged ? 'var-changed-flash' : '';
    const formattedCur = (typeof curVal === 'number') ? (Number.isInteger(curVal) ? curVal : Math.round(curVal * 1000) / 1000) : curVal;
    const formattedPrev = (typeof prevVal === 'number') ? (Number.isInteger(prevVal) ? prevVal : Math.round(prevVal * 1000) / 1000) : prevVal;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td class="py-1.5 font-bold text-slate-800">${escapeHtml(k)}</td>
        <td class="py-1.5 text-right font-mono ${flashClass}">${formattedCur}</td>
        <td class="py-1.5 text-right font-mono text-slate-400">${formattedPrev}</td>
      </tr>
    `;
  }).join('');
}

function setDebuggerStatus(statusText) {
  const badge = document.getElementById('sim-status-badge');
  if (badge) badge.textContent = statusText;
  const badgeFloating = document.getElementById('floating-sim-status-badge');
  if (badgeFloating) {
    badgeFloating.textContent = statusText;
    if (statusText.includes('완주') || statusText.includes('성공')) {
      badgeFloating.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 whitespace-nowrap animate-bounce";
    } else if (statusText.includes('실행') || statusText.includes('진행')) {
      badgeFloating.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 whitespace-nowrap";
    } else if (statusText.includes('대기') || statusText.includes('선택')) {
      badgeFloating.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap animate-pulse";
    } else if (statusText.includes('오류') || statusText.includes('초과')) {
      badgeFloating.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 whitespace-nowrap";
    } else {
      badgeFloating.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap";
    }
  }
}

function updateBlockHighlights(activeId, prevId = null) {
  document.querySelectorAll('.flowchart-block-simulating').forEach(el => el.classList.remove('flowchart-block-simulating'));
  document.querySelectorAll('.flowchart-path-simulating').forEach(el => el.classList.remove('flowchart-path-simulating'));

  if (activeId) {
    const el = document.getElementById(`free-blk-${activeId}`) || document.getElementById(activeId);
    if (el) {
      el.classList.add('flowchart-block-simulating');
    }
  }

  if (prevId && activeId) {
    const pathEl = document.getElementById(`conn-path-${prevId}-${activeId}`);
    if (pathEl) {
      pathEl.classList.add('flowchart-path-simulating');
      setTimeout(() => {
        if (pathEl) pathEl.classList.remove('flowchart-path-simulating');
      }, 500);
    }
  }
}

function stepDebugger() {
  if (!debuggerExec) {
    if (!initDebugger()) return;
  }
  if (debuggerExec.isWaitingUserChoice) {
    return;
  }
  if (debuggerExec.done) {
    logDebugConsole("실행이 이미 완료되었습니다. [초기화] 후 다시 실행하세요.");
    setDebuggerStatus("실행 종료");
    pauseDebugger();
    return;
  }

  debuggerExec.steps++;
  if (debuggerExec.steps > 1000) {
    logDebugConsole("⚠️ 1,000단계를 초과했습니다! 무한 루프 가능성이 있으니 조건식을 점검하세요.", true);
    debuggerExec.done = true;
    pauseDebugger();
    return;
  }

  const curBlock = freeBlocks.find(b => b.id === debuggerExec.curId);
  if (!curBlock) {
    logDebugConsole(`⚠️ 다음 기호(${debuggerExec.curId})를 찾을 수 없습니다.`, true);
    debuggerExec.done = true;
    pauseDebugger();
    return;
  }

  updateBlockHighlights(curBlock.id, debuggerExec.prevId);
  if (typeof playSfx === 'function') playSfx('step');
  debuggerExec.lastChanged = null;
  let nextId = null;

  try {
    if (curBlock.shape === 'terminal') {
      const isStart = (curBlock.text || '').includes('시작');
      const isEnd = (curBlock.text || '').includes('종료');

      if (isStart) {
        logDebugConsole(`[시작] 알고리즘을 출발합니다.`);
        const outConns = freeConnections.filter(c => c.from === curBlock.id);
        if (outConns.length === 0) throw new Error("'시작' 기호에서 나가는 화살표가 없습니다.");
        nextId = outConns[0].to;
      } else if (isEnd) {
        logDebugConsole(`🎉 [종료] 알고리즘이 성공적으로 완주했습니다! (총 ${debuggerExec.steps}단계)`);
        debuggerExec.done = true;
        setDebuggerStatus("완주 성공");
        pauseDebugger();
        window.isFlowchartSimValidated = true;
        if (typeof updateThinkerToolbarButton === 'function') updateThinkerToolbarButton();
        if (typeof playSfx === 'function') playSfx('success');
        updateBlockHighlights(curBlock.id, debuggerExec.prevId);
        setTimeout(() => {
          alert(`🎉 [실행 검증 완료] 순서도가 '시작'부터 '종료'까지 완벽하게 완주되었습니다!\n우측 디버그 스튜디오의 실행 기록과 변수 상태를 확인해 보세요.`);
        }, 300);
        return;
      }
    } else if (curBlock.shape === 'process') {
      const rawText = (curBlock.text || '').trim();
      if (rawText.includes('=')) {
        const assign = parseFlowchartAssign(rawText);
        const resultVal = evalFlowchartAST(assign.ast, debuggerExec.vars);
        if (assign.name in debuggerExec.vars) {
          debuggerExec.prevVars[assign.name] = debuggerExec.vars[assign.name];
        }
        debuggerExec.vars[assign.name] = resultVal;
        debuggerExec.lastChanged = assign.name;
        logDebugConsole(`[처리] ${assign.name} = ${resultVal}`);
      } else {
        logDebugConsole(`[명령] '${rawText}' 실행 완료`);
      }
      const outConns = freeConnections.filter(c => c.from === curBlock.id);
      if (outConns.length === 0) throw new Error(`'${rawText}' 기호 다음에 연결된 화살표가 없습니다.`);
      nextId = outConns[0].to;
    } else if (curBlock.shape === 'io') {
      const rawText = (curBlock.text || '').trim();
      if (rawText.startsWith('입력')) {
        const varName = rawText.slice(2).trim() || 'x';
        pauseDebugger();
        const inputValStr = window.prompt(`[입력 기호] '${varName}'에 넣을 숫자 값을 입력하세요:`, '0');
        if (inputValStr === null) {
          logDebugConsole(`[입력 취소] 사용자가 입력을 취소했습니다.`, true);
          return;
        }
        const numVal = parseFloat(inputValStr);
        if (isNaN(numVal)) throw new Error(`숫자만 입력할 수 있습니다: '${inputValStr}'`);
        if (varName in debuggerExec.vars) {
          debuggerExec.prevVars[varName] = debuggerExec.vars[varName];
        }
        debuggerExec.vars[varName] = numVal;
        debuggerExec.lastChanged = varName;
        logDebugConsole(`[입력] ${varName} = ${numVal}`);
      } else if (rawText.startsWith('출력')) {
        const exprStr = rawText.slice(2).trim();
        let printVal;
        try {
          const tk = tokenizeFlowchartExpr(exprStr);
          const ast = makeFlowchartParser(tk).expr();
          printVal = evalFlowchartAST(ast, debuggerExec.vars);
        } catch (e) {
          printVal = debuggerExec.vars[exprStr] !== undefined ? debuggerExec.vars[exprStr] : exprStr;
        }
        logDebugConsole(`📢 [출력] 결과: ${printVal}`);
      } else {
        logDebugConsole(`[자료] '${rawText}' 확인`);
      }
      const outConns = freeConnections.filter(c => c.from === curBlock.id);
      if (outConns.length === 0) throw new Error(`'${rawText}' 기호 다음에 연결된 화살표가 없습니다.`);
      nextId = outConns[0].to;
    } else if (curBlock.shape === 'decision') {
      const rawText = (curBlock.text || '').trim();
      const outConns = freeConnections.filter(c => c.from === curBlock.id);
      if (outConns.length === 0) throw new Error(`'${rawText}' 판단 기호에서 나가는 연결 화살표가 없습니다.`);

      let isNumericCond = false;
      let conditionResult = null;

      if (/[<>=!]/.test(rawText)) {
        try {
          const cond = parseFlowchartCond(rawText);
          const identifiers = (rawText.match(/[a-zA-Z_가-힣][a-zA-Z0-9_가-힣]*/g) || [])
            .filter(w => !['true', 'false', '예', '아니오', '참', '거짓'].includes(w));
          const hasVars = identifiers.some(id => id in debuggerExec.vars);

          if (hasVars || Object.keys(debuggerExec.vars).length > 0) {
            conditionResult = evalFlowchartCond(cond, debuggerExec.vars);
            isNumericCond = true;
          }
        } catch (e) {
          isNumericCond = false;
        }
      }

      if (isNumericCond && conditionResult !== null) {
        // 숫자/변수 조건식: Opus AST 자동 평가
        const branchChoice = conditionResult ? '예' : '아니오';
        logDebugConsole(`[판단 자동평가] '${rawText}' ➔ [${branchChoice}] 판정`);

        let targetConn = outConns.find(c => (c.branchLabel || c.label) === branchChoice);
        if (!targetConn) {
          if (branchChoice === '예') {
            targetConn = outConns.find(c => c.fromPort === 'yes' || c.fromPort === 'bottom') || outConns[0];
          } else {
            targetConn = outConns.find(c => c.fromPort === 'no' || c.fromPort === 'right' || c.fromPort === 'left') || (outConns[1] || outConns[0]);
          }
        }
        if (!targetConn) throw new Error(`'${branchChoice}' 방향으로 나가는 연결선이 없습니다.`);
        nextId = targetConn.to;
      } else {
        // 중학생 일상 자연어 알고리즘: 직접 블록 위에서 참(예)/거짓(아니오) 선택 인터랙션
        const wasContinuous = !!debuggerTimer;
        pauseDebugger();
        debuggerExec.wasContinuousRunning = wasContinuous;
        debuggerExec.isWaitingUserChoice = true;
        setDebuggerStatus("분기 선택 대기");
        logDebugConsole(`🤔 [판단] '${rawText}' ➔ [예] 또는 [아니오] 분기를 직접 선택하세요.`);

        const blockEl = document.getElementById(`free-blk-${curBlock.id}`) || document.getElementById(curBlock.id);
        if (blockEl) {
          document.querySelectorAll('.sim-choice-overlay').forEach(el => el.remove());
          const overlay = document.createElement('div');
          overlay.className = 'sim-choice-overlay';
          overlay.id = `sim-choice-overlay-${curBlock.id}`;
          overlay.innerHTML = `
            <span class="text-xs font-black text-amber-950 flex items-center gap-1 shrink-0">
              <i class="fa-solid fa-code-branch text-amber-600"></i>
              <span>조건 분기:</span>
            </span>
            <button onclick="handleSimDecisionChoice('${curBlock.id}', '예')" class="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer">
              <span>✓ 참 (예)</span>
            </button>
            <button onclick="handleSimDecisionChoice('${curBlock.id}', '아니오')" class="px-3 py-1 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer">
              <span>✗ 거짓 (아니오)</span>
            </button>
          `;
          blockEl.appendChild(overlay);
        }
        return;
      }
    }
  } catch (err) {
    logDebugConsole(`❌ 오류 발생: ${err.message}`, true);
    setDebuggerStatus("오류 멈춤");
    pauseDebugger();
    if (typeof playSfx === 'function') playSfx('warning');
    return;
  }

  debuggerExec.prevId = curBlock.id;
  debuggerExec.curId = nextId;
  renderVariableWatcher();
  setDebuggerStatus(`실행 중 (${debuggerExec.steps}단계)`);
}

function handleSimDecisionChoice(blockId, choice) {
  const overlay = document.getElementById(`sim-choice-overlay-${blockId}`);
  if (overlay) overlay.remove();

  if (!debuggerExec) return;
  debuggerExec.isWaitingUserChoice = false;
  const resumeContinuous = !!debuggerExec.wasContinuousRunning;
  debuggerExec.wasContinuousRunning = false;

  const curBlock = freeBlocks.find(b => b.id === blockId);
  const outConns = freeConnections.filter(c => c.from === blockId);

  let targetConn = outConns.find(c => (c.branchLabel || c.label) === choice);
  if (!targetConn) {
    if (choice === '예') {
      targetConn = outConns.find(c => c.fromPort === 'yes' || c.fromPort === 'bottom') || outConns[0];
    } else {
      targetConn = outConns.find(c => c.fromPort === 'no' || c.fromPort === 'right' || c.fromPort === 'left') || (outConns[1] || outConns[0]);
    }
  }

  if (!targetConn) {
    logDebugConsole(`⚠️ '${choice}' 방향으로 나가는 연결 화살표를 찾을 수 없습니다.`, true);
    setDebuggerStatus("오류 멈춤");
    return;
  }

  logDebugConsole(`👉 [분기 선택] '${curBlock ? curBlock.text : blockId}' ➔ [${choice}] 선택 완료!`);

  // 연결선 하이라이트 애니메이션
  const pathEl = document.getElementById(`conn-path-${targetConn.from}-${targetConn.to}`);
  if (pathEl) {
    pathEl.classList.add('flowchart-path-simulating');
    setTimeout(() => {
      if (pathEl) pathEl.classList.remove('flowchart-path-simulating');
    }, 500);
  }

  debuggerExec.prevId = blockId;
  debuggerExec.curId = targetConn.to;

  // 다음 단계로 자동 진행
  stepDebugger();

  // 만약 연속 실행 중이었고 아직 완주되지 않았고 또 다른 분기 선택을 기다리지 않는다면 연속 실행 자동 재개!
  if (resumeContinuous && debuggerExec && !debuggerExec.done && !debuggerExec.isWaitingUserChoice) {
    startDebuggerContinuousTimer();
  }
}
window.handleSimDecisionChoice = handleSimDecisionChoice;

function startDebuggerContinuousTimer() {
  if (debuggerTimer) clearInterval(debuggerTimer);
  syncExecutionButtonUI(true);
  setDebuggerStatus('연속 실행 중');

  const intervals = [1000, 750, 500, 300, 150];
  const delay = intervals[debuggerSpeed - 1] || 500;
  debuggerTimer = setInterval(() => {
    stepDebugger();
  }, delay);
}

function toggleDebuggerRun() {
  if (debuggerTimer) {
    pauseDebugger();
  } else {
    if (!debuggerExec || debuggerExec.done) {
      if (!initDebugger()) return;
    }
    startDebuggerContinuousTimer();
  }
}

function pauseDebugger() {
  if (debuggerTimer) {
    clearInterval(debuggerTimer);
    debuggerTimer = null;
  }
  syncExecutionButtonUI(false);
  if (debuggerExec && !debuggerExec.done) {
    setDebuggerStatus('일시정지');
  }
}

function resetDebugger() {
  pauseDebugger();
  document.querySelectorAll('.sim-choice-overlay').forEach(el => el.remove());
  if (debuggerExec) {
    debuggerExec.wasContinuousRunning = false;
  }
  debuggerExec = null;
  updateBlockHighlights(null);
  clearDebugConsole();
  renderVariableWatcher();
  setDebuggerStatus('초기화됨');
  syncExecutionButtonUI(false);
  logDebugConsole('준비 완료. [한 단계] 또는 [실행]을 누르세요.');
}

function toggleDebuggerPanel() {
  const container = document.querySelector('.entry-studio-container');
  if (!container) return;
  container.classList.toggle('debugger-collapsed');
  const isCollapsed = container.classList.contains('debugger-collapsed');
  
  const fullView = document.querySelector('.debugger-panel-full-view');
  const colView = document.querySelector('.debugger-panel-collapsed-view');
  if (fullView && colView) {
    fullView.classList.toggle('hidden', isCollapsed);
    colView.classList.toggle('hidden', !isCollapsed);
  }
}

function focusCanvasBlockByText(text) {
  const b = freeBlocks.find(x => (x.text || '').trim() === text.trim()) || freeBlocks.find(x => (x.text || '').includes(text.trim()));
  if (!b) return;
  const canvas = document.getElementById('free-flowchart-canvas');
  if (!canvas) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  canvasPanX = Math.round(cw / 2 - (b.x + 80));
  canvasPanY = Math.round(ch / 2 - (b.y + 35));
  renderFreeCanvas();
  updateCanvasGridPosition();
  
  const el = document.getElementById(b.id);
  if (el) {
    el.classList.add('flowchart-block-simulating');
    setTimeout(() => {
      el.classList.remove('flowchart-block-simulating');
    }, 2000);
  }
}

window.initDebugger = initDebugger;
window.stepDebugger = stepDebugger;
window.toggleDebuggerRun = toggleDebuggerRun;
window.pauseDebugger = pauseDebugger;
window.resetDebugger = resetDebugger;
window.updateDebuggerSpeed = updateDebuggerSpeed;
window.clearDebugConsole = clearDebugConsole;
window.toggleDebuggerPanel = toggleDebuggerPanel;
window.focusCanvasBlockByText = focusCanvasBlockByText;

// ==========================================
// ⚡ 순서도 인터랙티브 가상 실행 검증 엔진
// ==========================================
let isSimulatingFlowchart = false;
let pendingSimIoBlocks = [];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 캔버스의 입출력(io) 블록을 스캔하여 입력값 설정 모달을 띄우거나 바로 실행
 */
function playFreeFlowchartSimulation() {
  if (freeBlocks.length === 0) {
    alert("실행할 순서도 블록이 없습니다. 가운데 기호 보관함에서 기호 블록을 캔버스에 추가해 보세요!");
    return;
  }

  // 1. 연결선 존재 여부 검사
  if (freeConnections.length === 0) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ [연결선 없음] '시작' 기호의 파란 연결점을 드래그하여 다음 기호로 화살표를 연결해 보세요!");
    return;
  }

  // 2. 시작 단말 블록 존재 여부
  const startBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('시작')) || freeBlocks.find(b => b.id === 'blk-start');
  if (!startBlock) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ [시작 기호 없음] 순서도에 '시작' 단말 기호가 없습니다. 기호 보관함에서 단말 기호를 추가해 주세요!");
    return;
  }

  // 3. 시작 블록에서 나가는 연결선 검사
  if (!freeConnections.some(c => c.from === startBlock.id)) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ [시작 기호 미연결] '시작' 기호에서 출발하는 화살표가 없습니다.\n시작 기호의 연결점(파란 점)을 드래그해 다음 기호로 연결해 보세요!");
    return;
  }

  // 4. 종료 단말 블록 존재 여부
  const endBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('종료')) || freeBlocks.find(b => b.id === 'blk-end');
  if (!endBlock) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ [종료 기호 없음] 순서도의 끝을 나타내는 '종료' 단말 기호가 없습니다!");
    return;
  }

  // 5. 디버그 스튜디오 패널이 접혀있다면 펼치고 실행 시작
  const container = document.querySelector('.entry-studio-container');
  if (container && container.classList.contains('debugger-collapsed')) {
    toggleDebuggerPanel();
  }
  toggleDebuggerRun();
}
window.playFreeFlowchartSimulation = playFreeFlowchartSimulation;
window.toggleDebuggerRun = toggleDebuggerRun;
window.stepDebugger = stepDebugger;
window.pauseDebugger = pauseDebugger;
window.resetDebugger = resetDebugger;

/**
 * 입출력 블록 값 설정 모달 열기
 */
function openSimInputModal(ioBlocks) {
  pendingSimIoBlocks = ioBlocks;
  const modal = document.getElementById('flowchart-sim-input-modal');
  const container = document.getElementById('sim-input-fields');
  if (!modal || !container) {
    runInteractiveSimulation({});
    return;
  }

  // 기본 예시값 스마트 추천
  const sampleValues = {
    "투입": "1,000",
    "금액": "1,000",
    "비밀번호": "7777",
    "나이": "15",
    "이름": "홍길동",
    "점수": "95",
    "온도": "24",
    "선택": "사이다"
  };

  container.innerHTML = ioBlocks.map((b, idx) => {
    let defVal = "100";
    for (const [k, v] of Object.entries(sampleValues)) {
      if ((b.text || '').includes(k)) {
        defVal = v;
        break;
      }
    }
    return `
      <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
        <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">${idx + 1}</span>
          <span>${escapeHtml(b.text || '입출력 데이터')}</span>
        </label>
        <div class="relative">
          <input type="text" id="sim-input-${b.id}" value="${defVal}" 
                 class="w-full px-3.5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:outline-none transition" 
                 placeholder="입력할 데이터 값 (예: 1000)" />
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
  if (typeof playSfx === 'function') playSfx('step');
}

/**
 * 모달 닫기
 */
function closeSimInputModal() {
  const modal = document.getElementById('flowchart-sim-input-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * 모달에서 입력값을 수집하여 시뮬레이션 시작
 */
function startSimulationWithInputs() {
  const simInputs = {};
  if (pendingSimIoBlocks && pendingSimIoBlocks.length > 0) {
    pendingSimIoBlocks.forEach(b => {
      const inputEl = document.getElementById(`sim-input-${b.id}`);
      simInputs[b.id] = inputEl ? inputEl.value.trim() : "데이터값";
    });
  }
  closeSimInputModal();
  runInteractiveSimulation(simInputs);
}

/**
 * 인터랙티브 시뮬레이션 본체 (네온 하이라이트 + 화살표 애니메이션 + 판단 블록 인터랙션 + 엄격한 완주 검증)
 */
async function runInteractiveSimulation(simInputs = {}) {
  if (isSimulatingFlowchart) return;
  isSimulatingFlowchart = true;

  // 기존 뱃지 및 하이라이트 잔여물 정리
  document.querySelectorAll('.sim-value-badge, .sim-choice-overlay').forEach(el => el.remove());
  document.querySelectorAll('.flowchart-block-simulating').forEach(el => el.classList.remove('flowchart-block-simulating'));
  document.querySelectorAll('.flowchart-path-simulating').forEach(el => el.classList.remove('flowchart-path-simulating'));

  const startBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('시작')) || freeBlocks.find(b => b.id === 'blk-start') || freeBlocks[0];
  const endBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('종료')) || freeBlocks.find(b => b.id === 'blk-end');

  let current = startBlock;
  const visitedCount = {};
  let totalSteps = 0;
  let intermediateSteps = 0;
  const MAX_STEPS = 35; // 무한루프 방지 안전장치
  let stoppedBlock = null;

  while (current && totalSteps < MAX_STEPS) {
    totalSteps++;
    visitedCount[current.id] = (visitedCount[current.id] || 0) + 1;
    if (visitedCount[current.id] > 10) {
      alert("⚠️ 순서도 내에서 10회 이상 반복(무한 루프)되었습니다. 안전을 위해 실행을 일시 중지합니다.");
      stoppedBlock = current;
      break;
    }

    if (current !== startBlock && current !== endBlock) {
      intermediateSteps++;
    }

    const blockEl = document.getElementById(`free-blk-${current.id}`) || document.getElementById(current.id);
    if (blockEl) {
      blockEl.classList.add('flowchart-block-simulating');

      // 입출력 블록이면 입력값 말풍선 띄우기
      if (current.shape === 'io' && simInputs && simInputs[current.id]) {
        const valBadge = document.createElement('div');
        valBadge.className = 'sim-value-badge';
        valBadge.innerHTML = `📥 입력: ${escapeHtml(simInputs[current.id])}`;
        blockEl.appendChild(valBadge);
      }
    }

    if (typeof playSfx === 'function') playSfx('step');
    await new Promise(r => setTimeout(r, 600));

    // 종료 블록에 도달하면 완주 성공!
    if (current === endBlock) {
      break;
    }

    // 나가는 연결선 탐색
    const outgoingConns = freeConnections.filter(c => c.from === current.id);
    if (outgoingConns.length === 0) {
      // 종료 블록이 아닌데 나가는 선이 없음 (중간 끊김)
      stoppedBlock = current;
      break;
    }

    let nextConn = outgoingConns[0];

    // 판단(decision) 블록인 경우: 참/거짓 분기 인터랙션
    if (current.shape === 'decision' && outgoingConns.length > 1) {
      const yesConn = outgoingConns.find(c => c.fromPort === 'yes') || outgoingConns[0];
      const noConn = outgoingConns.find(c => c.fromPort === 'no' || c.fromPort === 'right' || c.fromPort === 'left') || outgoingConns[1];

      if (blockEl) {
        // 미니 분기 선택 팝업 오버레이 띄우기 (가로형 알약 배너)
        const overlay = document.createElement('div');
        overlay.className = 'sim-choice-overlay';
        overlay.innerHTML = `
          <span class="text-xs font-black text-amber-950 flex items-center gap-1.5 shrink-0">
            <i class="fa-solid fa-code-branch text-amber-600"></i>
            <span>조건 판단:</span>
          </span>
          <button id="sim-btn-yes" class="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0">
            <span>✓ 참 (예)</span>
          </button>
          <button id="sim-btn-no" class="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-full text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0">
            <span>✗ 거짓 (아니오)</span>
          </button>
        `;
        blockEl.appendChild(overlay);

        const chosenConn = await new Promise(resolve => {
          const yesBtn = overlay.querySelector('#sim-btn-yes');
          const noBtn = overlay.querySelector('#sim-btn-no');
          yesBtn.onclick = (e) => {
            e.stopPropagation();
            resolve(yesConn);
          };
          noBtn.onclick = (e) => {
            e.stopPropagation();
            resolve(noConn);
          };
        });

        overlay.remove();
        nextConn = chosenConn;
      }
    }

    // 다음 연결 화살표 선 하이라이트 애니메이션
    const pathEl = document.getElementById(`conn-path-${nextConn.from}-${nextConn.to}`);
    if (pathEl) {
      pathEl.classList.add('flowchart-path-simulating');
      await new Promise(r => setTimeout(r, 450));
      pathEl.classList.remove('flowchart-path-simulating');
    } else {
      await new Promise(r => setTimeout(r, 300));
    }

    // 이전 블록 하이라이트 해제
    if (blockEl) {
      blockEl.classList.remove('flowchart-block-simulating');
    }

    // 다음 블록으로 이동
    current = freeBlocks.find(b => b.id === nextConn.to);
  }

  // 최종 도달 블록 하이라이트 유지
  if (current) {
    const lastEl = document.getElementById(`free-blk-${current.id}`) || document.getElementById(current.id);
    if (lastEl) {
      lastEl.classList.add('flowchart-block-simulating');
    }
  }

  const reachedEnd = (current === endBlock);

  // 결과 검증 판정
  if (reachedEnd && intermediateSteps >= 1) {
    window.isFlowchartSimValidated = true;
    if (typeof playSfx === 'function') playSfx('success');
    setTimeout(() => {
      alert(`🎉 [실행 검증 성공] 시작부터 종료까지 중간 ${intermediateSteps}개 명령을 거쳐 완벽하게 실행되었습니다!`);
      setTimeout(() => {
        document.querySelectorAll('.flowchart-block-simulating').forEach(el => el.classList.remove('flowchart-block-simulating'));
        document.querySelectorAll('.sim-value-badge').forEach(el => el.remove());
      }, 1500);
      isSimulatingFlowchart = false;
    }, 300);
  } else if (reachedEnd && intermediateSteps === 0) {
    if (typeof playSfx === 'function') playSfx('warning');
    setTimeout(() => {
      alert("⚠️ [명령 블록 없음] '시작'에서 아무런 명령 블록 없이 곧바로 '종료'로 이어졌습니다.\n중간에 자료(입출력), 판단(조건), 처리(명령) 기호를 넣어 알고리즘을 설계해 보세요!");
      setTimeout(() => {
        document.querySelectorAll('.flowchart-block-simulating').forEach(el => el.classList.remove('flowchart-block-simulating'));
        document.querySelectorAll('.sim-value-badge').forEach(el => el.remove());
      }, 1500);
      isSimulatingFlowchart = false;
    }, 300);
  } else {
    // 끊김
    if (typeof playSfx === 'function') playSfx('warning');
    const stoppedName = (stoppedBlock && stoppedBlock.text) ? `[${stoppedBlock.text}]` : '중간 기호';
    setTimeout(() => {
      alert(`⚠️ [실행 검증 중단] 순서도가 '종료'까지 이어지지 않고 ${stoppedName}에서 멈췄습니다!\n화살표를 끝까지 연결해 보세요.`);
      setTimeout(() => {
        document.querySelectorAll('.flowchart-block-simulating').forEach(el => el.classList.remove('flowchart-block-simulating'));
        document.querySelectorAll('.sim-value-badge').forEach(el => el.remove());
      }, 1500);
      isSimulatingFlowchart = false;
    }, 300);
  }
}

// --------------------------------------------------
// 🔍 정량적 알고리즘 대조 엔진 (자연어 기획서 vs 캔버스)
// --------------------------------------------------
function analyzeAlgorithmConsistency() {
  const seqCards = nlCards.filter(c => c.type === 'seq');
  const selCards = nlCards.filter(c => c.type === 'sel');
  const loopCards = nlCards.filter(c => c.type === 'loop');

  const startBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('시작'));
  const endBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('종료'));
  const processBlocks = freeBlocks.filter(b => b.shape === 'process');
  const decisionBlocks = freeBlocks.filter(b => b.shape === 'decision');
  const ioBlocks = freeBlocks.filter(b => b.shape === 'io');

  // 루프백 연결선 (아래에서 위로 되돌아가는 연결선)
  const loopbackConns = freeConnections.filter(c => {
    const fromB = freeBlocks.find(x => x.id === c.from);
    const toB = freeBlocks.find(x => x.id === c.to);
    return fromB && toB && toB.y <= fromB.y + 15;
  });

  const issues = [];
  const compliments = [];

  // 1. 시작/종료 단말 검사
  if (!startBlock) issues.push("시작 기호(보라색 단말)가 캔버스에 없습니다. 알고리즘의 출발점을 만들어 주세요.");
  if (!endBlock) issues.push("종료 기호(보라색 단말)가 캔버스에 없습니다. 알고리즘의 마무리 끝점을 지정해 주세요.");

  // 2. 선택(조건 분기) 구조 대조
  if (selCards.length > 0 && decisionBlocks.length === 0) {
    issues.push(`자연어 기획서에 '선택(만약 ~라면)' 단계가 ${selCards.length}개 있으나, 캔버스에 마름모(판단) 블록이 0개입니다.`);
  } else if (selCards.length > 0 && decisionBlocks.length < selCards.length) {
    issues.push(`자연어 기획서의 선택 단계(${selCards.length}개)에 비해 캔버스의 판단 블록(${decisionBlocks.length}개)이 부족합니다.`);
  }

  // 3. 반복(루프백) 구조 대조
  if (loopCards.length > 0 && loopbackConns.length === 0 && decisionBlocks.length === 0) {
    issues.push(`자연어 기획서에 '반복' 단계가 있으나, 캔버스에 조건을 검사하는 판단 기호나 상위로 되돌아가는 반복선이 없습니다.`);
  }

  // 4. 처리 블록 수량 대조 (순차 행동 수에 비해 처리 블록이 지나치게 부족한지 체크)
  if (seqCards.length >= 2 && processBlocks.length < Math.floor(seqCards.length * 0.6)) {
    issues.push(`자연어 기획서의 행동 단계(${seqCards.length}개)에 비해 캔버스의 파란색 처리 블록(${processBlocks.length}개)이 부족합니다. 중간 명령을 더 채워 넣어 보세요.`);
  }

  // 5. 💡 판단(Decision) 기호의 양방향 분기 완결성 검사 (참/거짓 2갈래 필수)
  decisionBlocks.forEach(dec => {
    const outgoing = freeConnections.filter(c => c.from === dec.id);
    if (outgoing.length < 2) {
      issues.push(`⚠️ [판단 분기 누락] '${dec.text || '조건 판단'}' 기호에서 '예' 또는 '아니오' 분기 중 하나가 빠져 있습니다. 조건에 따른 두 갈래 길을 모두 연결해 주세요.`);
    }
  });

  // 6. 💡 비단말 블록의 나가는 연결선 검사 (종료 외 블록 중간 멈춤 방지)
  freeBlocks.forEach(b => {
    if (b !== endBlock) {
      const outgoing = freeConnections.filter(c => c.from === b.id);
      if (outgoing.length === 0) {
        if (b === startBlock) {
          issues.push("시작 기호에서 출발하는 화살표가 없습니다. 첫 번째 단계를 연결해 주세요.");
        } else {
          issues.push(`⚠️ [미완성 경로 발견] '${b.text || b.shape}' 기호 다음에 나가는 화살표가 없어 알고리즘이 중간에 멈춥니다. 종료 기호까지 연결해 주세요.`);
        }
      }
    }
  });

  // 7. 💡 시작 ➔ 종료 전 경로 도달성(Reachability) 및 막다른 길(Dead End) 정밀 탐색
  if (startBlock && endBlock) {
    // 7.1 시작 블록에서 출발하여 도달 가능한 모든 블록 집합 (Forward Reachability)
    const visitedFromStart = new Set([startBlock.id]);
    const queue = [startBlock.id];
    while (queue.length > 0) {
      const currId = queue.shift();
      const outgoing = freeConnections.filter(c => c.from === currId);
      for (const conn of outgoing) {
        if (!visitedFromStart.has(conn.to)) {
          visitedFromStart.add(conn.to);
          queue.push(conn.to);
        }
      }
    }

    // 7.2 종료 블록에 도달할 수 있는 모든 블록 집합 (Backward Reachability)
    const canReachEnd = new Set([endBlock.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of freeConnections) {
        if (canReachEnd.has(conn.to) && !canReachEnd.has(conn.from)) {
          canReachEnd.add(conn.from);
          changed = true;
        }
      }
    }

    // 7.3 막다른 길(Dead End) 검출: 시작에서 도달할 수 있으나 종료로 갈 수 없는 분기/블록
    const deadEndBlocks = freeBlocks.filter(b => b !== endBlock && visitedFromStart.has(b.id) && !canReachEnd.has(b.id));
    if (deadEndBlocks.length > 0) {
      const names = deadEndBlocks.map(b => `'${b.text || b.shape}'`).slice(0, 2).join(', ');
      const suffix = deadEndBlocks.length > 2 ? ` 외 ${deadEndBlocks.length - 2}개` : '';
      issues.push(`⚠️ [종료 미도달 분기 발견] ${names}${suffix}에서 출발한 흐름이 '종료' 기호에 닿지 못하고 끊겨 있습니다. 모든 갈래길이 최종적으로 '종료'로 이어지도록 만들어 보세요.`);
    }

    // 7.4 시작 기호와 전혀 연결되지 않은 부유 블록 검출
    const orphanBlocks = freeBlocks.filter(b => b !== startBlock && !visitedFromStart.has(b.id));
    if (orphanBlocks.length > 0) {
      issues.push(`캔버스에 '시작' 기호의 실행 흐름과 연결되지 않은 기호가 ${orphanBlocks.length}개 있습니다. 불필요한 블록은 휴지통으로 지워주세요.`);
    }
  }

  // 8. 💡 미수정 기본(더미) 블록 텍스트 방치 검출 (학생이 내용을 채우지 않은 경우)
  const DUMMY_TEXTS = [
    "알고리즘 명령 실행",
    "연산 처리 실행",
    "데이터 입출력",
    "조건 검사 ◇",
    "블록 내용"
  ];
  const uneditedBlocks = freeBlocks.filter(b => 
    b.shape !== 'terminal' && DUMMY_TEXTS.some(dt => (b.text || '').trim() === dt)
  );
  if (uneditedBlocks.length > 0) {
    const uneditedNames = uneditedBlocks.map(b => `'${b.text}'`).slice(0, 2).join(', ');
    const suffix = uneditedBlocks.length > 2 ? ` 외 ${uneditedBlocks.length - 2}개` : '';
    issues.push(`⚠️ [기본 블록 내용 미작성] 캔버스에 내용을 수정하지 않은 기본 기호(${uneditedNames}${suffix})가 있습니다. 기호를 더블클릭하여 자연어 기획서에 맞게 실제 명령을 적어주세요.`);
  }

  // 9. 💡 기획서에 단계가 있으나 캔버스에 명령 블록이 전혀 없는 경우
  const commandBlocks = freeBlocks.filter(b => b.shape !== 'terminal');
  if (nlCards.length > 0 && commandBlocks.length === 0) {
    issues.push("자연어 기획서에 단계가 작성되어 있으나, 캔버스에 '시작'과 '종료' 외에 실제 명령 기호(자료·처리·판단)가 하나도 없습니다. 기호 보관함에서 기호를 추가해 보세요.");
  }

  // 칭찬 요소
  if (startBlock && endBlock && issues.length === 0) {
    compliments.push("시작과 종료 단말 기호가 바르게 배치되어 있으며, 모든 경로가 종료까지 완벽하게 이어집니다.");
  }
  if (decisionBlocks.length > 0 && selCards.length > 0 && !issues.some(i => i.includes('판단'))) {
    compliments.push("자연어 기획서의 조건 분기를 주황색 마름모(판단) 기호와 양방향 갈래길로 잘 대응시켰습니다.");
  }
  if (loopbackConns.length > 0) {
    compliments.push("상위 블록으로 되돌아가는 완벽한 반복(루프백) 화살표를 갖추고 있습니다.");
  }

  return {
    isConsistent: issues.length === 0,
    issues,
    compliments,
    stats: {
      nlTotal: nlCards.length,
      seqCards: seqCards.length,
      selCards: selCards.length,
      loopCards: loopCards.length,
      blocksTotal: freeBlocks.length,
      process: processBlocks.length,
      decision: decisionBlocks.length,
      io: ioBlocks.length,
      connections: freeConnections.length,
      loopbacks: loopbackConns.length
    }
  };
}

/**
 * --------------------------------------------------
 * 🤖 Solar AI 알고리즘 설계 검사 모달 (전용 팝업 리포트)
 * --------------------------------------------------
 */
function openAiAuditModal() {
  const modal = document.getElementById('flowchart-ai-audit-modal');
  if (modal) modal.classList.remove('hidden');
  if (typeof playSfx === 'function') playSfx('step');
}

function closeAiAuditModal() {
  const modal = document.getElementById('flowchart-ai-audit-modal');
  if (modal) modal.classList.add('hidden');
}

async function diagnoseFreeAlgorithmWithSolarAI() {
  const modal = document.getElementById('flowchart-ai-audit-modal');
  const content = document.getElementById('flowchart-ai-audit-content');
  const actions = document.getElementById('flowchart-ai-audit-actions');
  if (!modal || !content) return;

  openAiAuditModal();

  // 로딩 상태 표시
  content.innerHTML = `
    <div class="py-12 flex flex-col items-center justify-center gap-3 text-center">
      <div class="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-2xl animate-spin shadow-sm">
        <i class="fa-solid fa-spinner"></i>
      </div>
      <div>
        <div class="text-sm font-black text-slate-800">Solar AI가 자연어와 순서도를 정밀 대조 중입니다...</div>
        <div class="text-xs text-slate-400 mt-1">2022 개정 정보 교육과정 기준: 순차, 선택, 반복 논리 구조 일치성 분석</div>
      </div>
    </div>
  `;

  if (actions) {
    actions.innerHTML = `
      <button onclick="closeAiAuditModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition">
        닫기
      </button>
    `;
  }

  // 1. JS 룰 엔진을 통한 정량적 사전 대조 수행
  const consistency = analyzeAlgorithmConsistency();

  const nlSummary = nlCards.map((c, i) => {
    if (c.type === 'seq') return `${i+1}단계(순차): ${c.text || '내용 없음'}`;
    if (c.type === 'sel') return `${i+1}단계(선택): 만약 [${c.condition || '조건'}] -> 참: ${c.yesAction || '실행'} / 거짓: ${c.noAction || '실행'}`;
    if (c.type === 'loop') return `${i+1}단계(반복): [${c.condition || '조건'}] 동안 -> (${c.loopAction || '행동'}) 반복`;
  }).join('\n');

  const orderedBlocksForAI = getFlowchartOrderedBlocks();
  const blockSummary = orderedBlocksForAI.map(b => `- [${b.shape}] "${b.text}"`).join('\n');

  // 자연어 친화적 연결선 맵 (포트 방향 및 루프백 판별 포함)
  const connSummary = freeConnections.map(c => {
    const fromB = freeBlocks.find(x => x.id === c.from);
    const toB = freeBlocks.find(x => x.id === c.to);
    if (!fromB || !toB) return `(${c.from} -> ${c.to})`;
    const fromText = fromB.text ? `"${fromB.text}"` : fromB.shape;
    const toText = toB.text ? `"${toB.text}"` : toB.shape;

    let portLabel = "진행선";
    if (c.fromPort === 'yes') portLabel = "[예] 참 분기선";
    else if (c.fromPort === 'no') portLabel = "[아니오] 거짓 분기선";
    else if (c.fromPort === 'right') portLabel = "[우측 포트]";
    else if (c.fromPort === 'left') portLabel = "[좌측 포트]";
    else if (c.fromPort === 'bottom' || c.fromPort === 'out') portLabel = "[하단 포트]";

    const isBack = toB.y <= fromB.y + 15;
    const backLabel = isBack ? " ➔ 상위 판단/조건으로 되돌아가는 루프백(반복 구조 연결)" : "";
    return `- [${fromB.shape}: ${fromText}]의 ${portLabel} ➔ [${toB.shape}: ${toText}]${backLabel}`;
  }).join('\n');

  const issuesText = consistency.issues.length > 0 
    ? consistency.issues.map((iss, idx) => `  ${idx+1}) ${iss}`).join('\n')
    : "  - 특이한 결손이나 누락 없이 자연어와 순서도 블록이 균형 있게 구성됨.";

  const complimentsText = consistency.compliments.length > 0
    ? consistency.compliments.map(cmp => `  - ${cmp}`).join('\n')
    : "  - 알고리즘 완성을 위해 노력 중.";

  const prompt = `당신은 대한민국 중학교 2학년 정보 교과 '알고리즘과 순서도' 단원의 친절하고 명확한 AI 지도교사입니다.
학생이 작성한 [자연어 기획서]와 [순서도 캔버스 블록 및 화살표]의 논리적 일치성을 검토해 주세요.

[자연어 알고리즘 단계]:
${nlSummary || "작성된 단계 없음"}

[순서도 캔버스 블록 목록]:
${blockSummary || "배치된 블록 없음"}

[화살표 연결 흐름]:
${connSummary || "연결선 없음"}

[시스템 사전 정량 분석 결과]:
* 일치 상태: ${consistency.isConsistent ? '논리적 일치' : '⚠️ 보완 및 블록 추가 필요'}
* 발견된 결손/누락 문제:
${issuesText}
* 칭찬할 만한 점:
${complimentsText}

[평가 및 피드백 지침 - 매우 중요!]:
1. 반드시 응답의 맨 첫 줄에 최종 판정 태그를 단독으로 작성하세요:
   - 자연어 기획서의 단계별 행동/조건이 순서도 블록 내용 및 화살표 흐름과 실질적으로 일치할 때: [판정: 통과]
   - 기획서의 특정 단계가 순서도에 누락되어 있거나, 순서도 블록 내용이 기본 텍스트('알고리즘 명령 실행' 등)로 방치되어 있거나, 화살표 흐름에 결손이 있을 때: [판정: 보완 필요]
2. 만약 사전 정량 분석에서 '보완 필요' 판정이 났거나, 발견된 결손/누락 문제가 있거나, 캔버스 블록에 실제 기획서 내용이 채워지지 않았다면 절대로 [판정: 통과]를 주지 말고 반드시 [판정: 보완 필요]를 부여하세요!
3. 두 번째 줄부터 학생을 위한 지도 피드백을 작성하세요:
   - [보완 필요]인 경우: 잘된 점은 짧게 1문장만 가볍게 칭찬하고, 어떤 단계의 내용이 순서도 블록에 빠져 있는지, 어떤 기호(처리, 판단 등)를 수정하거나 추가해야 하는지 중2 학생 눈높이에 맞게 다정하고 구체적으로 지도하세요.
   - [통과]인 경우: 자연어 기획서와 순서도 캔버스가 어떻게 잘 일치했는지 칭찬하고 완성 축하 메시지를 남기세요.
4. 순서도에서 처리(Process) 블록의 아래쪽뿐만 아니라 우측이나 좌측 포트에서 판단(Decision) 블록으로 되돌아가는 화살표는 완벽한 반복(Loopback) 구조로 간주합니다.
5. 피드백 본문은 총 3문장 이내(220자 내외)로 간결하게 작성하세요.`;

  let aiFeedbackText = "";
  try {
    const res = await fetch("https://api.upstage.ai/v1/solar/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${UPSTAGE_API_KEY}`
      },
      body: JSON.stringify({
        model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    aiFeedbackText = data.choices[0].message.content;
  } catch (err) {
    aiFeedbackText = consistency.issues.length > 0
      ? `[판정: 보완 필요]\n자연어 기획서와 비교했을 때 보완할 점이 있어요: ${consistency.issues[0]} 기호 보관함에서 필요한 기호를 추가하거나 내용을 수정해 보세요!`
      : `[판정: 통과]\n자연어 기획서와 순서도 블록이 단계별로 일관되게 잘 구성되어 있습니다. 완성 후 [띵커보드 제출]을 진행해 보세요!`;
  }

  // 💡 Solar AI 판정 태그 파싱 및 정밀 보정
  let aiJudgmentPassed = consistency.isConsistent; // 기본값
  if (aiFeedbackText.includes("[판정: 통과]")) {
    aiJudgmentPassed = true;
  } else if (aiFeedbackText.includes("[판정: 보완 필요]") || aiFeedbackText.includes("보완 필요")) {
    aiJudgmentPassed = false;
  } else {
    // 키워드 기반 스마트 보정 (LLM이 태그를 누락했을 때의 안전망)
    const needFixKeywords = ["빠져 있으니", "빠져 있어", "채워 넣으", "추가해 보세요", "보완할 점", "수정해"];
    if (needFixKeywords.some(kw => aiFeedbackText.includes(kw))) {
      aiJudgmentPassed = false;
    }
  }

  // 💡 양방향 합의(Consensus) 합격제: JS 정량 검사 통과 AND Solar AI 판정 통과
  const isGood = consistency.isConsistent && aiJudgmentPassed;
  window.isFlowchartAiPassed = isGood;
  if (typeof updateThinkerToolbarButton === 'function') updateThinkerToolbarButton();

  // 학생에게 보여줄 피드백 텍스트에서는 [판정: ...] 태그를 깔끔하게 분리/제거
  const cleanFeedbackText = aiFeedbackText.replace(/\[판정:\s*(통과|보완 필요)\]\s*/g, '').trim();

  // 헤더 배너
  const headerHtml = isGood ? `
    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl font-black shadow-md shadow-emerald-500/20">💮</div>
        <div>
          <div class="text-sm font-black text-emerald-950 flex items-center gap-1.5">
            <span>Solar AI 설계 검사 통과!</span>
            <span class="px-2 py-0.5 bg-emerald-200/80 text-emerald-800 text-[10px] rounded-md font-bold">2022 개정 정보 표준</span>
          </div>
          <div class="text-xs text-emerald-700 font-medium mt-0.5">자연어 기획서와 순서도 캔버스가 완벽하게 일치합니다.</div>
        </div>
      </div>
      <span class="hidden sm:inline-flex px-3 py-1.5 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-sm">
        💮 AI 검사 통과 (합격 인증)
      </span>
    </div>
  ` : `
    <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl font-black shadow-md shadow-amber-500/20">🛠️</div>
        <div>
          <div class="text-sm font-black text-amber-950 flex items-center gap-1.5">
            <span>알고리즘 보완 권장</span>
            <span class="px-2 py-0.5 bg-amber-200/80 text-amber-800 text-[10px] rounded-md font-bold">기호 및 내용 보완 필요</span>
          </div>
          <div class="text-xs text-amber-700 font-medium mt-0.5">자연어 기획서의 단계와 순서도 캔버스 내용이 완전히 일치하지 않습니다.</div>
        </div>
      </div>
      <span class="hidden sm:inline-flex px-3 py-1.5 bg-amber-500 text-white font-black rounded-xl text-xs shadow-sm">
        보완 필요
      </span>
    </div>
  `;

  // 정량 대조표 카드
  const stats = consistency.stats;
  const quantGridHtml = `
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
      <div class="flex items-center justify-between text-xs font-black text-slate-700">
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-chart-pie text-indigo-500"></i> 📊 기획서 vs 순서도 기호 대조표</span>
        <span class="text-[11px] text-slate-400 font-normal">총 ${stats.nlTotal}단계 ➔ ${stats.blocksTotal}개 블록</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div class="font-bold text-slate-600 flex items-center justify-between">
            <span>📝 자연어 기획서</span>
            <span class="text-indigo-600 font-black">${stats.nlTotal}단계</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5">
            <div>• 순차: <strong class="text-slate-700">${stats.seqCards}개</strong></div>
            <div>• 선택: <strong class="text-slate-700">${stats.selCards}개</strong></div>
            <div>• 반복: <strong class="text-slate-700">${stats.loopCards}개</strong></div>
          </div>
        </div>
        <div class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
          <div class="font-bold text-slate-600 flex items-center justify-between">
            <span>📐 캔버스 순서도</span>
            <span class="text-emerald-600 font-black">${stats.blocksTotal}블록</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5">
            <div>• 처리: <strong class="text-slate-700">${stats.process}개</strong> / 입출력: <strong class="text-slate-700">${stats.io}개</strong></div>
            <div>• 판단: <strong class="text-slate-700">${stats.decision}개</strong></div>
            <div>• 연결선: <strong class="text-slate-700">${stats.connections}개</strong> (루프백 ${stats.loopbacks}개)</div>
          </div>
        </div>
      </div>
      ${consistency.issues.length > 0 ? `
        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
          <div class="text-[11px] font-black text-rose-700 flex items-center gap-1">
            <i class="fa-solid fa-triangle-exclamation"></i> <span>발견된 결손 및 보완 과제:</span>
          </div>
          <ul class="text-[11px] text-rose-600 space-y-1 list-none font-medium">
            ${consistency.issues.map((iss, idx) => {
              const m = iss.match(/'([^']+)'/);
              const targetText = m ? m[1] : '';
              const clickAction = targetText ? `onclick="focusCanvasBlockByText('${escapeHtml(targetText)}'); closeAiAuditModal();"` : '';
              const cursorClass = targetText ? 'cursor-pointer hover:bg-rose-100/80 p-1 rounded-lg transition flex items-start justify-between' : 'p-1';
              return `
                <li ${clickAction} class="${cursorClass}">
                  <span>${idx + 1}. ${escapeHtml(iss)}</span>
                  ${targetText ? '<span class="text-[10px] bg-rose-200/80 text-rose-800 px-1.5 py-0.5 rounded font-bold shrink-0 ml-1.5">기호 찾기 🔍</span>' : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      ` : (aiJudgmentPassed ? `
        <div class="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
          <i class="fa-solid fa-circle-check text-emerald-600"></i>
          <span>자연어와 순서도 기호가 빠짐없이 완벽하게 대응되었습니다.</span>
        </div>
      ` : `
        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
          <i class="fa-solid fa-lightbulb text-amber-600"></i>
          <span>기호 개수는 구성되었으나 자연어 단계의 세부 내용 반영이 필요합니다.</span>
        </div>
      `)}
    </div>
  `;

  // AI 총평 카드
  const adviceBorder = isGood ? "border-emerald-200 bg-emerald-50/70" : "border-indigo-200 bg-indigo-50/70";
  const adviceTitle = isGood ? "Solar AI의 설계 검사 종합 의견" : "Solar AI의 맞춤형 보완 가이드";
  const adviceColor = isGood ? "text-emerald-950" : "text-indigo-950";
  const adviceIcon = isGood ? "fa-medal text-emerald-600" : "fa-lightbulb text-indigo-600";

  const adviceHtml = `
    <div class="p-4 ${adviceBorder} border rounded-2xl space-y-2">
      <div class="flex items-center gap-2 font-black text-xs ${adviceColor}">
        <i class="fa-solid ${adviceIcon}"></i>
        <span>${adviceTitle}</span>
      </div>
      <div class="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
        ${cleanFeedbackText.replace(/\n/g, '<br>')}
      </div>
    </div>
  `;

  content.innerHTML = `
    ${headerHtml}
    ${quantGridHtml}
    ${adviceHtml}
  `;

  if (actions) {
    if (isGood) {
      actions.innerHTML = `
        <button onclick="closeAiAuditModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
          캔버스 확인
        </button>
        <button onclick="closeAiAuditModal(); openThinkerSubmissionModal();" class="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition active:scale-95">
          <i class="fa-solid fa-clipboard-check"></i>
          <span>합격 도장 찍고 띵커보드 제출하기</span>
        </button>
      `;
    } else {
      actions.innerHTML = `
        <button onclick="closeAiAuditModal()" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition active:scale-95">
          <i class="fa-solid fa-screwdriver-wrench"></i>
          <span>캔버스로 돌아가 기호 보완하기</span>
        </button>
      `;
    }
  }

  if (typeof playSfx === 'function') playSfx(isGood ? 'success' : 'step');
}


// ==========================================
// 5. 띵커보드(ThinkerBoard) 원클릭 제출 파이프라인
// ==========================================

/**
 * 순서도 블록들을 실제 실행 흐름(화살표 연결 순서)에 맞춰 정렬
 * (시작 ➔ 연결선 경로 순차 탐색 ➔ 미연결 블록 ➔ 종료 단말 맨 마지막)
 */
function getFlowchartOrderedBlocks() {
  if (!freeBlocks || freeBlocks.length === 0) return [];

  const startBlock = freeBlocks.find(b => b.shape === 'terminal' && (b.text || '').includes('시작'))
    || freeBlocks.find(b => b.id === 'blk-start')
    || freeBlocks[0];

  const endBlock = freeBlocks.find(b => b.shape === 'terminal' && ((b.text || '').includes('종료') || b.id === 'blk-end'))
    || freeBlocks.filter(b => b.shape === 'terminal' && b !== startBlock)[0];

  const ordered = [];
  const visited = new Set();

  if (startBlock) {
    ordered.push(startBlock);
    visited.add(startBlock.id);
  }

  // 연결선을 타고 다음 블록들을 순차 탐색 (BFS)
  const queue = startBlock ? [startBlock] : [];
  while (queue.length > 0) {
    const cur = queue.shift();
    const outConns = (freeConnections || []).filter(c => c.from === cur.id);
    for (const c of outConns) {
      const targetB = freeBlocks.find(b => b.id === c.to);
      if (targetB && !visited.has(targetB.id)) {
        // 종료 블록은 바로 넣지 않고 맨 마지막에 넣기 위해 예약
        if (targetB !== endBlock) {
          visited.add(targetB.id);
          ordered.push(targetB);
          queue.push(targetB);
        }
      }
    }
  }

  // 연결선에 잡히지 않은 나머지 중간 블록들 (y좌표 순으로 위에서 아래로 정렬하여 추가)
  const remaining = freeBlocks
    .filter(b => !visited.has(b.id) && b !== endBlock)
    .sort((a, b) => (a.y || 0) - (b.y || 0));

  remaining.forEach(b => {
    visited.add(b.id);
    ordered.push(b);
  });

  // 종료 단말 블록을 무조건 맨 마지막에 추가!
  if (endBlock && !ordered.includes(endBlock)) {
    ordered.push(endBlock);
  }

  return ordered;
}

// 💡 학생 학번/이름 입력 핸들러 및 세션 저장소 동기화
function handleStudentInput(el) {
  if (el) {
    el.classList.remove('student-input-highlight', 'input-shake');
  }
  const numInput = document.getElementById('thinker-student-num');
  const nameInput = document.getElementById('thinker-student-name');
  if (numInput && numInput.value.trim()) {
    sessionStorage.setItem('flowchart_student_num', numInput.value.trim());
  }
  if (nameInput && nameInput.value.trim()) {
    sessionStorage.setItem('flowchart_student_name', nameInput.value.trim());
  }
}

function openThinkerSubmissionModal() {
  // 💡 구조적 합격 인증 게이트웨이: AI 설계 검사를 통과해야만 띵커보드에 제출 가능
  if (!window.isFlowchartAiPassed) {
    if (typeof playSfx === 'function') playSfx('warning');
    const proceed = confirm("⚠️ 아직 Solar AI 설계 검사를 통과하지 않았습니다!\n\n순서도 연구소에서는 내가 만든 기획서와 순서도가 올바른지 AI의 검사를 통과해야 띵커보드에 최종 제출할 수 있어요.\n\n지금 AI 설계 검사를 받으시겠습니까?");
    if (proceed) {
      diagnoseFreeAlgorithmWithSolarAI();
    }
    return;
  }

  const modal = document.getElementById('thinker-submission-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // 💡 학번 및 이름 입력창 초기화 및 자동 포커스 & 시각적 하이라이트 (홍길동 근절!)
  const numInput = document.getElementById('thinker-student-num');
  const nameInput = document.getElementById('thinker-student-name');
  if (numInput && nameInput) {
    const savedNum = sessionStorage.getItem('flowchart_student_num') || '';
    const savedName = sessionStorage.getItem('flowchart_student_name') || '';
    numInput.value = savedNum;
    nameInput.value = savedName;

    // 시각적 시선 집중 하이라이트 (홍길동 기본값 대신 직접 입력 강력 유도)
    if (!savedNum) numInput.classList.add('student-input-highlight');
    if (!savedName) nameInput.classList.add('student-input-highlight');

    // 모달 렌더링 완료 후 학번 칸에 자동 포커스
    setTimeout(() => {
      if (!savedNum) {
        numInput.focus();
      } else if (!savedName) {
        nameInput.focus();
      } else {
        numInput.focus();
      }
    }, 100);
  }

  // 현재 상태 / 목표 상태 인풋 스마트 기본값 채우기
  const curInput = document.getElementById('thinker-cur-status');
  const goalInput = document.getElementById('thinker-goal-status');
  const pres = window.latestAbstractionPrescription;

  if (curInput && goalInput) {
    if (pres && pres.currentStatus && pres.goalStatus) {
      curInput.value = pres.currentStatus;
      goalInput.value = pres.goalStatus;
    } else if (pres) {
      if (!curInput.value) curInput.value = pres.currentStatus || "";
      if (!goalInput.value) goalInput.value = pres.goalStatus || "";
    } else {
      if (!curInput.value) {
        const firstCard = nlCards[0];
        curInput.value = firstCard && firstCard.text 
          ? `[${firstCard.text}] 시작 전 상태` 
          : "알고리즘 문제 발생 및 초기 상태";
      }
      if (!goalInput.value) {
        const lastCard = nlCards[nlCards.length - 1];
        let lastText = "알고리즘 최종 문제 해결 및 완료!";
        if (lastCard) {
          if (lastCard.type === 'seq') lastText = lastCard.text || lastText;
          else if (lastCard.type === 'sel') lastText = `${lastCard.yesAction || '조건 처리'} 성공 및 완료`;
          else if (lastCard.type === 'loop') lastText = `${lastCard.loopAction || '반복 동작'} 완수`;
        }
        goalInput.value = lastText;
      }
    }
  }

  updateThinkerCardPreview();
  if (typeof playSfx === 'function') playSfx('step');
}

function closeThinkerSubmissionModal() {
  const modal = document.getElementById('thinker-submission-modal');
  if (modal) modal.classList.add('hidden');
}

function updateThinkerCardPreview() {
  const sNumVal = document.getElementById('thinker-student-num') ? document.getElementById('thinker-student-num').value.trim() : "";
  const sNameVal = document.getElementById('thinker-student-name') ? document.getElementById('thinker-student-name').value.trim() : "";
  const studentNum = sNumVal || "(학번 미입력)";
  const studentName = sNameVal || "(이름 미입력)";

  const preview = document.getElementById('thinker-card-preview');
  if (!preview) return;

  const pres = window.latestAbstractionPrescription;
  const curStatus = (document.getElementById('thinker-cur-status')?.value || '').trim() 
    || (pres ? pres.currentStatus : '알고리즘 시작 전 상태');
  const goalStatus = (document.getElementById('thinker-goal-status')?.value || '').trim() 
    || (pres ? pres.goalStatus : '알고리즘 수행 후 목표 달성!');
  const coreVars = pres && pres.coreVariables ? pres.coreVariables.join(', ') : '핵심 입력 변수 및 조건';

  const nlListHtml = nlCards.map((c, i) => {
    if (c.type === 'seq') return `<div><strong>${i+1}. [순차]</strong> ${escapeHtml(c.text || '내용 없음')}</div>`;
    if (c.type === 'sel') return `<div><strong>${i+1}. [선택]</strong> 만약 [${escapeHtml(c.condition || '조건')}] -> (예: ${escapeHtml(c.yesAction || '실행')} / 아니오: ${escapeHtml(c.noAction || '실행')})</div>`;
    if (c.type === 'loop') return `<div><strong>${i+1}. [반복]</strong> [${escapeHtml(c.condition || '조건')}] 일 때까지 -> (${escapeHtml(c.loopAction || '행동')}) 반복</div>`;
  }).join('');

  // 실제 실행 순서(토폴로지)대로 정렬된 블록들 가져오기
  const orderedBlocks = getFlowchartOrderedBlocks();
  const blocksHtml = orderedBlocks.map(b => `<span class="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold">[${b.shape}] ${escapeHtml(b.text)}</span>`).join(' ➔ ');

  preview.innerHTML = `
    <div class="space-y-3.5 text-xs sm:text-sm text-slate-800">
      <!-- 1. 헤더 배너 -->
      <div class="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-xs">
        <div>
          <div class="text-[11px] font-bold text-indigo-200">ALGORITHM LAB PORTFOLIO</div>
          <h3 class="text-base sm:text-lg font-black tracking-tight">나만의 알고리즘 순서도 마스터 리포트</h3>
        </div>
        <div class="text-right">
          <span class="text-xs sm:text-sm font-black bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-white/20">
            ${escapeHtml(studentNum) || '학번'} ${escapeHtml(studentName) || '이름'}
          </span>
        </div>
      </div>

      <!-- 2. 추상화 분석 결과 -->
      <div class="p-3.5 bg-violet-50/70 border border-violet-200 rounded-2xl space-y-1.5">
        <h4 class="font-black text-violet-900 text-xs flex items-center gap-1.5">
          <i class="fa-solid fa-lightbulb text-violet-600"></i> 1. 문제 분석 및 추상화
        </h4>
        <div class="space-y-1 text-xs">
          <div><span class="text-slate-500 font-bold">현재 상태:</span> <strong class="text-slate-800">${escapeHtml(curStatus)}</strong></div>
          <div><span class="text-slate-500 font-bold">목표 상태:</span> <strong class="text-slate-800">${escapeHtml(goalStatus)}</strong></div>
        </div>
        <div class="text-xs pt-1 border-t border-violet-100">
          <span class="text-slate-500 font-bold">핵심 변수 & 조건:</span> 
          <strong class="text-violet-800">${escapeHtml(coreVars)}</strong>
        </div>
      </div>

      <!-- 3. 자연어 알고리즘 기획서 -->
      <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
        <h4 class="font-black text-blue-900 text-xs flex items-center gap-1.5">
          <i class="fa-solid fa-file-lines text-blue-600"></i> 2. 자연어 알고리즘 설계
        </h4>
        <div class="space-y-1 text-xs text-slate-700 leading-relaxed font-medium">
          ${nlListHtml || '<div class="text-slate-400 italic">작성된 자연어 카드가 없습니다.</div>'}
        </div>
      </div>

      <!-- 4. 순서도 시각 구조 -->
      <div class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
        <h4 class="font-black text-emerald-900 text-xs flex items-center gap-1.5">
          <i class="fa-solid fa-diagram-project text-emerald-600"></i> 3. 완성된 순서도 흐름 (실제 캔버스 배치)
        </h4>
        <div class="flex flex-wrap items-center gap-1.5 text-xs text-slate-700 leading-relaxed py-1">
          ${blocksHtml || '<div class="text-slate-400 italic">배치된 순서도 블록이 없습니다.</div>'}
        </div>
      </div>

      <!-- 5. 합격 스탬프 (조건부: AI 설계 검사 통과 시에만 공식 합격 인증 마크 부여) -->
      ${window.isFlowchartAiPassed ? `
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div class="flex items-center gap-2 text-emerald-950 font-bold">
            <span class="text-base">💮</span>
            <div>
              <span class="font-black text-emerald-900">Solar AI 설계 검사 통과</span>
              <span class="text-[11px] text-emerald-700 block sm:inline sm:ml-1">자연어 기획서와 순서도가 완벽히 일치합니다.</span>
            </div>
          </div>
          <span class="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl text-xs shadow-xs shrink-0">
            💮 AI 검사 통과 (합격 인증)
          </span>
        </div>
      ` : `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2 text-amber-950">
            <span class="text-base shrink-0">⏳</span>
            <div>
              <span class="font-black text-amber-900">AI 검사 전 (실습 중)</span>
              <span class="text-[11px] text-amber-700 block sm:inline sm:ml-1">AI 설계 검사를 통과하면 이곳에 공식 합격 도장이 찍힙니다!</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button onclick="closeThinkerSubmissionModal(); diagnoseFreeAlgorithmWithSolarAI();" class="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black rounded-xl text-xs shadow-xs flex items-center gap-1 transition active:scale-95">
              <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              <span>지금 AI 검사받기</span>
            </button>
          </div>
        </div>
      `}
    </div>
  `;

  // 모달 하단 버튼 제어 (미통과 시 복사/다운로드 비활성화)
  const copyBtn = document.getElementById('btn-thinker-copy');
  const dlBtn = document.getElementById('btn-thinker-download');
  const isPassed = !!window.isFlowchartAiPassed;
  if (copyBtn) {
    copyBtn.disabled = !isPassed;
    copyBtn.classList.toggle('opacity-50', !isPassed);
    copyBtn.classList.toggle('cursor-not-allowed', !isPassed);
  }
  if (dlBtn) {
    dlBtn.disabled = !isPassed;
    dlBtn.classList.toggle('opacity-50', !isPassed);
    dlBtn.classList.toggle('cursor-not-allowed', !isPassed);
  }
}

// --------------------------------------------------
// HTML5 Canvas 기반 초정밀 이미지 생성 및 클립보드 복사
// --------------------------------------------------
async function copyThinkerImageToClipboard() {
  const numInput = document.getElementById('thinker-student-num');
  const nameInput = document.getElementById('thinker-student-name');
  const studentNum = numInput ? numInput.value.trim() : "";
  const studentName = nameInput ? nameInput.value.trim() : "";

  // 💡 학번 및 이름 필수 입력 가드 (홍길동/공란 제출 원천 방지)
  if (!studentNum || !studentName) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ 학번과 이름을 모두 입력해 주세요!\n\n선생님께서 여러분의 멋진 순서도 작품을 확인할 수 있도록\n학번과 이름을 꼭 적어주세요.");
    if (!studentNum && numInput) {
      numInput.classList.add('input-shake');
      numInput.focus();
      setTimeout(() => numInput.classList.remove('input-shake'), 600);
    } else if (!studentName && nameInput) {
      nameInput.classList.add('input-shake');
      nameInput.focus();
      setTimeout(() => nameInput.classList.remove('input-shake'), 600);
    }
    return;
  }

  // 성공 시 sessionStorage 보존 (동일 세션 재입력 편의)
  sessionStorage.setItem('flowchart_student_num', studentNum);
  sessionStorage.setItem('flowchart_student_name', studentName);

  const btn = document.getElementById('btn-thinker-copy');
  if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 이미지 생성 중...`;

  try {
    const canvas = await generatePortfolioCanvas(studentNum, studentName);
    
    canvas.toBlob(async (blob) => {
      try {
        if (!navigator.clipboard || !window.ClipboardItem) {
          throw new Error("클립보드 API 미지원");
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);

        if (typeof playSfx === 'function') playSfx('success');
        if (btn) btn.innerHTML = `<i class="fa-solid fa-check"></i> 복사 완료!`;

        alert(`🎉 포트폴리오 이미지가 클립보드에 복사되었습니다!\n\n선생님이 칠판에 띄워주신 띵커보드 화면에서 [Ctrl + V]를 눌러 붙여넣으세요!`);
        closeThinkerSubmissionModal();

      } catch (clipErr) {
        // 클립보드 차단 시 자동 다운로드 백업
        downloadCanvasImage(canvas, `${studentNum}_${studentName}_알고리즘_포트폴리오.png`);
        alert(`클립보드 직접 쓰기가 차단된 환경이어서 이미지 파일이 자동으로 다운로드되었습니다!\n띵커보드 창으로 다운로드된 파일을 끌어다 놓으세요.`);
        closeThinkerSubmissionModal();
      } finally {
        if (btn) btn.innerHTML = `<i class="fa-solid fa-copy"></i> 띵커보드 제출용 이미지 복사 (Ctrl+V)`;
      }
    }, 'image/png');

  } catch (err) {
    alert("이미지 생성 중 오류가 발생했습니다. 아래 [다운로드] 버튼을 이용해 주세요.");
    if (btn) btn.innerHTML = `<i class="fa-solid fa-copy"></i> 띵커보드 제출용 이미지 복사 (Ctrl+V)`;
  }
}

async function downloadThinkerImage() {
  const numInput = document.getElementById('thinker-student-num');
  const nameInput = document.getElementById('thinker-student-name');
  const studentNum = numInput ? numInput.value.trim() : "";
  const studentName = nameInput ? nameInput.value.trim() : "";

  // 💡 학번 및 이름 필수 입력 가드 (홍길동/공란 제출 원천 방지)
  if (!studentNum || !studentName) {
    if (typeof playSfx === 'function') playSfx('warning');
    alert("⚠️ 학번과 이름을 모두 입력해 주세요!\n\n선생님께서 여러분의 멋진 순서도 작품을 확인할 수 있도록\n학번과 이름을 꼭 적어주세요.");
    if (!studentNum && numInput) {
      numInput.classList.add('input-shake');
      numInput.focus();
      setTimeout(() => numInput.classList.remove('input-shake'), 600);
    } else if (!studentName && nameInput) {
      nameInput.classList.add('input-shake');
      nameInput.focus();
      setTimeout(() => nameInput.classList.remove('input-shake'), 600);
    }
    return;
  }

  // 성공 시 sessionStorage 보존
  sessionStorage.setItem('flowchart_student_num', studentNum);
  sessionStorage.setItem('flowchart_student_name', studentName);

  const canvas = await generatePortfolioCanvas(studentNum, studentName);
  downloadCanvasImage(canvas, `${studentNum}_${studentName}_알고리즘_포트폴리오.png`);
  if (typeof playSfx === 'function') playSfx('success');
}

function downloadCanvasImage(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/**
 * 캔버스 지능형 줄바꿈 텍스트 렌더링 헬퍼 (글자 겹침 및 우측 잘림 완벽 방지)
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  if (!text) return y;
  const chars = Array.from(String(text));
  let line = '';
  let linesDrawn = 0;
  let currentY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      if (linesDrawn === maxLines - 1) {
        ctx.fillText(line.substring(0, Math.max(0, line.length - 1)) + '…', x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
      linesDrawn++;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

/**
 * 방향 인식 화살표 촉 드로잉 헬퍼
 */
function drawArrowHead(ctx, x, y, dir, color, scale = 1.0) {
  const headLen = Math.max(6, 8 * scale);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 'right') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - headLen, y - headLen * 0.55);
    ctx.lineTo(x - headLen, y + headLen * 0.55);
  } else if (dir === 'left') {
    ctx.moveTo(x, y);
    ctx.lineTo(x + headLen, y - headLen * 0.55);
    ctx.lineTo(x + headLen, y + headLen * 0.55);
  } else if (dir === 'up') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - headLen * 0.55, y + headLen);
    ctx.lineTo(x + headLen * 0.55, y + headLen);
  } else {
    // down (기본: 상단 포트로 진입)
    ctx.moveTo(x, y);
    ctx.lineTo(x - headLen * 0.55, y - headLen);
    ctx.lineTo(x + headLen * 0.55, y - headLen);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 나만의 알고리즘 & 순서도 설계 보고서 Canvas 2D 고해상도 이미지 생성 엔진
 */
function generatePortfolioCanvas(studentNum, studentName) {
  return new Promise((resolve) => {
    const W = 840;
    const H = 990;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 배경 흰색
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // 외곽 테두리
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    // 헤더 그라디언트 배너
    const grad = ctx.createLinearGradient(30, 30, W - 60, 110);
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = grad;
    roundRect(ctx, 30, 30, W - 60, 90, 16, true, false);

    ctx.fillStyle = "#c7d2fe";
    ctx.font = "bold 13px 'Pretendard', sans-serif";
    ctx.fillText("ALGORITHM LAB • COMPREHENSIVE PORTFOLIO", 50, 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 24px 'Pretendard', sans-serif";
    ctx.fillText("나만의 알고리즘 & 순서도 설계 보고서", 50, 95);

    // 학생 정보 뱃지
    const sNum = (studentNum || document.getElementById('thinker-student-num')?.value || '').trim() || "학번";
    const sName = (studentName || document.getElementById('thinker-student-name')?.value || '').trim() || "이름";
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    roundRect(ctx, W - 240, 50, 190, 48, 12, true, false);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px 'Pretendard', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${sNum} ${sName}`, W - 145, 80);
    ctx.textAlign = "left";

    let curY = 145;

    // --------------------------------------------------
    // 섹션 1: 문제 분석 및 생각 다이어트 (추상화) - 세로형 3단 레이아웃
    // --------------------------------------------------
    const pres = window.latestAbstractionPrescription;
    const curStatus = (document.getElementById('thinker-cur-status')?.value || '').trim()
      || (pres ? pres.currentStatus : '')
      || (nlCards[0]?.text ? `[${nlCards[0].text}] 시작 전 상태` : '알고리즘 문제 초기 상태');

    const goalStatus = (document.getElementById('thinker-goal-status')?.value || '').trim()
      || (pres ? pres.goalStatus : '')
      || (nlCards[nlCards.length - 1]?.text ? `[${nlCards[nlCards.length - 1].text}] 완수 및 목표 달성` : '알고리즘 문제 최종 해결!');

    const coreVars = (pres && pres.coreVariables && pres.coreVariables.length > 0)
      ? pres.coreVariables.join(', ')
      : '입력 조건 및 핵심 제어 변수';

    ctx.fillStyle = "#faf5ff";
    ctx.strokeStyle = "#e9d5ff";
    roundRect(ctx, 30, curY, W - 60, 125, 16, true, true);

    ctx.fillStyle = "#6b21a8";
    ctx.font = "bold 15px 'Pretendard', sans-serif";
    ctx.fillText("💡 1. 문제 분석 및 생각 다이어트 (추상화)", 50, curY + 28);

    // 1. 현재 상태 (최대 W-190 = 650px 폭으로 자동 줄바꿈)
    let textY = curY + 52;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px 'Pretendard', sans-serif";
    ctx.fillText("• 현재 상태:", 50, textY);
    ctx.fillStyle = "#1e293b";
    ctx.font = "13px 'Pretendard', sans-serif";
    drawWrappedText(ctx, curStatus, 130, textY, W - 190, 19, 2);

    // 2. 목표 상태
    textY += 28;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px 'Pretendard', sans-serif";
    ctx.fillText("• 목표 상태:", 50, textY);
    ctx.fillStyle = "#1e293b";
    ctx.font = "13px 'Pretendard', sans-serif";
    drawWrappedText(ctx, goalStatus, 130, textY, W - 190, 19, 2);

    // 3. 핵심 변수 & 조건
    textY += 28;
    ctx.fillStyle = "#7c3aed";
    ctx.font = "bold 12px 'Pretendard', sans-serif";
    ctx.fillText("• 핵심 변수 & 조건:", 50, textY);
    ctx.fillStyle = "#5b21b6";
    ctx.font = "12px 'Pretendard', sans-serif";
    drawWrappedText(ctx, coreVars, 175, textY, W - 235, 18, 1);

    curY += 145;

    // --------------------------------------------------
    // 섹션 2: 자연어 알고리즘 기획서 (3대 제어 구조) - 단어 단위 자동 줄바꿈
    // --------------------------------------------------
    ctx.fillStyle = "#eff6ff";
    ctx.strokeStyle = "#bfdbfe";
    roundRect(ctx, 30, curY, W - 60, 185, 16, true, true);

    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 15px 'Pretendard', sans-serif";
    ctx.fillText("📝 2. 자연어 알고리즘 기획서 (3대 제어 구조)", 50, curY + 28);

    let nlY = curY + 52;
    const maxCardW = W - 110; // 730px
    nlCards.slice(0, 4).forEach((c, idx) => {
      let prefix = "";
      let body = "";
      if (c.type === 'seq') {
        prefix = `${idx+1}. [순차] `;
        body = c.text || '행동 실행';
      } else if (c.type === 'sel') {
        prefix = `${idx+1}. [선택] `;
        body = `만약 [${c.condition || '조건'}] -> 예: ${c.yesAction || '실행'} / 아니오: ${c.noAction || '실행'}`;
      } else if (c.type === 'loop') {
        prefix = `${idx+1}. [반복] `;
        body = `[${c.condition || '조건'}] 동안 -> ${c.loopAction || '행동'} 반복`;
      }

      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 12px 'Pretendard', sans-serif";
      ctx.fillText(prefix, 50, nlY);

      const prefixW = ctx.measureText(prefix).width;
      ctx.fillStyle = "#1e293b";
      ctx.font = "12px 'Pretendard', sans-serif";
      const nextY = drawWrappedText(ctx, body, 50 + prefixW, nlY, maxCardW - prefixW - 40, 17, 2);
      nlY = Math.max(nlY + 24, nextY + 6);
    });

    curY += 205;

    // --------------------------------------------------
    // 섹션 3: 완성된 순서도 다이어그램 (실제 캔버스 1:1 미니어처 캡처 엔진)
    // --------------------------------------------------
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#cbd5e1";
    roundRect(ctx, 30, curY, W - 60, 350, 16, true, true);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px 'Pretendard', sans-serif";
    ctx.fillText("📐 3. 완성된 순서도 다이어그램 (실제 캔버스 배치)", 50, curY + 28);

    // 캔버스 박스 내부 도트 모눈 그리드 (엔트리 스타일)
    const boxX = 45;
    const boxY = curY + 45;
    const boxW = W - 90; // 750px
    const boxH = 285;
    ctx.fillStyle = "#e2e8f0";
    for (let dx = boxX + 10; dx < boxX + boxW - 5; dx += 24) {
      for (let dy = boxY + 10; dy < boxY + boxH - 5; dy += 24) {
        ctx.fillRect(dx, dy, 2, 2);
      }
    }

    if (!freeBlocks || freeBlocks.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 14px 'Pretendard', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("배치된 순서도 블록이 없습니다.", W / 2, boxY + boxH / 2);
      ctx.textAlign = "left";
    } else {
      // 1. 전체 블록 Bounding Box 계산
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      freeBlocks.forEach(b => {
        const bw = b.shape === 'decision' ? 220 : (b.shape === 'terminal' ? 200 : (b.shape === 'io' ? 220 : 210));
        const bh = b.shape === 'decision' ? 120 : 60;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + bw > maxX) maxX = b.x + bw;
        if (b.y + bh > maxY) maxY = b.y + bh;
      });

      const contentW = Math.max(maxX - minX, 120);
      const contentH = Math.max(maxY - minY, 120);
      const availW = boxW - 40;
      const availH = boxH - 35;
      const scale = Math.min(availW / contentW, availH / contentH, 0.95);

      const offsetX = boxX + (boxW - contentW * scale) / 2 - minX * scale;
      const offsetY = boxY + (boxH - contentH * scale) / 2 - minY * scale;

      const toX = (x) => offsetX + x * scale;
      const toY = (y) => offsetY + y * scale;

      // 2. 실제 연결선 (freeConnections) 정밀 드로잉
      freeConnections.forEach(conn => {
        const fromB = freeBlocks.find(b => b.id === conn.from);
        const toB = freeBlocks.find(b => b.id === conn.to);
        if (!fromB || !toB) return;

        const fromBW = (fromB.shape === 'decision' ? 220 : (fromB.shape === 'terminal' ? 200 : (fromB.shape === 'io' ? 220 : 210)));
        const fromBH = (fromB.shape === 'decision' ? 120 : 60);
        let p1X = fromB.x + fromBW / 2, p1Y = fromB.y + fromBH;
        if (conn.fromPort === 'right' || conn.fromPort === 'no') { p1X = fromB.x + fromBW; p1Y = fromB.y + fromBH / 2; }
        else if (conn.fromPort === 'left') { p1X = fromB.x; p1Y = fromB.y + fromBH / 2; }
        else if (conn.fromPort === 'top' || conn.fromPort === 'in') { p1X = fromB.x + fromBW / 2; p1Y = fromB.y; }

        const toBW = (toB.shape === 'decision' ? 220 : (toB.shape === 'terminal' ? 200 : (toB.shape === 'io' ? 220 : 210)));
        const toBH = (toB.shape === 'decision' ? 120 : 60);
        let p2X = toB.x + toBW / 2, p2Y = toB.y;
        let entryDir = 'down';
        if (conn.toPort === 'left') { p2X = toB.x; p2Y = toB.y + toBH / 2; entryDir = 'right'; }
        else if (conn.toPort === 'right') { p2X = toB.x + toBW; p2Y = toB.y + toBH / 2; entryDir = 'left'; }
        else if (conn.toPort === 'bottom' || conn.toPort === 'out') { p2X = toB.x + toBW / 2; p2Y = toB.y + toBH; entryDir = 'up'; }

        const x1 = toX(p1X), y1 = toY(p1Y);
        const x2 = toX(p2X), y2 = toY(p2Y);

        let strokeCol = "#475569";
        let badgeText = "";
        if (conn.fromPort === 'yes') { strokeCol = "#10b981"; badgeText = "예"; }
        else if (conn.fromPort === 'no') { strokeCol = "#f59e0b"; badgeText = "아니오"; }
        else if (conn.fromPort === 'left') { strokeCol = "#f59e0b"; badgeText = "분기"; }

        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = Math.max(1.8, 2.4 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);

        if (conn.fromPort === 'right' || conn.fromPort === 'no') {
          const midX = Math.max(x1 + 18 * scale, (x1 + x2) / 2);
          ctx.lineTo(midX, y1);
          ctx.lineTo(midX, y2);
          ctx.lineTo(x2, y2);
        } else if (conn.fromPort === 'left') {
          const midX = Math.min(x1 - 18 * scale, (x1 + x2) / 2);
          ctx.lineTo(midX, y1);
          ctx.lineTo(midX, y2);
          ctx.lineTo(x2, y2);
        } else {
          if (y2 > y1 + 10) {
            const midY = (y1 + y2) / 2;
            ctx.lineTo(x1, midY);
            ctx.lineTo(x2, midY);
            ctx.lineTo(x2, y2);
          } else {
            const loopX = x2 < x1 ? Math.min(x1 - 35 * scale, x2 - 35 * scale) : Math.max(x1 + 35 * scale, x2 + 35 * scale);
            ctx.lineTo(x1, y1 + 14 * scale);
            ctx.lineTo(loopX, y1 + 14 * scale);
            ctx.lineTo(loopX, y2 - 14 * scale);
            ctx.lineTo(x2, y2 - 14 * scale);
            ctx.lineTo(x2, y2);
          }
        }
        ctx.stroke();

        drawArrowHead(ctx, x2, y2, entryDir, strokeCol, scale);

        if (badgeText) {
          const badgeX = conn.fromPort === 'left' ? x1 - 16 * scale : x1 + 16 * scale;
          const badgeY = y1 + 10 * scale;
          ctx.fillStyle = strokeCol;
          roundRect(ctx, badgeX - 10 * scale, badgeY - 7 * scale, 20 * scale, 14 * scale, 3 * scale, true, false);
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px Pretendard, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(badgeText, badgeX, badgeY + 3.5 * scale);
          ctx.textAlign = "left";
        }
      });

      // 3. 실제 블록 (freeBlocks) 정밀 드로잉
      freeBlocks.forEach(b => {
        const origW = (b.shape === 'decision' ? 220 : (b.shape === 'terminal' ? 200 : (b.shape === 'io' ? 220 : 210)));
        const origH = (b.shape === 'decision' ? 120 : 60);
        const bx = toX(b.x), by = toY(b.y);
        const bw = origW * scale, bh = origH * scale;

        ctx.lineWidth = Math.max(1.8, 2.5 * scale);

        if (b.shape === 'terminal') {
          ctx.fillStyle = "#faf5ff";
          ctx.strokeStyle = "#a855f7";
          roundRect(ctx, bx, by, bw, bh, bh / 2, true, true);
          ctx.fillStyle = "#581c87";
        } else if (b.shape === 'io') {
          ctx.fillStyle = "#ecfdf5";
          ctx.strokeStyle = "#10b981";
          const skew = 12 * scale;
          ctx.beginPath();
          ctx.moveTo(bx + skew, by);
          ctx.lineTo(bx + bw, by);
          ctx.lineTo(bx + bw - skew, by + bh);
          ctx.lineTo(bx, by + bh);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#064e3b";
        } else if (b.shape === 'decision') {
          ctx.fillStyle = "#fffbeb";
          ctx.strokeStyle = "#f59e0b";
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, by);
          ctx.lineTo(bx + bw, by + bh / 2);
          ctx.lineTo(bx + bw / 2, by + bh);
          ctx.lineTo(bx, by + bh / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#78350f";
        } else {
          ctx.fillStyle = "#eff6ff";
          ctx.strokeStyle = "#3b82f6";
          roundRect(ctx, bx, by, bw, bh, 6 * scale, true, true);
          ctx.fillStyle = "#1e3a8a";
        }

        let txt = (b.text || '').trim();
        if (txt.length > 15) txt = txt.substring(0, 14) + '…';
        ctx.font = `bold ${Math.max(8, Math.round(11 * scale))}px Pretendard, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 3.5 * scale);
        ctx.textAlign = "left";
      });
    }

    curY += 370;

    // --------------------------------------------------
    // 섹션 4: 총평 및 조건부 합격 스탬프 ('감수' ➔ '검사 / 점검' 반영)
    // --------------------------------------------------
    const isAiPassed = !!window.isFlowchartAiPassed;
    if (isAiPassed) {
      ctx.fillStyle = "#ecfdf5";
      ctx.strokeStyle = "#a7f3d0";
      roundRect(ctx, 30, curY, W - 60, 70, 14, true, true);

      ctx.fillStyle = "#064e3b";
      ctx.font = "bold 13px 'Pretendard', sans-serif";
      ctx.fillText("🤖 Solar AI 검사: 일상 문제를 컴퓨터적 제어 구조(순차·선택·반복)로 완벽히 설계함.", 50, curY + 40);

      ctx.fillStyle = "#059669";
      ctx.font = "900 15px 'Pretendard', sans-serif";
      ctx.fillText("💮 AI 검사 통과 (합격)", W - 180, curY + 40);
    } else {
      ctx.fillStyle = "#fffbeb";
      ctx.strokeStyle = "#fde68a";
      roundRect(ctx, 30, curY, W - 60, 70, 14, true, true);

      ctx.fillStyle = "#78350f";
      ctx.font = "bold 13px 'Pretendard', sans-serif";
      ctx.fillText("🤖 Solar AI 검사: 현재 알고리즘 설계 및 순서도 보완 실습 진행 중.", 50, curY + 40);

      ctx.fillStyle = "#d97706";
      ctx.font = "bold 14px 'Pretendard', sans-serif";
      ctx.fillText("⏳ AI 검사 전 (실습 중)", W - 180, curY + 40);
    }

    resolve(canvas);
  });
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * ------------------------------------------------------------------------------
 * 📐 [좌측 기획서 패널 접기/펼치기 토글 및 캔버스 Full-bleed 확장]
 * ------------------------------------------------------------------------------
 */
let isNlPanelCollapsed = false;

function toggleNlPanel(forcedState = null) {
  if (forcedState !== null) {
    isNlPanelCollapsed = forcedState;
  } else {
    isNlPanelCollapsed = !isNlPanelCollapsed;
  }

  try {
    sessionStorage.setItem('flowchart_panel_collapsed', isNlPanelCollapsed ? '1' : '0');
  } catch (e) {}

  const studioL3 = document.querySelector('.entry-studio-container');
  const studioL2 = document.querySelector('.entry-studio-l2-container');

  if (studioL3) {
    studioL3.classList.toggle('panel-collapsed', isNlPanelCollapsed);
  }
  if (studioL2) {
    studioL2.classList.toggle('panel-collapsed', isNlPanelCollapsed);
  }

  // 연결선 SVG 위치 재계산
  setTimeout(() => {
    if (typeof renderFreeConnections === 'function') {
      renderFreeConnections();
    }
  }, 260);
}

// 초기 패널 접힘 상태 복원
(function initPanelState() {
  try {
    if (sessionStorage.getItem('flowchart_panel_collapsed') === '1') {
      setTimeout(() => toggleNlPanel(true), 100);
    }
  } catch (e) {}
})();

window.toggleNlPanel = toggleNlPanel;

