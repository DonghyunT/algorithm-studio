// Explicit, additive correction of a reviewed plan. Private input/output belongs in scratch/.
// No credentials, names, answers, or bank content are logged. Archive originals are never updated.
const fs=require('node:fs'),path=require('node:path');
const {digest,currentPatch}=require('../server/objective-regrade.cjs');
const {decode}=require('./firebase-admin.cjs');
const {sourceKey}=require('../js/core/objective-correction.js');
function verifyPlan(plan,hash){
  const {planHash,...body}=plan;
  if(planHash!==hash||digest(body)!==hash||plan.project!=='donghyun-algo'||plan.issues.length)throw Error('INVALID_OR_UNRESOLVED_PLAN');
}
function correctionFor(plan,group,row,at){
  return {revision:plan.revision,attemptId:group.attemptId,beforePart2:row.beforePart2,afterPart2:row.afterPart2,delta:row.delta,sourceKey:row.sourceKey,appliedAt:at,reason:'교사 승인에 따른 동등 표현 인정 답안 확대',beforeBankHash:plan.beforeBankHash,afterBankHash:plan.afterBankHash};
}
async function applyPlan(plan,{request,root,fields},hash){
  verifyPlan(plan,hash);
  const results=[];
  for(const group of plan.groups){
    // Archived originals need a separately reviewed display/overlay workflow.
    // The approved production plan has zero affected archived records.
    if(group.archiveId)throw Error('ARCHIVED_CHANGE_REQUIRES_REVIEW');
    const auditPath=`${root}/classrooms/${group.classId}/archives/${group.auditId}`;
    let existing;
    try{existing=await request(auditPath);}catch(error){if(!String(error.message).startsWith('404'))throw error;}
    if(existing){
      const saved=decode({mapValue:{fields:existing.fields}});
      if(saved.planHash!==hash)throw Error('EXISTING_CORRECTION_CONFLICT');
      let restored;
      try{restored=await request(`${root}/classrooms/${group.classId}/archives/restore-${group.auditId}`);}catch(error){if(!String(error.message).startsWith('404'))throw error;}
      if(restored)throw Error('PLAN_ALREADY_RESTORED');
      results.push({classId:group.classId,auditId:group.auditId,alreadyApplied:true});continue;
    }
    const {transaction}=await request(root+':beginTransaction',{method:'POST',body:{options:{readWrite:{}}}});
    try{
      const documents=[group.session.name,...group.students.map(row=>row.source.name)];
      const fetched=await request(root+':batchGet',{method:'POST',body:{documents,transaction}});
      const found=new Map(fetched.filter(row=>row.found).map(row=>[row.found.name,row.found]));
      if(found.get(group.session.name)?.updateTime!==group.session.updateTime)throw Error('ROUND_CHANGED_SINCE_PREVIEW');
      for(const row of group.students)if(found.get(row.source.name)?.updateTime!==row.source.updateTime||sourceKey(row.source.data)!==row.sourceKey)throw Error('ANSWER_CHANGED_SINCE_PREVIEW');
      const at=new Date().toISOString(),auditName=auditPath.replace('https://firestore.googleapis.com/v1/','');
      const session=group.archiveId?group.session.data.session:group.session.data;
      if(session.status!=='ended'||session.questionVersion!==4||session.attemptId!==group.attemptId)throw Error('ROUND_NOT_ELIGIBLE');
      const metadata={kind:'objective-regrade',archivedAt:at,session,revision:plan.revision,planHash:hash,sourceArchiveId:group.archiveId,sourcePath:group.session.name,sourceAttemptId:group.attemptId,beforeBankHash:plan.beforeBankHash,afterBankHash:plan.afterBankHash,affectedStudents:group.students.length,approval:'교사 요청 2026-09-24: 종료된 V4 전체, 기존 정답 유지 및 동등 표현 추가'};
      const writes=[{update:{name:auditName,fields:fields(metadata)},currentDocument:{exists:false}}];
      for(const row of group.students){
        const studentNum=row.source.name.split('/').pop(),correction=correctionFor(plan,group,row,at);
        const saved={...row.source.data,objectiveCorrection:correction,originalStudent:row.source.data,sourcePath:row.source.name,sourceUpdateTime:row.source.updateTime,changes:row.changes};
        // Keep audit documents within Firestore's limit before sending any write in this transaction.
        if(Buffer.byteLength(JSON.stringify(saved),'utf8')>900000)throw Error('AUDIT_DOCUMENT_TOO_LARGE');
        writes.push({update:{name:auditName+'/students/'+studentNum,fields:fields(saved)},currentDocument:{exists:false}});
        if(!group.archiveId){
          const patch=currentPatch(row.source.data,correction);
          writes.push({update:{name:row.source.name,fields:fields(patch)},updateMask:{fieldPaths:['scores','objectiveCorrection']},currentDocument:{updateTime:row.source.updateTime}});
        }
      }
      const result=await request(root+':commit',{method:'POST',body:{transaction,writes}});
      results.push({classId:group.classId,auditId:group.auditId,students:group.students.length,commitTime:result.commitTime});
    }catch(error){await request(root+':rollback',{method:'POST',body:{transaction}}).catch(()=>{});throw error;}
  }
  return results;
}
async function restorePlan(plan,{request,root,fields},hash){
  verifyPlan(plan,hash);
  const results=[];
  for(const group of plan.groups){
    if(group.archiveId)throw Error('ARCHIVED_CHANGE_REQUIRES_REVIEW');
    const auditPath=`${root}/classrooms/${group.classId}/archives/${group.auditId}`;
    const audit=await request(auditPath),metadata=decode({mapValue:{fields:audit.fields}});
    if(metadata.planHash!==hash)throw Error('EXISTING_CORRECTION_CONFLICT');
    const {transaction}=await request(root+':beginTransaction',{method:'POST',body:{options:{readWrite:{}}}});
    try{
      const fetched=await request(root+':batchGet',{method:'POST',body:{documents:group.students.map(row=>row.source.name),transaction}});
      const found=new Map(fetched.filter(row=>row.found).map(row=>[row.found.name,row.found]));
      const restoreName=audit.name.replace('/archives/'+group.auditId,'/archives/restore-'+group.auditId);
      const writes=[{update:{name:restoreName,fields:fields({kind:'objective-regrade-restore',planHash:hash,restoredAt:new Date().toISOString(),sourceAudit:group.auditId})},currentDocument:{exists:false}}];
      for(const row of group.students){
        const doc=found.get(row.source.name);
        if(!doc)throw Error('RESTORE_SOURCE_MISSING');
        const current=decode({mapValue:{fields:doc.fields}}),correction=current.objectiveCorrection;
        if(!correction||sourceKey(current)!==row.sourceKey||digest(correction)!==digest(correctionFor(plan,group,row,correction.appliedAt))||digest(current.scores)!==digest(currentPatch(row.source.data,correction).scores))throw Error('RECORD_CHANGED_AFTER_CORRECTION');
        const patch={};
        for(const key of ['scores','objectiveCorrection'])if(Object.hasOwn(row.source.data,key))patch[key]=row.source.data[key];
        writes.push({update:{name:restoreName+'/students/'+row.source.name.split('/').pop(),fields:fields({originalStudent:current,sourcePath:row.source.name,sourceUpdateTime:doc.updateTime})},currentDocument:{exists:false}});
        // An omitted field in an update mask removes only that field, restoring absence.
        writes.push({update:{name:row.source.name,fields:fields(patch)},updateMask:{fieldPaths:['scores','objectiveCorrection']},currentDocument:{updateTime:doc.updateTime}});
      }
      const result=await request(root+':commit',{method:'POST',body:{transaction,writes}});
      results.push({classId:group.classId,commitTime:result.commitTime});
    }catch(error){await request(root+':rollback',{method:'POST',body:{transaction}}).catch(()=>{});throw error;}
  }
  return results;
}
async function main(){
  const args=process.argv.slice(2),at=key=>args[args.indexOf(key)+1];
  if(!args.includes('--plan')||!args.includes('--confirm-plan'))throw Error('PLAN_AND_HASH_REQUIRED');
  const filename=path.resolve(at('--plan')),workspace=path.resolve(__dirname,'..'),scratch=path.join(workspace,'scratch')+path.sep;
  if(!filename.startsWith(scratch))throw Error('USE_PRIVATE_SCRATCH_PLAN');
  const plan=JSON.parse(fs.readFileSync(filename,'utf8')),hash=at('--confirm-plan');verifyPlan(plan,hash);
  if(!args.includes('--apply')){console.log(JSON.stringify({mode:'check-only',summary:plan.summary,planHash:hash}));return;}
  const restore=args.includes('--restore');
  const results=await (restore?restorePlan:applyPlan)(plan,require('./firebase-admin.cjs'),hash);
  fs.writeFileSync(path.join(path.dirname(filename),restore?'regrade-restored.json':'regrade-applied.json'),JSON.stringify({at:new Date().toISOString(),planHash:hash,results},null,2));
  console.log(JSON.stringify({completed:true,groups:results.length,students:plan.summary.changedRecords,alreadyAppliedGroups:results.filter(r=>r.alreadyApplied).length}));
}
if(require.main===module)main().catch(error=>{const reason=/^[A-Z_]+$/.test(error.message)?error.message:'REMOTE_OPERATION_FAILED';console.error(JSON.stringify({completed:false,reason,httpStatus:String(error.message).match(/^\d{3}/)?.[0]}));process.exitCode=1;});
module.exports={verifyPlan,correctionFor,applyPlan,restorePlan};
