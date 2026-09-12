// Administrative deployment helper. Credentials stay in the Firebase CLI credential store.
const path=require('node:path');
const PROJECT='donghyun-algo';
async function adminToken(){
  const base=process.env.FIREBASE_TOOLS_LIB;
  if(!base)throw Error('Set FIREBASE_TOOLS_LIB to the installed firebase-tools/lib directory.');
  const {configstore}=require(path.join(base,'configstore.js'));
  const {getAccessToken}=require(path.join(base,'auth.js'));
  return (await getAccessToken(configstore.get('tokens').refresh_token,configstore.get('loginScopes')||[])).access_token;
}
async function request(url,{method='GET',body,token}={}){
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+(token||await adminToken()),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(response.status+' '+JSON.stringify(data.error||data));return data;
}
function value(data){if(data===null)return {nullValue:null};if(Array.isArray(data))return {arrayValue:{values:data.map(value)}};if(typeof data==='object')return {mapValue:{fields:fields(data)}};if(typeof data==='boolean')return {booleanValue:data};if(typeof data==='number')return Number.isInteger(data)?{integerValue:String(data)}:{doubleValue:data};return {stringValue:String(data)};}
function fields(data){return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,value(v)]));}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,item])=>[k,decode(item)]));if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('nullValue'in v)return null;return Object.values(v)[0];}
const root=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const name=relative=>`projects/${PROJECT}/databases/(default)/documents/${relative}`;
module.exports={PROJECT,adminToken,request,fields,decode,root,name};
