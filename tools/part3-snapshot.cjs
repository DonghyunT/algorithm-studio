// Read-only selection and private recovery snapshot. Never prints student data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const admin=require('./firebase-admin.cjs');
const unpack=d=>({name:d.name,updateTime:d.updateTime,data:admin.decode({mapValue:{fields:d.fields}})});
async function list(url){const rows=[];let next;do{const r=await admin.request(url+'?pageSize=100'+(next?'&pageToken='+encodeURIComponent(next):''));rows.push(...r.documents||[]);next=r.nextPageToken;}while(next);return rows;}
function selectRounds(candidates){
  const eligible=candidates.filter(r=>{const s=r.archiveId?r.session.data.session:r.session.data;return s?.questionVersion===4&&s.status==='ended'&&s.attemptId;});
  const unique=new Map();
  for(const r of eligible){const s=r.archiveId?r.session.data.session:r.session.data;r.attemptId=s.attemptId;r.started=Date.parse(s.startTime);if(!Number.isFinite(r.started))continue;if(!unique.has(s.attemptId)||!r.archiveId)unique.set(s.attemptId,r);}
  return [...unique.values()].sort((a,b)=>b.started-a.started).slice(0,2);
}
async function snapshot(){
  const out={project:admin.PROJECT,createdAt:new Date().toISOString(),rounds:[],selectionIssues:[]};
  for(const d of await list(admin.root+'/classrooms')){
    const current=unpack(d),classId=d.name.split('/').pop();
    if(current.data.status==='in_progress')throw Error('ACTIVE_EVALUATION');
    const candidates=[{classId,archiveId:null,session:current}];
    for(const a of await list(admin.root+'/classrooms/'+classId+'/archives')){const r=unpack(a);if(r.data.kind==='new-session')candidates.push({classId,archiveId:a.name.split('/').pop(),session:r});}
    for(const r of candidates){const s=r.archiveId?r.session.data.session:r.session.data;if(s?.questionVersion===4&&s.status==='ended'&&s.attemptId&&!Number.isFinite(Date.parse(s.startTime)))out.selectionIssues.push({classId,archiveId:r.archiveId,reason:'NO_START_TIME'});}
    for(const r of selectRounds(candidates)){
      const docs=await list('https://firestore.googleapis.com/v1/'+r.session.name+'/students');
      r.students=docs.map(unpack);
      if(r.students.some(s=>s.data.status==='in_progress'))throw Error('ACTIVE_MAKEUP');
      out.rounds.push(r);
    }
  }
  return out;
}
async function main(){const dir=path.join(__dirname,'../scratch/part3-v2');fs.mkdirSync(dir,{recursive:true});const out=await snapshot();const content=JSON.stringify(out,null,2);fs.writeFileSync(path.join(dir,'before.json'),content,{flag:'wx'});fs.writeFileSync(path.join(dir,'before.sha256'),crypto.createHash('sha256').update(content).digest('hex'),{flag:'wx'});console.log(JSON.stringify({snapshotSaved:true,rounds:out.rounds.length,submitted:out.rounds.reduce((n,r)=>n+r.students.filter(s=>s.data.status==='submitted'&&s.data.attemptId===r.attemptId).length,0),selectionIssues:out.selectionIssues.length,serverWrites:0}));}
if(require.main===module)main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'SNAPSHOT_FAILED_PRIVATE_DETAILS_WITHHELD');process.exitCode=1;});
module.exports={selectRounds,snapshot,list,unpack};
