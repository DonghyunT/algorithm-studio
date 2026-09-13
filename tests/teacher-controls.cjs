// Local demo only: no production Firebase writes, Google login, or AI calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'results');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/js/data/firebase-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}');}
  if(!/^\/(?:index\.html|(?:js|css)\/[\w/.-]+)$/.test(url.pathname)||url.pathname.endsWith('/config.js')){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const results=[],errors=[],consoleErrors=[];let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.setDefaultTimeout(7000);let confirmEnd=true;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('dialog',d=>confirmEnd?d.accept():d.dismiss());
  const url=`http://127.0.0.1:${server.address().port}/index.html?demo=1`;
  await page.goto(url,{waitUntil:'networkidle'});await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-google').click();
  const action=page.locator('#teacher-session-action'),status=page.locator('#teacher-session-status');
  async function check(name,task){try{await task();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
  await check('one action moves from unprepared to ready without starting the timer',async()=>{
   assert.equal(await status.textContent(),'준비 전');assert.equal(await action.textContent(),'평가 준비');
   await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-action').textContent==='평가 시작');
   assert.equal(await status.textContent(),'입장 대기');assert.equal(await page.locator('#teacher-session-time').textContent(),'');
  });
  await check('pending and double clicks send one start; state changes only after success',async()=>{
   await page.evaluate(()=>{window.originalStart=evalService.startSession.bind(evalService);window.startCalls=0;evalService.startSession=async(...args)=>{startCalls++;await new Promise(r=>window.releaseStart=r);return originalStart(...args);};});
   await action.click();await page.evaluate(()=>handleTeacherSessionAction());
   assert.equal(await action.isDisabled(),true);assert.equal(await status.textContent(),'입장 대기');assert.equal(await page.evaluate(()=>startCalls),1);
   await page.evaluate(()=>releaseStart());await page.waitForFunction(()=>document.getElementById('teacher-session-action').textContent==='평가 종료');
   assert.equal(await status.textContent(),'평가 중');assert.match(await page.locator('#teacher-session-time').textContent(),/남은 시간/);
   await page.evaluate(()=>evalService.startSession=originalStart);
  });
  await check('cancelled end and failed server write leave the running state intact',async()=>{
   confirmEnd=false;await action.click();assert.equal(await status.textContent(),'평가 중');confirmEnd=true;
   await page.evaluate(()=>{window.originalEnd=evalService.endSession.bind(evalService);evalService.endSession=async()=>{throw Error('검증용 연결 실패');};});
   await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-feedback').textContent.includes('검증용 연결 실패'));
   assert.equal(await status.textContent(),'평가 중');assert.equal(await action.isDisabled(),false);
   await page.evaluate(()=>evalService.endSession=originalEnd);
  });
  await check('wide and narrow teacher toolbar has reachable controls and no page overflow',async()=>{
   await page.evaluate(()=>{setTeacherSessionFeedback('');window.scrollTo({top:0,behavior:'instant'});});
   for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
    for(const button of await page.locator('.teacher-session-actions button').all()){
     const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height>=40);
    }
    if(width===1440||width===390){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(output,`teacher-controls-${width}.png`),fullPage:true});}
   }
  });
  await check('end then prepare archives the old round and displays a new waiting round',async()=>{
   const old=await page.evaluate(()=>currentLiveSession.attemptId);await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-action').textContent==='새 평가 준비');
   assert.equal(await status.textContent(),'평가 종료');await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-action').textContent==='평가 시작');
   assert.notEqual(await page.evaluate(()=>currentLiveSession.attemptId),old);
   assert.ok(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.startsWith('EVAL_ARCHIVE_'))));
  });
  await check('remote teacher updates are reflected and class switching removes old listeners',async()=>{
   const other=await context.newPage();await other.goto(url,{waitUntil:'networkidle'});
   await other.evaluate(()=>evalService.prepareSession('2-2'));await page.locator('#classroom-class-select').selectOption('2학년 2반');
   await page.waitForFunction(()=>currentLiveSession?.attemptId);
   await other.evaluate(()=>evalService.startSession('2-2'));await page.waitForFunction(()=>document.getElementById('teacher-session-status').textContent==='평가 중');
   await page.locator('#classroom-class-select').selectOption('2학년 1반');await page.waitForFunction(()=>document.getElementById('teacher-session-status').textContent==='입장 대기');
   await other.evaluate(()=>evalService.endSession('2-2'));await page.waitForTimeout(120);
   assert.equal(await status.textContent(),'입장 대기');await other.close();
  });
  await check('expired session is shown as ended and can prepare the next round without restarting it',async()=>{
   await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-status').textContent==='평가 중');
   await page.evaluate(()=>{const session=evalService.read('EVAL_SESSION_2-1',{});session.deadlineMs=Date.now()-1000;evalService.write('EVAL_SESSION_2-1',session);evalService.notify('2-1',{session});});
   await page.waitForFunction(()=>document.getElementById('teacher-session-action').textContent==='새 평가 준비');
   await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-status').textContent==='입장 대기');
  });
  await check('subscription failure disables mutations until retry and leaving cleans up the dashboard',async()=>{
   await page.evaluate(()=>{currentLiveStudents=[{num:1,name:'권한 회수 전 이름'}];document.getElementById('classroom-live-modal-title').textContent='권한 회수 전 이름';document.getElementById('classroom-live-detail-modal').classList.remove('hidden');window.originalListen=evalService.listenSession.bind(evalService);evalService.listenSession=(id,cb,onError)=>{onError(Error('permission-denied'));return()=>{};};initLiveEvalDashboard();});
   assert.equal(await status.textContent(),'상태 확인 실패');assert.equal(await action.textContent(),'다시 연결');
   assert.equal(await page.evaluate(()=>currentLiveStudents.length===0&&currentLiveSession===null&&liveSessionTimer===null),true);
   assert.equal(await page.locator('#classroom-live-modal-title').textContent(),'');assert.equal(await page.locator('#classroom-live-detail-modal').isVisible(),false);
   await page.evaluate(()=>evalService.listenSession=originalListen);await action.click();await page.waitForFunction(()=>document.getElementById('teacher-session-status').textContent==='입장 대기');
   await page.evaluate(()=>switchUnit('roadmap'));
   assert.equal(await page.evaluate(()=>liveSessionTimer===null&&liveSessionUnsub===null&&liveEvalUnsub===null),true);
  });
 }catch(error){errors.push(error.message);}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  const report={at:new Date().toISOString(),results,errors,consoleErrors,passed:results.length===8&&results.every(r=>r.pass)&&errors.length===0&&consoleErrors.length===0};
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'teacher-controls.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }
})();
