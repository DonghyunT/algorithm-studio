// Read-only inventory. Never logs names, answers, account IDs, or credentials.
const fs=require('node:fs'),crypto=require('node:crypto');
const {request,PROJECT,root,decode}=require('./firebase-admin.cjs');
async function list(url){const rows=[];let token;do{const data=await request(url+'?pageSize=100'+(token?'&pageToken='+encodeURIComponent(token):''));rows.push(...(data.documents||[]));token=data.nextPageToken;}while(token);return rows;}
const data=doc=>Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,decode(v)]));
(async()=>{
 const report={at:new Date().toISOString(),project:PROJECT,readOnly:true,classrooms:[],issues:[]};
 const classes=await list(root+'/classrooms');
 for(const doc of classes){
   const id=doc.name.split('/').pop(),session=data(doc),base='https://firestore.googleapis.com/v1/'+doc.name;
   const [students,archives,collections]=await Promise.all([list(base+'/students'),list(base+'/archives'),request(base+':listCollectionIds',{method:'POST',body:{pageSize:100}})]);
   const row={classId:id,status:session.status,questionVersion:session.questionVersion||1,childCollections:collections.collectionIds||[],currentStudents:students.length,archives:archives.length,archivedStudents:0,archiveKinds:{}};
   for(const student of students){const s=data(student);if(!/^(0[1-9]|1[0-9]|2[0-7])$/.test(student.name.split('/').pop()))report.issues.push(id+': invalid current student document ID');if(s.attemptId!==session.attemptId)report.issues.push(id+': current student round differs from classroom');}
   for(const archive of archives){
     const saved=data(archive),records=await list('https://firestore.googleapis.com/v1/'+archive.name+'/students');row.archivedStudents+=records.length;row.archiveKinds[saved.kind||'unspecified']=(row.archiveKinds[saved.kind||'unspecified']||0)+1;
     if(!saved.session)report.issues.push(id+': archive missing session snapshot');
     for(const record of records){const s=data(record);if(s.attemptId&&saved.session?.attemptId&&s.attemptId!==saved.session.attemptId)report.issues.push(id+': archived student round differs from archived session');}
   }
   report.classrooms.push(row);
 }
 report.classrooms.sort((a,b)=>Number(a.classId.split('-')[1])-Number(b.classId.split('-')[1]));
 const release=await request(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`);
 const ruleset=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
 const remote=ruleset.source.files.find(f=>f.name.endsWith('.rules'))?.content||'',normalize=s=>s.replace(/\r\n/g,'\n').trim();
 report.rules={release:release.rulesetName,matchLocal:normalize(remote)===normalize(fs.readFileSync('firestore.rules','utf8')),sha256:crypto.createHash('sha256').update(normalize(remote)).digest('hex')};
 if(!report.rules.matchLocal)report.issues.push('Deployed Firestore rules differ from local rules');
 report.legacyEvalSessionDocuments=(await list(root+'/eval_sessions')).length;
 fs.writeFileSync('tests/results/firestore-structure.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(report.issues.length)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
