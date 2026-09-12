// Opt-in integration test: uses two disposable anonymous users and an empty, waiting classroom.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {request,PROJECT,root,fields}=require('../tools/firebase-admin.cjs');
async function run(){
 if(!process.argv.includes('--run'))throw Error('Explicit --run is required for cloud test fixtures.');
 const classUrl=root+'/classrooms/2-11',students=await request(classUrl+'/students');
 const original=await request(classUrl);
 if((students.documents||[]).length || original.fields.status.stringValue!=='waiting')throw Error('2-11 must be empty and waiting; no existing answer is changed.');
 const key=fs.readFileSync('js/data/firebase-config.js','utf8').match(/apiKey:\s*"([^"]+)"/)[1];
 const users=[],created=[],results=[];
 async function client(url,token,method='GET',data){
   const res=await fetch(url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
   return {status:res.status,data:await res.json()};
 }
 async function check(label,expected,action){const res=await action();assert.equal(res.status,expected,label+': '+JSON.stringify(res.data));results.push({name:label,pass:true});return res.data;}
 try{
   for(let i=0;i<2;i++){
     const res=await client('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+key,null,'POST',{returnSecureToken:true});
     assert.equal(res.status,200,JSON.stringify(res.data));users.push(res.data);
   }
   const a=users[0],b=users[1],url=classUrl+'/students/01';
   await check('unauthenticated class read denied',403,()=>client(classUrl));
   await check('anonymous class read allowed',200,()=>client(classUrl,a.idToken));
   const answers={part1:{},part2:{},part3:null};
   const student={num:1,numStr:'01',name:'배포 검증용',ownerUid:a.localId,status:'waiting',joinedAt:new Date().toISOString(),submittedAt:null,progress:{part1:0,part2:0,part3:0},answers,feedback:{},attemptId:original.fields.attemptId.stringValue};
   await check('student creates own seat',200,()=>client(url+'?currentDocument.exists=false',a.idToken,'PATCH',{fields:fields(student)}));created.push(url);
   await check('student B cannot read A answer',403,()=>client(url,b.idToken));
   await check('student cannot list classmates',403,()=>client(classUrl+'/students',a.idToken));
   await check('student cannot grant teacher role',403,()=>client(root+'/teachers/'+a.localId,a.idToken,'PATCH',{fields:fields({enabled:true})}));
   await check('student cannot start assessment',403,()=>client(classUrl+'?updateMask.fieldPaths=status',a.idToken,'PATCH',{fields:fields({status:'in_progress'})}));
   await request(classUrl+'?updateMask.fieldPaths=status&updateMask.fieldPaths=deadlineMs',{method:'PATCH',body:{fields:fields({status:'in_progress',deadlineMs:Date.now()+600000})}});
   student.status='in_progress';student.answers.part1.q1=1;
   await check('owner saves active answer',200,()=>client(url,a.idToken,'PATCH',{fields:fields(student)}));
   await check('student score forgery denied',403,()=>client(url+'?updateMask.fieldPaths=scores',a.idToken,'PATCH',{fields:fields({scores:{teacherOverride:100}})}));
   await request(classUrl+'?updateMask.fieldPaths=deadlineMs',{method:'PATCH',body:{fields:fields({deadlineMs:Date.now()-5000})}});
   const changed=JSON.parse(JSON.stringify(student));changed.answers.part1.q1=2;
   await check('late answer edit denied',403,()=>client(url,a.idToken,'PATCH',{fields:fields(changed)}));
   student.status='submitted';student.submittedAt=new Date().toISOString();
   await check('unchanged saved answer can submit after deadline',200,()=>client(url,a.idToken,'PATCH',{fields:fields(student)}));
   await check('submitted answer immutable',403,()=>client(url,a.idToken,'PATCH',{fields:fields(changed)}));
   await check('student cannot read archives',403,()=>client(classUrl+'/archives',a.idToken));
 }finally{
   // Only exact documents/users created above are removed; no legacy records are accessed.
   for(const url of created)await request(url,{method:'DELETE'}).catch(e=>console.error('Fixture cleanup:',e.message));
   await request(classUrl,{method:'PATCH',body:{fields:original.fields}});
   for(const user of users)await request(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`,{method:'POST',body:{localId:user.localId}});
   fs.writeFileSync('tests/results/firestore-live.json',JSON.stringify({project:PROJECT,at:new Date().toISOString(),results,fixturesRemoved:true},null,2));
 }
 console.log(JSON.stringify({passed:results.length,fixturesRemoved:true}));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1});
