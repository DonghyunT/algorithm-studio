// Isolated local-demo browser coverage for the read-only teacher archive history.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
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
 let browser;const pageErrors=[],consoleErrors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/^https:\/\/(?:cdn\.tailwindcss\.com|www\.gstatic\.com|cdnjs\.cloudflare\.com)\//,route=>route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/javascript',body:''}));
  const page=await context.newPage();page.setDefaultTimeout(7000);
  page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'.hidden{display:none!important} [role="tablist"]{display:flex;flex-wrap:wrap;gap:8px} [role="tab"]{flex:1 1 132px;min-width:132px}'});
  await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-google').click();
  const archive={kind:'new-session',classId:'2-1',archivedAt:'2026-09-23T01:00:00.000Z',session:{classId:'2-1',questionVersion:4,status:'ended',startTime:'2026-09-23T00:30:00.000Z'},students:[{num:1,numStr:'01',name:'보관 <학생>',status:'submitted',submittedAt:'2026-09-23T01:15:00.000Z',answers:{part1:{q1:0,q2:null},part2:{q1:'답안 예시'},part3:{plan:{current:'현재 상태',goal:'목표 상태',conditions:'지켜야 할 조건',steps:['첫 순서']},blocks:[{id:'start',shape:'terminal',text:'시작',x:100,y:40}],connections:[]}},scores:{part1:24,part2:26,part3:null,objectiveTotal:50,total:null,pendingReview:true,serverGraded:true},review:{confirmed:{criteria:[{id:'unknown-rule',score:8,evidence:'검토 기록'}]}}}]};
  await page.evaluate(value=>sessionStorage.setItem('EVAL_ARCHIVE_history-ui',JSON.stringify(value)),archive);
  const storageBefore=await page.evaluate(()=>sessionStorage.getItem('EVAL_ARCHIVE_history-ui'));
  await page.locator('#classroom-tab-btn-archive').evaluate(button=>button.click());
  assert.equal(await page.locator('#classroom-tab-btn-archive').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#classroom-section-archive').isVisible(),true);
  const round=page.locator('[data-archive-action="open-round"]');await round.waitFor();
  assert.match(await page.locator('#classroom-archive-content').textContent(),/실전평가 · 2026\.09\.23/);
  await round.evaluate(button=>button.click());
  const student=page.locator('[data-archive-action="select-student"]');await student.waitFor();
  assert.match(await student.textContent(),/소계 50점 · 서술 대기/);
  await page.locator('#classroom-archive-student-search').fill('찾을 수 없는 이름');
  assert.equal(await page.locator('#classroom-archive-search-empty').isVisible(),true);
  await page.locator('#classroom-archive-student-search').fill('보관');
  assert.equal(await student.isVisible(),true);
  await student.evaluate(button=>{button.focus();button.click();});
  await page.waitForFunction(()=>document.activeElement?.dataset?.archiveStudentId==='01');
  const detail=page.locator('#classroom-archive-content');
  assert.match(await detail.textContent(),/보관 <학생>/);
  assert.match(await detail.textContent(),/소계 50점 · 서술 대기/);
  assert.match(await detail.textContent(),/V4 당시 문항 원문은 답안 보관 자료에 포함되지 않았습니다/);
  assert.match(await detail.textContent(),/검토 기록/);
  assert.match(await detail.textContent(),/①/);
  assert.match(await detail.textContent(),/미응답/);
  assert.match(await detail.textContent(),/2026\.09\.23 10:15 KST/);
  assert.equal(await detail.locator('button').filter({hasText:/수정|초기화|재채점|점수 조정/}).count(),0);
  const screenshotDir=path.join(os.tmpdir(),'archive-history-check');fs.mkdirSync(screenshotDir,{recursive:true});
  await page.screenshot({path:path.join(screenshotDir,'desktop.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('EVAL_ARCHIVE_history-ui')),storageBefore,'opening history must not alter archived source data');
  const layout=page.locator('#classroom-archive-round-layout');
  for(const width of [1440,1024,768,390]){
   await page.setViewportSize({width,height:844});
   const columns=await layout.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length);
   assert.equal(columns,width>899?2:1,`archive panes should follow viewport at ${width}px`);
   assert.ok(await layout.evaluate(element=>element.scrollWidth<=element.clientWidth+1),`archive pane must not overflow at ${width}px`);
   assert.equal(await page.locator('[data-archive-action="back-roster"]').isVisible(),width<=899,`student list return should match the pane breakpoint at ${width}px`);
  }
  await page.screenshot({path:path.join(screenshotDir,'mobile.png'),fullPage:true});
  await page.locator('[data-archive-action="back-roster"]').evaluate(button=>button.click());
  assert.equal(await page.locator('.classroom-archive-roster').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'classroom-archive-student-search');
  await page.locator('[data-archive-action="back-list"]').evaluate(button=>{button.focus();button.click();});
  await page.waitForFunction(()=>document.activeElement?.dataset?.archiveId==='history-ui');
  await page.locator('[data-archive-action="open-round"]').evaluate(button=>button.click());
  await page.waitForFunction(()=>document.activeElement?.dataset?.archiveStudentId==='01');
  await page.locator('#classroom-tab-btn-archive').focus();await page.locator('#classroom-tab-btn-archive').press('ArrowRight');
  assert.equal(await page.locator('#classroom-tab-btn-assign').getAttribute('aria-selected'),'true');
  await page.locator('#classroom-tab-btn-assign').press('ArrowLeft');
  assert.equal(await page.locator('#classroom-tab-btn-archive').getAttribute('aria-selected'),'true');
  assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);
  console.log(JSON.stringify({passed:true,checks:['teacher archive list and KST round label','saved score and stored review display','search, student answer and read-only integrity','desktop/mobile pane layout at 1440/1024/768/390','tab keyboard navigation'],screenshots:screenshotDir,pageErrors,consoleErrors}));
 }catch(error){
  console.error(JSON.stringify({passed:false,error:error.message,pageErrors,consoleErrors}));process.exitCode=1;
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})();
