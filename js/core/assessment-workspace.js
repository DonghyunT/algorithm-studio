/* One studio DOM and interaction engine; assessment owns a separate data snapshot and execution policy. */
class AssessmentWorkspace {
  constructor() {
    this.active=false;
    this.saved=null;
    this.timer=null;
    this.originals={};
    const mutations=['addNlCard','removeNlCard','updateNlCardText','updateNlCardField','addCanvasBlock','addCanvasBlockAtPosition','removeCanvasBlock','handleBlockTextChange','handleBlockMouseDown','startConnecting','handlePortMouseUp','handleCanvasDrop','clearFreeCanvas','autoAlignCanvas'];
    for(const name of mutations) {
      const original=window[name];if(typeof original!=='function')continue;
      window[name]=(...args)=>{
        if(this.active&&!this.app.canEditPlan())return;
        const result=original(...args);
        if(this.active)this.capture();
        return result;
      };
    }
    const originalRender=renderNlCards;
    window.renderNlCards=()=>{originalRender();this.decorateCards();};
    for(const name of ['playFreeFlowchartSimulation','stepDebugger','toggleDebuggerRun']) {
      const original=window[name];this.originals[name]=original;
      window[name]=(...args)=>this.active?this.run(name==='stepDebugger'):original(...args);
    }
    for(const name of ['openPrescriptionModal','applyPrescriptionDraft','requestSolarPrescription','diagnoseFreeAlgorithmWithSolarAI','openThinkerSubmissionModal','initLevel2Walkthrough','initLevel3FreeStudio']) {
      const original=window[name];if(typeof original!=='function')continue;
      window[name]=(...args)=>{if(isAssessmentLocked()||this.active)return;return original(...args);};
    }
    const originalReset=resetDebugger;
    this.originals.resetDebugger=originalReset;
    window.resetDebugger=(...args)=>{if(this.active)this.stop();return originalReset(...args);};
    for(const event of ['input','change','mouseup','drop','keyup','focusout']) {
      document.addEventListener(event,()=>{if(this.active)queueMicrotask(()=>this.capture());});
    }
    window.addEventListener('beforeunload',()=>this.capture());
  }
  enter(app) {
    if(this.active)return;
    window.savePracticeDraft?.();
    resetDebugger();clearPaletteDrag();
    this.app=app;
    this.element=document.getElementById('fc-level3-view');
    this.anchor=document.createComment('practice workspace home');this.element.before(this.anchor);
    this.saved={cards:nlCards,blocks:freeBlocks,connections:freeConnections,nextBlockId,panX:canvasPanX,panY:canvasPanY,zoom:currentCanvasZoom,panel:isNlPanelCollapsed,className:this.element.className,containerClass:this.element.firstElementChild.className,stageTransform:document.getElementById('free-flowchart-stage').style.transform,aiPassed:window.isFlowchartAiPassed,simPassed:window.isFlowchartSimValidated,selection:selectedBlockId};
    this.active=true;document.body.classList.add('assessment-workspace-mode');
    document.getElementById('eval-shared-workspace').appendChild(this.element);
    this.element.classList.remove('hidden');
    this.element.firstElementChild.classList.remove('panel-collapsed');
    this.element.firstElementChild.classList.add('debugger-collapsed');
    isNlPanelCollapsed=false;
    document.querySelector('.debugger-panel-full-view').classList.add('hidden');
    document.querySelector('.debugger-panel-collapsed-view').classList.remove('hidden');
    this.guide=document.getElementById('eval-plan-guide');this.guide.hidden=false;
    if(app.isFreeDesign())document.getElementById('eval-free-design').appendChild(this.guide);
    else document.getElementById('nl-cards-container').before(this.guide);
    const part=app.answers.part3;
    freeBlocks=structuredClone(part.blocks||[]);freeConnections=structuredClone(part.connections||[]);
    nlCards=app.getAssessmentPlan().steps.map(s=>({...s,type:s.type||'seq'}));
    canvasPanX=part.viewport?.x||0;canvasPanY=part.viewport?.y||0;currentCanvasZoom=1;
    this.lastSnapshot='';this.lastGraph='';this.stop();
    renderNlCards();renderFreeCanvas();initCanvasPanning();initDraggableSimFloatingBar();applyCanvasPan();
    this.element.querySelectorAll('[aria-controls="execution-panel-content"]').forEach(b=>b.setAttribute('aria-expanded','false'));
    this.setReadOnly(!app.canEditPlan());this.capture();
  }
  capture() {
    if(!this.active||!this.app||this.readOnly)return;
    // Contenteditable changes must also survive submission while still focused.
    this.element.querySelectorAll('.free-block').forEach(el=>{
      const block=freeBlocks.find(b=>'free-blk-'+b.id===el.id),label=el.querySelector('.block-text-label');
      if(block&&label===document.activeElement)block.text=label.innerText.trim().slice(0,1000);
    });
    const snapshot=JSON.stringify({blocks:freeBlocks,connections:freeConnections,cards:nlCards,x:canvasPanX,y:canvasPanY});
    if(snapshot===this.lastSnapshot)return;
    this.lastSnapshot=snapshot;
    const graphSnapshot=JSON.stringify({blocks:freeBlocks,connections:freeConnections,cards:nlCards});
    const graphChanged=graphSnapshot!==this.lastGraph;this.lastGraph=graphSnapshot;
    const part=this.app.answers.part3;
    part.blocks=structuredClone(freeBlocks);part.connections=structuredClone(freeConnections);
    part.plan=this.app.getAssessmentPlan();part.plan.steps=structuredClone(nlCards);
    part.viewport={x:canvasPanX,y:canvasPanY};part.isVerified=false;
    if(graphChanged){
      this.stop();this.element.querySelectorAll('.execution-issue,.flowchart-block-simulating').forEach(el=>el.classList.remove('execution-issue','flowchart-block-simulating'));
      const summary=document.getElementById('execution-summary');summary.textContent='현재 작성한 순서도를 실행해 결과를 확인해 보세요.';summary.classList.remove('execution-summary-error');
    }
    this.app.syncStudentProgress();
  }
  leave() {
    if(!this.active)return;
    this.capture();this.stop();pauseDebugger();clearPaletteDrag();
    isDraggingBlock=false;draggedBlockObj=null;isConnecting=false;connectionSource=null;isPanningCanvas=false;
    document.getElementById('eval-shared-workspace').after(this.guide);this.guide.hidden=true;
    this.anchor.replaceWith(this.element);
    this.element.className=this.saved.className;this.element.firstElementChild.className=this.saved.containerClass;
    nlCards=this.saved.cards;freeBlocks=this.saved.blocks;freeConnections=this.saved.connections;nextBlockId=this.saved.nextBlockId;
    canvasPanX=this.saved.panX;canvasPanY=this.saved.panY;currentCanvasZoom=this.saved.zoom;isNlPanelCollapsed=this.saved.panel;
    this.setReadOnly(false);this.active=false;document.body.classList.remove('assessment-workspace-mode');
    const collapsed=this.element.firstElementChild.classList.contains('debugger-collapsed');
    document.querySelector('.debugger-panel-full-view').classList.toggle('hidden',collapsed);
    document.querySelector('.debugger-panel-collapsed-view').classList.toggle('hidden',!collapsed);
    window.isFlowchartAiPassed=this.saved.aiPassed;window.isFlowchartSimValidated=this.saved.simPassed;selectedBlockId=this.saved.selection;
    renderNlCards();renderFreeCanvas();applyCanvasPan();document.getElementById('free-flowchart-stage').style.transform=this.saved.stageTransform;this.saved=null;
  }
  setReadOnly(value) {
    this.readOnly=value;
    if(!this.element)return;
    this.element.querySelectorAll('textarea,[contenteditable]').forEach(e=>{if(e.tagName==='TEXTAREA')e.disabled=value;else e.contentEditable=String(!value);});
    this.guide?.querySelectorAll('textarea,button').forEach(e=>e.disabled=value);
    this.element.classList.toggle('assessment-readonly',value);
    if(value){isDraggingBlock=false;draggedBlockObj=null;isConnecting=false;connectionSource=null;this.stop();}
  }
  decorateCards() {
    document.querySelectorAll('#nl-cards-container > [id^="card-"]').forEach((row,index)=>{
      const card=nlCards[index];
      if(this.active)row.querySelectorAll('textarea').forEach(input=>{
        const action=input.getAttribute('oninput')||'';
        input.maxLength=1000;
        input.placeholder=action.includes('yesAction')?'맞으면 어떤 행동을 하나요?':action.includes('noAction')?'아니면 어떤 행동을 하나요?':action.includes('condition')?(card.type==='loop'?'어떤 조건인 동안 반복하나요?':'어떤 조건을 확인하나요?'):action.includes('loopAction')?'무엇을 반복하나요?':'어떤 행동을 하나요?';
      });
      const controls=document.createElement('div');controls.className='shared-card-order';
      for(const [label,delta] of [['위로',-1],['아래로',1]]) {
        const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',`${index+1}단계 ${label}`);
        button.disabled=index+delta<0||index+delta>=nlCards.length;
        button.onclick=()=>{if(this.active&&!this.app.canEditPlan())return;[nlCards[index],nlCards[index+delta]]=[nlCards[index+delta],nlCards[index]];renderNlCards();if(this.active)this.capture();};controls.appendChild(button);
      }
      row.appendChild(controls);
    });
  }
  stop() {clearInterval(this.timer);this.timer=null;if(this.active)this.originals.resetDebugger();}
  run(single=false) {
    if(!this.active||this.readOnly)return;
    this.capture();
    if(!debuggerExec || debuggerExec.done) {
      const result=validateFlowGraph(freeBlocks,freeConnections);
      clearDebugConsole();this.element.querySelectorAll('.execution-issue').forEach(e=>e.classList.remove('execution-issue'));
      result.issues.forEach(issue=>{if(issue.blockId)document.getElementById('free-blk-'+issue.blockId)?.classList.add('execution-issue');logDebugConsole(issue.message,true);});
      if(!result.valid){setDebuggerStatus('실행 중단');return;}
      if(!initDebugger())return;
    }
    if(single)this.originals.stepDebugger();else this.originals.toggleDebuggerRun();
  }
}
window.assessmentWorkspace=new AssessmentWorkspace();
