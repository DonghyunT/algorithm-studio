// Creates missing classroom documents only. Existing eval_sessions and student records are untouched.
const crypto=require('node:crypto');
const {request,root,name,fields}=require('./firebase-admin.cjs');
async function provision(){
 const date=new Date().toISOString(),writes=[];
 const existing=await request(root+'/classrooms?pageSize=100');
 const ids=new Set((existing.documents||[]).map(d=>d.name.split('/').pop()));
 for(let n=1;n<=11;n++){
   const classId='2-'+n;if(ids.has(classId))continue;
   writes.push({update:{name:name('classrooms/'+classId),fields:fields({classId,schemaVersion:2,schoolYear:2026,status:'waiting',durationMinutes:30,maxStudents:27,attemptId:crypto.randomUUID(),preparedAt:date})},currentDocument:{exists:false}});
 }
 if(process.argv.includes('--apply')&&writes.length)await request(root+':commit',{method:'POST',body:{writes}});
 console.log(JSON.stringify({applied:process.argv.includes('--apply'),newClassrooms:writes.length,existingPreserved:ids.size}));
}
if(require.main===module)provision().catch(e=>{console.error(e.message);process.exitCode=1});
