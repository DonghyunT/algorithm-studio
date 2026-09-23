// Isolated browser verification: synthetic responses only, never production data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'scratch/read-efficiency');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/js/data/firebase-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}');}
  if(!/^\/(index\.html|(?:js|css)\/[\w/.-]+)$/.test(pathname)||pathname.endsWith('/config.js')){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 const errors=[],requests=[];let part3=null;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1'&&/firebase|googleapis|upstage/.test(url.hostname+url.pathname))return route.fulfill({status:200,body:''});
   if(url.pathname==='/api/evaluation'){
    const body=route.request().postDataJSON();requests.push(body.action);
    const data=body.action==='class-grades'?{attemptId:'synthetic-round',grades:{'01':{score:{part1:25,part2:25,objectiveTotal:50}}}}:{ready:true,score:{part1:25,part2:25,objectiveTotal:50},part3};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   return route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?demo=1`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   switchUnit('eval');
   window.authService.isDemo=()=>false;window.authService.token=async()=>'synthetic-token';window.authService.teacher=async()=>({uid:'synthetic-teacher'});
   const app=window.studentEvalApp;
   app.sessionUnsub?.();app.studentUnsub?.();app.sessionUnsub=null;app.studentUnsub=null;
   window.evalService.listenSession=()=>()=>{};
   window.evalService.listenStudent=(id,num,cb)=>{window.testStudentSnapshot=cb;return ()=>{};};
   window.testRecord={num:1,numStr:'01',name:'검증용',status:'submitted',attemptId:'synthetic-round',submittedAt:'synthetic-time',answers:{part1:{q:1},part2:{q:'예시'},part3:{questionVersion:4,blocks:[],connections:[]}}};
   Object.assign(app,{currentClass:'2-1',studentNum:1,attemptId:'synthetic-round',joined:true,isSubmitted:true,latestSession:{questionVersion:4,attemptId:'synthetic-round',status:'ended'},answers:structuredClone(window.testRecord.answers)});
   app.calculateScores();app.renderResult();app.attachAssessmentListeners();window.testStudentSnapshot(structuredClone(window.testRecord));
  });
  await page.waitForFunction(()=>studentEvalApp.serverScoreState.status==='ready');
  await page.waitForTimeout(6500);
  assert.equal(requests.filter(x=>x==='student-score').length,1,'No periodic reads while review is pending');
  for(const [total,confirmed] of [[30,false],[35,true],[0,true]]){
   part3={total,confirmed,criteria:[]};
   await page.evaluate(review=>testStudentSnapshot({...structuredClone(testRecord),review:{[review.confirmed?'confirmed':'proposal']:review}}),part3);
   await page.waitForFunction(({total,confirmed})=>studentEvalApp.serverScoreState.score?.part3===total&&studentEvalApp.serverScoreState.score?.part3Status===(confirmed?'confirmed':'first_graded'),part3);
   assert.match(await page.locator('#eval-result-part3-card').innerText(),new RegExp(String(total)));
  }
  const scoreButton=page.locator('#eval-result-score-reveal-button');
  await scoreButton.dispatchEvent('pointerdown',{pointerId:1});
  assert.match(await page.locator('#eval-result-part1-score').innerText(),/25/);
  assert.equal(await page.locator('#eval-result-grand-total-score').innerText(),'50점');
  await scoreButton.dispatchEvent('pointerup',{pointerId:1});
  assert.doesNotMatch(await page.locator('#eval-result-part1-score').innerText(),/25/);
  assert.doesNotMatch(await page.locator('#eval-result-grand-total-score').innerText(),/50/);
  assert.doesNotMatch(await page.locator('#eval-result-breakdown').innerText(),/선생님 검토 대기/);
  assert.match(await page.locator('#eval-result-part3-title').innerText(),/확정 점수/);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.screenshot({path:path.join(output,`student-${width}.png`),fullPage:true});
  }
  await page.evaluate(()=>{
   window.studentEvalApp.exitExam();
   window.evalService.listenSession=(id,cb)=>{cb({questionVersion:4,attemptId:'synthetic-round',status:'ended'});return ()=>{};};
   window.evalService.listenStudents=(id,cb)=>{window.testClassSnapshot=cb;return ()=>{};};
   syncTeacherAutoReviewQueue=()=>{};isTeacherAuthenticated=true;currentSelectedClass='2학년 1반';
   initLiveEvalDashboard();testClassSnapshot([structuredClone(testRecord)]);
  });
  await page.waitForFunction(()=>currentLiveClassGrades['01']?.score.objectiveTotal===50);
  for(let i=0;i<5;i++){
   await page.evaluate(i=>testClassSnapshot([structuredClone(testRecord),{num:2,numStr:'02',status:'in_progress',attemptId:'synthetic-round',answers:{part1:{q:i}},progress:{part1:1,part2:0,part3:0}}]),i);
   await page.waitForTimeout(400);
  }
  assert.equal(requests.filter(x=>x==='class-grades').length,1);
  await page.evaluate(()=>stopLiveEvalDashboard());
  assert.deepEqual(errors,[]);
  const result={studentScoreRequests:requests.filter(x=>x==='student-score').length,classGradeRequests:requests.filter(x=>x==='class-grades').length,checks:['pending idle','proposal/confirmed/zero updates','hold masking','unrelated drafts'],errors};
  fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
