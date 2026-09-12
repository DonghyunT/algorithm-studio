/**
 * ==============================================================================
 * 🤖 [AI Service] 통합 Solar AI 통신 모듈 (하이브리드 보안 지원)
 * ==============================================================================
 * 1. Vercel 배포 환경:
 *    - /api/chat 서버리스 함수를 호출하여 브라우저/학생에게 API 키를 100% 은닉합니다.
 * 2. 로컬 개발/오프라인 환경 (file:/// 또는 로컬 서버):
 *    - js/data/config.js의 UPSTAGE_API_KEY 또는 sessionStorage 키를 직접 사용합니다.
 * 3. 3대 로컬 PC(학교/집/개인):
 *    - config.js는 OneDrive를 통해 자동 동기화되며, .gitignore로 깃허브 유출을 원천 방지합니다.
 */

async function callSolarAI({ messages, temperature = 0.5, model }) {
  const selectedModel = model || (typeof SOLAR_MODEL !== 'undefined' ? SOLAR_MODEL : "solar-pro4");
  const isLocalFile = window.location.protocol === 'file:';

  // ----------------------------------------------------
  // 1. 웹 배포 환경(Vercel 등): /api/chat 서버리스 프록시 우선 호출
  // ----------------------------------------------------
  if (!isLocalFile) {
    try {
      const vResp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature
        })
      });

      if (vResp.ok) {
        const vData = await vResp.json();
        if (vData.choices && vData.choices[0] && vData.choices[0].message) {
          return vData.choices[0].message.content;
        }
      } else if (vResp.status === 404) {
        // 로컬 웹서버(Live Server 등)에서 /api/chat 엔드포인트가 없을 경우
        console.info('[AI Service] /api/chat 서버리스가 감지되지 않아 로컬 config.js 키 모드로 전환합니다.');
      } else {
        const errJson = await vResp.json().catch(() => ({}));
        console.warn('[AI Service] /api/chat 응답 상태:', vResp.status, errJson);
      }
    } catch (netErr) {
      console.info('[AI Service] /api/chat 연결 불가, 로컬 설정으로 대체 시도:', netErr.message);
    }
  }

  // ----------------------------------------------------
  // 2. 로컬 오프라인(file://) 환경 또는 Fallback: config.js 직접 호출
  // ----------------------------------------------------
  const apiKey = (typeof UPSTAGE_API_KEY !== 'undefined' && UPSTAGE_API_KEY)
    ? UPSTAGE_API_KEY
    : (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('UPSTAGE_API_KEY') : null);

  if (!apiKey || apiKey === "선생님의_UPSTAGE_API_키" || apiKey.trim() === "") {
    throw new Error("⚠️ AI API 키가 설정되지 않았습니다.\n(로컬: js/data/config.js 키 입력 / 배포: Vercel 환경변수 UPSTAGE_API_KEY 등록 필요)");
  }

  const resp = await fetch("https://api.upstage.ai/v1/solar/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Upstage API 호출 실패 (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Upstage API 응답 형식이 올바르지 않습니다.");
  }

  return data.choices[0].message.content;
}

// 전역 스코프에 등록
if (typeof window !== 'undefined') {
  window.callSolarAI = callSolarAI;
}
