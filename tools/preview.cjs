// Loopback preview. Production Firebase UI is disabled; --ai opts into the AI relay.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const aiEnabled=process.argv.includes('--ai');
let bridge=null;
if(aiEnabled){
  const passwordFile=path.join(root,'.env.preview.local');
  if(!fs.existsSync(passwordFile))fs.writeFileSync(passwordFile,'LOCAL_TEACHER_PASSWORD='+require('node:crypto').randomBytes(12).toString('base64url')+'\n',{flag:'wx',mode:0o600});
  const password=fs.readFileSync(passwordFile,'utf8').match(/^LOCAL_TEACHER_PASSWORD=(.+)$/m)?.[1]?.trim();
  if(!password||password.length<12)throw Error('로컬 교사 비밀번호를 .env.preview.local에 12자 이상으로 설정해 주세요.');
  const apiKey=fs.readFileSync(path.join(root,'js/data/firebase-config.js'),'utf8').match(/apiKey:\s*"([^"]+)"/)?.[1];
  if(!apiKey)throw Error('Firebase 공개 연결 설정을 확인해 주세요.');
  bridge=require('./local-preview-service.cjs').createLocalPreviewService({password,apiKey});
}
const server=http.createServer(async(req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port;
  if(req.headers.host!=='127.0.0.1:'+server.address().port || req.headers['sec-fetch-site']==='cross-site') {res.writeHead(403);return res.end();}
  res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Content-Type-Options','nosniff');
  let url,pathname;
  try {url=new URL(req.url,'http://localhost');pathname=decodeURIComponent(url.pathname);}
  catch {res.writeHead(400);return res.end();}
  if(bridge&&await bridge.handle(req,res,url.pathname,origin))return;
  if(url.pathname==='/') {res.writeHead(302,{Location:'/index.html?demo=1'});return res.end();}
  if(url.pathname==='/api/chat'){res.writeHead(503);return res.end('Local preview');}
  if(url.pathname==='/js/data/firebase-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}'+(bridge?'window.LOCAL_PREVIEW_CONFIG='+JSON.stringify({token:bridge.nonce})+';':''));}
  if(!/^\/(index\.html|(?:js|css)\/[^.][\w/.-]+)$/.test(pathname)||pathname.endsWith('/config.js')){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
});
server.listen(Number(process.env.PORT)||(aiEnabled?4174:4173),'127.0.0.1',()=>console.log('Local review: http://127.0.0.1:'+server.address().port+'/?demo=1'+(aiEnabled?' (실제 AI / 로컬 교사 비밀번호: .env.preview.local)':'')));
