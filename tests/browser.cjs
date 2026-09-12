const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'), output=path.join(__dirname,'results');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/js/data/firebase-config.js') {res.setHeader('Content-Type','application/javascript');return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}');}
    if(pathname==='/api/chat') {res.writeHead(503);return res.end('{}');}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||file.includes('.env')||file.endsWith('/config.js')) {res.writeHead(403);return res.end();}
    fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const results=[],errors=[],consoleErrors=[];
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='127.0.0.1' && /firebase|googleapis|upstage/.test(url.hostname+url.pathname)) return route.fulfill({status:200,body:''});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('dialog',d=>d.accept());
    const url='http://127.0.0.1:'+server.address().port+'/?demo=1';
    await page.goto(url,{waitUntil:'networkidle'});
    async function check(name,task) {try{await task();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
    await check('reading pages have centered margins on wide screens',async()=>{
      await page.setViewportSize({width:1920,height:1000});
      for(const [unit,step,id] of [['roadmap',null,'view-roadmap'],['unit1','concept','view-concept'],['unit1','quiz','view-quiz']]){
        await page.evaluate(({unit,step})=>switchUnit(unit,step),{unit,step});
        const box=await page.locator('#'+id).boundingBox();assert.ok(box.width<=1201);assert.ok(box.x>250);
        await page.waitForTimeout(500);await page.screenshot({path:path.join(output,id+'.png')});
      }
      await page.setViewportSize({width:1440,height:900});
    });
    await check('navigation has one visible main view',async()=>{
      for(const target of ['unit1','eval','unit3','classroom','unit2','roadmap']) {
        await page.evaluate(target=>{isTeacherAuthenticated=true;switchUnit(target,'lab');},target);
        const visible=await page.evaluate(()=>['view-roadmap','view-concept','view-quiz','view-lab','view-eval','view-classroom'].filter(id=>{const e=document.getElementById(id);return e&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=='none';}));
        assert.equal(visible.length,1, target+': '+visible);
      }
    });
    await check('practice parser and no fabricated branch',async()=>{
      const result=await page.evaluate(()=>{
        switchUnit('unit3','lab');switchFlowchartStep(5);
        return {names:['나이 입력','합계 입력','기온 입력','점수를 입력받는다'].map(parseIoInputVarName),output:parseIoOutputExpr('나이 출력'),path:generateManhattanPath(10,10,'out',12,100,'in')};
      });
      assert.deepEqual(result.names,['나이','합계','기온','점수']);assert.equal(result.output,'나이');assert.ok(!result.path.includes(' L '));
    });
    await check('practice submission allowed and review invalidates after edit',async()=>{
      const state=await page.evaluate(()=>{
        window.isFlowchartAiPassed=true;addNlCard('seq');updateNlCardText(nlCards[0].id,'새로운 동작');updateThinkerToolbarButton();
        return {passed:window.isFlowchartAiPassed,disabled:document.getElementById('btn-toolbar-thinker-submit').disabled};
      });assert.equal(state.passed,false);assert.equal(state.disabled,false);
    });
    await check('student name markup is inert in teacher grid',async()=>{
      await page.evaluate(()=>renderLiveGrid([{num:1,name:'<img src=x onerror="window.xss=1">',status:'waiting'}]));
      assert.equal(await page.evaluate(()=>window.xss),undefined);
      assert.equal(await page.locator('#classroom-live-grid img').count(),0);
    });
    await check('AI outage leaves review unpassed and current submission available',async()=>{
      const result=await page.evaluate(async()=>{
        window.savedAI=callSolarAI;window.callSolarAI=async()=>{throw Error('test outage');};
        window.isFlowchartAiPassed=true;await diagnoseFreeAlgorithmWithSolarAI();window.callSolarAI=window.savedAI;
        return {passed:window.isFlowchartAiPassed,text:document.getElementById('flowchart-ai-audit-content').textContent,submit:document.getElementById('flowchart-ai-audit-actions').textContent};
      });
      assert.equal(result.passed,false);assert.ok(result.text.includes('연결'));assert.ok(result.submit.includes('현재 상태로 제출'));
      await page.evaluate(()=>closeAiAuditModal());
    });
    await check('practice missing false branch stops and constant comparison runs',async()=>{
      const result=await page.evaluate(()=>{
        freeBlocks=[{id:'s',shape:'terminal',text:'시작',x:10,y:10},{id:'d',shape:'decision',text:'1 > 2',x:10,y:150},{id:'e',shape:'terminal',text:'종료',x:10,y:300}];
        freeConnections=[{from:'s',to:'d',fromPort:'out'},{from:'d',to:'e',fromPort:'yes'}];renderFreeCanvas();resetDebugger();stepDebugger();stepDebugger();
        return {waiting:debuggerExec?.isWaitingUserChoice,passed:window.isFlowchartSimValidated,logs:document.getElementById('debug-console')?.textContent||''};
      });assert.ok(!result.waiting);assert.equal(result.passed,false);
    });
    await check('sandwich reset cancels queued work and fallback preserves order',async()=>{
      const actions=await page.evaluate(()=>{switchUnit('unit2','lab');scheduleSandwich(()=>{state.bagOpened=true;},50);resetWorkspace();return fallbackRuleParser('잼 뚜껑 열기 그리고 빵 봉지 열기').actions;});
      assert.deepEqual(actions,['OPEN_JAM','OPEN_BAG']);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>state.bagOpened),false);
    });
    await check('practice and quiz drafts survive refresh',async()=>{
      await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);nlCards=[{id:'draft-1',type:'seq',text:'내가 쓴 기획'}];userQuizAnswers.flowchart.q1=2;document.getElementById('inp-current').value='나의 문제';});
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.evaluate(()=>nlCards[0].text),'내가 쓴 기획');
      assert.equal(await page.evaluate(()=>userQuizAnswers.flowchart.q1),2);
      assert.equal(await page.locator('#inp-current').inputValue(),'나의 문제');
    });
    const teacher=await context.newPage();teacher.on('dialog',d=>d.accept());teacher.on('pageerror',e=>errors.push(e.message));
    await teacher.goto(url,{waitUntil:'networkidle'});
    await teacher.evaluate(()=>{window.roster=[];evalService.listenStudents('2-1',list=>window.roster=list);});
    await check('two tabs join and receive start',async()=>{
      await page.evaluate(async()=>{switchUnit('eval');document.getElementById('eval-st-name').value='검증학생';await studentEvalApp.enterWaitingRoom();});
      await teacher.waitForFunction(()=>window.roster.length===1);
      await teacher.evaluate(()=>evalService.startSession('2-1'));
      await page.waitForFunction(()=>studentEvalApp.sessionStatus==='in_progress');
    });
    await check('active exam locks header, direct navigation and teacher page',async()=>{
      assert.equal(await page.locator('#nav-btn-unit1').isDisabled(),true);
      assert.equal(await page.locator('#nav-btn-classroom').isDisabled(),true);
      await page.evaluate(()=>{switchUnit('roadmap');switchUnitStep('unit1','quiz');activateLabContent('sandwich');showClassroomView();openMegaMenu();studentEvalApp.exitExam();});
      assert.equal(await page.locator('#view-eval').isVisible(),true);
      assert.equal(await page.locator('#view-classroom').isVisible(),false);
      assert.equal(await page.evaluate(()=>isMegaMenuOpen),false);
    });
    await check('assessment plans are student-written, reorderable and persisted with answers',async()=>{
      await page.evaluate(()=>studentEvalApp.switchPart('part3'));
      assert.equal(await page.locator('#eval-tab-btn-part3').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('#eval-plan-steps textarea').count(),0);
      assert.equal(await page.locator('#eval-part3-recipe-list').count(),0);
      await page.locator('#eval-plan-current').fill('현재 기온을 아직 모른다');
      await page.locator('#eval-plan-goal').fill('기온에 맞는 창문 상태');
      await page.getByRole('button',{name:'+ 단계 추가',exact:true}).click();
      await page.locator('#eval-plan-steps textarea').fill('기온을 확인한다');
      await page.getByRole('button',{name:'+ 단계 추가',exact:true}).click();
      await page.locator('#eval-plan-steps textarea').nth(1).fill('조건에 맞는 동작을 정한다');
      await page.getByRole('button',{name:'2단계 위로',exact:true}).click();
      assert.equal(await page.locator('#eval-plan-steps textarea').first().inputValue(),'조건에 맞는 동작을 정한다');
      await page.getByRole('button',{name:'1단계 아래로',exact:true}).click();
      await teacher.waitForFunction(()=>window.roster[0]?.answers?.part3?.plan?.steps?.[0]?.text==='기온을 확인한다');
      await teacher.evaluate(()=>{currentLiveStudents=window.roster;openLiveStudentModal(1);});
      assert.ok((await teacher.locator('#classroom-live-modal-p3').textContent()).includes('기온을 확인한다'));
      await page.evaluate(()=>{const saved=window.confirm;window.confirm=()=>false;studentEvalApp.selectPart3Theme('theme_vending');window.confirm=saved;});
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.selectedThemeId),'theme_greenhouse');
    });
    await check('refresh restores answers and same-theme graph',async()=>{
      await page.evaluate(()=>{studentEvalApp.onSelectPart1('q1',2);studentEvalApp.onInputPart2('q11','"><img src=x onerror=window.xss=2>');studentEvalApp.addPart3Block('process');studentEvalApp.handlePart3BlockText('eblk_1','학생 작업');});
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>studentEvalApp.sessionStatus==='in_progress');
      assert.equal(await page.locator('#eval-screen-exam').isVisible(),true);
      const state=await page.evaluate(()=>({answer:studentEvalApp.answers.part1.q1,text:studentEvalApp.answers.part3.blocks.find(b=>b.id==='eblk_1')?.text,xss:window.xss}));
      assert.equal(state.answer,2);assert.equal(state.text,'학생 작업');assert.equal(state.xss,undefined);
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.plan.goal),'기온에 맞는 창문 상태');
      assert.equal(await page.locator('#nav-btn-roadmap').isDisabled(),true);
    });
    await check('save failure retains draft and allows retry',async()=>{
      await page.evaluate(async()=>{window.realSubmit=evalService.submitStudentExam;evalService.submitStudentExam=async()=>{throw Error('test offline');};await studentEvalApp.submitExam(true);});
      assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitted),false);
      assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitting),false);
      assert.equal(await page.locator('#nav-btn-unit1').isDisabled(),true);
      await page.evaluate(()=>{evalService.submitStudentExam=window.realSubmit;});
    });
    await check('assessment malformed flow highlights blocked position only',async()=>{
      await page.bringToFront();
      await page.evaluate(()=>{studentEvalApp.switchPart('part3');studentEvalApp.verifyPart3Flowchart();});
      assert.ok(await page.locator('#eval-part3-stage .execution-issue').count()>0);
      assert.equal(await page.evaluate(()=>studentEvalApp.calculateScores().scores.part3),0);
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#eval-tab-btn-part3').getAttribute('aria-selected'),'true');
      await page.waitForFunction(()=>getComputedStyle(document.getElementById('eval-tab-btn-part3')).backgroundColor==='rgb(79, 70, 229)');
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:path.join(output,'assessment.png'),fullPage:true});
    });
    await check('assessment palette stays inside panel and scrolled blocks drag without jumping',async()=>{
      for(const width of [1440,1024,768]){
        await page.setViewportSize({width,height:900});
        const toolbar=await page.locator('.eval-symbol-toolbar').boundingBox();
        for(const button of await page.locator('.eval-symbol-toolbar button').all()){
          const box=await button.boundingBox();assert.ok(box.x>=toolbar.x&&box.x+box.width<=toolbar.x+toolbar.width+1);
        }
      }
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(()=>{studentEvalApp.addPart3Block('process');studentEvalApp.addPart3Block('process');});
      const block=page.locator('#eval-blk-eblk_3');await block.scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#eval-part3-canvas').evaluate(el=>el.scrollTop)>0);
      const submit=page.locator('#eval-screen-exam button[onclick*="submitExam"]');
      await submit.click({trial:true});
      const before=await page.evaluate(()=>({...studentEvalApp.answers.part3.blocks.find(b=>b.id==='eblk_3')}));
      const box=await block.boundingBox();
      await page.mouse.move(box.x+35,box.y+15);await page.mouse.down();await page.mouse.move(box.x+75,box.y-15,{steps:5});await page.mouse.up();
      const after=await page.evaluate(()=>studentEvalApp.answers.part3.blocks.find(b=>b.id==='eblk_3'));
      assert.ok(Math.abs(after.x-before.x-40)<2);assert.ok(Math.abs(after.y-before.y+30)<2);
    });
    await check('teacher end submits and submitted rejoin stays submitted',async()=>{
      await teacher.evaluate(()=>evalService.endSession('2-1'));
      await page.waitForFunction(()=>studentEvalApp.isSubmitted);
      assert.equal(await page.evaluate(()=>studentEvalApp.timerInterval),null);
      await page.reload({waitUntil:'networkidle'});
      await page.evaluate(async()=>{switchUnit('eval');document.getElementById('eval-st-name').value='검증학생';await studentEvalApp.enterWaitingRoom();});
      assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitted),true);
      assert.equal(await page.locator('#eval-screen-result').isVisible(),true);
      assert.equal(await page.locator('#nav-btn-unit1').isDisabled(),false);
    });
    await check('studio canvas and toolbar usable across viewports',async()=>{
      for(const width of [1920,1440,1366,1024,768]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);});
        await page.waitForTimeout(150);
        const rect=await page.locator('#free-flowchart-canvas').boundingBox();assert.ok(rect.height>=250,'canvas at '+width+': '+JSON.stringify(rect));
        await page.screenshot({path:path.join(output,'studio-'+width+'.png')});
      }
    });
    assert.equal(errors.length,0,JSON.stringify(errors));
  } finally {
    fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify({results,errors,consoleErrors},null,2));
    console.log(JSON.stringify({results,errors,consoleErrors},null,2));
    await browser?.close();await new Promise(resolve=>server.close(resolve));
  }
  if(results.some(result=>!result.pass))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
