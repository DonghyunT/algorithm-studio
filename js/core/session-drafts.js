/* Recover practice work on refresh, within this tab's session only. */
(() => {
  const key='ALGO_PRACTICE_DRAFT_V1';
  const fields=['inp-current','inp-goal','inp-new-condition'];
  let previous='';
  try {
    const draft=JSON.parse(sessionStorage.getItem(key));
    if(draft?.version===1) {
      window.hasPracticeDraft=true;
      nlCards=draft.flow.cards;freeBlocks=draft.flow.blocks;freeConnections=draft.flow.connections;
      nextBlockId=draft.flow.nextBlockId;
      userQuizAnswers=draft.quiz;
      if(draft.abstraction) {
        const a=draft.abstraction;
        isTutorialCompleted=a.completed;tutStep=a.tutStep;tutTrashTags=a.tutTrashTags;
        currentWizardStep=a.step;registeredConditions=a.conditions;currentPoolTags=a.pool;currentTrashTags=a.trash;currentGeneratedPlans=a.plans;
        for(const [id,value] of Object.entries(a.fields)) {const input=document.getElementById(id);if(input)input.value=value;}
      }
    }
  } catch(error) { console.warn('임시 작업 복원 실패',error); }
  function save() {
    if(window.isSessionClosing)return;
    if(window.assessmentWorkspace?.active)return;
    try {
      const snapshot=JSON.stringify({version:1,flow:{cards:nlCards,blocks:freeBlocks,connections:freeConnections,nextBlockId},quiz:userQuizAnswers,
        abstraction:{completed:isTutorialCompleted,tutStep,tutTrashTags,step:currentWizardStep,conditions:registeredConditions,pool:currentPoolTags,trash:currentTrashTags,plans:currentGeneratedPlans,fields:Object.fromEntries(fields.map(id=>[id,document.getElementById(id)?.value||'']))}});
      if(snapshot!==previous){sessionStorage.setItem(key,snapshot);previous=snapshot;}
    } catch(error) { console.warn('임시 작업 저장 실패',error); }
  }
  let pending;
  window.savePracticeDraft=save;
  ['input','change','pointerup','keyup'].forEach(event=>document.addEventListener(event,()=>{clearTimeout(pending);pending=setTimeout(save,100);}));
  window.addEventListener('beforeunload',save);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  setInterval(save,1000);
  window.addEventListener('DOMContentLoaded',()=>{
    if(isTutorialCompleted){document.getElementById('abs-subtab-workspace')?.removeAttribute('disabled');}
    renderConditionsUI();renderTags();updateWizardUI();
  });
})();
