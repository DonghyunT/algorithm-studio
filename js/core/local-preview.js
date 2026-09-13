// Enabled only by the opt-in loopback preview server, never by the deployed app.
if(location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).get('demo')==='1'&&window.LOCAL_PREVIEW_CONFIG){
  window.localPreview={
    async request(path,body){
      const response=await fetch(path,{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json','X-Local-Preview-Token':window.LOCAL_PREVIEW_CONFIG.token,Authorization:'Bearer '+(sessionStorage.getItem('LOCAL_TEACHER_SESSION')||'')},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok){const error=new Error(result.error||'로컬 체험 연결을 확인해 주세요.');error.code='local-preview';throw error;}return result;
    },
    async existingTeacher(){const r=await this.request('/api/local-teacher',{action:'status'});return r.authenticated?{uid:'local-teacher'}:null;},
    async teacher({method,password}={}){
      if(method==='google'){const e=new Error('로컬 체험에서는 임시 로그인을 선택해 주세요.');e.code='local-preview';throw e;}
      if(method==='temporary'){const result=await this.request('/api/local-teacher',{action:'login',password});sessionStorage.setItem('LOCAL_TEACHER_SESSION',result.session);return {uid:'local-teacher'};}
      const user=await this.existingTeacher();if(!user){const e=new Error('교사용 버튼에서 로컬 임시 계정으로 먼저 로그인해 주세요.');e.code='local-preview';throw e;}return user;
    },
    async signOut(){try{await this.request('/api/local-teacher',{action:'logout'});}finally{sessionStorage.removeItem('LOCAL_TEACHER_SESSION');}},
    async chat(messages){return (await this.request('/api/local-chat',{messages})).content;}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const notice=document.createElement('div');notice.className='local-preview-notice';notice.textContent='로컬 체험 · 실제 AI 연결 · 학생 자료와 평가는 로컬 시연';document.getElementById('global-header')?.appendChild(notice);
    const google=document.getElementById('teacher-login-google');if(google){google.disabled=true;google.dataset.previewDisabled='true';google.title='로컬 체험에서는 임시 로그인을 이용해 주세요.';}
    const label=document.querySelector('label[for="teacher-login-password"]');if(label)label.textContent='로컬 교사 비밀번호';
    const hint=document.createElement('p');hint.textContent='로컬 전용 비밀번호로 체험합니다. 운영 교사 계정에 로그인하지 않습니다.';document.getElementById('teacher-login-feedback')?.before(hint);
  });
}
