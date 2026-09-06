/**
 * ==============================================================================
 * 💡 [실습 1코스] 추상화 워크북 엔진 (추상화 닥터)
 * ==============================================================================
 * 30초 맛보기 튜토리얼 및 실전 4단계 워크북 위저드, 태그 드래그앤드롭/클릭,
 * AI 처방전 발행 및 상담 로직.
 */
function switchAbstractionSubTab(tab) {
      if (tab === 'workspace' && !isTutorialCompleted) {
        alert('먼저 [30초 맛보기]를 완료해야 실전 워크북이 해금됩니다! 🎮');
        switchAbstractionSubTab('tutorial');
        return;
      }

      currentAbstractionSubTab = tab;
      const isTut = tab === 'tutorial';
      document.getElementById('abs-view-tutorial').classList.toggle('hidden', !isTut);
      document.getElementById('abs-view-workspace').classList.toggle('hidden', isTut);

      const tutBtn = document.getElementById('abs-subtab-tutorial');
      const wsBtn = document.getElementById('abs-subtab-workspace');

      if (isTut) {
        tutBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition bg-violet-600 text-white shadow-sm flex items-center gap-1.5';
        if (!isTutorialCompleted) {
          wsBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition text-slate-400 bg-slate-100 cursor-not-allowed flex items-center gap-1.5';
        } else {
          wsBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
        }
      } else {
        tutBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
        wsBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition bg-violet-600 text-white shadow-sm flex items-center gap-1.5';
        updateWizardUI();
      }
    }

    // 튜토리얼 3대 시나리오 완결형 데이터셋
    let currentTutScenario = 'chat';
    const TUT_SCENARIOS = {
      chat: {
        id: 'chat',
        name: "친구 관계 / 카톡 안읽씹 고민",
        icon: "📱",
        current: "스토리는 올리면서 카톡 3시간째 안읽음",
        goal: "부담 없이 답장 받고 자연스럽게 대화 이어감",
        conditions: [
          { text: "상대방의 개인 시간을 존중하고 집착해 보이지 않기", desc: "관계와 감정 배려" },
          { text: "답장을 재촉하는 대신 가벼운 릴스나 일상 이야기 1개만 건네기", desc: "소통 방식 규칙" }
        ],
        coreTags: ["마지막 연락 시간", "상대방 관심사 릴스", "대화 부담도"],
        noiseTags: ["상대방 오늘 옷 색깔", "어제 학교 급식 메뉴", "보낸 카톡 글자 수"]
      },
      late: {
        id: 'late',
        name: "학교 생활 / 아침 등교 지각 방지",
        icon: "⏰",
        current: "매일 아침 8시 10분에 헐레벌떡 일어나 지각 위기",
        goal: "8시 전에 여유롭게 등교 완료하기",
        conditions: [
          { text: "오전 7시 30분 이전에 알람을 듣고 반드시 기상하기", desc: "기상 시각 규칙" },
          { text: "세수 및 옷 입기 준비 시간을 25분 이내로 제한하기", desc: "준비 시간 규칙" }
        ],
        coreTags: ["현재 시각", "알람 소리", "남은 준비 시간"],
        noiseTags: ["침대 이불 색깔", "어제 꾼 꿈 내용", "칫솔 브랜드"]
      },
      game: {
        id: 'game',
        name: "학습 습관 / 게임·유튜브 시간 조절",
        icon: "🎮",
        current: "공부 시작하려다 유튜브·게임에 빠져 2시간 순삭",
        goal: "목표 공부 분량을 먼저 끝내고 기분 좋게 쉬기",
        conditions: [
          { text: "하루 목표 공부 분량을 다 풀기 전에는 게임 켜지 않기", desc: "우선순위 규칙" },
          { text: "공부 후 자유 게임 시간은 타이머 40분 이내로 준수하기", desc: "이용 시간 한도 규칙" }
        ],
        coreTags: ["오늘 공부 분량", "게임 타이머 알림", "스마트폰 화면 끄기"],
        noiseTags: ["게임 캐릭터 스킨", "의자 등받이 각도", "방 조명 색상"]
      }
    };

    function initTutorialUI() {
      tutStep = 1;
      currentTutScenario = 'chat';
      tutTrashTags = [];
      tutPoolTags = [...TUT_SCENARIOS.chat.coreTags, ...TUT_SCENARIOS.chat.noiseTags];
      updateTutorialStepUI();
    }

    function updateTutorialStepUI() {
      for (let i = 1; i <= 4; i++) {
        const formEl = document.getElementById(`tut-form-${i}`);
        if (formEl) formEl.classList.toggle('hidden', i !== tutStep);
      }

      const badges = ["", "맛보기 Step 1/4", "맛보기 Step 2/4", "맛보기 Step 3/4", "맛보기 완료!"];
      const titles = ["", "1단계: 문제 진단 체험", "2단계: 조건 탐색 체험", "3단계: 생각 다이어트 체험", "4단계: 실전 워크북 해금"];
      const nextTexts = ["", "다음: 조건 탐색 👉", "다음: 생각 다이어트 👉", "다음: 최종 확인 👉", "🎉 실전 워크북 시작하기"];

      document.getElementById('tut-step-badge').innerText = badges[tutStep];
      document.getElementById('tut-step-title').innerText = titles[tutStep];
      document.getElementById('tut-next-btn').querySelector('span').innerText = nextTexts[tutStep];
      document.getElementById('tut-prev-btn').classList.toggle('hidden', tutStep === 1);

      renderTutorialChatGuide();
      if (tutStep === 3) renderTutTags();
    }

    function renderTutorialChatGuide() {
      const body = document.getElementById('tut-chat-body');
      const tag = document.getElementById('tut-guide-step-tag');
      if (!body || !tag) return;

      const sc = TUT_SCENARIOS[currentTutScenario] || TUT_SCENARIOS.chat;

      if (tutStep === 1) {
        tag.innerText = "1단계: 문제 상황 예시를 선택하세요";
        body.innerHTML = `
          <div class="space-y-2.5">
            <p class="text-slate-800 font-black text-xs sm:text-sm flex items-center gap-1.5">
              <span>💬</span> <span>중학교 2학년 대표 고민 중 하나를 골라보세요:</span>
            </p>
            
            <!-- 예시 1: 카톡 안읽씹 고민 -->
            <button onclick="applyTutStep1('스토리는 올리면서 카톡 3시간째 안읽음', '부담 없이 답장 받고 자연스럽게 대화 이어감', 'chat')" 
                    class="w-full text-left bg-white hover:bg-violet-50 border-2 ${currentTutScenario === 'chat' ? 'border-violet-500 bg-violet-50/50' : 'border-violet-200'} rounded-2xl p-3.5 transition shadow-2xs group flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <span class="text-xs sm:text-sm font-black text-violet-800 flex items-center gap-1.5">
                  <span>📱</span> <span>예시 1: 친구 관계 / 카톡 안읽씹 고민</span>
                </span>
                <span class="text-[10px] bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition">선택 ➔</span>
              </div>
              <div class="text-xs text-slate-700 font-medium leading-snug pl-5">
                <span class="text-rose-600 font-bold">[현재]</span> 스토리는 올리면서 카톡 3시간째 안읽음<br>
                <span class="text-violet-600 font-bold">[목표]</span> 부담 없이 답장 받고 자연스럽게 대화 이어감
              </div>
            </button>

            <!-- 예시 2: 등교 지각 고민 -->
            <button onclick="applyTutStep1('매일 아침 8시 10분에 헐레벌떡 일어나 지각 위기', '8시 전에 여유롭게 등교 완료하기', 'late')" 
                    class="w-full text-left bg-white hover:bg-violet-50 border-2 ${currentTutScenario === 'late' ? 'border-violet-500 bg-violet-50/50' : 'border-slate-200'} rounded-2xl p-3.5 transition shadow-2xs group flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <span class="text-xs sm:text-sm font-black text-amber-800 flex items-center gap-1.5">
                  <span>⏰</span> <span>예시 2: 학교 생활 / 아침 등교 지각 방지</span>
                </span>
                <span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition">선택 ➔</span>
              </div>
              <div class="text-xs text-slate-700 font-medium leading-snug pl-5">
                <span class="text-rose-600 font-bold">[현재]</span> 매일 아침 8시 10분에 헐레벌떡 일어나 지각 위기<br>
                <span class="text-violet-600 font-bold">[목표]</span> 8시 전에 여유롭게 등교 완료하기
              </div>
            </button>

            <!-- 예시 3: 게임/유튜브 시간 조절 -->
            <button onclick="applyTutStep1('공부 시작하려다 유튜브·게임에 빠져 2시간 순삭', '목표 공부 분량을 먼저 끝내고 기분 좋게 쉬기', 'game')" 
                    class="w-full text-left bg-white hover:bg-violet-50 border-2 ${currentTutScenario === 'game' ? 'border-violet-500 bg-violet-50/50' : 'border-slate-200'} rounded-2xl p-3.5 transition shadow-2xs group flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <span class="text-xs sm:text-sm font-black text-emerald-800 flex items-center gap-1.5">
                  <span>🎮</span> <span>예시 3: 학습 습관 / 게임·유튜브 시간 조절</span>
                </span>
                <span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition">선택 ➔</span>
              </div>
              <div class="text-xs text-slate-700 font-medium leading-snug pl-5">
                <span class="text-rose-600 font-bold">[현재]</span> 공부 시작하려다 유튜브·게임에 빠져 2시간 순삭<br>
                <span class="text-violet-600 font-bold">[목표]</span> 목표 공부 분량을 먼저 끝내고 기분 좋게 쉬기
              </div>
            </button>
          </div>
        `;
      } else if (tutStep === 2) {
        tag.innerText = `2단계: [${sc.name}] 맞춤 조건을 선택하세요`;
        body.innerHTML = `
          <div class="space-y-2.5">
            <p class="text-slate-800 font-black text-xs sm:text-sm flex items-center gap-1.5">
              <span>🛡️</span> <span>[${sc.name}] 목표 달성을 위한 맞춤 규칙을 골라보세요:</span>
            </p>
            ${sc.conditions.map((c, i) => `
              <button onclick="applyTutStep2('${c.text}')" 
                      class="w-full text-left bg-white hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-2xl p-3.5 transition shadow-2xs group flex flex-col gap-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs sm:text-sm font-black text-amber-800 flex items-center gap-1.5">
                    <span>${i === 0 ? '✨' : '🎯'}</span> <span>추천 조건 ${i + 1}: ${c.desc}</span>
                  </span>
                  <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full group-hover:bg-amber-600 group-hover:text-white transition">선택 ➔</span>
                </div>
                <div class="text-xs text-slate-700 font-medium leading-snug pl-5">
                  "${c.text}"
                </div>
              </button>
            `).join('')}
          </div>
        `;
      } else if (tutStep === 3) {
        tag.innerText = `3단계: [${sc.name}] 불필요한 노이즈를 클릭하세요`;
        body.innerHTML = `
          <div class="space-y-3">
            <p class="text-slate-800 font-black text-xs sm:text-sm">🗑️ 왼쪽의 후보 단어 중 <strong>목표와 상관없는 것</strong>을 클릭해 보세요!</p>
            <div class="p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-600 leading-relaxed font-semibold space-y-2">
              <div class="flex items-center gap-2 text-rose-600 font-bold">
                <i class="fa-solid fa-trash-can"></i>
                <span>버릴 노이즈: ${sc.noiseTags.join(', ')}</span>
              </div>
              <div class="flex items-center gap-2 text-emerald-700 font-bold">
                <i class="fa-solid fa-key"></i>
                <span>남길 핵심 변수: ${sc.coreTags.join(', ')}</span>
              </div>
            </div>
            <p class="text-xs text-slate-500">※ 불필요한 군더더기를 버릴수록 생각은 가벼워지고 알고리즘은 명확해집니다!</p>
          </div>
        `;
      } else if (tutStep === 4) {
        tag.innerText = "튜토리얼 완료!";
        body.innerHTML = `
          <div class="space-y-3 text-center py-4">
            <p class="text-emerald-700 font-black text-base sm:text-lg">🎉 [${sc.name}] 30초 맛보기 완벽 수료!</p>
            <p class="text-slate-600 text-xs sm:text-sm font-semibold leading-relaxed">
              추상화의 핵심 흐름인 [현재상태 ➔ 목표상태 ➔ 조건정의 ➔ 핵심요소 추출]을 체험했습니다.<br>
              이제 실전 워크북의 잠금이 해제되었습니다!
            </p>
          </div>
        `;
      }
    }

    function applyTutStep1(curr, goal, scenarioId = 'chat') {
      currentTutScenario = scenarioId;
      const sc = TUT_SCENARIOS[scenarioId] || TUT_SCENARIOS.chat;
      tutTrashTags = [];
      tutPoolTags = [...sc.coreTags, ...sc.noiseTags];

      document.getElementById('tut-inp-current').value = curr || sc.current;
      document.getElementById('tut-inp-goal').value = goal || sc.goal;
      if (typeof playSfx === 'function') playSfx('click');
      renderTutorialChatGuide();
    }

    function applyTutStep2(cond) {
      document.getElementById('tut-inp-condition').value = cond;
      if (typeof playSfx === 'function') playSfx('click');
    }

    function nextTutorialStep() {
      if (tutStep === 1) {
        if (!document.getElementById('tut-inp-current').value) {
          alert('우측의 고민 예시 버튼을 먼저 눌러주세요!');
          return;
        }
        tutStep = 2;
      } else if (tutStep === 2) {
        if (!document.getElementById('tut-inp-condition').value) {
          alert('우측의 조건 예시 버튼을 먼저 눌러주세요!');
          return;
        }
        tutStep = 3;
      } else if (tutStep === 3) {
        tutStep = 4;
      } else if (tutStep === 4) {
        isTutorialCompleted = true;
        const tutBadge = document.getElementById('tut-badge');
        tutBadge.className = 'ml-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black';
        tutBadge.innerText = '완료됨';
        
        const wsBtn = document.getElementById('abs-subtab-workspace');
        wsBtn.disabled = false;
        wsBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm flex items-center gap-1.5';
        document.getElementById('lock-icon').className = 'fa-solid fa-lock-open text-[11px]';
        
        alert('🎉 축하합니다! 실전 워크북이 해금되었습니다!\n이제 여러분의 실제 고민으로 생각 다이어트를 시작하세요!');
        switchAbstractionSubTab('workspace');
        return;
      }
      updateTutorialStepUI();
    }

    function prevTutorialStep() {
      if (tutStep > 1) {
        tutStep--;
        updateTutorialStepUI();
      }
    }

    function renderTutTags() {
      const poolEl = document.getElementById('tut-tag-pool');
      poolEl.innerHTML = tutPoolTags.map(tag => {
        const isTrashed = tutTrashTags.includes(tag);
        return `
          <button onclick="toggleTutTrashTag('${tag}')" class="text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${isTrashed ? 'bg-slate-200 text-slate-400 border-slate-300 line-through' : 'bg-white hover:bg-rose-50 hover:text-rose-600 border-slate-300 text-slate-800 shadow-xs'}">
            <span>${tag}</span>
            <i class="fa-solid ${isTrashed ? 'fa-rotate-left' : 'fa-xmark text-rose-500'} text-[10px]"></i>
          </button>
        `;
      }).join('');

      const trashEl = document.getElementById('tut-trash-pool');
      trashEl.innerHTML = tutTrashTags.map(t => `
        <span onclick="toggleTutTrashTag('${t}')" class="cursor-pointer bg-white text-rose-600 border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-bold line-through shadow-xs">
          ${t}
        </span>
      `).join('') || `<span class="text-xs text-slate-400 italic">버린 요소 없음</span>`;

      const coreTags = tutPoolTags.filter(t => !tutTrashTags.includes(t));
      const coreEl = document.getElementById('tut-core-pool');
      coreEl.innerHTML = coreTags.map(c => `
        <span class="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-xs">${c}</span>
      `).join('') || `<span class="text-xs text-slate-400 italic">남은 요소 없음</span>`;
    }

    function toggleTutTrashTag(tag) {
      if (tutTrashTags.includes(tag)) {
        tutTrashTags = tutTrashTags.filter(t => t !== tag);
      } else {
        tutTrashTags.push(tag);
      }
      renderTutTags();
    }

    function updateWizardUI() {
      const s = currentWizardStep;
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`form-step-${i}`);
        if (el) el.classList.toggle('hidden', i !== s);
      }

      const titles = [
        "",
        "1단계: 문제 진단 (현재 vs 목표)",
        "2단계: 조건 탐색 (다중 조건 설정)",
        "3단계: 생각 다이어트 (노이즈 버리기)",
        "4단계: 최종 처방전 & 솔루션 코칭"
      ];
      const tags = [
        "",
        "출발점과 도착점 정하기",
        "지켜야 할 규칙 설정",
        "군더더기 정보 제거",
        "처방 결과 확인 및 자유 코칭"
      ];
      const nextBtnTexts = [
        "",
        "다음: 조건 탐색하기 👉",
        "다음: 생각 다이어트 👉",
        "다음: 처방전 생성하기 👉",
        "완료됨 🎉"
      ];

      document.getElementById('step-badge').innerText = `Step ${s}/4`;
      document.getElementById('step-title-main').innerText = titles[s];
      document.getElementById('step-hint-tag').innerText = tags[s];
      document.getElementById('btn-wizard-next').querySelector('span').innerText = nextBtnTexts[s];
      document.getElementById('btn-wizard-prev').classList.toggle('hidden', s === 1);
      document.getElementById('btn-wizard-next').classList.toggle('hidden', s === 4);

      const scrollEl = document.getElementById('workspace-form-scroll');
      if (scrollEl) scrollEl.scrollTop = 0;

      updateStepChatUI(s);

      if (s === 2) renderConditionsUI();
      if (s === 3) renderTags();
      if (s === 4) generateFinalPrescription();
    }

    function nextStepWizard() {
      if (currentWizardStep === 1) {
        const cur = document.getElementById('inp-current').value.trim();
        const goal = document.getElementById('inp-goal').value.trim();
        if (!cur || !goal) {
          alert('현재 상태와 목표 상태를 모두 작성하거나 우측 닥터 카드를 클릭해 주세요!');
          return;
        }
        currentWizardStep = 2;
        updateWizardUI();
        requestDynamicOptionsForStep(2);
      } else if (currentWizardStep === 2) {
        if (registeredConditions.length === 0) {
          const manual = document.getElementById('inp-new-condition').value.trim();
          if (manual) {
            registeredConditions.push(manual);
          } else {
            alert('최소 1개 이상의 조건을 등록하거나 우측 닥터 카드를 클릭해 주세요!');
            return;
          }
        }
        currentWizardStep = 3;
        updateWizardUI();
        requestTagsForStep3();
      } else if (currentWizardStep === 3) {
        currentWizardStep = 4;
        updateWizardUI();
      }
    }

    function prevStepWizard() {
      if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardUI();
      }
    }

    function renderConditionsUI() {
      const container = document.getElementById('condition-list-container');
      if (registeredConditions.length === 0) {
        container.innerHTML = `<div class="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl text-xs text-slate-400 font-bold text-center">아직 등록된 조건이 없습니다. 우측 닥터 추천을 누르거나 직접 추가하세요.</div>`;
        return;
      }

      container.innerHTML = registeredConditions.map((cond, idx) => `
        <div class="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm font-bold text-amber-950 shadow-xs animate-in fade-in">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">${idx+1}</span>
            <span>${cond}</span>
          </div>
          <button onclick="removeCondition(${idx})" class="text-rose-500 hover:text-rose-700 px-2 py-0.5 transition font-bold" title="삭제">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('');
    }

    function addManualCondition() {
      const inp = document.getElementById('inp-new-condition');
      const val = inp.value.trim();
      if (val && !registeredConditions.includes(val)) {
        registeredConditions.push(val);
        inp.value = '';
        renderConditionsUI();
      }
    }

    function removeCondition(idx) {
      registeredConditions.splice(idx, 1);
      renderConditionsUI();
    }

    function updateStepChatUI(step) {
      const statusEl = document.getElementById('step-chat-status');
      const titleEl = document.getElementById('step-chat-title');
      const iconEl = document.getElementById('step-chat-icon');
      const chatInput = document.getElementById('chatInput');
      
      const stepNames = ["", "1단계: 문제 진단 코치", "2단계: 조건 도출 코치", "3단계: 생각 다이어트 코치", "4단계: 자유 솔루션 파트너"];
      statusEl.innerText = stepNames[step] || "";

      if (step === 4) {
        titleEl.innerText = "솔루션 액션 파트너";
        iconEl.innerText = "💬";
        chatInput.placeholder = "처방전에 대해 궁금한 점이나 실천 고민을 자유롭게 물어보세요...";
      } else {
        titleEl.innerText = "추상화 닥터 코치";
        iconEl.innerText = "💡";
        chatInput.placeholder = "고민 키워드를 입력하세요...";
      }

      if (stepChats[step].length === 0) {
        let welcomeText = "";
        if (step === 1) {
          welcomeText = `안녕! <strong>1단계 문제 진단</strong> 닥터야 💡<br>왼쪽에서 <strong>카테고리</strong>를 누르거나 아래에 고민 단어를 적어줘!`;
        } else if (step === 2) {
          welcomeText = `<strong>2단계 조건 탐색</strong> 닥터야 🛡️<br>입력한 [현재/목표 상태]를 바탕으로 <strong>지켜야 할 규칙</strong>을 추천해 줄게. 마음에 드는 카드를 누르면 조건으로 쏙 추가돼!`;
        } else if (step === 3) {
          welcomeText = `<strong>3단계 생각 다이어트</strong> 닥터야 🗑️<br>왼쪽 후보 단어 중 <strong>쓸데없는 노이즈</strong>를 클릭해서 싹 버려봐!`;
        } else if (step === 4) {
          welcomeText = `생각 다이어트 완료! 🎉<br>왼쪽에 완성된 <strong>추상화 처방전</strong>을 보면서, 어떻게 실천할지 더 구체적인 팁이나 고민이 있다면 무엇이든 편하게 이야기해 줘!`;
        }
        stepChats[step].push({ role: "assistant", content: welcomeText, options: [] });
      }

      renderStepChatMessages(step);
    }

    function renderStepChatMessages(step) {
      const container = document.getElementById('chatMessages');
      container.innerHTML = '';

      (stepChats[step] || []).forEach(msg => {
        if (msg.role === 'user') {
          appendUserMessageDOM(msg.content);
        } else {
          appendDoctorMessageDOM(msg.content, msg.options, msg.targetInputId);
        }
      });
    }

    function handleCategorySelect(cat) {
      const names = { study: "학습 및 시험 공부 계획", love: "연애 및 친구 관계", school: "학교생활 및 반티/부스 행사", life: "스마트폰 및 일상 습관" };
      appendUserMessage(names[cat]);
      requestDynamicCurrentAndGoal(names[cat]);
    }

    async function handleStepChatSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;

      appendUserMessage(text);
      input.value = '';

      if (currentWizardStep === 1) {
        requestDynamicCurrentAndGoal(text);
      } else if (currentWizardStep === 2) {
        requestDynamicConditionWithKeyword(text);
      } else if (currentWizardStep === 3) {
        callStepAI(`학생 입력: "${text}". 추상화 관점에서 1문장 조언과 3가지 options를 주세요.`, null, null);
      } else if (currentWizardStep === 4) {
        requestStep4FreeChat(text);
      }
    }

    async function requestStep4FreeChat(userMessage) {
      const cur = document.getElementById('inp-current').value.trim();
      const cond = registeredConditions.join(', ');
      const goal = document.getElementById('inp-goal').value.trim();
      const coreTags = currentPoolTags.filter(t => !currentTrashTags.includes(t));

      const contextPrompt = `[학생의 최종 처방전 정보]
- 현재 문제: "${cur}"
- 지킬 조건: "${cond}"
- 목표 상태: "${goal}"
- 추출된 핵심 변수: [${coreTags.join(', ')}]
- 닥터의 3~5단계 실천 계획:
${currentGeneratedPlans.join('\n')}

[학생의 질문/대화]: "${userMessage}"

위 학생의 질문에 대해 친절하고 구체적이며 힘이 되는 답변을 2~4문장으로 답변해 주세요. (options 코드블록 없이 자연스러운 대화로 답변하세요.)`;

      callStepAI(contextPrompt, null, null);
    }

    function requestDynamicCurrentAndGoal(keyword) {
      const prompt = `학생의 고민 주제: "${keyword}". 중2 정보 문제 상황 분석 관점에서, [구체적 현재 상태 + 바라는 목표] 세트를 3가지 서로 다른 관점으로 options에 작성하세요. (형식: "현재: ~함 / 목표: ~하기")`;
      
      callStepAI(prompt, (selected) => {
        const parts = selected.split('/');
        if (parts.length >= 2) {
          document.getElementById('inp-current').value = parts[0].replace('현재:', '').trim();
          document.getElementById('inp-goal').value = parts[1].replace('목표:', '').trim();
        } else {
          document.getElementById('inp-current').value = selected;
        }
        appendUserMessage(`[선택 적용] ${selected}`);
      }, 'inp-current');
    }

    function requestDynamicOptionsForStep(step) {
      const cur = document.getElementById('inp-current').value;
      const goal = document.getElementById('inp-goal').value;
      const prompt = `현재 문제: "${cur}"
목표 상태: "${goal}"

위 문제 상황을 면밀히 분석하고, 이 목표를 달성하기 위해 중2 학생이 반드시 지켜야 할 현실적인 [조건/제약사항(방향성/판단 기준/경계선)] 3가지를 명사형 어미로 options에 작성하세요. 지나치게 세부적인 행동 지침 대신 판단 기준 수준으로 추상화하여 제시하세요.`;
      
      callStepAI(prompt, (selected) => {
        if (!registeredConditions.includes(selected)) {
          registeredConditions.push(selected);
          renderConditionsUI();
        }
        appendUserMessage(`[조건 추가됨] ${selected}`);
      }, 'inp-new-condition');
    }

    function requestDynamicConditionWithKeyword(keyword) {
      const cur = document.getElementById('inp-current').value;
      const goal = document.getElementById('inp-goal').value;
      const prompt = `현재 문제: "${cur}", 목표: "${goal}", 추가 키워드: "${keyword}".
이 상황에서 고려할 수 있는 [추가 조건/제약사항(판단 기준/방향성)] 3가지를 명사형 어미로 options에 작성하세요.`;

      callStepAI(prompt, (selected) => {
        if (!registeredConditions.includes(selected)) {
          registeredConditions.push(selected);
          renderConditionsUI();
        }
        appendUserMessage(`[조건 추가됨] ${selected}`);
      }, 'inp-new-condition');
    }

    async function requestTagsForStep3() {
      const cur = document.getElementById('inp-current').value;
      const cond = registeredConditions.join(', ');
      const goal = document.getElementById('inp-goal').value;

      const prompt = `[현재 문제]: "${cur}"
[지킬 조건]: "${cond}"
[목표 상태]: "${goal}"

위 문제 상황을 바탕으로 '생각 다이어트(추상화)'용 단어 리스트 7개를 생성하세요.
1. 핵심 변수/데이터 3~4개: 문제 해결에 직결되는 2~4글자 핵심 명사 단어
2. 자연스러운 노이즈 3~4개: '신발 브랜드'처럼 쌩뚱맞은 단어가 아니라, 이 상황 맥락 속에 실제로 존재하지만 목표 달성에는 불필요한 그럴듯한 노이즈 단어 (예: 사진 속 배경 장소, 필기구 색상, 앱 아이콘 모양 등)

반드시 options 배열 형태로만 출력하세요.`;

      try {
        const res = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${UPSTAGE_API_KEY}` },
          body: JSON.stringify({
            model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
            messages: [{ role: "system", content: STEP_PROMPTS[3] }, { role: "user", content: prompt }],
            temperature: 0.6
          })
        });
        const data = await res.json();
        const raw = data.choices[0].message.content;
        
        const parsed = parseOptionsFromReply(raw);
        if (parsed.options && parsed.options.length > 0) {
          currentPoolTags = parsed.options;
          currentTrashTags = [];
          renderTags();
        }
      } catch (e) {
        currentPoolTags = ["설명 시간", "이해 여부", "점검 분량", "형광펜 색상", "문제집 출판사", "노트 표지 디자인", "의자 종류"];
        currentTrashTags = [];
        renderTags();
      }
    }

    function parseOptionsFromReply(rawReply) {
      let options = [];
      let cleanText = rawReply;
      
      const match = rawReply.match(/```(?:options|json)?\s*([\s\S]*?)\s*```/i);
      if (match) {
        cleanText = rawReply.replace(/```(?:options|json)?[\s\S]*?```/i, '').trim();
        try {
          options = JSON.parse(match[1].trim());
        } catch(e) {
          const items = match[1].match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
          if (items && items.length > 0) {
            options = items.map(s => s.slice(1, -1).replace(/\\"/g, '"').trim()).filter(Boolean);
          }
        }
      }
      
      if (!options || options.length === 0) {
        const lines = rawReply.split('\n').map(l => l.trim()).filter(Boolean);
        const candidateLines = lines.filter(l => /^(?:\d+[\.\)]|[-*•])\s+/.test(l));
        if (candidateLines.length >= 2) {
          options = candidateLines.map(l => l.replace(/^(?:\d+[\.\)]|[-*•])\s+/, '').trim());
          cleanText = lines.filter(l => !/^(?:\d+[\.\)]|[-*•])\s+/.test(l)).join(' ').trim();
        } else if (lines.length >= 2 && lines.every(l => l.length > 5)) {
          options = lines;
          cleanText = "상황에 꼭 필요한 추천 항목을 준비했어요! 아래 카드를 선택해 보세요 👇";
        }
      }
      
      if (!cleanText) {
        cleanText = "닥터가 상황에 맞는 추천 항목을 준비했어요! 아래 카드를 선택해 보세요 👇";
      }
      
      return { cleanText, options };
    }

    async function callStepAI(promptText, onSelectCallback, targetInputId) {
      const step = currentWizardStep;
      stepChats[step].push({ role: "user", content: promptText });
      const loadingId = appendLoadingMessage();

      try {
        const res = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${UPSTAGE_API_KEY}` },
          body: JSON.stringify({
            model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
            messages: [{ role: "system", content: STEP_PROMPTS[step] || STEP_PROMPTS[1] }, { role: "user", content: promptText }],
            temperature: 0.6
          })
        });

        if (!res.ok) throw new Error(`API 오류 (${res.status})`);
        const data = await res.json();
        const reply = data.choices[0].message.content;

        removeChatMessage(loadingId);

        const parsed = parseOptionsFromReply(reply);
        stepChats[step].push({ role: "assistant", content: parsed.cleanText, options: parsed.options, targetInputId: targetInputId });
        appendDoctorMessageDOM(parsed.cleanText, parsed.options, targetInputId, onSelectCallback);

      } catch (err) {
        removeChatMessage(loadingId);
        const errMsg = `⚠️ 연결이 불안정합니다. 대화를 다시 시도해 주세요!`;
        stepChats[step].push({ role: "assistant", content: errMsg, options: [] });
        appendDoctorMessageDOM(errMsg, [], targetInputId, onSelectCallback);
      }
    }

    function appendUserMessage(text) {
      const step = currentWizardStep;
      stepChats[step].push({ role: "user", content: text });
      appendUserMessageDOM(text);
    }

    function appendUserMessageDOM(text) {
      const container = document.getElementById('chatMessages');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'flex items-start justify-end gap-2';
      div.innerHTML = `
        <div class="bg-violet-600 text-white rounded-2xl rounded-tr-none p-3 text-xs sm:text-sm font-bold leading-relaxed max-w-[85%] shadow-xs">
          ${text.replace(/\n/g, '<br>')}
        </div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function appendDoctorMessageDOM(text, options, targetInputId, onSelectCallback) {
      const container = document.getElementById('chatMessages');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'flex items-start gap-2.5';

      let optionsHtml = '';
      if (options && options.length > 0) {
        window.currentCallback = onSelectCallback;
        
        const cardsHtml = options.map((opt) => `
          <button onclick="handleOptionClick('${opt.replace(/'/g, "\\'") }')" 
                  class="w-full text-left bg-violet-50 hover:bg-violet-600 hover:text-white border border-violet-200 text-violet-950 font-bold p-3 rounded-2xl text-xs transition flex items-center justify-between group shadow-xs">
            <span>${opt}</span>
            <i class="fa-solid fa-arrow-turn-down text-[10px] text-violet-400 group-hover:text-white rotate-90"></i>
          </button>
        `).join('');

        const manualInputHtml = `
          <button onclick="focusTargetInput('${targetInputId}')" 
                  class="w-full text-left bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-600 font-bold p-2 rounded-xl text-xs transition flex items-center justify-between">
            <span>✏️ 원하는 내용이 없나요? (왼쪽에 직접 입력하기)</span>
            <i class="fa-solid fa-pen text-[10px]"></i>
          </button>
        `;

        optionsHtml = `
          <div class="space-y-2 pt-2 border-t border-violet-100">
            ${cardsHtml}
            ${manualInputHtml}
          </div>
        `;
      }

      const iconEmoji = currentWizardStep === 4 ? "💬" : "💡";

      div.innerHTML = `
        <div class="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xs shrink-0 font-bold">${iconEmoji}</div>
        <div class="bg-white border border-violet-100 rounded-2xl rounded-tl-none p-3.5 text-slate-800 leading-relaxed max-w-[92%] space-y-2 text-xs sm:text-sm font-medium shadow-xs">
          <div>${text}</div>
          ${optionsHtml}
        </div>
      `;

      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function handleOptionClick(text) {
      if (window.currentCallback) {
        window.currentCallback(text);
      }
    }

    function focusTargetInput(targetId) {
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          el.focus();
          el.classList.add('ring-4', 'ring-violet-300');
          setTimeout(() => el.classList.remove('ring-4', 'ring-violet-300'), 1200);
        }
      }
    }

    function appendLoadingMessage() {
      const container = document.getElementById('chatMessages');
      if (!container) return '';
      const id = 'loading-' + Date.now();
      const div = document.createElement('div');
      div.id = id;
      div.className = 'flex items-start gap-2.5';
      const iconEmoji = currentWizardStep === 4 ? "💬" : "💡";
      div.innerHTML = `
        <div class="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xs shrink-0 font-bold">${iconEmoji}</div>
        <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 text-xs text-slate-400 flex items-center gap-2 shadow-xs">
          <span class="w-2 h-2 bg-violet-600 rounded-full animate-bounce"></span>
          <span class="w-2 h-2 bg-violet-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-2 h-2 bg-violet-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
          <span class="font-bold ml-1 text-slate-500">답변 작성 중...</span>
        </div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return id;
    }

    function removeChatMessage(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    function clearCurrentStepChat() {
      const s = currentWizardStep;
      stepChats[s] = [];
      updateStepChatUI(s);
    }

    function renderTags() {
      if (currentPoolTags.length === 0) {
        currentPoolTags = ["설명 시간", "이해 여부", "점검 분량", "형광펜 색상", "문제집 출판사", "노트 표지 디자인", "의자 종류"];
        currentTrashTags = [];
      }

      const poolEl = document.getElementById('tag-pool-main');
      if (!poolEl) return;
      poolEl.innerHTML = currentPoolTags.map(tag => {
        const isTrashed = currentTrashTags.includes(tag);
        return `
          <button onclick="toggleTrashTag('${tag}')" class="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${isTrashed ? 'bg-slate-200 text-slate-400 border-slate-300 line-through' : 'bg-white hover:bg-rose-50 hover:text-rose-600 border-slate-300 text-slate-800 shadow-xs'}">
            <span>${tag}</span>
            <i class="fa-solid ${isTrashed ? 'fa-rotate-left' : 'fa-xmark text-rose-500'} text-[10px]"></i>
          </button>
        `;
      }).join('');

      const trashEl = document.getElementById('trash-pool-main');
      trashEl.innerHTML = currentTrashTags.map(tag => `
        <span onclick="toggleTrashTag('${tag}')" class="cursor-pointer bg-white text-rose-600 border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-bold line-through shadow-xs">
          ${tag}
        </span>
      `).join('') || `<span class="text-xs text-slate-400 italic">버린 요소 없음</span>`;

      const coreTags = currentPoolTags.filter(t => !currentTrashTags.includes(t));
      const coreEl = document.getElementById('core-pool-main');
      coreEl.innerHTML = coreTags.map(tag => `
        <span class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-xs">
          ${tag}
        </span>
      `).join('') || `<span class="text-xs text-slate-400 italic">남은 요소 없음</span>`;
    }

    function toggleTrashTag(tag) {
      if (currentTrashTags.includes(tag)) {
        currentTrashTags = currentTrashTags.filter(t => t !== tag);
      } else {
        currentTrashTags.push(tag);
      }
      renderTags();
    }

    async function generateFinalPrescription() {
      const cur = document.getElementById('inp-current').value.trim();
      const condList = registeredConditions.length > 0 ? registeredConditions : [document.getElementById('inp-new-condition').value.trim() || "-"];
      const goal = document.getElementById('inp-goal').value.trim();
      const coreTags = currentPoolTags.filter(t => !currentTrashTags.includes(t));

      const loadingBox = document.getElementById('step4-loading-box');
      const contentWrapper = document.getElementById('step4-content-wrapper');
      const cardEl = document.getElementById('step4-prescription-card');

      loadingBox.classList.remove('hidden');
      contentWrapper.classList.add('hidden');

      let plans = [];
      try {
        const prompt = `[문제 상황]: "${cur}"
[지킬 조건]: ${condList.join(' / ')}
[목표 상태]: "${goal}"
[추출된 핵심 요소(변수)]: [${coreTags.join(', ')}]

[요청사항]:
당신은 최고의 알고리즘 코치입니다. 상투적이거나 엉뚱한 대답을 하지 말고, 
반드시 학생이 추출한 **[핵심 요소(변수)]들을 하나하나 직접 활용**하여 순서대로 해결할 수 있는 **구체적인 실천 알고리즘 3~5단계**를 작성하세요.

출력 형식:
\`\`\`options
["1. 첫 번째 구체적 행동", "2. 두 번째 구체적 행동", "3. 세 번째 구체적 행동", "4. 네 번째 구체적 행동"]
\`\`\``;

        const res = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${UPSTAGE_API_KEY}` },
          body: JSON.stringify({
            model: typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4",
            messages: [{ role: "system", content: "당신은 중2 정보 수업의 논리적 문제 해결 알고리즘 닥터입니다. 주어진 핵심 변수를 바탕으로 3~5개의 구체적 실행 단계 options 배열로만 답하세요." }, { role: "user", content: prompt }],
            temperature: 0.5
          })
        });
        const data = await res.json();
        const raw = data.choices[0].message.content;
        const parsed = parseOptionsFromReply(raw);
        if (parsed.options && parsed.options.length > 0) {
          plans = parsed.options;
        }
      } catch (e) {
        console.error(e);
      }

      if (!plans || plans.length === 0) {
        plans = [
          `1단계: [${coreTags[0] || '현재 상태'}] 파악 및 기준 정리`,
          `2단계: [${coreTags[1] || '지킬 조건'}]에 맞춰 분량 및 계획 배분`,
          `3단계: [${coreTags[2] || '목표 상태'}] 달성을 위한 실제 실천 및 피드백`
        ];
      }

      currentGeneratedPlans = plans;
      window.latestAbstractionPrescription = {
        currentStatus: cur,
        goalStatus: goal,
        conditions: [...condList],
        coreVariables: [...coreTags],
        trashVariables: [...currentTrashTags],
        plans: [...plans]
      };

      cardEl.innerHTML = `
        <div class="space-y-4">
          
          <!-- 1. 상태 정의 (3요소) -->
          <div class="space-y-1.5">
            <h4 class="font-black text-xs sm:text-sm text-violet-700 flex items-center gap-2">
              <i class="fa-solid fa-list-check"></i> 1. 문제 상태 정의 (3요소)
            </h4>
            <div class="grid sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <span class="text-rose-500 block font-black text-xs mb-0.5">현재 상태</span>
                <strong class="text-slate-800 text-xs sm:text-sm leading-snug block">${cur}</strong>
              </div>
              <div>
                <span class="text-amber-600 block font-black text-xs mb-0.5">지킬 조건 (${condList.length}개)</span>
                <ul class="text-slate-800 text-xs leading-snug list-disc list-inside space-y-0.5 font-bold">
                  ${condList.map(c => `<li>${c}</li>`).join('')}
                </ul>
              </div>
              <div>
                <span class="text-violet-600 block font-black text-xs mb-0.5">목표 상태</span>
                <strong class="text-slate-800 text-xs sm:text-sm leading-snug block">${goal}</strong>
              </div>
            </div>
          </div>

          <!-- 2. 생각 다이어트 결과 -->
          <div class="grid sm:grid-cols-2 gap-2.5">
            <div class="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
              <span class="text-[11px] font-black text-rose-700 block mb-1.5"><i class="fa-solid fa-trash-can"></i> 버린 노이즈 (군더더기)</span>
              <div class="flex flex-wrap gap-1">
                ${currentTrashTags.length ? currentTrashTags.map(t => `<span class="bg-white text-rose-600 border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-bold line-through shadow-xs">${t}</span>`).join('') : '<span class="text-slate-400 text-xs font-medium">없음</span>'}
              </div>
            </div>
            <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
              <span class="text-[11px] font-black text-emerald-800 block mb-1.5"><i class="fa-solid fa-key"></i> 추출된 핵심 요소 (변수/기능)</span>
              <div class="flex flex-wrap gap-1">
                ${coreTags.length ? coreTags.map(t => `<span class="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-xs">${t}</span>`).join('') : '<span class="text-slate-400 text-xs font-medium">없음</span>'}
              </div>
            </div>
          </div>

          <!-- 3. 실천 계획 알고리즘 -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <h4 class="font-black text-xs sm:text-sm text-violet-700 flex items-center gap-2">
                <i class="fa-solid fa-wand-magic-sparkles"></i> 2. 닥터의 핵심 변수 기반 실천 알고리즘 (${plans.length}단계)
              </h4>
              <span class="text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-md">핵심 변수 연계</span>
            </div>
            <div class="space-y-1.5">
              ${plans.map((p, idx) => `
                <div class="flex items-center gap-2.5 bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 font-bold text-slate-800 text-xs sm:text-sm shadow-xs">
                  <span class="w-6 h-6 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xs shrink-0 font-black">${idx+1}</span>
                  <span class="leading-snug">${p.replace(/^\d+[.\s]+/, '')}</span>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      `;

      loadingBox.classList.add('hidden');
      contentWrapper.classList.remove('hidden');
      
      const scrollEl = document.getElementById('workspace-form-scroll');
      if (scrollEl) scrollEl.scrollTop = 0;
    }

    function copyStudentCard() {
      const cur = document.getElementById('inp-current').value;
      const condList = registeredConditions.length > 0 ? registeredConditions.join(', ') : (document.getElementById('inp-new-condition').value || "-");
      const goal = document.getElementById('inp-goal').value;
      const trashed = currentTrashTags.length ? currentTrashTags.join(', ') : '없음';
      const cores = currentPoolTags.filter(t => !currentTrashTags.includes(t)).join(', ');

      const plansText = currentGeneratedPlans.length > 0 
        ? currentGeneratedPlans.map((p, idx) => `  ${idx + 1}단계: ${p.replace(/^\d+[.\s]+/, '')}`).join('\n')
        : '  - 분석된 실천 계획이 없습니다.';

      const text = `[📋 추상화 워크북 최종 처방전]\n\n1. 상태 정의 (3요소)\n- 현재 상태: ${cur}\n- 지킬 조건: ${condList}\n- 목표 상태: ${goal}\n\n2. 생각 다이어트 결과\n- 버린 노이즈 (군더더기): ${trashed}\n- 추출된 핵심 변수/기능: ${cores}\n\n3. 닥터의 문제 분해 실천 계획\n${plansText}`;
      
      navigator.clipboard.writeText(text).then(() => {
        alert('과제 제출용 텍스트가 클립보드에 복사되었습니다! (패들렛에 붙여넣기 하세요)');
      });
    }
