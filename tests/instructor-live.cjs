// Opt-in production permission verification. It creates only unique archive fixtures
// and removes them with administrator credentials in finally.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PROJECT,request:adminRequest,fields,decode,root,name}=require('../tools/firebase-admin.cjs');

function readLocalEnv(file){
  if(!fs.existsSync(file))throw Error('.env.instructor.local 파일에 교사 계정 정보를 설정해 주세요.');
  const values={};
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const index=line.indexOf('=');
    if(index<1)continue;
    const key=line.slice(0,index).trim();
    let value=line.slice(index+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    values[key]=value;
  }
  if(!values.INSTRUCTOR_EMAIL||!values.INSTRUCTOR_PASSWORD)throw Error('INSTRUCTOR_EMAIL과 INSTRUCTOR_PASSWORD를 모두 설정해 주세요.');
  return values;
}

async function client(url,token,method='GET',body){
  const response=await fetch(url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const text=await response.text();
  let data={};
  if(text)try{data=JSON.parse(text);}catch{data={};}
  return {status:response.status,data};
}

function record(results,label,response,expected,verify){
  assert.equal(response.status,expected,`${label}: HTTP ${response.status}`);
  if(verify)verify(response.data);
  results.push({name:label,status:response.status});
  return response;
}

async function run(){
  if(!process.argv.includes('--run'))throw Error('운영 권한 검사는 명시적인 --run 옵션이 필요합니다.');
  const env=readLocalEnv(path.join(__dirname,'../.env.instructor.local'));
  const config=fs.readFileSync(path.join(__dirname,'../js/data/firebase-config.js'),'utf8');
  const apiKey=config.match(/apiKey:\s*"([^"]+)"/)?.[1];
  if(!apiKey)throw Error('Firebase Web API 설정을 찾지 못했습니다.');

  const results=[],archiveIds={assigned:crypto.randomUUID(),unassigned:crypto.randomUUID()};
  const created={assigned:false,unassigned:false};
  let anonymous;
  const auth=await client('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(apiKey),null,'POST',{email:env.INSTRUCTOR_EMAIL,password:env.INSTRUCTOR_PASSWORD,returnSecureToken:true});
  if(auth.status!==200||!auth.data.idToken||!auth.data.localId)throw Error(`교사 계정 로그인에 실패했습니다 (HTTP ${auth.status}).`);
  const teacherToken=auth.data.idToken;

  try{
    const role=record(results,'instructor reads own role',await client(root+'/teachers/'+encodeURIComponent(auth.data.localId),teacherToken),200,data=>{
      const value=decode({mapValue:{fields:data.fields||{}}});
      const classes=Array.isArray(value.classIds)?[...value.classIds].sort():[];
      if(value.enabled!==true||value.allClasses===true||classes.length!==2||classes[0]!=='2-10'||classes[1]!=='2-11')throw Error('교사 역할이 enabled + classIds [2-10, 2-11] 구성과 일치하지 않습니다.');
    });
    void role;

    for(const classId of ['2-10','2-11']){
      record(results,`${classId} empty student list`,await client(`${root}/classrooms/${classId}/students?pageSize=1`,teacherToken),200,data=>{
        if((data.documents||[]).length!==0)throw Error(`${classId} 학생 목록이 비어 있지 않아 운영 권한 검사를 중단했습니다.`);
      });
      record(results,`${classId} empty archive list`,await client(`${root}/classrooms/${classId}/archives?pageSize=1`,teacherToken),200,data=>{
        if((data.documents||[]).length!==0)throw Error(`${classId} 보관 목록이 비어 있지 않아 운영 권한 검사를 중단했습니다.`);
      });
    }

    record(results,'unassigned class metadata denied',await client(root+'/classrooms/2-1',teacherToken),403);
    record(results,'unassigned class student list denied',await client(root+'/classrooms/2-1/students?pageSize=1',teacherToken),403);
    record(results,'unassigned class existing seat denied',await client(root+'/classrooms/2-1/students/01',teacherToken),403);

    const write=classId=>client(root+':commit',teacherToken,'POST',{writes:[{update:{name:name(`classrooms/${classId}/archives/${archiveIds[classId==='2-10'?'assigned':'unassigned']}`),fields:fields({kind:'permission-verification'})},currentDocument:{exists:false}}]});
    const assignedWrite=await write('2-10');
    created.assigned=assignedWrite.status===200;
    record(results,'assigned class archive create',assignedWrite,200);

    const unassignedWrite=await write('2-1');
    created.unassigned=unassignedWrite.status===200;
    record(results,'unassigned class archive create denied',unassignedWrite,403);

    const anonymousAuth=await client('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(apiKey),null,'POST',{returnSecureToken:true});
    if(anonymousAuth.status!==200||!anonymousAuth.data.idToken)throw Error(`익명 기준 계정 생성에 실패했습니다 (HTTP ${anonymousAuth.status}).`);
    anonymous=anonymousAuth.data;
    record(results,'anonymous classroom metadata read',await client(root+'/classrooms/2-10',anonymous.idToken),200);
    record(results,'anonymous student list denied',await client(root+'/classrooms/2-10/students?pageSize=1',anonymous.idToken),403);

    if(process.argv.includes('--production')){
      const production=(process.env.PRODUCTION_URL||'https://algorithm-studio-ten.vercel.app').replace(/\/$/,'');
      record(results,'production API unassigned review denied before paid call',await client(production+'/api/assessment',teacherToken,'POST',{purpose:'review',classId:'2-1',studentNum:'01'}),403,data=>{
        if(typeof data.error!=='string'||!data.error.includes('이 학급을 검토할 권한이 없습니다'))throw Error('배포 API가 새 학급 범위 거부 응답을 반환하지 않았습니다.');
      });
    }
  }finally{
    const cleanup=[];
    if(created.assigned)cleanup.push(adminRequest(`${root}/classrooms/2-10/archives/${archiveIds.assigned}`,{method:'DELETE'}));
    if(created.unassigned)cleanup.push(adminRequest(`${root}/classrooms/2-1/archives/${archiveIds.unassigned}`,{method:'DELETE'}));
    if(anonymous?.idToken)cleanup.push(client('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+encodeURIComponent(apiKey),null,'POST',{idToken:anonymous.idToken}).then(response=>{
      if(response.status!==200)throw Error(`익명 기준 계정 정리에 실패했습니다 (HTTP ${response.status}).`);
    }));
    await Promise.all(cleanup);
  }

  console.log(JSON.stringify({project:PROJECT,passed:results.length,results,fixturesRemoved:true,productionApiChecked:process.argv.includes('--production')}));
}

if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
