// Three synthetic practice cases through the opt-in live preview. Consumes real AI quota.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const context=vm.createContext({});for(const file of ['flow-validation.js','flowchart-review.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core/',file),'utf8'),context);
const block=(id,shape,text)=>({id,shape,text}),edge=(from,to,fromPort='out')=>({from,to,fromPort,toPort:'in'});
const s=block('s','terminal','시작'),e=block('e','terminal','종료');
const cases=[
 {name:'two actions in one meaningful process',expected:'pass',cards:[{type:'seq',text:'불을 켠다'},{type:'seq',text:'음악을 재생한다'}],blocks:[s,block('p','process','불을 켜고 음악을 재생한다'),e],edges:[edge('s','p'),edge('p','e')]},
 {name:'password retry loop with exit',expected:'pass',cards:[{type:'seq',text:'비밀번호를 입력받는다'},{type:'loop',condition:'비밀번호가 1234가 아닌 동안',loopAction:'비밀번호를 다시 입력받는다'}],blocks:[s,block('i','io','비밀번호 입력'),block('d','decision','비밀번호 == 1234'),e],edges:[edge('s','i'),edge('i','d'),edge('d','e','yes'),edge('d','i','no')]},
 {name:'reversed yes and no actions',expected:'needs_revision',cards:[{type:'seq',text:'기온을 입력받는다'},{type:'sel',condition:'기온이 28도 초과인가?',yesAction:'창문을 연다',noAction:'창문을 닫는다'}],blocks:[s,block('i','io','기온 입력'),block('d','decision','기온 > 28'),block('o','process','창문을 연다'),block('c','process','창문을 닫는다'),e],edges:[edge('s','i'),edge('i','d'),edge('d','c','yes'),edge('d','o','no'),edge('o','e'),edge('c','e')]}
];
(async()=>{
 const origin='http://127.0.0.1:4174';const script=await(await fetch(origin+'/js/data/firebase-config.js')).text();const config=JSON.parse(script.match(/window.LOCAL_PREVIEW_CONFIG=(\{.*\});/)[1]);
 const results=[];
 for(const fixture of cases){
  const messages=context.buildFlowchartReviewMessages(fixture.cards,fixture.blocks,fixture.edges);
  const response=await fetch(origin+'/api/local-chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Local-Preview-Token':config.token},body:JSON.stringify({messages}),signal:AbortSignal.timeout(45000)});
  const data=await response.json();const verdict=context.parseFlowchartReviewVerdict(data.content);
  results.push({name:fixture.name,expected:fixture.expected,status:response.status,verdict:verdict.verdict,feedback:verdict.feedback,pass:response.ok&&verdict.verdict===fixture.expected});
 }
 const report={at:new Date().toISOString(),results};fs.mkdirSync(path.join(__dirname,'results/semantic-review-live'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/semantic-review-live/extended.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(results.every(r=>r.pass));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
