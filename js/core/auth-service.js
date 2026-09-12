/* Shared-PC authentication. Roles are granted by an administrator, never by the browser. */
window.authService = {
  pending: null,
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
  async teacher() {
    if (this.isDemo()) return { uid: 'demo-teacher' };
    const auth = await this.ready();
    let user = auth.currentUser;
    if (!user || user.isAnonymous) user = (await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())).user;
    const role = await firebase.firestore().collection('teachers').doc(user.uid).get();
    if (!role.exists || role.data().enabled !== true) throw new Error('이 Google 계정에는 교사 권한이 없습니다. 관리자에게 계정 등록을 요청해 주세요.');
    return user;
  },
  async token() {
    const user = await this.student();
    return user.getIdToken ? user.getIdToken() : '';
  },
  async signOut() {
    const auth = await this.ready();
    if (auth) await auth.signOut();
    this.pending = null;
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
