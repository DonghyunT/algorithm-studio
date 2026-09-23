// Atomic per-round apply/restore, immutable server backup, and explicit plan hash.
const fs=require('node:fs'),path=require('node:path');
const {digest}=require('../server/objective-regrade.cjs'),{decode}=require('./firebase-admin.cjs');
const policy=require('../js/core/assessment-policy.js');
const keys=['review','scores','assessmentRubricVersion'];
function verify(plan,hash){
  const {planHash,...body}=plan;
  if(hash!==planHash||digest(body)!==hash||plan.project!=='donghyun-algo'||plan.revision!==policy.ASSESSMENT_V2)throw Error('INVALID_PLAN');
  for(const g of plan.groups){
    const s=g.archiveId?g.session.data.session:g.session.data;
    const base=`projects/donghyun-algo/databases/(default)/documents/classrooms/${g.classId}`+(g.archiveId?'/archives/'+g.archiveId:'');
    if(!/^2-(?:[1-9]|10|11)$/.test(g.classId)||g.session.name!==base||s.status!=='ended'||s.questionVersion!==4||!Number.isFinite(Date.parse(s.startTime))||s.attemptId!==g.attemptId||g.auditId!=='part3-v2-'+g.attemptId||g.auditId.includes('/'))throw Error('INVALID_ROUND');
    for(const r of g.students){const st=r.source.data,review=policy.assessmentEffectiveReview({...st,...r.patch});if(!r.source.name.startsWith(base+'/students/')||!/^\d{2}$/.test(r.source.name.slice((base+'/students/').length))||st.attemptId!==s.attemptId||!review||review.rubricVersion!==policy.ASSESSMENT_V2||r.patch.review.confirmed||r.patch.scores.part1!==st.scores?.part1||r.patch.scores.part2!==st.scores?.part2||r.patch.scores.part3!==review.total)throw Error('INVALID_PATCH');}
  }
}
async function optional(request,url){try{return await request(url);}catch(e){if(String(e.message).startsWith('404'))return null;throw e;}}
async function operate(plan,api,hash,restore=false){
  verify(plan,hash);const {request,root,fields}=api,results=[];
  for(const g of plan.groups){
    const auditName=`projects/donghyun-algo/databases/(default)/documents/classrooms/${g.classId}/archives/${g.auditId}`,url='https://firestore.googleapis.com/v1/'+auditName;
    const existing=await optional(request,url),restored=await optional(request,url.replace('/'+g.auditId,'/restore-'+g.auditId));
    if(existing&&decode({mapValue:{fields:existing.fields}}).planHash!==hash)throw Error('AUDIT_CONFLICT');
    if(!restore&&restored)throw Error('ALREADY_RESTORED');
    if((!restore&&existing)||(restore&&restored)){results.push({classId:g.classId,alreadyDone:true});continue;}
    if(restore&&!existing)continue;
    const {transaction}=await request(root+':beginTransaction',{method:'POST',body:{options:{readWrite:{}}}});
    try{
      if(restore&&g.archiveId){
        const edits=await request(root+'/classrooms/'+g.classId+':runQuery',{method:'POST',body:{transaction,structuredQuery:{from:[{collectionId:'archives'}],where:{fieldFilter:{field:{fieldPath:'kind'},op:'EQUAL',value:{stringValue:'part3-review-correction'}}}}}});
        if(edits.some(r=>r.document&&decode({mapValue:{fields:r.document.fields}}).sourceArchiveId===g.archiveId))throw Error('ARCHIVED_TEACHER_CORRECTION_REQUIRES_REVIEW');
      }
      const fetched=await request(root+':batchGet',{method:'POST',body:{documents:[g.session.name,...g.students.map(r=>r.source.name)],transaction}}),found=new Map(fetched.filter(r=>r.found).map(r=>[r.found.name,r.found]));
      if(!restore&&found.get(g.session.name)?.updateTime!==g.session.updateTime)throw Error('ROUND_CHANGED');
      const at=new Date().toISOString(),name=restore?auditName.replace('/'+g.auditId,'/restore-'+g.auditId):auditName;
      const metadata={kind:restore?'part3-regrade-restore':'part3-regrade',planHash:hash,archivedAt:at,sourceArchiveId:g.archiveId,sourceAttemptId:g.attemptId,session:g.archiveId?g.session.data.session:g.session.data};
      const writes=[{update:{name,fields:fields(metadata)},currentDocument:{exists:false}}];
      for(const r of g.students){
        const now=found.get(r.source.name),data=now&&decode({mapValue:{fields:now.fields}});
        if(!now||(!restore&&now.updateTime!==r.source.updateTime))throw Error('ANSWER_CHANGED');
        if(restore&&!g.archiveId&&(policy.assessmentSourceKey(data.answers?.part3)!==policy.assessmentSourceKey(r.source.data.answers?.part3)||data.attemptId!==r.source.data.attemptId||keys.some(k=>digest(data[k])!==digest(r.patch[k]))))throw Error('CHANGED_AFTER_REGRADE');
        const saved=restore?{originalStudent:data,sourcePath:r.source.name}:{...r.source.data,...r.patch,originalStudent:r.source.data,sourcePath:r.source.name,sourceUpdateTime:r.source.updateTime};
        if(Buffer.byteLength(JSON.stringify(saved))>900000)throw Error('BACKUP_TOO_LARGE');
        writes.push({update:{name:name+'/students/'+r.source.name.split('/').pop(),fields:fields(saved)},currentDocument:{exists:false}});
        if(!g.archiveId){const patch=restore?Object.fromEntries(keys.filter(k=>Object.hasOwn(r.source.data,k)).map(k=>[k,r.source.data[k]])):r.patch;writes.push({update:{name:r.source.name,fields:fields(patch)},updateMask:{fieldPaths:keys},currentDocument:{updateTime:now.updateTime}});}
      }
      const result=await request(root+':commit',{method:'POST',body:{transaction,writes}});results.push({classId:g.classId,archiveId:g.archiveId,students:g.students.length,commitTime:result.commitTime});
    }catch(e){await request(root+':rollback',{method:'POST',body:{transaction}}).catch(()=>{});throw e;}
  }
  return results;
}
async function main(){const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];if(!args.includes('--plan')||!args.includes('--confirm-plan'))throw Error('PLAN_HASH_REQUIRED');const file=path.resolve(get('--plan'));if(!file.startsWith(path.resolve(__dirname,'../scratch')+path.sep))throw Error('PRIVATE_PATH_REQUIRED');const plan=JSON.parse(fs.readFileSync(file)),hash=get('--confirm-plan');verify(plan,hash);if(!args.includes('--apply')){console.log('PLAN_VALID');return;}const restore=args.includes('--restore'),results=await operate(plan,require('./firebase-admin.cjs'),hash,restore);fs.writeFileSync(path.join(path.dirname(file),restore?'restored.json':'applied.json'),JSON.stringify({planHash:hash,results},null,2));console.log(JSON.stringify({completed:true,restore,groups:results.length}));}
if(require.main===module)main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'REGRADE_OPERATION_FAILED');process.exitCode=1;});
module.exports={verify,operate};
