// Private results and a persistent attempt ledger enforce the approved call budget.
const fs=require('node:fs'),path=require('node:path');
const admin=require('./firebase-admin.cjs'),policy=require('../js/core/assessment-policy.js');
const dir=path.join(__dirname,'../scratch/part3-v2');
async function callAI(part,kind='calibration'){
  const ledgerFile=path.join(dir,'calls.json'),ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile)):[];
  if(kind==='calibration'&&ledger.filter(x=>x.kind===kind).length>=40)throw Error('CALIBRATION_BUDGET_REACHED');
  const record={kind,at:new Date().toISOString()};ledger.push(record);fs.writeFileSync(ledgerFile,JSON.stringify(ledger));
  const config=JSON.parse(fs.readFileSync(path.join(dir,'preview-access.json')));
  const response=await fetch(config.url+'/api/assessment-calibration',{method:'POST',headers:{'Content-Type':'application/json','x-vercel-protection-bypass':config.bypass,Authorization:'Bearer '+await admin.adminToken()},body:JSON.stringify({part:policy.assessmentReviewPayload(part)}),signal:AbortSignal.timeout(50000)});
  if(!response.ok)throw Error('AI_HTTP_'+response.status);
  const result=await response.json();result.criteria=policy.assessmentNormalizeAI(result.criteria,part,policy.ASSESSMENT_V2);return {...result,...policy.assessmentTotals(result.criteria,policy.ASSESSMENT_V2)};
}
async function main(){const cases=require('../tests/fixtures/part3-calibration.cjs'),results=[];
  for(let repeat=0;repeat<2;repeat++)for(const f of cases){
    let result;
    if(policy.assessmentIsEmpty(f.part)){const criteria=policy.assessmentEmptyCriteria();result={criteria,...policy.assessmentTotals(criteria,policy.ASSESSMENT_V2),model:'deterministic-empty'};}
    else result=await callAI(f.part);
    const scores=result.criteria.map(c=>c.score),pass=f.expected?JSON.stringify(scores)===JSON.stringify(f.expected):scores.every((x,i)=>f.ranges[i].includes(x));
    results.push({id:f.id,repeat,pass,...result});
    fs.writeFileSync(path.join(dir,'calibration.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({id:f.id,repeat,scores,pass}));
  }
  console.log(JSON.stringify({completed:true,passed:results.filter(r=>r.pass).length,total:results.length}));
}
if(require.main===module)main().catch(e=>{console.error(/^[A-Z_0-9]+$/.test(e.message)?e.message:'CALIBRATION_FAILED');process.exitCode=1;});
module.exports={callAI};
