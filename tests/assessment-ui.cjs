// Local UI regressions: no production authentication, database writes or AI calls.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(__dirname, 'results');
(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/js/data/firebase-config.js') { res.setHeader('Content-Type','application/javascript'); return res.end('window.firebaseDb=null;function initFirebaseApp(){return null;}'); }
    if (!/^\/(?:index\.html|(?:js|css)\/[\w/.-]+)$/.test(url.pathname) || url.pathname.endsWith('/config.js')) { res.writeHead(404); return res.end(); }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, body) => { if(error) {res.writeHead(404);return res.end();} res.setHeader('Content-Type', file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'); res.end(body); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser; const results=[], errors=[], consoleErrors=[];
  try {
    browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {if(msg.type()==='error')consoleErrors.push(msg.text());});
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?demo=1`, {waitUntil:'networkidle'});
    async function check(name, task) {try {await task(); results.push({name,pass:true});} catch(error) {results.push({name,pass:false,error:error.message});}}
    const teacher=await page.context().newPage();teacher.on('dialog',d=>d.accept());teacher.on('pageerror',e=>errors.push(e.message));
    const url=page.url();await teacher.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(()=>{nlCards=[{id:'practice-card',type:'seq',text:'실습 전용 초안'}];freeBlocks=[{id:'practice-start',shape:'terminal',text:'시작',x:80,y:40}];freeConnections=[];savePracticeDraft();});
    const practiceBefore=await page.evaluate(()=>sessionStorage.getItem('ALGO_PRACTICE_DRAFT_V1'));
    await teacher.evaluate(()=>evalService.prepareSession('2-1'));
    await page.evaluate(async()=>{switchUnit('eval');document.getElementById('eval-st-name').value='평가 검증';await studentEvalApp.enterWaitingRoom();});
    await teacher.evaluate(()=>evalService.startSession('2-1'));
    await page.waitForFunction(()=>studentEvalApp.sessionStatus==='in_progress');
    await check('new questions have neutral titles and changed short-answer tasks',async()=>{
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.questionVersion),2);
      const options=await page.locator('#eval-part1-list label').allTextContents();assert.ok(options.every(t=>!/[A-Za-z]/.test(t)));
      assert.ok(!(await page.locator('#eval-part2-list').textContent()).includes('변하는 데이터'));
      assert.ok((await page.locator('#eval-part2-list').textContent()).includes('선풍기'));
      assert.ok((await page.locator('#eval-part2-list').textContent()).includes('컵이 3개'));
      assert.equal(await page.locator('#eval-part1-list > div').first().locator('span').first().textContent(),'1번 문제');
    });
    await check('unanswered parts can be skipped at the bottom but manual submission requires a Part 3 visit',async()=>{
      assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),true);
      await page.evaluate(()=>studentEvalApp.submitExam(false));assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitted),false);
      await page.locator('#eval-part1-container .eval-part-footer button').click();
      assert.equal(await page.evaluate(()=>studentEvalApp.currentPart),'part2');
      await page.locator('#p2_q5_v2_input').fill('켜기');
      await page.locator('#eval-part2-container .eval-part-footer').getByRole('button',{name:'이전: 객관식'}).click();
      await page.locator('#eval-part1-list input').first().check();
      assert.ok((await page.locator('#eval-part1-container .eval-part-footer').textContent()).includes('1문항 응답'));
      await page.locator('#eval-part1-container .eval-part-footer button').click();
      assert.equal(await page.locator('#p2_q5_v2_input').inputValue(),'켜기');
      await page.locator('#eval-part2-container .eval-part-footer').getByRole('button',{name:'다음: 순서도'}).click();
      assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),false);
    });
    await check('assessment reuses the studio, has blank structured guidance and blocks practice help',async()=>{
      assert.equal(await page.locator('#eval-shared-workspace #fc-level3-view').count(),1);
      assert.equal(await page.locator('#lab-flowchart-content #fc-level3-view').count(),0);
      assert.equal(await page.locator('#btn-free-ai-diagnose').isVisible(),false);
      assert.equal(await page.locator('[onclick="openPrescriptionModal()"]').isVisible(),false);
      assert.equal(await page.locator('#nl-cards-container textarea').count(),0);
      assert.equal(await page.locator('#eval-plan-current').inputValue(),'');
      assert.equal(await page.locator('.palette-entry-block').count(),4);
      await page.evaluate(()=>{window.helpCalls=0;window.savedSolar=callSolarAI;callSolarAI=()=>{window.helpCalls++;return Promise.resolve('unused');};openPrescriptionModal();requestSolarPrescription();diagnoseFreeAlgorithmWithSolarAI();initLevel2Walkthrough();callSolarAI=window.savedSolar;});
      assert.equal(await page.evaluate(()=>window.helpCalls),0);
      await page.locator('#eval-plan-current').fill('기온에 맞춘 환기가 필요하다');
      await page.locator('#eval-plan-goal').fill('기온에 맞는 창문 상태');
      for(const type of ['seq','sel','loop'])await page.locator(`#fc-level3-view button[onclick="addNlCard('${type}')"]`).click();
      await page.getByPlaceholder('어떤 행동을 하나요?',{exact:true}).fill('기온 입력');
      await page.getByPlaceholder('어떤 조건을 확인하나요?',{exact:true}).fill('기온이 28℃ 초과인가?');
      await page.getByPlaceholder('맞으면 어떤 행동을 하나요?',{exact:true}).fill('창문 열기');
      await page.getByPlaceholder('아니면 어떤 행동을 하나요?',{exact:true}).fill('창문 닫기');
      await page.getByPlaceholder('어떤 조건인 동안 반복하나요?',{exact:true}).fill('원하는 조건');
      await page.getByPlaceholder('무엇을 반복하나요?',{exact:true}).fill('내가 정한 행동');
      await page.getByRole('button',{name:'3단계 위로',exact:true}).click();
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.plan.steps[1].type),'loop');
      await page.getByRole('button',{name:'2단계 아래로',exact:true}).click();
      await page.locator('.palette-block-io').dragTo(page.locator('#free-flowchart-canvas'),{targetPosition:{x:220,y:220}});
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.blocks.at(-1).shape),'io');
      const id=await page.evaluate(()=>studentEvalApp.answers.part3.blocks.at(-1).id);
      await page.locator('#free-blk-'+id+' .block-text-label').fill('<img src=x onerror=window.xss=1>');
      await page.locator('#eval-plan-goal').click();
      await page.evaluate(()=>renderFreeCanvas());assert.equal(await page.locator('#free-flowchart-stage img').count(),0);
      assert.equal(await page.evaluate(()=>window.xss),undefined);
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('ALGO_PRACTICE_DRAFT_V1')),practiceBefore);
    });
    await check('structured answers, editor and visit permission survive reload and appear for teacher',async()=>{
      await page.waitForTimeout(650);
      await teacher.evaluate(()=>{window.students=[];evalService.listenStudents('2-1',list=>window.students=list);});
      await teacher.waitForFunction(()=>window.students[0]?.answers?.part3?.plan?.steps?.length===3);
      await teacher.evaluate(()=>{currentLiveStudents=window.students;openLiveStudentModal(1);});
      assert.ok((await teacher.locator('#classroom-live-modal-p3').textContent()).includes('[선택] 조건: 기온이 28℃ 초과인가?'));
      assert.ok((await teacher.locator('#classroom-live-modal-p3').textContent()).includes('맞으면: 창문 열기'));
      assert.ok((await teacher.locator('#classroom-live-modal-p3').textContent()).includes('[반복]'));
      await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>assessmentWorkspace.active);
      assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),false);
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.plan.steps[1].yesAction),'창문 열기');
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('ALGO_PRACTICE_DRAFT_V1')),practiceBefore);
      await page.locator('#eval-tab-btn-part1').click();assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),false);
      await page.locator('#eval-tab-btn-part3').click();
    });
    await check('execution facts stay in the shared panel without answer generation and stop on edits',async()=>{
      await page.evaluate(()=>{assessmentWorkspace.leave();studentEvalApp.answers.part3.blocks=[['s','terminal','시작'],['i','io','기온 입력'],['d','decision','기온 > 28'],['y','process','창문 열기'],['n','process','창문 닫기'],['e','terminal','종료']].map(([id,shape,text],i)=>({id,shape,text,x:170,y:40+i*85}));studentEvalApp.answers.part3.connections=[['s','i','out'],['i','d','out'],['d','y','yes'],['d','n','no'],['y','e','out'],['n','e','out']].map(([from,to,fromPort])=>({from,to,fromPort,toPort:'in'}));assessmentWorkspace.enter(studentEvalApp);});
      await page.locator('#btn-floating-sim-step').click();
      assert.ok((await page.locator('#execution-summary').textContent()).includes('기온 27'));
      await page.locator('#btn-floating-sim-run').click();
      await page.waitForTimeout(400);await page.evaluate(()=>handleBlockTextChange('d','기온 >= 28'));
      assert.equal(await page.evaluate(()=>assessmentWorkspace.timer),null);
      await page.evaluate(()=>{for(let i=0;i<30;i++)assessmentWorkspace.run(true);});
      assert.ok((await page.locator('#debug-terminal-console').textContent()).includes('예상'));
      await page.evaluate(()=>{freeConnections=[];renderFreeCanvas();assessmentWorkspace.capture();assessmentWorkspace.run(true);});
      assert.ok(await page.locator('#free-flowchart-stage .execution-issue').count()>0);
      assert.equal(await page.locator('#execution-panel-content').isVisible(),false);
    });
    await check('assessment editor actions remain reachable at classroom and narrow widths',async()=>{
      for(const width of [1920,1440,1024,768,390]) {
        await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);
        for(const selector of ['#btn-floating-sim-run','#btn-floating-sim-step','#fc-level3-view button[onclick="autoAlignCanvas()"]','.execution-panel-rail'])await page.locator(selector).click({trial:true});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),width+' overflow');
        if(width<=900)assert.ok(await page.evaluate(()=>{
          const frame=document.querySelector('#eval-shared-workspace .entry-studio-container'),bounds=frame.getBoundingClientRect();
          return [...frame.children].every(panel=>{const r=panel.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom+1;})&&frame.scrollHeight<=frame.clientHeight+2;
        }),width+' panels must be visible in the page, not clipped inside the studio');
        if(width===1440||width===390){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'assessment-shared-'+width+'.png'),fullPage:true});}
      }
      await page.setViewportSize({width:1440,height:900});
    });
    await check('failed submission preserves shared draft; retry succeeds and practice data is restored',async()=>{
      await page.evaluate(async()=>{window.realSubmit=evalService.submitStudentExam;evalService.submitStudentExam=async()=>{throw Error('test offline');};await studentEvalApp.submitExam(false);});
      assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitted),false);assert.equal(await page.evaluate(()=>assessmentWorkspace.readOnly),false);
      assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),false);
      await page.evaluate(async()=>{evalService.submitStudentExam=window.realSubmit;await studentEvalApp.submitExam(false);});
      assert.equal(await page.evaluate(()=>studentEvalApp.isSubmitted),true);assert.equal(await page.evaluate(()=>assessmentWorkspace.active),false);
      assert.equal(await page.evaluate(()=>nlCards[0].text),'실습 전용 초안');
      await page.evaluate(()=>{studentEvalApp.exitExam();switchUnit('unit3','lab');switchFlowchartStep(5);});
      assert.equal(await page.locator('#btn-free-ai-diagnose').isVisible(),true);
    });
    await check('teacher reset clears Part 3 visit and cards while keeping the question version',async()=>{
      await teacher.evaluate(()=>evalService.resetStudentExam('2-1',1));
      await page.waitForFunction(()=>!studentEvalApp.isSubmitted&&studentEvalApp.currentPart==='part1');
      assert.equal(await page.evaluate(()=>!!studentEvalApp.visitedPart3),false);
      assert.equal(await page.locator('[data-eval-submit]').first().isDisabled(),true);
      await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>studentEvalApp.sessionStatus==='in_progress');
      assert.equal(await page.evaluate(()=>studentEvalApp.currentPart),'part1');
      assert.equal(await page.evaluate(()=>studentEvalApp.answers.part3.questionVersion),2);
      assert.equal(await page.evaluate(()=>studentEvalApp.getAssessmentPlan().steps.length),0);
    });
    await check('time expiry submits even without visiting Part 3',async()=>{
      await teacher.evaluate(async()=>{await evalService.endSession('2-1');await evalService.prepareSession('2-1');});
      const fresh=await page.context().newPage();fresh.on('dialog',d=>d.accept());fresh.on('pageerror',e=>errors.push(e.message));await fresh.goto(url,{waitUntil:'networkidle'});
      await fresh.evaluate(async()=>{switchUnit('eval');document.getElementById('eval-st-num').value=2;document.getElementById('eval-st-name').value='시간 검증';await studentEvalApp.enterWaitingRoom();});
      await teacher.evaluate(()=>evalService.startSession('2-1'));await fresh.waitForFunction(()=>studentEvalApp.sessionStatus==='in_progress');
      await fresh.evaluate(()=>studentEvalApp.deadlineMs=Date.now()-1);
      await fresh.waitForFunction(()=>studentEvalApp.isSubmitted);assert.equal(await fresh.evaluate(()=>!!studentEvalApp.visitedPart3),false);await fresh.close();
    });
  } finally {
    fs.writeFileSync(path.join(output,'assessment-ui.json'),JSON.stringify({results,errors,consoleErrors},null,2));
    if(browser)await browser.close();server.close();
    console.log(JSON.stringify({results,errors,consoleErrors},null,2));
    if(results.some(r=>!r.pass)||errors.length||consoleErrors.length)process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
