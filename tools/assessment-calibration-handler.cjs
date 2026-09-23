// Copy into api/assessment-calibration.js only in an isolated private Preview.
// This source is excluded from production deployments. Never accepts production requests.
const {assessmentReviewPayload,assessmentNormalizeAI,assessmentTotals,assessmentSourceKey,ASSESSMENT_V2}=require('../js/core/assessment-policy.js');
const prompt=require('../server/assessment-guidance.cjs');
const {graphInput,enforceStructureEvidence}=require('../server/assessment-graph.cjs');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(process.env.VERCEL_ENV!=='preview'||req.method!=='POST')return res.status(404).json({error:'사용할 수 없는 경로입니다.'});
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'관리자 인증이 필요합니다.'});
  try{
    const check=await fetch('https://cloudresourcemanager.googleapis.com/v1/projects/donghyun-algo:testIamPermissions',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({permissions:['datastore.entities.get','datastore.entities.update']}),signal:AbortSignal.timeout(10000)});
    const role=await check.json();if(!check.ok||!['datastore.entities.get','datastore.entities.update'].every(p=>role.permissions?.includes(p)))return res.status(403).json({error:'프로젝트 관리자 권한이 필요합니다.'});
    const part=req.body?.part;if(!part||JSON.stringify(part).length>55000)return res.status(400).json({error:'검증 답안을 확인해 주세요.'});
    const response=await fetch('https://api.upstage.ai/v1/solar/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTAGE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.SOLAR_MODEL||'solar-pro4',temperature:0,max_tokens:2000,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(graphInput(part))}]}),signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error('AI_FAILURE');const data=await response.json();
    const raw=data.choices?.[0]?.message?.content||'',result=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
    const criteria=enforceStructureEvidence(assessmentNormalizeAI(result.criteria,part,ASSESSMENT_V2),part);
    if(criteria.some(c=>!c.evidence.trim())||!Array.isArray(result.uncertainties))throw Error('INVALID_RESULT');
    return res.status(200).json({criteria,...assessmentTotals(criteria,ASSESSMENT_V2),sourceKey:assessmentSourceKey(part),rubricVersion:ASSESSMENT_V2,uncertainties:result.uncertainties.slice(0,3),model:process.env.SOLAR_MODEL||'solar-pro4'});
  }catch{return res.status(503).json({error:'검증 응답을 확인하지 못했습니다. 점수를 저장하지 않았습니다.'});}
};
