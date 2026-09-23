// One persisted result per eligible answer. No student payload is printed.
const fs=require('node:fs'),path=require('node:path');
const p=require('../js/core/assessment-policy.js'),{digest}=require('../server/objective-regrade.cjs'),{callAI}=require('./part3-calibrate.cjs');
const dir=path.join(__dirname,'../scratch/part3-v2');
async function main(){
  const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'before.json'))),cachePath=path.join(dir,'graded.json');
  const cache=fs.existsSync(cachePath)?JSON.parse(fs.readFileSync(cachePath)):{};
  const groups=[];
  for(const round of snapshot.rounds){
    const students=[];
    for(const source of round.students){
      const s=source.data;if(s.status!=='submitted'||s.attemptId!==round.attemptId)continue;
      const sourceKey=p.assessmentSourceKey(s.answers?.part3),key=digest({name:source.name,sourceKey,attemptId:s.attemptId});
      if(!cache[key]){
        if(p.assessmentIsEmpty(s.answers?.part3)){const criteria=p.assessmentEmptyCriteria();cache[key]={criteria,...p.assessmentTotals(criteria,p.ASSESSMENT_V2),model:'deterministic-empty'};}
        else {
          // Persist each technical failure too; restarting cannot reset the retry limit.
          const failures=cache[key+'-failures']||0;if(failures>=2)throw Error('ANSWER_RETRY_LIMIT');
          for(let attempt=failures;attempt<2;attempt++)try{cache[key]=await callAI(s.answers?.part3,'student');break;}catch(e){cache[key+'-failures']=attempt+1;fs.writeFileSync(cachePath,JSON.stringify(cache));if(attempt===1)throw e;}
        }
        cache[key].createdAt=new Date().toISOString();fs.writeFileSync(cachePath,JSON.stringify(cache));
      }
      const result=cache[key],criteria=p.validateAssessmentCriteria(result.criteria,p.ASSESSMENT_V2);
      const proposal={...result,criteria,...p.assessmentTotals(criteria,p.ASSESSMENT_V2),sourceKey,attemptId:s.attemptId,rubricVersion:p.ASSESSMENT_V2};
      const scores={...(s.scores||{})};delete scores.teacherOverride;delete scores.finalScore;
      Object.assign(scores,{part3:proposal.total,pendingReview:false,assessmentStatus:'잠정'});
      if(Number.isFinite(scores.part1)&&Number.isFinite(scores.part2)){scores.objectiveTotal=scores.part1+scores.part2;scores.total=scores.objectiveTotal+proposal.total;}else{delete scores.total;}
      const review={...(s.review||{}),proposal};delete review.confirmed;
      students.push({source,patch:{review,scores,assessmentRubricVersion:p.ASSESSMENT_V2}});
    }
    groups.push({...round,auditId:'part3-v2-'+round.attemptId,students});
    console.log(JSON.stringify({completedRounds:groups.length,completedAnswers:groups.reduce((n,g)=>n+g.students.length,0)}));
  }
  const plan={schemaVersion:1,project:snapshot.project,revision:p.ASSESSMENT_V2,groups};plan.planHash=digest(plan);
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plan,null,2));console.log(JSON.stringify({planReady:true,answers:groups.reduce((n,g)=>n+g.students.length,0)}));
}
if(require.main===module)main().catch(e=>{console.error(/^[A-Z_0-9]+$/.test(e.message)?e.message:'GRADING_FAILED');process.exitCode=1;});
