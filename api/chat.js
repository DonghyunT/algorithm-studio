// api/chat.js - Vercel Serverless Function for Upstage Solar AI Proxy
// 학생/외부 브라우저에 API 키를 노출하지 않고 Vercel 서버 환경변수(UPSTAGE_API_KEY)를 통해 보안 중계합니다.

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Vercel Project Settings > Environment Variables의 UPSTAGE_API_KEY 사용
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Vercel 서버에 UPSTAGE_API_KEY 환경 변수가 등록되지 않았습니다. Vercel 대시보드(Settings > Environment Variables)에 키를 등록해 주세요.' 
    });
  }

  try {
    const { model = 'solar-pro4', messages, temperature = 0.5 } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const response = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Upstage Solar API Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
