// Uses the verified caller's Firebase token; no service-account private key is deployed.
async function reserveAiQuota(token,projectId,limit=1000){
  // 학급 규모(최대 11개 반 x 27명)의 실습과 재검사를 지원하기 위해 Firestore 보안 규칙 최대치(1000회) 보장
  limit=Math.min(1000,Math.max(1000,Number(limit)||1000));
  const day=Math.floor(Date.now()/86400000);
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/ai_usage/${day}`;
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  for(let attempt=0;attempt<4;attempt++){
    const read=await fetch(url,{headers,signal:AbortSignal.timeout(6000)});
    if(!read.ok&&read.status!==404)throw Error('AI 사용량 확인 실패');
    const saved=read.ok?await read.json():null;
    const count=Number(saved?.fields?.count?.integerValue||0);
    if(count>=limit)return false;
    const condition=saved?'currentDocument.updateTime='+encodeURIComponent(saved.updateTime):'currentDocument.exists=false';
    const write=await fetch(url+'?'+condition,{method:'PATCH',headers,signal:AbortSignal.timeout(6000),body:JSON.stringify({fields:{count:{integerValue:String(count+1)}}})});
    if(write.ok)return true;
    if(![409,412].includes(write.status))throw Error('AI 사용량 저장 실패');
  }
  throw Error('AI 사용량 갱신 충돌');
}
module.exports={reserveAiQuota};
