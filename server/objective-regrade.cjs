const crypto=require('node:crypto');
const {parseEvaluationBank,gradeAssignment}=require('./evaluation-bank.cjs');
const {sourceKey}=require('../js/core/objective-correction.js');
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const digest=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
const norm=value=>value.toLocaleLowerCase('ko-KR').replace(/\s+/g,'').trim();
function validateExpansion(before,after){
  parseEvaluationBank(JSON.stringify(before));parseEvaluationBank(JSON.stringify(after));
  if(stable(before.part1)!==stable(after.part1)||before.part2.length!==after.part2.length)throw Error('BANK_CONTENT_CHANGED');
  before.part2.forEach((q,index)=>{
    const candidate=after.part2[index],{answers,...rest}=q,{answers:accepted,...next}=candidate;
    if(stable(rest)!==stable(next)||!answers.every(a=>accepted.some(b=>norm(a)===norm(b))))throw Error('NOT_ANSWER_EXPANSION');
  });
}
function compareStudent(before,after,session,student){
  if(session?.questionVersion!==4||session.status!=='ended'||!session.attemptId)return {skip:'ROUND_NOT_ENDED_V4'};
  if(student?.status!=='submitted')return {skip:'NOT_SUBMITTED'};
  if(student.attemptId!==session.attemptId)return {issue:'ROUND_MISMATCH'};
  const answers=student.answers?.part2;
  if(!answers||typeof answers!=='object'||Array.isArray(answers))return {issue:'INVALID_ANSWERS'};
  const ids=Object.keys(answers);
  if(ids.length>6||ids.some(id=>!before.part2.some(q=>q.id===id)||typeof answers[id]!=='string'))return {issue:'UNKNOWN_QUESTION_OR_ANSWER'};
  const original=before.part2.filter(q=>ids.includes(q.id)),updated=after.part2.filter(q=>ids.includes(q.id));
  const domains=original.map(q=>q.domain).filter(Boolean);
  if(new Set(domains).size!==domains.length)return {issue:'DUPLICATE_DOMAIN'};
  const beforePart2=gradeAssignment({part1:[],part2:original},student.answers).part2;
  const afterPart2=gradeAssignment({part1:[],part2:updated},student.answers).part2;
  if(afterPart2===beforePart2)return {unchanged:true};
  if(afterPart2<beforePart2)throw Error('SCORE_DECREASE');
  // An existing persisted score may use another historical rubric. Do not replace it silently.
  if(student.scores?.part2!=null&&student.scores.part2!==beforePart2)return {issue:'STORED_SCORE_DIFFERS'};
  if(student.scores?.teacherOverride!=null||Number.isFinite(student.scores?.total))return {issue:'CONFIRMED_TOTAL_REQUIRES_REVIEW'};
  const changes=updated.flatMap(q=>{
    const old=original.find(row=>row.id===q.id);
    const was=gradeAssignment({part1:[],part2:[old]},student.answers).part2;
    const now=gradeAssignment({part1:[],part2:[q]},student.answers).part2;
    return now>was?[{questionId:q.id,studentAnswer:answers[q.id],before:was,after:now,reason:'승인된 동등 표현 인정'}]:[];
  });
  return {beforePart2,afterPart2,delta:afterPart2-beforePart2,changes,sourceKey:sourceKey(student)};
}
function buildPlan(before,after,snapshot,revision){
  if(!/^v4-[a-z0-9-]{3,60}$/.test(revision))throw Error('INVALID_REVISION');
  if(snapshot.project!=='donghyun-algo')throw Error('WRONG_PROJECT');
  validateExpansion(before,after);
  const groups=[],issues=[],summary={rounds:snapshot.rounds.length,records:0,changedRecords:0,changedAnswers:0,currentChanged:0,archivedChanged:0,unchanged:0,skipped:0,perClass:{}};
  for(const round of snapshot.rounds){
    const session=round.archiveId?round.session.data.session:round.session.data;
    const expectedSessionPath=`projects/donghyun-algo/databases/(default)/documents/classrooms/${round.classId}`+(round.archiveId?`/archives/${round.archiveId}`:'');
    if(!/^2-(?:[1-9]|10|11)$/.test(round.classId)||round.session.name!==expectedSessionPath)throw Error('INVALID_SOURCE_PATH');
    const students=[];
    for(const saved of round.students){
      summary.records++;
      if(!new RegExp('^'+expectedSessionPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/students/(0[1-9]|1[0-9]|2[0-7])$').test(saved.name))throw Error('INVALID_STUDENT_PATH');
      const result=compareStudent(before,after,session,saved.data);
      if(result.issue){issues.push({source:saved.name,reason:result.issue});continue;}
      if(result.skip){summary.skipped++;continue;}
      if(result.unchanged){summary.unchanged++;continue;}
      students.push({source:saved,...result});summary.changedRecords++;summary.changedAnswers+=result.changes.length;summary[round.archiveId?'archivedChanged':'currentChanged']++;
      summary.perClass[round.classId]=(summary.perClass[round.classId]||0)+1;
    }
    if(students.length)groups.push({classId:round.classId,archiveId:round.archiveId,session:round.session,attemptId:session.attemptId,auditId:'objective-'+revision+'-'+digest({path:round.session.name,attemptId:session.attemptId}).slice(0,24),students});
  }
  const plan={schemaVersion:1,revision,project:snapshot.project,beforeBankHash:digest(before),afterBankHash:digest(after),summary,issues,groups};
  return {...plan,planHash:digest(plan)};
}
function currentPatch(student,correction){
  // Only the objective subtotal changes. In particular review.confirmed and Part 3 stay untouched.
  const scores={...(student.scores||{}),part2:correction.afterPart2};
  if(Number.isFinite(scores.part1))scores.objectiveTotal=scores.part1+scores.part2;
  // Do not manufacture a final total from AI proposals or missing objective scores.
  return {scores,objectiveCorrection:correction};
}
module.exports={digest,validateExpansion,compareStudent,buildPlan,currentPatch};
