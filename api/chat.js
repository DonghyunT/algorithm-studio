const { verifyFirebaseToken } = require('../server/firebase-token.cjs');
const requests = new Map();
module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'POST 요청만 사용할 수 있습니다.'});
  const body=req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length<1 || body.messages.length>20 ||
      body.messages.some(message=>!message || !['user','assistant','system'].includes(message.role) || typeof message.content!=='string') ||
      JSON.stringify(body).length>32000) return res.status(400).json({error:'요청 내용을 확인해 주세요.'});
  const token = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
  let claims;
  try { claims=await verifyFirebaseToken(token,process.env.FIREBASE_PROJECT_ID || 'donghyun-algo'); }
  catch { return res.status(401).json({error:'로그인을 확인한 뒤 다시 시도해 주세요.'}); }
  // Per-process burst protection; configure platform-wide limits before classroom rollout.
  const now=Date.now(), previous=requests.get(claims.sub);
  const bucket=previous && now-previous.start<60000 ? previous : {start:now,count:0};
  if (++bucket.count>10) return res.status(429).json({error:'잠시 기다린 뒤 다시 요청해 주세요.'});
  requests.set(claims.sub,bucket);
  if(requests.size>1000) for(const [key,value] of requests) if(now-value.start>=60000)requests.delete(key);
  if (!process.env.UPSTAGE_API_KEY) return res.status(503).json({error:'AI 연결 설정을 확인 중입니다. 잠시 후 다시 시도해 주세요.'});
  try {
    const response=await fetch('https://api.upstage.ai/v1/solar/chat/completions',{
      method:'POST',signal:AbortSignal.timeout(25000),
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.UPSTAGE_API_KEY},
      body:JSON.stringify({model:process.env.SOLAR_MODEL || 'solar-pro4',messages:body.messages,temperature:0.4,max_tokens:800})
    });
    if(!response.ok) return res.status(502).json({error:'AI 응답을 받지 못했습니다. 직접 실행하거나 잠시 후 다시 시도해 주세요.'});
    return res.status(200).json(await response.json());
  } catch { return res.status(503).json({error:'AI 연결 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.'}); }
};
