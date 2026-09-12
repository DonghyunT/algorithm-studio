/**
 * ==============================================================================
 * 🤖 [전역 AI 학습 튜터 챗봇]
 * ==============================================================================
 * 화면 우하단 튜터 챗봇 모달창 토글, 질문 전송, 스트리밍 응답, 퀵 질문 버튼 처리.
 */
// 🤖 AI 학습 튜터 챗봇 (전 교과 지원 & 유연한 회피)
    // ==========================================
    let isTutorOpen = false;
    function toggleTutorChat() {
      const win = document.getElementById('tutor-chat-window');
      const fab = document.getElementById('tutor-fab-btn');
      isTutorOpen = !isTutorOpen;
      if (isTutorOpen) {
        win.classList.remove('hidden');
        if (fab) {
          fab.classList.add('chat-open');
          fab.innerHTML = '<i class="fa-solid fa-xmark text-lg"></i> <span class="text-xs font-black tracking-tight select-none">닫기</span>';
        }
        document.getElementById('tutor-input').focus();
      } else {
        win.classList.add('hidden');
        if (fab) {
          fab.classList.remove('chat-open');
          fab.innerHTML = '<i class="fa-solid fa-comment-dots text-lg"></i> <span class="text-xs font-black tracking-tight select-none">AI 튜터</span>';
        }
      }
    }

    function quickTutorAsk(query) {
      document.getElementById('tutor-input').value = query;
      sendTutorMessage();
    }

    async function sendTutorMessage() {
      const input = document.getElementById('tutor-input');
      const sendBtn = document.getElementById('tutor-send-btn');
      const stream = document.getElementById('tutor-chat-stream');
      const query = input.value.trim();
      if (!query) return;

      const userDiv = document.createElement('div');
      userDiv.className = "p-2.5 bg-blue-600 text-white rounded-2xl rounded-tr-none text-xs sm:text-sm ml-auto max-w-[85%] shadow-xs";
      userDiv.textContent = query;
      stream.appendChild(userDiv);
      input.value = '';
      stream.scrollTop = stream.scrollHeight;

      sendBtn.disabled = true;
      const loadingDiv = document.createElement('div');
      loadingDiv.className = "p-2.5 bg-white border border-slate-200 rounded-2xl rounded-tl-none text-xs text-slate-400 font-mono flex items-center gap-1.5 max-w-[85%]";
      loadingDiv.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-blue-600"></i> 답변을 생각하는 중...';
      stream.appendChild(loadingDiv);
      stream.scrollTop = stream.scrollHeight;

      const systemPrompt = `당신은 중학교 학생들을 위한 친절하고 다정한 'AI 학습 튜터(도우미)'입니다.
[주요 역할 및 가이드라인]
1. 기본적으로 '알고리즘 및 정보 교과' 학습 도우미로서 추상화, 제어 구조(순차/선택/반복), 순서도, 효율성 분석, 프로그래밍(변수/리스트/함수), 디버깅, 샌드위치 로봇 실험실의 오작동 원인 등을 명쾌하게 설명합니다.
2. 정보 교과뿐만 아니라 국어, 영어, 수학, 과학, 사회 등 학생들의 전반적인 교과 학습 관련 질문에도 쉽고 유익하게 답변해주는 친절한 과외 선생님 역할을 수행합니다.
3. [회피 및 안전 가이드라인]: 욕설, 비속어, 유해하거나 부적절한 질문, 장난스러운 비학습성 질문에는 "저는 여러분의 공부를 돕는 AI 학습 도우미예요! 교과목 공부나 알고리즘에 대해 궁금한 점을 질문해 주세요 😊"와 같이 정중하고 자연스럽게 학습 주제로 유도하여 회피하세요.
4. 중학생 눈높이에 맞추어 핵심 위주로 이해하기 쉽게 2~3문장 내외로 이모지를 곁들여 간결하고 친절하게 답변하세요.`;

      try {
        const reply = (await callSolarAI({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          temperature: 0.3
        })).trim();

        loadingDiv.remove();

        const botDiv = document.createElement('div');
        botDiv.className = "p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-none text-xs sm:text-sm text-slate-700 shadow-xs max-w-[90%] leading-relaxed";
        botDiv.innerHTML = reply.replace(/\n/g, '<br>');
        stream.appendChild(botDiv);
      } catch (err) {
        loadingDiv.remove();
        const errDiv = document.createElement('div');
        errDiv.className = "p-2.5 bg-rose-50 border border-rose-200 rounded-2xl rounded-tl-none text-xs text-rose-700";
        errDiv.textContent = "⚠️ 답변을 불러오지 못했습니다. 잠시 후 다시 질문해 주세요!";
        stream.appendChild(errDiv);
      } finally {
        sendBtn.disabled = false;
        stream.scrollTop = stream.scrollHeight;
      }
    }
