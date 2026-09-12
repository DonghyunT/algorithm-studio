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
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {if(msg.type()==='error')consoleErrors.push(msg.text());});
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?demo=1`, {waitUntil:'networkidle'});
    async function check(name, task) {try {await task(); results.push({name,pass:true});} catch(error) {results.push({name,pass:false,error:error.message});}}
    await check('all five steps keep the same subbar and content origin at each width', async () => {
      for (const width of [1920,1440,1024,768,390]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => switchUnit('unit3','lab'));
        const bounds=[];
        for(const step of [1,2,3,4,5,3]) {
          await page.locator('#fc-step-btn-'+step).click();
          await page.evaluate(()=>window.scrollTo(0,0));
          await page.waitForTimeout(400);
          bounds.push(await page.evaluate(() => {
            const bar=document.querySelector('#lab-flowchart-content > .subbar-island').getBoundingClientRect();
            const content=[...document.querySelectorAll('#lab-flowchart-content > div')].find(e=>e.id.startsWith('fc-level')&&!e.classList.contains('hidden')).getBoundingClientRect();
            return {x:bar.x,y:bar.y,height:bar.height,contentY:content.y};
          }));
        }
        for(const box of bounds)for(const key of ['x','y','height','contentY']) assert.ok(Math.abs(box[key]-bounds[0][key])<2, `${width}px ${key}: ${JSON.stringify(bounds)}`);
      }
    });
    await check('wider plan and both panel toggles retain graph coordinates and usable actions', async () => {
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);});
      const before=await page.evaluate(()=>JSON.stringify(freeBlocks));
      for(const width of [1920,1440,1024,901,768,390]) {
        await page.setViewportSize({width,height:900});
        for(const open of [true,false]) {
          await page.evaluate(open=>{const el=document.querySelector('#fc-level3-view .entry-studio-container');if(el.classList.contains('debugger-collapsed')===open)toggleDebuggerPanel();},open);
          await page.waitForTimeout(100);
          if(width>900) assert.ok((await page.locator('#fc-level3-view .entry-studio-container > section').first().boundingBox()).width>=300);
          for(const selector of ['#btn-floating-sim-run','#btn-floating-sim-step','#btn-toolbar-thinker-submit','#debugger-studio-panel button:visible']) await page.locator(selector).first().click({trial:true});
          const overflow=await page.evaluate(()=>[...document.querySelectorAll('#fc-level3-view *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,8).map(e=>({id:e.id,cls:e.className,right:e.getBoundingClientRect().right})));
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width}px page overflow: ${JSON.stringify(overflow)}`);
        }
      }
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(()=>toggleNlPanel());
      await page.evaluate(()=>toggleNlPanel());
      assert.equal(await page.evaluate(()=>JSON.stringify(freeBlocks)),before);
      await page.evaluate(()=>{freeBlocks.forEach(b=>b.x=240);renderFreeCanvas();});
      await page.screenshot({path:path.join(output,'workspace-polish-collapsed.png')});
      await page.locator('.execution-panel-rail').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#execution-panel-content').isVisible(),true);
      await page.waitForTimeout(400);
      assert.ok((await page.locator('#debugger-studio-panel').boundingBox()).width>=239);
      await page.screenshot({path:path.join(output,'workspace-polish-expanded.png')});
      await page.locator('[aria-label="실행 과정 접기"]').click();
      assert.equal(await page.locator('.execution-panel-rail').evaluate(e=>e===document.activeElement),true);
    });
    await check('native palette drag preserves silhouettes, drop shapes and cleans up on cancel', async () => {
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(()=>{switchUnit('unit3','lab');switchFlowchartStep(5);freeBlocks=[{id:'s',shape:'terminal',text:'시작',x:30,y:30}];freeConnections=[];canvasPanX=-40;canvasPanY=20;renderFreeCanvas();
        window.dragSamples=[]; const original=DataTransfer.prototype.setDragImage;
        DataTransfer.prototype.setDragImage=function(canvas,x,y){window.dragSamples.push({x,y,center:canvas.getContext('2d').getImageData(90,40,1,1).data[3],corner:canvas.getContext('2d').getImageData(3,11,1,1).data[3],url:canvas.toDataURL()});return original.call(this,canvas,x,y);};
      });
      for(const [i,shape] of ['terminal','io','decision','process'].entries()) {
        const source=page.locator('.palette-block-'+shape), target=page.locator('#free-flowchart-canvas');
        const count=await page.evaluate(()=>freeBlocks.length);
        await source.dragTo(target,{targetPosition:{x:180+i*45,y:160+i*55}});
        assert.equal(await page.evaluate(()=>freeBlocks.length),count+1);
        assert.equal(await page.evaluate(()=>freeBlocks.at(-1).shape),shape);
        const centerError=await page.evaluate(({i})=>{const r=document.getElementById('free-blk-'+freeBlocks.at(-1).id).getBoundingClientRect(),c=document.getElementById('free-flowchart-canvas').getBoundingClientRect();return [Math.abs(r.x+r.width/2-c.x-(180+i*45)),Math.abs(r.y+r.height/2-c.y-(160+i*55))];},{i});
        assert.ok(centerError.every(v=>v<=12),`drop center drift: ${centerError}`);
        assert.equal(await page.locator('.palette-drag-preview').count(),0);
      }
      const samples=await page.evaluate(()=>window.dragSamples);
      assert.equal(samples.length,4);
      assert.deepEqual(samples.map(s=>s.center),[255,255,255,255]);
      assert.deepEqual(samples.map(s=>s.corner),[0,0,0,255]);
      for(let i=0;i<samples.length;i++)fs.writeFileSync(path.join(output,'drag-shape-'+i+'.png'),Buffer.from(samples[i].url.split(',')[1],'base64'));
      await page.evaluate(()=>zoomCanvas('in'));
      await page.locator('.palette-block-process').dragTo(page.locator('#free-flowchart-canvas'),{targetPosition:{x:220,y:200}});
      const zoomError=await page.evaluate(()=>{const r=document.getElementById('free-blk-'+freeBlocks.at(-1).id).getBoundingClientRect(),c=document.getElementById('free-flowchart-canvas').getBoundingClientRect();return [Math.abs(r.x+r.width/2-c.x-220),Math.abs(r.y+r.height/2-c.y-200)];});
      assert.ok(zoomError.every(v=>v<=14),`zoom drop drift: ${zoomError}`);
      await page.evaluate(()=>zoomCanvas('reset'));
      const count=await page.evaluate(()=>freeBlocks.length);
      await page.locator('.palette-block-process').dragTo(page.locator('#entry-trash-zone'));
      assert.equal(await page.evaluate(()=>freeBlocks.length),count);
      await page.evaluate(()=>{const source=document.querySelector('.palette-block-io');handlePaletteDragStart({currentTarget:source,dataTransfer:new DataTransfer()},'io');source.dispatchEvent(new DragEvent('dragend'));});
      assert.equal(await page.locator('.palette-drag-preview').count(),0);
      await page.screenshot({path:path.join(output,'workspace-polish-dragged.png')});
    });
    await check('running a collapsed panel keeps it closed and shows output beside canvas',async()=>{
      await page.evaluate(()=>{const el=document.querySelector('#fc-level3-view .entry-studio-container');if(!el.classList.contains('debugger-collapsed'))toggleDebuggerPanel();freeBlocks=[{id:'s',shape:'terminal',text:'시작',x:40,y:40},{id:'e',shape:'terminal',text:'종료',x:40,y:190}];freeConnections=[{from:'s',to:'e',fromPort:'out'}];renderFreeCanvas();resetDebugger();playFreeFlowchartSimulation();});
      await page.waitForFunction(()=>document.getElementById('floating-sim-status-badge').textContent.includes('완주'));
      assert.equal(await page.locator('#execution-panel-content').isVisible(),false);
      assert.ok((await page.locator('#execution-summary').textContent()).includes('완주'));
    });
    await check('result score and review status are separate, and logo remains the home route',async()=>{
      await page.evaluate(()=>{switchUnit('eval');studentEvalApp.renderResult();});
      for(const width of [390,768]) {
        await page.setViewportSize({width,height:900});
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.eval-review-status').evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
        assert.ok(!(await page.locator('#eval-result-total-score').textContent()).includes('검토'));
        await page.screenshot({path:path.join(output,'workspace-polish-result-'+width+'.png'),fullPage:true});
      }
      await page.locator('.site-brand').click();
      assert.equal(await page.locator('#view-roadmap').isVisible(),true);
      assert.equal(await page.locator('#nav-btn-roadmap').count(),0);
    });
  } finally {
    fs.writeFileSync(path.join(output,'workspace-ui.json'),JSON.stringify({results,errors,consoleErrors},null,2));
    if(browser)await browser.close();server.close();
    console.log(JSON.stringify({results,errors,consoleErrors},null,2));
    if(results.some(r=>!r.pass)||errors.length||consoleErrors.length)process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
