// Explicit administrative rollout; never changes classroom or student records.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {request,root,name,fields,PROJECT}=require('./firebase-admin.cjs');
const OWNER_UID='lb20pFOCGybl1EXmMA5iVShKi7Y2',OWNER_EMAIL='adh103006@gmail.com';
const EMAIL='temporary-teacher@donghyun-algo.firebaseapp.com';
const authRoot='https://identitytoolkit.googleapis.com/v1/projects/'+PROJECT;
async function main(){
 const activate=process.argv.includes('--activate'),prepare=process.argv.includes('--prepare');
 if(!activate&&!prepare)throw Error('Use --prepare or --activate after reviewing the rollout.');
 const owner=(await request(authRoot+'/accounts:lookup',{method:'POST',body:{localId:[OWNER_UID]}})).users?.[0];
 if(owner?.email!==OWNER_EMAIL||owner.disabled)throw Error('Expected existing owner account not verified.');
 const credentialFile=path.join(__dirname,'../.env.instructor.local');
 const lookup=await request(authRoot+'/accounts:lookup',{method:'POST',body:{email:[EMAIL]}});
 let user=lookup.users?.[0];
 if(prepare){
   if(user&&!fs.existsSync(credentialFile))throw Error('Existing instructor account found without local credentials; do not reset automatically.');
   if(!fs.existsSync(credentialFile))fs.writeFileSync(credentialFile,'INSTRUCTOR_EMAIL='+EMAIL+'\nINSTRUCTOR_PASSWORD='+crypto.randomBytes(15).toString('base64url')+'\n',{flag:'wx',mode:0o600});
   const password=fs.readFileSync(credentialFile,'utf8').match(/^INSTRUCTOR_PASSWORD=(.+)$/m)?.[1]?.trim();
   if(!password||password.length<16)throw Error('Local instructor credential file is invalid.');
   if(!user){
     user=await request('https://identitytoolkit.googleapis.com/v1/accounts:signUp',{method:'POST',body:{targetProjectId:PROJECT,email:EMAIL,password,displayName:'10·11반 강사',disabled:true}});
   }else if(!user.disabled)throw Error('Instructor is already active; refusing to overwrite its role.');
   await request(root+':commit',{method:'POST',body:{writes:[
     {update:{name:name('teachers/'+OWNER_UID),fields:fields({enabled:true,allClasses:true})},updateMask:{fieldPaths:['enabled','allClasses']},currentDocument:{exists:true}},
     {update:{name:name('teachers/'+user.localId),fields:fields({enabled:false,allClasses:false,classIds:['2-10','2-11'],displayName:'10·11반 강사'})}}
   ]}});
   console.log(JSON.stringify({phase:'prepared',ownerAllClasses:true,instructorUid:user.localId,instructorEnabled:false,credentialFile:'.env.instructor.local'}));
 }else{
   if(!user)throw Error('Prepare the instructor first.');
   // Require the actual released rules to equal this reviewed local version.
   const release=await request('https://firebaserules.googleapis.com/v1/projects/'+PROJECT+'/releases/cloud.firestore');
   const rules=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
   const local=fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8').replace(/\r\n/g,'\n').trim();
   if(!rules.source?.files?.some(f=>f.content.replace(/\r\n/g,'\n').trim()===local)||!local.includes('teacherForClass(classId)'))throw Error('Scoped rules are not released; instructor remains disabled.');
   await request('https://identitytoolkit.googleapis.com/admin/v2/projects/'+PROJECT+'/config?updateMask=signIn.email',{method:'PATCH',body:{signIn:{email:{enabled:true,passwordRequired:true}}}});
   await request(root+'/teachers/'+user.localId+'?updateMask.fieldPaths=enabled',{method:'PATCH',body:{fields:fields({enabled:true})}});
   await request(authRoot+'/accounts:update',{method:'POST',body:{localId:user.localId,disableUser:false}});
   console.log(JSON.stringify({phase:'activated',instructorUid:user.localId,classIds:['2-10','2-11'],emailPasswordEnabled:true}));
 }
}
if(require.main===module)main().catch(error=>{const status=String(error.message).match(/^\d{3}/)?.[0];const reason=String(error.message).match(/"message":"([^"]+)"/)?.[1]?.replace(/[A-Za-z0-9_-]{20,}/g,'[redacted]');console.error(JSON.stringify({error:'Instructor provisioning stopped; no credentials printed.',status,reason}));process.exitCode=1;});
