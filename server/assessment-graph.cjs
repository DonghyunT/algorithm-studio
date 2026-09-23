const {assessmentReviewPayload}=require('../js/core/assessment-policy.js');
function graphInput(part){
  const p=assessmentReviewPayload(part),byId=new Map(p.blocks.map(b=>[b.id,b])),linked=new Set(p.connections.flatMap(e=>[e.from,e.to]));
  const active=p.blocks.filter(b=>linked.has(b.id)),meaningful=p.blocks.filter(b=>b.shape!=='terminal'&&b.text.trim());
  const stops=active.filter(b=>b.shape!=='terminal'&&!p.connections.some(e=>e.from===b.id)).map(b=>b.id);
  const facts={paths:p.connections.map(e=>`${e.from} [${byId.get(e.from)?.text||'없는 기호'}] --${e.fromPort==='yes'?'예(참)':e.fromPort==='no'?'아니오(거짓)':'다음'}--> ${e.to} [${byId.get(e.to)?.text||'없는 기호'}]`),disconnected:p.blocks.filter(b=>!linked.has(b.id)).map(b=>b.id),connectedNonterminalDeadEnds:stops,noConnectionsWithMeaningfulBlocks:p.connections.length===0&&meaningful.length>0,invalidReferences:p.connections.some(e=>!byId.has(e.from)||!byId.has(e.to))};
  // Discarded islands cannot affect AI grading. Keep all blocks when no assembled graph exists.
  return {...p,blocks:p.connections.length?active:p.blocks,graphFacts:facts};
}
function enforceStructureEvidence(criteria,part){
  const f=graphInput(part).graphFacts,rows=criteria.map(c=>({...c})),row=rows.find(c=>c.id==='structure');
  if(!row)return rows;
  if(f.noConnectionsWithMeaningfulBlocks&&row.score>4){row.score=4;row.evidence='의미 있는 기호는 작성했으나 연결선이 전혀 없어 구조는 일부만 구성되었습니다.';}
  else if((f.connectedNonterminalDeadEnds.length||f.invalidReferences)&&row.score>8){row.score=8;row.evidence='주요 연결 흐름에 후속 연결이 없는 기호가 있습니다: '+f.connectedNonterminalDeadEnds.join(', ');}
  return rows;
}
module.exports={graphInput,enforceStructureEvidence};
