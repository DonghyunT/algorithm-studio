/**
 * ==============================================================================
 * 🥪 [실습 2코스] 샌드위치 실험실 실행 엔진 (완성형)
 * ==============================================================================
 * 샌드위치 로봇 상태 관리, 레시피 블록 조합, 단계별 조리 시뮬레이터 애니메이션,
 * 디버깅 판정 및 AI 평가 피드백.
 */
// ==========================================
    // 샌드위치 실험실 실행 엔진 (완성형)
    // ==========================================
    let state = {
      bagOpened: false, breadOnPlate: 0, jamOpened: false, pbOpened: false,
      cheeseUnwrapped: false, cheeseOnBread: null, cheesePlasticIncluded: false,
      knifeHolding: 'none', bread1Spread: 'none', bread2Spread: 'none',
      isFlippedCover: false, completed: false
    };

    let globalExecutionQueue = [];
    let validStudentPromptsLog = [];

    // audioCtx is shared globally via getAudioCtx()
        function playSound(type) {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'click') {
          osc.frequency.setValueAtTime(550, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'action') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(560, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } else if (type === 'error') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'question') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(650, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } else if (type === 'success') {
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
            g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.25);
            o.start(ctx.currentTime + i * 0.1);
            o.stop(ctx.currentTime + i * 0.1 + 0.25);
          });
        }
      } catch (e) {
        console.warn("Audio play error:", e);
      }
    }

    function toggleSTT() {
      if (!recognition) return alert("Chrome 브라우저에서 마이크 기능을 지원합니다.");
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
        isListening = true;
        document.getElementById('mic-btn').classList.add('bg-rose-500', 'text-white', 'mic-on');
        playSound('click');
      }
    }

    function updateStatusUI() {
      const setCard = (cId, vId, cond, txtT, txtF, isWarning = false) => {
        const c = document.getElementById(cId);
        const v = document.getElementById(vId);
        if (cond) {
          c.className = isWarning ? "p-2 rounded-xl bg-amber-50 border border-amber-300" : "p-2 rounded-xl bg-emerald-50 border border-emerald-300";
          v.className = isWarning ? "font-bold text-amber-700 mt-0.5 text-xs" : "font-bold text-emerald-700 mt-0.5 text-xs";
          v.textContent = txtT;
        } else {
          c.className = "p-2 rounded-xl bg-slate-50 border border-slate-200";
          v.className = "font-bold text-slate-500 mt-0.5 text-xs";
          v.textContent = txtF;
        }
      };

      setCard('c-bag', 'v-bag', state.bagOpened, "🔓 열림", "🔒 닫힘");
      
      const bCard = document.getElementById('c-bread');
      const bVal = document.getElementById('v-bread');
      bVal.textContent = `${state.breadOnPlate} 장`;
      bCard.className = state.breadOnPlate > 0 ? "p-2 rounded-xl bg-emerald-50 border border-emerald-300" : "p-2 rounded-xl bg-slate-50 border border-slate-200";
      bVal.className = state.breadOnPlate > 0 ? "font-bold text-emerald-700 mt-0.5 text-xs" : "font-bold text-slate-500 mt-0.5 text-xs";

      setCard('c-jam', 'v-jam', state.jamOpened, "🔓 열림", "🔒 닫힘");
      setCard('c-pb', 'v-pb', state.pbOpened, "🔓 열림", "🔒 닫힘");
      setCard('c-cheese', 'v-cheese', state.cheeseUnwrapped, "비닐제거됨", "밀봉상태");

      const kCard = document.getElementById('c-knife');
      const kVal = document.getElementById('v-knife');
      if (state.knifeHolding === 'jam') {
        kCard.className = "p-2 rounded-xl bg-rose-50 border border-rose-300";
        kVal.className = "font-bold text-rose-700 mt-0.5 text-xs";
        kVal.textContent = "🍓 딸기잼";
      } else if (state.knifeHolding === 'pb') {
        kCard.className = "p-2 rounded-xl bg-amber-50 border border-amber-300";
        kVal.className = "font-bold text-amber-700 mt-0.5 text-xs";
        kVal.textContent = "🥜 땅콩버터";
      } else {
        kCard.className = "p-2 rounded-xl bg-slate-50 border border-slate-200";
        kVal.className = "font-bold text-slate-500 mt-0.5 text-xs";
        kVal.textContent = "깨끗함";
      }

      const sCard = document.getElementById('c-spread');
      const sVal = document.getElementById('v-spread');
      const hasAnySpread = (state.bread1Spread !== 'none' || state.bread2Spread !== 'none' || state.cheeseOnBread);
      if (hasAnySpread) {
        sCard.className = "p-2 rounded-xl bg-emerald-50 border border-emerald-300";
        sVal.className = "font-bold text-emerald-700 mt-0.5 text-xs";
        sVal.textContent = "토핑완료";
      } else {
        sCard.className = "p-2 rounded-xl bg-slate-50 border border-slate-200";
        sVal.className = "font-bold text-slate-500 mt-0.5 text-xs";
        sVal.textContent = "미완료";
      }

      setCard('c-goal', 'v-goal', state.completed, "🎉 완성!", "대기");
    }

    function analyzeSandwichResult() {
      const hasJam = (state.bread1Spread.includes('jam') || state.bread2Spread.includes('jam'));
      const hasJamEdge = (state.bread1Spread === 'jam_edge' || state.bread2Spread === 'jam_edge');
      const hasPB = (state.bread1Spread.includes('pb') || state.bread2Spread.includes('pb'));
      const hasPBEdge = (state.bread1Spread === 'pb_edge' || state.bread2Spread === 'pb_edge');
      const hasCheese = state.cheeseOnBread !== null;
      const isPlastic = state.cheesePlasticIncluded;
      const isStickyOutside = (!state.isFlippedCover && state.bread2Spread !== 'none');

      let title = "맞춤형 샌드위치";
      let review = "";
      let isFlawless = true;
      let badgeType = "perfect";

      if (isPlastic) {
        title = "플라스틱 비닐 치즈 샌드위치";
        review = "⚠️ 치즈 비닐을 벗기지 않고 그대로 넣었습니다! 이대로 먹으면 배탈나요. 🏥";
        isFlawless = false;
        badgeType = "clumsy";
      } else if (isStickyOutside) {
        title = "손잡이 끈적 샌드위치";
        review = "⚠️ '마주보게 포개어라'는 지시가 없어서 잼/버터가 샌드위치 바깥면에 그대로 노출되었습니다! 잡는 순간 손이 끈적끈적 대참사 발생! 🍯";
        isFlawless = false;
        badgeType = "clumsy";
      } else if (hasJamEdge || hasPBEdge) {
        title = "모서리 테두리 샌드위치";
        review = "⚠️ '넓은 면'이라는 지시가 없어서 식빵 윗모서리 테두리에만 잼/버터를 발랐습니다! 속은 퍽퍽한 사막 샌드위치입니다! 🏜️";
        isFlawless = false;
        badgeType = "clumsy";
      } else if (!hasJam && !hasPB && !hasCheese) {
        title = "속 빈 맨식빵 샌드위치";
        review = "⚠️ 아무런 재료도 바르지 않고 맨 빵 두 장만 덮었습니다. 다이어트에는 좋을지도요? 🍞";
        isFlawless = false;
        badgeType = "clumsy";
      } else {
        if (hasJam && hasPB && hasCheese) title = "트리플 PB&J 치즈 샌드위치";
        else if (hasJam && hasPB) title = "정통 PB&J (딸기잼+땅콩버터) 샌드위치";
        else if (hasJam && hasCheese) title = "달콤 짭짤 딸기잼 치즈 샌드위치";
        else if (hasPB && hasCheese) title = "고소 짭짤 땅콩버터 치즈 샌드위치";
        else if (hasJam) title = "달콤한 딸기잼 샌드위치";
        else if (hasPB) title = "고소한 땅콩버터 샌드위치";
        else if (hasCheese) title = "클래식 체다 치즈 샌드위치";

        review = "✨ 마주보게 깔끔하게 포개고 재료도 정석대로 도포된 완벽한 샌드위치입니다! 미슐랭 셰프가 인정합니다. 👏";
        badgeType = "perfect";
      }

      return { title, review, isFlawless, badgeType, isStickyOutside };
    }

    function animateAction(action, success, errorMsg) {
      const caption = document.getElementById('stage-caption');
      const knife = document.getElementById('g-knife');
      const knifeBlob = document.getElementById('g-knife-blob');
      const errorMark = document.getElementById('g-error-mark');
      const errorReason = document.getElementById('txt-error-reason');
      const stageFrame = document.getElementById('stage-frame');

      if (!success) {
        errorReason.textContent = errorMsg || "오류 발생!";
        errorMark.classList.remove('opacity-0');
        stageFrame.classList.add('shake-error', 'border-rose-400');
        caption.textContent = "❌ " + (errorMsg || "오류가 발생했습니다!");
        playSound('error');
        setTimeout(() => {
          errorMark.classList.add('opacity-0');
          stageFrame.classList.remove('shake-error', 'border-rose-400');
        }, 1500);
        return;
      }

      playSound('action');

      switch(action) {
        case 'OPEN_BAG':
          document.getElementById('g-bag-clip').setAttribute('transform', 'translate(0, -45) rotate(-45)');
          document.getElementById('txt-bag').textContent = "[개봉됨]";
          document.getElementById('txt-bag').setAttribute('fill', '#10b981');
          caption.textContent = "빵 봉지를 개봉했습니다.";
          break;

        case 'TAKE_BREAD':
          if (state.breadOnPlate === 1) {
            const b1 = document.getElementById('g-bread-1');
            b1.classList.remove('opacity-0');
            b1.setAttribute('transform', 'translate(75, 20)');
            caption.textContent = "식빵 1을 접시 왼쪽에 올렸습니다.";
          } else if (state.breadOnPlate === 2) {
            const b2 = document.getElementById('g-bread-2');
            b2.classList.remove('opacity-0');
            b2.setAttribute('transform', 'translate(265, 20)');
            caption.textContent = "식빵 2를 접시 오른쪽에 나란히 준비했습니다.";
          }
          break;

        case 'OPEN_JAM':
          document.getElementById('g-jam-lid').setAttribute('transform', 'translate(45, -45) rotate(45)');
          document.getElementById('txt-jam').textContent = "[열림]";
          document.getElementById('txt-jam').setAttribute('fill', '#10b981');
          caption.textContent = "딸기잼 뚜껑을 열었습니다.";
          break;

        case 'OPEN_PB':
          document.getElementById('g-pb-lid').setAttribute('transform', 'translate(-35, -45) rotate(-40)');
          document.getElementById('txt-pb').textContent = "[열림]";
          document.getElementById('txt-pb').setAttribute('fill', '#10b981');
          caption.textContent = "땅콩버터 뚜껑을 열었습니다.";
          break;

        case 'UNWRAP_CHEESE':
          document.getElementById('g-cheese-plastic').setAttribute('transform', 'translate(0, -50)');
          document.getElementById('txt-cheese-pack').textContent = "[비닐제거됨]";
          document.getElementById('txt-cheese-pack').setAttribute('fill', '#10b981');
          caption.textContent = "치즈의 비닐 포장을 벗겨냈습니다.";
          break;

        case 'SCOOP_JAM':
          knife.setAttribute('transform', 'translate(835, 175) rotate(15)');
          setTimeout(() => {
            knifeBlob.setAttribute('fill', '#dc2626');
            knifeBlob.classList.remove('opacity-0');
            knife.setAttribute('transform', 'translate(800, 240) rotate(-15)');
            caption.textContent = "칼에 딸기잼을 묻혔습니다.";
          }, 350);
          break;

        case 'SCOOP_PB':
          knife.setAttribute('transform', 'translate(740, 190) rotate(15)');
          setTimeout(() => {
            knifeBlob.setAttribute('fill', '#b45309');
            knifeBlob.classList.remove('opacity-0');
            knife.setAttribute('transform', 'translate(700, 240) rotate(-15)');
            caption.textContent = "칼에 땅콩버터를 묻혔습니다.";
          }, 350);
          break;

        // 식빵 1 도포
        case 'SPREAD_JAM_BREAD1_EDGE':
          knife.setAttribute('transform', 'translate(350, 235) rotate(-5)');
          setTimeout(() => {
            document.getElementById('g-jam-edge-1').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "⚠️ '넓은 면' 지시가 없어 식빵 1 윗모서리 테두리에만 딸기잼을 발랐습니다!";
          }, 450);
          break;

        case 'SPREAD_PB_BREAD1_EDGE':
          knife.setAttribute('transform', 'translate(350, 235) rotate(-5)');
          setTimeout(() => {
            document.getElementById('g-pb-edge-1').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "⚠️ '넓은 면' 지시가 없어 식빵 1 윗모서리 테두리에만 땅콩버터를 발랐습니다!";
          }, 450);
          break;

        case 'SPREAD_JAM_BREAD1_FLAT':
          knife.setAttribute('transform', 'translate(350, 270) rotate(15)');
          setTimeout(() => {
            document.getElementById('g-jam-flat-1').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "식빵 1 넓은 면에 딸기잼을 골고루 펴 발랐습니다.";
          }, 450);
          break;

        case 'SPREAD_PB_BREAD1_FLAT':
          knife.setAttribute('transform', 'translate(350, 270) rotate(15)');
          setTimeout(() => {
            document.getElementById('g-pb-flat-1').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "식빵 1 넓은 면에 땅콩버터를 골고루 발랐습니다.";
          }, 450);
          break;

        // 식빵 2 도포
        case 'SPREAD_JAM_BREAD2_EDGE':
          knife.setAttribute('transform', 'translate(540, 235) rotate(-5)');
          setTimeout(() => {
            document.getElementById('g-jam-edge-2').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "⚠️ '넓은 면' 지시가 없어 식빵 2 윗모서리 테두리에만 딸기잼을 발랐습니다!";
          }, 450);
          break;

        case 'SPREAD_PB_BREAD2_EDGE':
          knife.setAttribute('transform', 'translate(540, 235) rotate(-5)');
          setTimeout(() => {
            document.getElementById('g-pb-edge-2').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "⚠️ '넓은 면' 지시가 없어 식빵 2 윗모서리 테두리에만 땅콩버터를 발랐습니다!";
          }, 450);
          break;

        case 'SPREAD_JAM_BREAD2_FLAT':
          knife.setAttribute('transform', 'translate(540, 270) rotate(15)');
          setTimeout(() => {
            document.getElementById('g-jam-flat-2').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "식빵 2 넓은 면에 딸기잼을 골고루 펴 발랐습니다.";
          }, 450);
          break;

        case 'SPREAD_PB_BREAD2_FLAT':
          knife.setAttribute('transform', 'translate(540, 270) rotate(15)');
          setTimeout(() => {
            document.getElementById('g-pb-flat-2').classList.remove('opacity-0');
            knifeBlob.classList.add('opacity-0');
            knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
            caption.textContent = "식빵 2 넓은 면에 땅콩버터를 골고루 발랐습니다.";
          }, 450);
          break;

        // 치즈 올리기
        case 'PUT_CHEESE_BREAD1':
          document.getElementById('g-cheese-on-bread-1').classList.remove('opacity-0');
          if (state.cheesePlasticIncluded) {
            document.getElementById('g-cheese-error-wrap-1').classList.remove('opacity-0');
            caption.textContent = "💥 비닐을 안 벗겨서 플라스틱째 식빵 1 위에 올렸습니다!";
          } else {
            caption.textContent = "체다 치즈를 식빵 1 위에 얹었습니다.";
          }
          break;

        case 'PUT_CHEESE_BREAD2':
          document.getElementById('g-cheese-on-bread-2').classList.remove('opacity-0');
          if (state.cheesePlasticIncluded) {
            document.getElementById('g-cheese-error-wrap-2').classList.remove('opacity-0');
            caption.textContent = "💥 비닐을 안 벗겨서 플라스틱째 식빵 2 위에 올렸습니다!";
          } else {
            caption.textContent = "체다 치즈를 식빵 2 위에 얹었습니다.";
          }
          break;

        // 덮기
        case 'COVER_BREAD_NORMAL':
        case 'COVER_BREAD_FLIPPED':
          const b2 = document.getElementById('g-bread-2');
          b2.setAttribute('transform', 'translate(75, 15)');
          document.getElementById('txt-bread-2-label').textContent = "";
          
          const result = analyzeSandwichResult();

          if (action === 'COVER_BREAD_FLIPPED') {
            document.getElementById('g-pb-flat-2').classList.add('opacity-0');
            document.getElementById('g-jam-flat-2').classList.add('opacity-0');
            document.getElementById('g-jam-edge-2').classList.add('opacity-0');
            document.getElementById('g-pb-edge-2').classList.add('opacity-0');
            document.getElementById('g-cheese-on-bread-2').classList.add('opacity-0');
          }

          const badgeText = document.getElementById('txt-named-badge');
          const badgeRect = document.getElementById('rect-named-badge');
          badgeText.textContent = result.title;
          badgeRect.setAttribute('width', Math.max(180, result.title.length * 14 + 30));
          badgeRect.setAttribute('x', -(Math.max(180, result.title.length * 14 + 30) / 2));
          badgeRect.setAttribute('fill', result.badgeType === 'perfect' ? '#10b981' : '#f59e0b');

          document.getElementById('g-complete-badge').classList.remove('opacity-0');
          caption.textContent = result.review;
          playSound('success');
          
          document.getElementById('btn-reopen-summary').classList.remove('hidden');

          setTimeout(() => {
            openSummaryModal(result);
          }, 800);
          break;
      }
    }

    function openSummaryModal(result) {
      const modal = document.getElementById('summary-modal');
      const card = document.getElementById('modal-card');
      const title = document.getElementById('modal-sandwich-title');
      const badge = document.getElementById('modal-success-badge');
      const review = document.getElementById('modal-chef-review');
      const stepsContainer = document.getElementById('modal-algorithm-steps');
      const stepCount = document.getElementById('modal-step-count');

      title.textContent = result.title;
      if (result.badgeType === 'perfect') {
        badge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
        badge.textContent = "✨ 완벽한 성공";
      } else {
        badge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700";
        badge.textContent = "⚠️ 어설픈 완성";
      }

      review.innerHTML = `<strong>👨‍🍳 로봇 셰프의 시식평:</strong> ${result.review}`;
      stepCount.textContent = `총 ${validStudentPromptsLog.length}단계 실행됨`;

      stepsContainer.innerHTML = '';
      validStudentPromptsLog.forEach((logItem, idx) => {
        const row = document.createElement('div');
        row.className = "p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-col gap-1.5 shadow-xs";
        row.innerHTML = `
          <div class="flex items-center justify-between text-xs text-blue-400 font-bold">
            <span class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px]">#${idx + 1}</span>
              Step ${idx + 1}
            </span>
            <span class="text-slate-400 font-mono text-[11px] bg-slate-900/60 px-2 py-0.5 rounded-md">[분해 액션: ${logItem.actions.join(', ')}]</span>
          </div>
          <div class="text-slate-100 font-sans text-xs sm:text-sm font-medium pl-1">💬 "${logItem.userText}"</div>
        `;
        stepsContainer.appendChild(row);
      });

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
      }, 10);
    }

    function closeSummaryModal() {
      const modal = document.getElementById('summary-modal');
      const card = document.getElementById('modal-card');
      modal.classList.add('opacity-0');
      card.classList.remove('scale-100');
      card.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300);
    }

    function reopenSummaryModal() {
      const result = analyzeSandwichResult();
      openSummaryModal(result);
    }

    function copyAlgorithmToClipboard() {
      const result = analyzeSandwichResult();
      let copyText = `[🥪 로봇 샌드위치 알고리즘 과제 제출]\n`;
      copyText += `▪ 완성 샌드위치: ${result.title}\n`;
      copyText += `▪ 셰프 평가: ${result.review}\n`;
      copyText += `----------------------------------------\n`;
      copyText += `[내가 작성한 알고리즘 순서도]\n`;

      validStudentPromptsLog.forEach((log, idx) => {
        copyText += `${idx + 1}단계: "${log.userText}" ➔ [${log.actions.join(', ')}]\n`;
      });

      navigator.clipboard.writeText(copyText).then(() => {
        const btn = document.getElementById('copy-btn');
        const origHTML = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> 복사 완료! 패들렛에 붙여넣기(Ctrl+V) 하세요!`;
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btn.classList.add('bg-emerald-600');
        setTimeout(() => {
          btn.innerHTML = origHTML;
          btn.classList.remove('bg-emerald-600');
          btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }, 2500);
      });
    }

    function fallbackRuleParser(text) {
      const t = text.trim();
      const actions = [];

      if (t.includes('알아서') || t.includes('대충') || t.includes('맛있게') || (t.includes('샌드위치') && t.includes('만들어') && !t.includes('열') && !t.includes('발라'))) {
        return { type: 'CLARIFY', clarify_message: "로봇은 '알아서'라는 명령을 이해할 수 없습니다. 빵 봉지를 열어야 할까요, 잼 뚜껑을 열까요? 구체적인 첫 단계를 지시해주세요!" };
      }

      if (t.includes('봉지') || t.includes('봉다리')) {
        if (t.includes('열') || t.includes('뜯') || t.includes('까') || t.includes('개봉') || t.includes('풀')) {
          actions.push('OPEN_BAG');
        }
      }

      if (t.includes('식빵') || t.includes('빵')) {
        if (t.includes('꺼내') || t.includes('놓') || t.includes('올려') || t.includes('배치') || t.includes('준비')) {
          if (t.includes('2') || t.includes('두') || t.includes('두장') || t.includes('둘')) {
            actions.push('TAKE_BREAD', 'TAKE_BREAD');
          } else {
            actions.push('TAKE_BREAD');
          }
        }
      }

      if (t.includes('잼') && (t.includes('뚜껑') || t.includes('따') || t.includes('열'))) {
        if (!t.includes('발라') && !t.includes('묻혀') && !t.includes('떠')) actions.push('OPEN_JAM');
      }
      if ((t.includes('땅콩') || t.includes('버터')) && (t.includes('뚜껑') || t.includes('따') || t.includes('열'))) {
        if (!t.includes('발라') && !t.includes('묻혀') && !t.includes('떠')) actions.push('OPEN_PB');
      }

      if (t.includes('치즈') && (t.includes('비닐') || t.includes('껍질') || t.includes('포장')) && (t.includes('벗') || t.includes('까') || t.includes('뜯') || t.includes('제거'))) {
        actions.push('UNWRAP_CHEESE');
      }

      if ((t.includes('칼에') || t.includes('나이프에')) && (t.includes('묻') || t.includes('떠') || t.includes('발라') || t.includes('퍼'))) {
        if (t.includes('땅콩') || t.includes('버터')) actions.push('SCOOP_PB');
        else actions.push('SCOOP_JAM');
      }

      if (t.includes('발라') || t.includes('칠해') || t.includes('도포') || t.includes('문질')) {
        const isTargetBread2 = t.includes('식빵2') || t.includes('식빵 2') || t.includes('오른쪽');
        const isFlat = t.includes('넓은') || t.includes('표면') || t.includes('면적') || t.includes('골고루') || t.includes('가운데');
        const isPB = t.includes('땅콩') || t.includes('버터');

        if (isTargetBread2) {
          if (isPB) actions.push(isFlat ? 'SPREAD_PB_BREAD2_FLAT' : 'SPREAD_PB_BREAD2_EDGE');
          else actions.push(isFlat ? 'SPREAD_JAM_BREAD2_FLAT' : 'SPREAD_JAM_BREAD2_EDGE');
        } else {
          if (isPB) actions.push(isFlat ? 'SPREAD_PB_BREAD1_FLAT' : 'SPREAD_PB_BREAD1_EDGE');
          else actions.push(isFlat ? 'SPREAD_JAM_BREAD1_FLAT' : 'SPREAD_JAM_BREAD1_EDGE');
        }
      }

      if (t.includes('치즈') && (t.includes('올려') || t.includes('얹') || t.includes('넣'))) {
        if (t.includes('식빵2') || t.includes('오른쪽')) actions.push('PUT_CHEESE_BREAD2');
        else actions.push('PUT_CHEESE_BREAD1');
      }

      if (t.includes('덮') || t.includes('합쳐') || t.includes('포개') || t.includes('완성')) {
        if (t.includes('마주') || t.includes('뒤집') || t.includes('안쪽')) {
          actions.push('COVER_BREAD_FLIPPED');
        } else {
          actions.push('COVER_BREAD_NORMAL');
        }
      }

      if (actions.length > 0) {
        return { type: 'ACTION', actions: actions };
      }
      return null;
    }

    async function parseWithSolarAI(userInput) {
            const systemPrompt = `당신은 정보 교과 '알고리즘과 절차적 사고' 교육용 샌드위치 로봇의 [엄격한 명령어 컴파일러]입니다.

[핵심 교육 목표 & 원칙 - 매우 중요!]:
이 시뮬레이터는 중학생들에게 "컴퓨터는 융통성이 전혀 없으며, 사람이 지시하지 않은 전제 조건/행동을 스스로 해주지 않는다"는 프로그래밍의 원리를 가르치기 위한 도구입니다.

절대 지시하지 않은 사전 행동(예: 뚜껑 열기, 칼에 잼 묻히기, 봉지 열기 등)을 로봇이 임의로 추가해서는 안 됩니다!
오직 사용자가 문장에서 명시적으로 요구한 행동만 1:1로 추출해야 합니다.

[원자 액션 ID 목록]:
- "OPEN_BAG" : 빵 봉지 열기/뜯기 (사용자가 '봉지 열어/뜯어'라고 했을 때만)
- "TAKE_BREAD" : 식빵 꺼내기 (사용자가 '빵 꺼내/올려'라고 했을 때만. 2장이면 TAKE_BREAD 2번)
- "OPEN_JAM" : 딸기잼 뚜껑 열기 (사용자가 '잼 뚜껑 열어/따'라고 했을 때만)
- "OPEN_PB" : 땅콩버터 뚜껑 열기 (사용자가 '버터/땅콩 뚜껑 열어/따'라고 했을 때만)
- "UNWRAP_CHEESE" : 치즈 비닐 포장 벗기기 (사용자가 '치즈 비닐/껍질 벗겨/까'라고 했을 때만)
- "SCOOP_JAM" : 칼에 딸기잼 묻히기/뜨기 (사용자가 '칼에 잼 묻혀/떠'라고 했을 때만)
- "SCOOP_PB" : 칼에 땅콩버터 묻히기/뜨기 (사용자가 '칼에 버터 묻혀/떠'라고 했을 때만)
- "SPREAD_JAM_BREAD1_FLAT" : 식빵 1의 '넓은 면/골고루/표면'에 딸기잼 바르기
- "SPREAD_JAM_BREAD1_EDGE" : 식빵 1에 딸기잼 바르기 ('넓은 면'이라는 단어가 없는 모호한 지시)
- "SPREAD_PB_BREAD1_FLAT" : 식빵 1의 '넓은 면/골고루/표면'에 땅콩버터 바르기
- "SPREAD_PB_BREAD1_EDGE" : 식빵 1에 땅콩버터 바르기 ('넓은 면'이라는 단어가 없는 지시)
- "SPREAD_JAM_BREAD2_FLAT" : 식빵 2의 '넓은 면/골고루/표면'에 딸기잼 바르기
- "SPREAD_JAM_BREAD2_EDGE" : 식빵 2에 딸기잼 바르기 ('넓은 면'이라는 단어가 없는 지시)
- "SPREAD_PB_BREAD2_FLAT" : 식빵 2의 '넓은 면/골고루/표면'에 땅콩버터 바르기
- "SPREAD_PB_BREAD2_EDGE" : 식빵 2에 땅콩버터 바르기 ('넓은 면'이라는 단어가 없는 지시)
- "PUT_CHEESE_BREAD1" : 식빵 1 위에 치즈 올리기
- "PUT_CHEESE_BREAD2" : 식빵 2 위에 치즈 올리기
- "COVER_BREAD_FLIPPED" : 마주보게 뒤집어서 덮기/포개기
- "COVER_BREAD_NORMAL" : 단순 덮기/올리기

[변환 엄격 규칙 - 절대 위반 금지]:
1. [전제 조건 자동 완성 절대 금지]:
   - 사용자: "버터를 빵1에 발라" ➔ {"type": "ACTION", "actions": ["SPREAD_PB_BREAD1_EDGE"]}
     (주의: 뚜껑을 열라는 말도, 칼에 버터를 묻히라는 말도 없었으므로 OPEN_PB나 SCOOP_PB를 절대 임의로 추가하지 마세요!)
   - 사용자: "잼을 빵1의 넓은 면에 발라줘" ➔ {"type": "ACTION", "actions": ["SPREAD_JAM_BREAD1_FLAT"]}
     (주의: SCOOP_JAM을 임의로 추가하지 마세요!)
   - 사용자: "식빵 꺼내" ➔ {"type": "ACTION", "actions": ["TAKE_BREAD"]}
     (주의: 봉지를 열라는 말이 없었으므로 OPEN_BAG을 임의로 추가하지 마세요!)
2. [모서리 오류 규칙]:
   - '넓은 면', '표면', '골고루', '가운데'라는 표현이 없으면 무조건 _EDGE 액션으로 변환하세요.
3. [한 문장에 여러 동작이 명시된 경우]:
   - 사용자: "땅콩버터 뚜껑 열고 칼로 버터 퍼서 빵1 넓은 면에 발라" 처럼 여러 동작을 모두 명시했을 때만 차례대로 ["OPEN_PB", "SCOOP_PB", "SPREAD_PB_BREAD1_FLAT"]로 변환하세요.
4. [포괄적/모호한 지시]:
   - "알아서 해줘", "대충 만들어", "샌드위치 완성해줘" 등 구체적 동작이 없는 경우:
     {"type": "CLARIFY", "clarify_message": "로봇은 '알아서'라는 명령을 이해하지 못합니다. 빵 봉지를 열어야 할지, 잼 뚜껑을 열지 구체적인 첫 단계를 지시해주세요!"}

반드시 순수 JSON 형식으로만 출력하세요:
{"type": "ACTION", "actions": ["..."]} 또는 {"type": "CLARIFY", "clarify_message": "..."}`;

      try {
        const reply = await callSolarAI({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInput }
          ],
          temperature: 0.1
        });

        let content = reply.trim();
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.type === 'CLARIFY' || (parsed.type === 'ACTION' && parsed.actions && parsed.actions.length > 0)) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn("Solar AI 파싱 지연/오류, Fallback 파서로 처리:", err);
      }

      return fallbackRuleParser(userInput);
    }

    function executeActionStep(action) {
      switch(action) {
        case 'OPEN_BAG':
          state.bagOpened = true;
          return { success: true, name: "봉지 열기", msg: "빵 봉지를 열었습니다." };

        case 'TAKE_BREAD':
          if (!state.bagOpened) return { success: false, name: "식빵 꺼내기", msg: "오류: 빵 봉지가 닫혀 있습니다!" };
          state.breadOnPlate = Math.min(state.breadOnPlate + 1, 2);
          return { 
            success: true, 
            name: "식빵 꺼내기", 
            msg: state.breadOnPlate === 1 ? "식빵 1을 접시 왼쪽에 놓았습니다." : "식빵 2를 접시 오른쪽에 놓았습니다." 
          };

        case 'OPEN_JAM':
          state.jamOpened = true;
          return { success: true, name: "딸기잼 뚜껑 열기", msg: "딸기잼 뚜껑을 열었습니다." };

        case 'OPEN_PB':
          state.pbOpened = true;
          return { success: true, name: "땅콩버터 뚜껑 열기", msg: "땅콩버터 뚜껑을 열었습니다." };

        case 'UNWRAP_CHEESE':
          state.cheeseUnwrapped = true;
          return { success: true, name: "치즈 비닐 제거", msg: "치즈의 비닐 포장을 벗겨냈습니다." };

        case 'SCOOP_JAM':
          if (!state.jamOpened) return { success: false, name: "딸기잼 뜨기", msg: "오류: 딸기잼 뚜껑이 닫혀 있습니다!" };
          state.knifeHolding = 'jam';
          return { success: true, name: "딸기잼 뜨기", msg: "칼에 딸기잼을 묻혔습니다." };

        case 'SCOOP_PB':
          if (!state.pbOpened) return { success: false, name: "땅콩버터 뜨기", msg: "오류: 땅콩버터 뚜껑이 닫혀 있습니다!" };
          state.knifeHolding = 'pb';
          return { success: true, name: "땅콩버터 뜨기", msg: "칼에 땅콩버터를 묻혔습니다." };

        case 'SPREAD_JAM_BREAD1_EDGE':
          if (state.breadOnPlate === 0) return { success: false, name: "식빵1 잼 도포", msg: "오류: 접시에 식빵이 없습니다!" };
          if (state.knifeHolding !== 'jam') return { success: false, name: "식빵1 잼 도포", msg: "오류: 칼에 딸기잼이 없습니다!" };
          state.bread1Spread = 'jam_edge';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵1 모서리 도포", msg: "⚠️ [글자 그대로 실행]: '넓은 면' 지시가 없어 식빵 1 윗모서리 테두리에만 잼을 발랐습니다!" };

        case 'SPREAD_PB_BREAD1_EDGE':
          if (state.breadOnPlate === 0) return { success: false, name: "식빵1 땅콩버터 도포", msg: "오류: 접시에 식빵이 없습니다!" };
          if (state.knifeHolding !== 'pb') return { success: false, name: "식빵1 땅콩버터 도포", msg: "오류: 칼에 땅콩버터가 없습니다!" };
          state.bread1Spread = 'pb_edge';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵1 모서리 도포", msg: "⚠️ [글자 그대로 실행]: '넓은 면' 지시가 없어 식빵 1 윗모서리 테두리에만 땅콩버터를 발랐습니다!" };

        case 'SPREAD_JAM_BREAD1_FLAT':
          if (state.breadOnPlate === 0) return { success: false, name: "식빵1 잼 도포", msg: "오류: 접시에 식빵이 없습니다!" };
          if (state.knifeHolding !== 'jam') return { success: false, name: "식빵1 잼 도포", msg: "오류: 칼에 딸기잼이 없습니다!" };
          state.bread1Spread = 'jam_flat';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵1 잼 도포", msg: "식빵 1 넓은 면에 딸기잼을 골고루 펴 발랐습니다." };

        case 'SPREAD_PB_BREAD1_FLAT':
          if (state.breadOnPlate === 0) return { success: false, name: "식빵1 땅콩버터 도포", msg: "오류: 접시에 식빵이 없습니다!" };
          if (state.knifeHolding !== 'pb') return { success: false, name: "식빵1 땅콩버터 도포", msg: "오류: 칼에 땅콩버터가 없습니다!" };
          state.bread1Spread = 'pb_flat';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵1 땅콩버터 도포", msg: "식빵 1 넓은 면에 땅콩버터를 골고루 발랐습니다." };

        case 'SPREAD_JAM_BREAD2_EDGE':
          if (state.breadOnPlate < 2) return { success: false, name: "식빵2 잼 도포", msg: "오류: 접시에 식빵 2가 없습니다!" };
          if (state.knifeHolding !== 'jam') return { success: false, name: "식빵2 잼 도포", msg: "오류: 칼에 딸기잼이 없습니다!" };
          state.bread2Spread = 'jam_edge';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵2 모서리 도포", msg: "⚠️ [글자 그대로 실행]: '넓은 면' 지시가 없어 식빵 2 윗모서리 테두리에만 잼을 발랐습니다!" };

        case 'SPREAD_PB_BREAD2_EDGE':
          if (state.breadOnPlate < 2) return { success: false, name: "식빵2 땅콩버터 도포", msg: "오류: 접시에 식빵 2가 없습니다!" };
          if (state.knifeHolding !== 'pb') return { success: false, name: "식빵2 땅콩버터 도포", msg: "오류: 칼에 땅콩버터가 없습니다!" };
          state.bread2Spread = 'pb_edge';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵2 모서리 도포", msg: "⚠️ [글자 그대로 실행]: '넓은 면' 지시가 없어 식빵 2 윗모서리 테두리에만 땅콩버터를 발랐습니다!" };

        case 'SPREAD_JAM_BREAD2_FLAT':
          if (state.breadOnPlate < 2) return { success: false, name: "식빵2 잼 도포", msg: "오류: 접시에 식빵 2가 없습니다!" };
          if (state.knifeHolding !== 'jam') return { success: false, name: "식빵2 잼 도포", msg: "오류: 칼에 딸기잼이 없습니다!" };
          state.bread2Spread = 'jam_flat';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵2 잼 도포", msg: "식빵 2 넓은 면에 딸기잼을 골고루 펴 발랐습니다." };

        case 'SPREAD_PB_BREAD2_FLAT':
          if (state.breadOnPlate < 2) return { success: false, name: "식빵2 땅콩버터 도포", msg: "오류: 접시에 식빵 2가 없습니다!" };
          if (state.knifeHolding !== 'pb') return { success: false, name: "식빵2 땅콩버터 도포", msg: "오류: 칼에 땅콩버터가 없습니다!" };
          state.bread2Spread = 'pb_flat';
          state.knifeHolding = 'none';
          return { success: true, name: "식빵2 땅콩버터 도포", msg: "식빵 2 넓은 면에 땅콩버터를 골고루 발랐습니다." };

        case 'PUT_CHEESE_BREAD1':
          if (state.breadOnPlate === 0) return { success: false, name: "치즈 올리기", msg: "오류: 접시에 식빵 1이 없습니다!" };
          state.cheeseOnBread = 1;
          if (!state.cheeseUnwrapped) {
            state.cheesePlasticIncluded = true;
            return { success: true, name: "치즈 올리기", msg: "💥 [오류]: 비닐을 안 벗겨서 플라스틱째 식빵 1 위에 얹었습니다!" };
          }
          return { success: true, name: "치즈 올리기", msg: "치즈를 식빵 1 위에 얹었습니다." };

        case 'PUT_CHEESE_BREAD2':
          if (state.breadOnPlate < 2) return { success: false, name: "치즈 올리기", msg: "오류: 접시에 식빵 2가 없습니다!" };
          state.cheeseOnBread = 2;
          if (!state.cheeseUnwrapped) {
            state.cheesePlasticIncluded = true;
            return { success: true, name: "치즈 올리기", msg: "💥 [오류]: 비닐을 안 벗겨서 플라스틱째 식빵 2 위에 얹었습니다!" };
          }
          return { success: true, name: "치즈 올리기", msg: "치즈를 식빵 2 위에 얹었습니다." };

        case 'COVER_BREAD_NORMAL':
          if (state.breadOnPlate < 2) return { success: false, name: "식빵 덮기", msg: "오류: 덮을 두 번째 식빵이 접시에 없습니다!" };
          state.completed = true;
          state.isFlippedCover = false;
          return { success: true, name: "식빵 덮기", msg: "식빵 2를 식빵 1 위에 덮었습니다." };

        case 'COVER_BREAD_FLIPPED':
          if (state.breadOnPlate < 2) return { success: false, name: "마주보게 덮기", msg: "오류: 덮을 두 번째 식빵이 접시에 없습니다!" };
          state.completed = true;
          state.isFlippedCover = true;
          return { success: true, name: "마주보게 덮기", msg: "식빵 2를 뒤집어 잼/버터 면이 마주보도록 깔끔하게 포개었습니다." };

        default:
          return { success: false, name: "알 수 없음", msg: `알 수 없는 명령: ${action}` };
      }
    }

    function appendQueueStep(actionName, status, queueIndex) {
      const scroll = document.getElementById('queue-scroll');
      const emptyMsg = document.getElementById('queue-empty-msg');
      if (emptyMsg) emptyMsg.remove();

      const item = document.createElement('div');
      item.id = `q-step-${queueIndex}`;
      item.className = "flex-shrink-0 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-700 flex items-center gap-1.5 transition-all shadow-xs";
      item.innerHTML = `<span class="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] flex items-center justify-center font-bold">#${queueIndex}</span> ${actionName}`;
      scroll.appendChild(item);
      scroll.scrollLeft = scroll.scrollWidth;
      document.getElementById('queue-counter').textContent = `총 ${queueIndex}개 단계 실행됨`;
    }

    function updateQueueStatus(queueIndex, status) {
      const el = document.getElementById(`q-step-${queueIndex}`);
      if (!el) return;
      if (status === 'running') {
        el.className = "flex-shrink-0 bg-blue-50 border-2 border-blue-500 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 shadow-xs animate-pulse";
      } else if (status === 'success') {
        el.className = "flex-shrink-0 bg-emerald-50 border border-emerald-400 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5";
        el.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i> ` + el.innerText;
      } else if (status === 'fail') {
        el.className = "flex-shrink-0 bg-rose-50 border-2 border-rose-400 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5";
        el.innerHTML = `<i class="fa-solid fa-xmark text-rose-600"></i> ` + el.innerText;
      }
    }

    function appendChat(sender, html, type = 'normal') {
      const box = document.getElementById('chat-stream');
      const div = document.createElement('div');

      if (sender === 'user') {
        div.className = "bg-blue-600 text-white p-3 rounded-2xl max-w-[85%] ml-auto text-xs sm:text-sm shadow-xs";
        div.innerHTML = `<div class="font-semibold text-blue-100 text-xs mb-0.5">학생 지시:</div><div>${html}</div>`;
      } else if (type === 'ai_plan') {
        div.className = "bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl text-xs text-indigo-900 font-mono";
        div.innerHTML = `⚙️ <strong>Solar AI 파싱</strong>: [${html}]`;
      } else if (type === 'clarify') {
        div.className = "bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-2xl text-xs sm:text-sm shadow-xs";
        div.innerHTML = `🤔 <strong>로봇의 역질문 (구체화 요청)</strong>:<br>${html}`;
      } else if (type === 'error') {
        div.className = "bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-2xl text-xs sm:text-sm";
        div.innerHTML = `❌ <strong>로봇 오류</strong>: ${html}`;
      } else {
        div.className = "bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-xs sm:text-sm";
        div.innerHTML = `✅ <strong>로봇 실행</strong>: ${html}`;
      }

      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    async function executeCommand() {
      const input = document.getElementById('cmd-input');
      const sendBtn = document.getElementById('send-btn');
      const robotSub = document.getElementById('robot-sub');
      const avatar = document.getElementById('robot-avatar');
      const statusPill = document.getElementById('status-pill');

      const text = input.value.trim();
      if (!text) return;

      appendChat('user', text);
      input.value = '';
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';
      robotSub.textContent = "AI가 명령을 분석하고 있습니다...";
      avatar.textContent = "🤔";
      statusPill.textContent = "상태: 추론중";
      statusPill.className = "px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200";

      const parsedResult = await parseWithSolarAI(text);
      sendBtn.disabled = false;
      sendBtn.innerText = "실행";

      if (!parsedResult) {
        appendChat('bot', "명령에서 실행 가능한 동작을 추출하지 못했습니다. (예: 빵 봉지 열기, 잼 바르기 등 구체적인 동작을 내려주세요)", 'clarify');
        robotSub.textContent = "명령 해석 불가";
        avatar.textContent = "😵";
        playSound('error');
        return;
      }

      if (parsedResult.type === 'CLARIFY') {
        appendChat('bot', parsedResult.clarify_message || "로봇은 '알아서'라는 명령을 이해할 수 없습니다. 무엇을 먼저 해야 할지 구체적으로 알려주세요!", 'clarify');
        robotSub.textContent = "구체적인 지시가 필요합니다.";
        avatar.textContent = "❓";
        statusPill.textContent = "상태: 역질문 대기";
        statusPill.className = "px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300";
        playSound('question');
        return;
      }

      const actions = parsedResult.actions || [];
      if (actions.length === 0) {
        appendChat('bot', "실행 가능한 동작을 찾지 못했습니다. 구체적인 행동을 지시해주세요.", 'clarify');
        robotSub.textContent = "명령 해석 불가";
        avatar.textContent = "😵";
        playSound('error');
        return;
      }

      appendChat('bot', actions.join(" ➔ "), 'ai_plan');

      validStudentPromptsLog.push({
        userText: text,
        actions: actions
      });

      const startIndex = globalExecutionQueue.length;
      actions.forEach((act, i) => {
        const qIdx = startIndex + i + 1;
        globalExecutionQueue.push(act);
        appendQueueStep(act, 'pending', qIdx);
      });

      let curr = 0;
      function step() {
        if (curr >= actions.length) {
          robotSub.textContent = state.completed ? `샌드위치 완성! 🎉` : "명령 순서 실행 완료";
          avatar.textContent = state.completed ? "🥳" : "🤖";
          statusPill.textContent = "상태: 대기(IDLE)";
          statusPill.className = "px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200";
          return;
        }

        const act = actions[curr];
        const currentQIndex = startIndex + curr + 1;
        updateQueueStatus(currentQIndex, 'running');

        const res = executeActionStep(act);
        animateAction(act, res.success, res.msg);
        updateStatusUI();

        if (res.success) {
          updateQueueStatus(currentQIndex, 'success');
          appendChat('bot', res.msg, 'normal');
          avatar.textContent = "😃";
        } else {
          updateQueueStatus(currentQIndex, 'fail');
          appendChat('bot', res.msg, 'error');
          avatar.textContent = "😵";
        }

        curr++;
        setTimeout(step, 950);
      }

      step();
    }

    function resetWorkspace() {
      state = {
        bagOpened: false, breadOnPlate: 0, jamOpened: false, pbOpened: false,
        cheeseUnwrapped: false, cheeseOnBread: null, cheesePlasticIncluded: false,
        knifeHolding: 'none', bread1Spread: 'none', bread2Spread: 'none',
        isFlippedCover: false, completed: false
      };
      globalExecutionQueue = [];
      validStudentPromptsLog = [];

      document.getElementById('btn-reopen-summary').classList.add('hidden');

      document.getElementById('g-bag-clip').removeAttribute('transform');
      document.getElementById('txt-bag').textContent = "[밀봉됨]";
      document.getElementById('txt-bag').setAttribute('fill', '#0284c7');

      document.getElementById('g-cheese-plastic').removeAttribute('transform');
      document.getElementById('txt-cheese-pack').textContent = "[비닐밀봉]";
      document.getElementById('txt-cheese-pack').setAttribute('fill', '#ca8a04');

      const b1 = document.getElementById('g-bread-1');
      b1.classList.add('opacity-0');
      b1.setAttribute('transform', 'translate(75, -120)');

      const b2 = document.getElementById('g-bread-2');
      b2.classList.add('opacity-0');
      b2.setAttribute('transform', 'translate(265, -120)');
      document.getElementById('txt-bread-2-label').textContent = "식빵 2 (오른쪽)";

      document.getElementById('g-jam-edge-1').classList.add('opacity-0');
      document.getElementById('g-pb-edge-1').classList.add('opacity-0');
      document.getElementById('g-jam-flat-1').classList.add('opacity-0');
      document.getElementById('g-pb-flat-1').classList.add('opacity-0');
      document.getElementById('g-cheese-on-bread-1').classList.add('opacity-0');
      document.getElementById('g-cheese-error-wrap-1').classList.add('opacity-0');

      document.getElementById('g-jam-edge-2').classList.add('opacity-0');
      document.getElementById('g-pb-edge-2').classList.add('opacity-0');
      document.getElementById('g-jam-flat-2').classList.add('opacity-0');
      document.getElementById('g-pb-flat-2').classList.add('opacity-0');
      document.getElementById('g-cheese-on-bread-2').classList.add('opacity-0');
      document.getElementById('g-cheese-error-wrap-2').classList.add('opacity-0');

      document.getElementById('g-complete-badge').classList.add('opacity-0');

      document.getElementById('g-jam-lid').removeAttribute('transform');
      document.getElementById('txt-jam').textContent = "[뚜껑닫힘]";
      document.getElementById('txt-jam').setAttribute('fill', '#fecaca');

      document.getElementById('g-pb-lid').removeAttribute('transform');
      document.getElementById('txt-pb').textContent = "[뚜껑닫힘]";
      document.getElementById('txt-pb').setAttribute('fill', '#fde68a');

      const knife = document.getElementById('g-knife');
      knife.setAttribute('transform', 'translate(905, 290) rotate(-25)');
      document.getElementById('g-knife-blob').classList.add('opacity-0');

      document.getElementById('g-error-mark').classList.add('opacity-0');
      document.getElementById('stage-frame').classList.remove('shake-error', 'border-rose-400');
      document.getElementById('status-pill').textContent = "상태: 대기(IDLE)";
      document.getElementById('status-pill').className = "px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200";
      document.getElementById('stage-caption').textContent = "조리대 위에 재료들이 준비되어 있습니다.";
      document.getElementById('robot-sub').textContent = "작업대가 초기화되었습니다.";
      document.getElementById('robot-avatar').textContent = "🤖";
      
      document.getElementById('queue-scroll').innerHTML = '<span id="queue-empty-msg" class="text-slate-400 text-xs italic">명령을 내리면 누적된 전체 알고리즘 큐가 순서대로 계속 추가됩니다.</span>';
      document.getElementById('queue-counter').textContent = "총 0개 단계 실행됨";

      document.getElementById('chat-stream').innerHTML = `
        <div class="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-slate-700">
          <div class="font-bold text-blue-600 mb-1 flex items-center gap-1">
            <i class="fa-solid fa-robot"></i> 로봇 셰프 준비 완료
          </div>
          <p class="text-slate-600 text-xs sm:text-sm">작업대가 초기화되었습니다. 자유롭게 샌드위치 알고리즘을 지시해주세요!</p>
        </div>
      `;

      closeSummaryModal();
      updateStatusUI();
      playSound('click');
    }

    updateStatusUI();

    // 페이지 로드 시 초기화
