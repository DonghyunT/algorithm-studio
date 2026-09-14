// Sets idle/waiting classrooms to ended status so students cannot join without teacher opening the session.
const {request,root,name,fields,decode}=require('./firebase-admin.cjs');

async function closeIdleClassrooms(){
  const date=new Date().toISOString(), writes=[];
  const res=await request(root+'/classrooms?pageSize=100');
  const docs=res.documents||[];
  const targets=[];

  for(const doc of docs){
    const data=decode(doc.fields);
    const classId=doc.name.split('/').pop();
    if(data.status==='waiting'){
      targets.push(classId);
      writes.push({
        update:{
          name:doc.name,
          fields:fields({
            ...data,
            status:'ended',
            closedAt:date
          })
        }
      });
    }
  }

  const apply=process.argv.includes('--apply');
  if(apply && writes.length){
    await request(root+':commit',{method:'POST',body:{writes}});
  }

  console.log(JSON.stringify({
    applied: apply,
    foundWaitingClassrooms: targets,
    updatedCount: writes.length,
    message: apply ? '대기 상태 학급이 모두 종료(ended) 상태로 전환되었습니다.' : '드라이런 모드입니다. 실제 적용하려면 --apply 플래그를 붙여 실행하세요.'
  }, null, 2));
}

if(require.main===module){
  closeIdleClassrooms().catch(e=>{
    console.error(e.message);
    process.exitCode=1;
  });
}
module.exports={closeIdleClassrooms};
