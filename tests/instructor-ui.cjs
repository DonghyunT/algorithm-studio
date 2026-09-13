// Scoped instructor UI; --production uses the requested real instructor login, no classroom writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const production=process.argv.includes('--production');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());page.setDefaultTimeout(15000);
 const output=path.join(__dirname,'results',production?'instructor-production':'instructor-ui');fs.mkdirSync(output,{recursive:true});
 try{
  await page.goto(production?'https://algorithm-studio-ten.vercel.app/':'http://127.0.0.1:4173/index.html?demo=1',{waitUntil:'networkidle'});
  if(production){
   assert.equal(await page.evaluate(()=>!!window.LOCAL_PREVIEW_CONFIG||!!window.localPreview||authService.isDemo()),false);
   const password=fs.readFileSync(path.join(__dirname,'../.env.instructor.local'),'utf8').match(/^INSTRUCTOR_PASSWORD=(.+)$/m)[1].trim();
   await page.locator('#nav-btn-classroom').click();await page.locator('#teacher-login-temporary').click();await page.locator('#teacher-login-password').fill(password);
   await page.locator('#teacher-temporary-form button[type="submit"]').click();
  }else{
   await page.evaluate(async()=>{authService.teacherRole={enabled:true,classIds:['2-10','2-11']};isTeacherAuthenticated=true;await switchUnit('classroom');});
  }
  await page.locator('#view-classroom').waitFor({state:'visible'});
  assert.deepEqual(await page.locator('#classroom-class-select option').allTextContents(),['2학년 10반','2학년 11반']);
  assert.equal(await page.locator('#classroom-class-select').inputValue(),'2학년 10반');
  results.push('instructor sees only 10 and 11; starts in 10');
  await page.locator('#classroom-class-select').selectOption('2학년 11반');
  await page.evaluate(()=>switchClassroomClass('2학년 1반'));
  assert.equal(await page.evaluate(()=>currentSelectedClass),'2학년 11반');results.push('invalid class switch rejected');
  for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#classroom-class-select').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'classroom-'+width+'.png'),fullPage:true});}
  results.push('teacher controls fit four window widths');
  if(production){
   await page.reload({waitUntil:'networkidle'});await page.locator('#nav-btn-eval').click();await page.locator('#view-classroom').waitFor({state:'visible'});
   assert.equal(await page.locator('#classroom-class-select option').count(),2);results.push('restored instructor eval entry routes to scoped classroom');
   await page.evaluate(async()=>{await authService.signOut();exitClassroomView();});
  }else{
   await page.evaluate(()=>{authService.teacherRole={enabled:true,allClasses:true};renderClassroomDashboard();});assert.equal(await page.locator('#classroom-class-select option').count(),11);results.push('owner sees all 11 classes');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({at:new Date().toISOString(),production,results,errors},null,2));console.log(JSON.stringify({production,passed:results.length,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
