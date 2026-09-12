/**
 * ==============================================================================
 * 🔥 [Firebase 클라우드 데이터베이스 설정 및 초기화 모듈]
 * ==============================================================================
 * - 프로젝트 ID: donghyun-algo
 * - 목적: 11개 반(2-1 ~ 2-11) × 최대 27명 실시간 동시 수행평가 통신
 * - 특징:
 *   1. Firebase Web SDK Compat (CDN) 기반 Zero-Dependency 순수 웹 표준
 *   2. 오프라인 또는 Firebase 미연동 시 BroadcastChannel 기반 로컬 에뮬레이션 자동 지원
 *   3. 인간이 한눈에 보고 쉽게 이해할 수 있는 직관적인 구성
 */

// 1. Firebase 프로젝트 설정 객체
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZs36UcL7wMs1vecC9N77ygzuvExanjbk",
  authDomain: "donghyun-algo.firebaseapp.com",
  projectId: "donghyun-algo",
  storageBucket: "donghyun-algo.firebasestorage.app",
  messagingSenderId: "283104372111",
  appId: "1:283104372111:web:ba59ae4d6a58f4f5d6d7fa"
};

// 전역 상태 보관용
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.firebaseDb = null;
window.isFirebaseReady = false;

/**
 * 2. Firebase 및 Firestore 인스턴스 초기화
 * @returns {object|null} Firestore DB 인스턴스
 */
function initFirebaseApp() {
  if (window.authService?.isDemo()) return null;
  // 이미 초기화된 경우 기존 인스턴스 반환
  if (window.firebaseDb) {
    return window.firebaseDb;
  }

  try {
    // Firebase CDN 스크립트 로드 여부 확인
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      window.firebaseDb = firebase.firestore();
      window.isFirebaseReady = true;
      console.info("Firebase SDK 초기화 완료. 서버 접근 권한은 요청 시 확인합니다.");
      return window.firebaseDb;
    } else {
      console.warn("Firebase SDK를 불러오지 못했습니다. 서버 기능을 사용할 수 없습니다.");
      return null;
    }
  } catch (err) {
    console.error("❌ [Firebase] 초기화 중 오류 발생:", err);
    window.isFirebaseReady = false;
    return null;
  }
}

// 스크립트 로드 시 즉시 초기화 시도
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initFirebaseApp();
  });
}
