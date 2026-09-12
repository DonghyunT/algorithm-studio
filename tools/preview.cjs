// Read-only static preview. No production Firebase initialization or AI requests.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/') {res.writeHead(302,{Location:'/index.html?demo=1'});return res.end();}
  if(url.pathname==='/api/chat'){res.writeHead(503);return res.end('Local preview');}
  if(url.pathname==='/js/data/firebase-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}');}
  const pathname=decodeURIComponent(url.pathname);
  if(!/^\/(index\.html|(?:js|css)\/[^.][\w/.-]+)$/.test(pathname)||pathname.endsWith('/config.js')){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('Local review: http://127.0.0.1:'+server.address().port+'/?demo=1'));
