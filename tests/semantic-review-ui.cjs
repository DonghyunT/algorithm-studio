// Default: offline mocks. --live: two real AI requests via the opt-in local bridge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const live=process.argv.includes('--live'),output=path.join(__dirname,'results','semantic-review'+(live?'-live':''));fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[],consoleErrors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!(live&&m.location().url.includes('/api/local-teacher')&&m.text().includes('401')))consoleErrors.push(m.text());});page.on('dialog',d=>d.accept());
 async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
 try{
  await page.goto(`http://127.0.0.1:${live?4174:4173}/index.html?demo=1`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);});
  await check('input/output sequence passes without requiring a processing block',async()=>{
   await page.evaluate(async live=>{
    nlCards=[{id:'p1',type:'seq',text:'현재기온을 입력받는다.'},{id:'p2',type:'seq',text:'현재기온을 출력한다.'}];
    freeBlocks=[{id:'s',shape:'terminal',text:'시작',x:250,y:30},{id:'i',shape:'io',text:'현재기온 입력하기',x:120,y:160},{id:'o',shape:'io',text:'현재기온 출력하기',x:120,y:290},{id:'e',shape:'terminal',text:'종료',x:300,y:420}];
    freeConnections=[{from:'s',to:'i',fromPort:'out',toPort:'in'},{from:'i',to:'o',fromPort:'out',toPort:'in'},{from:'o',to:'e',fromPort:'out',toPort:'in'}];
    renderNlCards();renderFreeCanvas();invalidateFlowchartReview();
    if(!live){window.savedAI=window.callSolarAI;window.callSolarAI=async({messages})=>{window.testMessages=messages;return '[판정: 통과]\n기온을 입력받고 출력하는 순서가 기획과 일치해요.';};}
    await diagnoseFreeAlgorithmWithSolarAI();
   },live);
   assert.equal(await page.evaluate(()=>hasCurrentFlowchartReviewPass()),true);
   const report=await page.locator('#flowchart-ai-audit-content').textContent();assert.ok(!report.includes('처리 블록이 부족'));
   fs.writeFileSync(path.join(output,'io-review.txt'),report);await page.screenshot({path:path.join(output,'io-review.png'),fullPage:true});
   await page.evaluate(()=>closeAiAuditModal());
  });
  await check('reversed output-before-input is rejected despite equal symbol counts',async()=>{
   await page.evaluate(async live=>{
    freeConnections=[{from:'s',to:'o',fromPort:'out',toPort:'in'},{from:'o',to:'i',fromPort:'out',toPort:'in'},{from:'i',to:'e',fromPort:'out',toPort:'in'}];renderFreeCanvas();invalidateFlowchartReview();
    if(!live)window.callSolarAI=async()=> '[판정: 보완 필요]\n기온을 입력받기 전에 출력하고 있어요. 입력과 출력의 연결 순서를 확인해 보세요.';
    await diagnoseFreeAlgorithmWithSolarAI();
   },live);
   assert.equal(await page.evaluate(()=>hasCurrentFlowchartReviewPass()),false);
   fs.writeFileSync(path.join(output,'reversed-review.txt'),await page.locator('#flowchart-ai-audit-content').textContent());
   await page.evaluate(()=>closeAiAuditModal());
  });
  if(!live)await check('variable area grows then scrolls while retaining console space across widths',async()=>{
   await page.evaluate(()=>toggleDebuggerPanel());
   for(const [width,height] of [[1440,900],[1024,650],[768,900],[390,900]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(350);
    const sizes=[];
    for(const count of [0,3,8,30]){
     await page.evaluate(count=>{debuggerExec={vars:Object.fromEntries(Array.from({length:count},(_,i)=>['변수'+String(i+1).padStart(2,'0'),i===count-1?'아주 긴 현재값 '.repeat(6):i])),prevVars:{},lastChanged:null};renderVariableWatcher();logDebugConsole('콘솔 확인');},count);
     const box=await page.locator('#variable-watcher-panel').boundingBox();sizes.push(box.height);
     const consoleBox=await page.locator('#execution-console-panel').boundingBox();assert.ok(consoleBox.height>=139,JSON.stringify({width,height,consoleBox}));
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     if(count===30){await page.locator('#variable-watcher-scroll').scrollIntoViewIfNeeded();await page.locator('#variable-watcher-scroll').focus();await page.keyboard.press('End');await page.waitForTimeout(150);
      assert.ok(await page.locator('#variable-watcher-scroll').evaluate(e=>e.scrollTop>0));
      const last=await page.locator('#var-watcher-tbody tr').last().boundingBox(),scroll=await page.locator('#variable-watcher-scroll').boundingBox();assert.ok(last.y<scroll.y+scroll.height);
     }
    }
    assert.ok(sizes[2]>sizes[0]+10,JSON.stringify({width,height,sizes}));
    if(width===1440||width===390)await page.screenshot({path:path.join(output,`variables-${width}.png`),fullPage:true});
   }
  });
  if(live)await check('local password rejects wrong input, survives reload and teacher navigation, then signs out',async()=>{
   await page.evaluate(()=>switchUnit('roadmap'));await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-temporary').click();
   await page.locator('#teacher-login-password').fill('wrong-password');await page.locator('#teacher-temporary-form button').click();await page.waitForFunction(()=>document.getElementById('teacher-login-feedback').textContent.includes('비밀번호를 확인'));
   const password=fs.readFileSync(path.join(__dirname,'../.env.preview.local'),'utf8').match(/^LOCAL_TEACHER_PASSWORD=(.+)$/m)[1].trim();
   await page.locator('#teacher-login-password').fill(password);await page.locator('#teacher-temporary-form button').click();await page.waitForFunction(()=>isTeacherAuthenticated);
   await page.reload({waitUntil:'networkidle'});await page.locator('#nav-btn-eval').click();await page.waitForFunction(()=>isTeacherAuthenticated);assert.ok(await page.locator('#view-classroom').isVisible());
   await page.evaluate(()=>authService.signOut());assert.equal(await page.evaluate(()=>localPreview.existingTeacher()),null);
  });
 }finally{await browser.close();const report={at:new Date().toISOString(),live,results,errors,consoleErrors};fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(r=>!r.pass)||errors.length||consoleErrors.length)process.exitCode=1;}
})();
