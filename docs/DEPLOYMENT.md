# 운영 배포 기록

2026-09-12 · 사용자 승인에 따른 GitHub·Vercel·Firestore 배포

* 운영 주소: https://algorithm-studio-ten.vercel.app/
* GitHub: https://github.com/DonghyunT/algorithm-studio
* 배포 제품: `58f68af`, main 병합 `77294c124214278b69540312bb53678c94d162cc`
* Vercel 배포: `dpl_tkAqUtzRGVNdesRLcQpizVck8oZk`, Ready. 고정 운영 도메인 연결 확인.
* GitHub 검사: https://github.com/DonghyunT/algorithm-studio/actions/runs/34694833363 — success
* Firebase: `donghyun-algo`의 기본 DB. 새 `classrooms/2-1`~`2-11` 문서 생성. 기존 `eval_sessions`와 학생 테스트 자료는 그대로 보존.
* Google·Anonymous 공급자 활성화. 고정 Vercel 도메인, localhost, 127.0.0.1 승인 도메인 등록.
* Firestore 보안 규칙 컴파일·배포 완료.
* 운영 환경변수: 기존 `UPSTAGE_API_KEY` 유지, `FIREBASE_PROJECT_ID=donghyun-algo`, `AI_DAILY_LIMIT=300` 추가. 비밀 값은 기록하지 않음.

## 검증 근거

1. Node 테스트 12개 통과. 회차 보관, 새 학생 입장, 재시작 방지, 트랜잭션 실패 시 기존 답안 유지 포함.
2. 로컬 Edge 브라우저 시나리오 18개 통과. `tests/results/browser.json`.
3. 실제 Firestore 학생 권한 검사 13개 통과. `tests/results/firestore-live.json`. 새로 생성한 빈 2-11 학급에서 검사하고 임시 답안·Auth 계정을 제거한 뒤 대기 상태 복원.
4. 실제 운영 화면에서 시연 모드 꺼짐, 익명 로그인, 학급 조회 확인. API 요청 1회 HTTP 200 및 AI 응답 확인. `tests/results/production.json`, `tests/results/production.png`. 임시 인증 계정 제거 완료.

## 남은 확인

교사 Google 계정의 최초 로그인과 실제 UID에 대한 `teachers/{uid}.enabled=true` 등록이 남았습니다. 이메일만으로 별도 계정을 미리 생성하지 않았습니다. 최초 로그인 전에는 교사 화면 이용이 완료된 상태가 아닙니다.

실제 교사 브라우저와 학생 브라우저의 공동 운영, 27명 동시 사용, CSV의 NEIS 가져오기, 서버 보관 기간은 별도 확인 대상입니다. 원본 감사 35건 전체 해결이나 교실 운영 무결성을 선언하지 않습니다.
