// A correction is attached to the exact objective answers, never to a seat alone.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ObjectiveCorrection=api;
})(typeof window!=='undefined'?window:null,function(){
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value;
  }
  function sourceKey(student){
    return JSON.stringify(stable({attemptId:student?.attemptId||'',submittedAt:student?.submittedAt||null,part1:student?.answers?.part1||{},part2:student?.answers?.part2||{}}));
  }
  function get(student){
    const c=student?.objectiveCorrection;
    if(student?.status!=='submitted'||!c||c.attemptId!==student.attemptId||c.sourceKey!==sourceKey(student))return null;
    if(!Number.isInteger(c.beforePart2)||!Number.isInteger(c.afterPart2)||c.beforePart2<0||c.afterPart2>30||c.afterPart2<=c.beforePart2||c.delta!==c.afterPart2-c.beforePart2)return null;
    return c;
  }
  return {sourceKey,get};
});
