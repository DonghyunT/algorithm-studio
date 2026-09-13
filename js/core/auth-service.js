/* Shared-PC authentication. Roles are granted by an administrator, never by the browser. */
window.authService = {
  pending: null,
  temporaryTeacherEmail: 'temporary-teacher@donghyun-algo.firebaseapp.com',
  isDemo() {
    return ['localhost', '127.0.0.1'].includes(location.hostname) &&
      new URLSearchParams(location.search).get('demo') === '1';
  },
  async ready() {
    if (this.isDemo()) return null;
    if (!window.firebase || !firebase.auth) throw new Error('로그인 서비스를 불러오지 못했습니다. 연결을 확인해 주세요.');
    initFirebaseApp();
    const auth = firebase.auth();
    if (!this.pending) this.pending = (async () => {
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      await new Promise((resolve, reject) => {
        let unsub;
        unsub = auth.onAuthStateChanged(() => { queueMicrotask(()=>unsub?.()); resolve(); }, reject);
      });
      return auth;
    })().catch(error => { this.pending = null; throw error; });
    return this.pending;
  },
  async student() {
    if (this.isDemo()) return { uid: 'demo-student' };
    const auth = await this.ready();
    return auth.currentUser || (await auth.signInAnonymously()).user;
  },
  async existingTeacher() {
    this.checkLocalPreview();
    if(this.isDemo()&&window.localPreview)return window.localPreview.existingTeacher();
    if (this.isDemo()) return typeof isTeacherAuthenticated !== 'undefined' && isTeacherAuthenticated ? {uid:'demo-teacher'} : null;
    const auth = await this.ready(), user = auth.currentUser;
    if (!user) return null;
    const role = await firebase.firestore().collection('teachers').doc(user.uid).get();
    return auth.currentUser?.uid === user.uid && role.exists && role.data().enabled === true ? user : null;
  },
  async teacher({method, password} = {}) {
    this.checkLocalPreview();
    if(this.isDemo()&&window.localPreview)return window.localPreview.teacher({method,password});
    if (this.isDemo()) return { uid: 'demo-teacher' };
    const auth = await this.ready();
    let user = auth.currentUser;
    if (method === 'temporary') {
      if (typeof password !== 'string' || !password) throw new Error('임시 교사 비밀번호를 입력해 주세요.');
      user = (await auth.signInWithEmailAndPassword(this.temporaryTeacherEmail, password)).user;
    } else if (method === 'google') {
      user = (await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())).user;
    }
    if (!user) throw new Error('우측 상단 교사용 버튼에서 먼저 로그인해 주세요.');
    try {
      const role = await firebase.firestore().collection('teachers').doc(user.uid).get();
      if (!role.exists || role.data().enabled !== true) throw new Error(`교사 권한이 없습니다. 관리자에게 UID [${user.uid}]를 전달하여 교사 계정 등록 상태를 확인해 주세요.`);
    } catch(error) {
      if(method && auth.currentUser?.uid === user.uid)await this.signOut();
      throw error;
    }
    return user;
  },
  checkLocalPreview() {
    if(this.isDemo()&&window.LOCAL_PREVIEW_CONFIG&&!window.localPreview){
      const error=new Error('로컬 로그인 기능을 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 로그인해 주세요.');
      error.code='local-preview';throw error;
    }
  },
  teacherError(error) {
    if(error?.code==='local-preview')return error.message;
    const messages = {
      'auth/popup-blocked':'로그인 창이 차단되었습니다. 팝업을 허용하거나 임시 로그인을 선택해 주세요.',
      'auth/popup-closed-by-user':'Google 로그인을 완료하지 않았습니다. 다시 선택하거나 임시 로그인을 이용해 주세요.',
      'auth/cancelled-popup-request':'다른 로그인 창을 확인하거나 다시 로그인해 주세요.',
      'auth/wrong-password':'비밀번호를 확인하고 다시 입력해 주세요.',
      'auth/invalid-credential':'비밀번호를 확인하고 다시 입력해 주세요.',
      'auth/invalid-login-credentials':'비밀번호를 확인하고 다시 입력해 주세요.',
      'auth/user-not-found':'임시 교사 계정 설정을 관리자에게 확인해 주세요.',
      'auth/operation-not-allowed':'이 로그인 방식이 아직 설정되지 않았습니다. 관리자에게 확인하거나 다른 방식을 선택해 주세요.',
      'auth/user-disabled':'사용이 중지된 계정입니다. 관리자에게 확인해 주세요.',
      'auth/too-many-requests':'로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
      'auth/network-request-failed':'연결을 확인한 뒤 다시 로그인해 주세요.',
      'permission-denied':'교사 권한을 확인하지 못했습니다. 관리자에게 계정 등록 상태를 확인해 주세요.'
    };
    return messages[error?.code] || (error?.message?.startsWith('교사 권한이 없습니다.') ? error.message : '로그인을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
  },
  async token() {
    const user = await this.student();
    return user.getIdToken ? user.getIdToken() : '';
  },
  async signOut() {
    if(this.isDemo()&&window.localPreview)await window.localPreview.signOut();
    const auth = await this.ready();
    if (auth) await auth.signOut();
    this.pending = null;
    if (typeof isTeacherAuthenticated !== 'undefined') isTeacherAuthenticated = false;
  }
};

window.finishSharedSession = async function () {
  if (window.studentEvalApp?.joined && !window.studentEvalApp.isSubmitted) {
    alert('제출하지 않은 평가 답안이 있습니다. 먼저 제출하거나 선생님께 확인해 주세요.'); return;
  }
  if (!confirm('이 창의 로그인과 임시 작업을 지우고 사용을 종료할까요?')) return;
  try { await window.authService.signOut(); window.isSessionClosing=true; sessionStorage.clear(); location.reload(); }
  catch(error) { alert('로그아웃하지 못했습니다. '+error.message); }
};
