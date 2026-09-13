// Run tools/preview.cjs first. Local mocks only; never signs into production.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[],consoleErrors=[];
 const output=path.join(__dirname,'results');fs.mkdirSync(output,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 page.setDefaultTimeout(5000);
 async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
 try{
  await page.goto('http://127.0.0.1:4173/index.html?demo=1',{waitUntil:'networkidle'});
  await check('robot tab peeks, slides with hover and focus, and stays in viewport at varying widths',async()=>{
   for(const width of [1440,1350,1024,901,900,768,430,390,320]){
    await page.setViewportSize({width,height:900});await page.mouse.move(1,1);await page.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(300);
    const edge=await page.locator('#tutor-chat-container').evaluate(e=>e.getBoundingClientRect().right);
    const peek=await page.locator('#tutor-fab-btn').boundingBox();assert.ok(Math.abs(edge-peek.x-48)<2,JSON.stringify({width,peek}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.mouse.move(edge-24,peek.y+24);await page.waitForTimeout(300);
    const open=await page.locator('#tutor-fab-btn').boundingBox();assert.ok(Math.abs(open.x+open.width-edge)<2);
    await page.mouse.move(1,1);await page.locator('#tutor-fab-btn').focus();await page.waitForTimeout(300);
    const focused=await page.locator('#tutor-fab-btn').boundingBox();assert.ok(Math.abs(focused.x+focused.width-edge)<2);
   }
   await page.keyboard.press('Enter');assert.equal(await page.locator('#tutor-fab-btn').getAttribute('aria-expanded'),'true');
   assert.ok(await page.locator('#tutor-input').evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Escape');assert.equal(await page.locator('#tutor-fab-btn').getAttribute('aria-expanded'),'false');
   await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.locator('#tutor-fab-btn').evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration)<.001));await page.emulateMedia({reducedMotion:'no-preference'});
  });
  await check('bottom trash stays accessible beside collapsed tutor in practice',async()=>{
   for(const width of [1440,1024,900,768,390]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);document.activeElement.blur();});await page.mouse.move(1,1);await page.waitForTimeout(350);
    await page.locator('#entry-trash-zone').scrollIntoViewIfNeeded();
    const trash=await page.locator('#entry-trash-zone').boundingBox(),fab=await page.locator('#tutor-fab-btn').boundingBox();
    assert.equal(await page.locator('#entry-trash-zone').evaluate(e=>getComputedStyle(e).bottom),'14px');
    assert.ok(!(Math.min(trash.x+trash.width,width)-Math.max(trash.x,fab.x)>0&&Math.min(trash.y+trash.height,fab.y+fab.height)-Math.max(trash.y,fab.y)>0),'trash overlaps tutor at '+width);
    const hit=await page.locator('#entry-trash-zone').evaluate(e=>{const r=e.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {ok:e.contains(target),target:target?.outerHTML?.slice(0,150),x:r.x,y:r.y};});
    assert.ok(hit.ok,JSON.stringify({width,hit}));
    if(width===1440||width===390)await page.screenshot({path:path.join(output,`tutor-workspace-${width}.png`),fullPage:true});
   }
  });
  await check('teacher entry offers a choice; cancellation and incorrect password preserve safe state',async()=>{
   await page.evaluate(()=>switchUnit('roadmap'));await page.locator('#nav-btn-classroom').click();
   assert.ok(await page.locator('#teacher-login-dialog').evaluate(e=>e.open));
   assert.equal(await page.evaluate(()=>isTeacherAuthenticated),false);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#teacher-login-dialog').evaluate(e=>e.open),false);
   assert.equal(await page.evaluate(()=>currentActiveUnit),'roadmap');assert.ok(await page.locator('#view-roadmap').isVisible());
   await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-temporary').click();
   await page.evaluate(()=>{window.savedTeacher=authService.teacher;authService.teacher=async()=>{throw {code:'auth/wrong-password',message:'RAW_ERROR'};};});
   await page.locator('#teacher-login-password').fill('wrong');await page.locator('#teacher-temporary-form button').click();
   assert.match(await page.locator('#teacher-login-feedback').textContent(),/비밀번호/);assert.equal(await page.locator('#teacher-login-password').inputValue(),'');assert.equal(await page.evaluate(()=>isTeacherAuthenticated),false);
   await page.screenshot({path:path.join(output,'teacher-login-390.png'),fullPage:true});
   await page.evaluate(()=>authService.teacher=savedTeacher);
  });
  await check('temporary login and Google choice both reach classroom; teacher eval routes to classroom',async()=>{
   await page.locator('#teacher-login-password').fill('demo-only');await page.locator('#teacher-temporary-form button').click();await page.waitForFunction(()=>isTeacherAuthenticated);
   await page.locator('#nav-btn-eval').click();assert.ok(await page.locator('#view-classroom').isVisible());assert.equal(await page.locator('#view-eval').isVisible(),false);
   await page.evaluate(async()=>{await authService.signOut();switchUnit('roadmap');});await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-google').click();await page.waitForFunction(()=>isTeacherAuthenticated);
   await page.locator('#nav-btn-eval').click();assert.ok(await page.locator('#view-classroom').isVisible());
   await page.evaluate(async()=>{await authService.signOut();switchUnit('roadmap');});await page.locator('#nav-btn-eval').click();assert.ok(await page.locator('#view-eval').isVisible());
  });
  await check('pending login can be dismissed and late completion does not change the chosen page',async()=>{
   await page.evaluate(()=>switchUnit('roadmap'));await page.locator('#nav-btn-classroom').click();
   await page.evaluate(()=>{window.savedLogin=authService.teacher;window.savedSignOut=authService.signOut;window.cancelledLoginCleared=false;authService.signOut=async()=>{cancelledLoginCleared=true;await savedSignOut.call(authService);};authService.teacher=()=>new Promise(r=>window.resolveLogin=r);});
   await page.locator('#teacher-login-google').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#teacher-login-dialog').evaluate(e=>e.open),false);
   await page.evaluate(()=>{switchUnit('unit1','concept');resolveLogin({uid:'late'});});
   await page.waitForFunction(()=>!teacherLoginPending);assert.ok(await page.locator('#view-concept').isVisible());assert.equal(await page.evaluate(()=>isTeacherAuthenticated),false);
   assert.equal(await page.evaluate(()=>cancelledLoginCleared),true);
   await page.evaluate(()=>{authService.teacher=savedLogin;authService.signOut=savedSignOut;});
  });
  await check('restored teacher is detected on eval entry and slow role lookup cannot hijack a later navigation',async()=>{
   await page.evaluate(()=>{window.savedExisting=authService.existingTeacher;window.savedDemo=authService.isDemo;authService.isDemo=()=>false;authService.existingTeacher=async()=>({uid:'restored'});});
   await page.locator('#nav-btn-eval').click();await page.waitForFunction(()=>isTeacherAuthenticated);assert.ok(await page.locator('#view-classroom').isVisible());
   await page.evaluate(()=>{authService.isDemo=savedDemo;isTeacherAuthenticated=false;switchUnit('roadmap');authService.isDemo=()=>false;authService.existingTeacher=()=>new Promise(r=>window.resolveRole=r);switchUnit('eval');switchUnit('unit1','concept');resolveRole({uid:'restored'});});
   await page.waitForTimeout(50);assert.ok(await page.locator('#view-concept').isVisible());
   await page.evaluate(()=>{authService.isDemo=savedDemo;authService.existingTeacher=savedExisting;});
  });
 }finally{
  await browser.close();const report={at:new Date().toISOString(),results,errors,consoleErrors};fs.writeFileSync(path.join(output,'tutor-login-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(r=>!r.pass)||errors.length||consoleErrors.length)process.exitCode=1;
 }
})();
