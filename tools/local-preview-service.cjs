// Opt-in loopback-only bridge. No Firestore student/teacher access and no local AI key.
const {randomBytes,timingSafeEqual}=require('node:crypto');
const AI_ORIGIN='https://algorithm-studio-ten.vercel.app';
function createLocalPreviewService({password,apiKey,fetcher=fetch,now=Date.now}) {
  const nonce=randomBytes(32).toString('base64url'),sessions=new Map();
  let firebaseSession=null,authPending=null,aiCount=0,burst={start:0,count:0},loginBurst={start:0,count:0};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const limited=bucket=>{if(now()-bucket.start>=60000){bucket.start=now();bucket.count=0;}return ++bucket.count>5;};
  async function token() {
    if(firebaseSession&&firebaseSession.expires>now())return firebaseSession.token;
    if(!authPending)authPending=(async()=>{
      const response=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true}),signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('auth');
      const data=await response.json();if(typeof data.idToken!=='string')throw Error('auth');
      firebaseSession={token:data.idToken,expires:now()+Math.min(Number(data.expiresIn)||3600,3600)*1000-60000};
      return firebaseSession.token;
    })().finally(()=>{authPending=null;});
    return authPending;
  }
  async function handle(req,res,pathname,origin) {
    if(!['/api/local-chat','/api/local-teacher'].includes(pathname))return false;
    if(req.method!=='POST') {json(res,405,{error:'POST 요청만 사용할 수 있습니다.'});return true;}
    if(req.headers.origin!==origin||req.headers['x-local-preview-token']!==nonce||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) {
      json(res,403,{error:'로컬 체험 화면을 새로고침한 뒤 다시 시도해 주세요.'});return true;
    }
    let size=0,chunks=[];
    try {
      for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>32000){json(res,413,{error:'요청 내용이 너무 깁니다.'});return true;}chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks.map(c=>Buffer.isBuffer(c)?c:Buffer.from(c))).toString());
      if(pathname==='/api/local-teacher') {
        const session=(req.headers.authorization||'').replace(/^Bearer /,'');
        if(body.action==='status'){json(res,200,{authenticated:(sessions.get(session)||0)>now()});return true;}
        if(body.action==='logout'){sessions.delete(session);json(res,200,{ok:true});return true;}
        if(body.action!=='login'){json(res,400,{error:'로그인 요청을 확인해 주세요.'});return true;}
        if(limited(loginBurst)){json(res,429,{error:'잠시 기다린 뒤 다시 로그인해 주세요.'});return true;}
        const entered=Buffer.from(typeof body.password==='string'?body.password:'');const expected=Buffer.from(password);
        if(entered.length!==expected.length||!timingSafeEqual(entered,expected)){json(res,401,{error:'로컬 교사 비밀번호를 확인하고 다시 입력해 주세요.'});return true;}
        for(const [key,expires] of sessions)if(expires<=now())sessions.delete(key);
        const newSession=randomBytes(32).toString('base64url');sessions.set(newSession,now()+8*3600000);
        json(res,200,{session:newSession});return true;
      }
      if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>20||body.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')){json(res,400,{error:'AI 요청 내용을 확인해 주세요.'});return true;}
      if(limited(burst)||aiCount>=30){json(res,429,{error:'로컬 체험 호출 제한입니다. 분당 5회, 서버 실행당 30회까지 사용할 수 있습니다.'});return true;}
      aiCount++;
      const response=await fetcher(AI_ORIGIN+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await token()},body:JSON.stringify({messages:body.messages}),signal:AbortSignal.timeout(30000)});
      const data=await response.json();
      if(!response.ok){json(res,response.status===429?429:503,{error:response.status===429?'AI 사용량 제한입니다. 잠시 후 다시 검사해 주세요.':'실제 AI에 연결하지 못했습니다. 잠시 후 다시 검사해 주세요.'});return true;}
      const content=data.choices?.[0]?.message?.content;
      if(typeof content!=='string'||content.length>20000)throw Error('response');
      json(res,200,{content});return true;
    } catch {json(res,503,{error:'로컬 체험 요청을 처리하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.'});return true;}
  }
  return {nonce,handle};
}
module.exports={createLocalPreviewService};
