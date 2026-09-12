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

최초 배포 당시에는 교사 Google 로그인과 UID 역할 연결이 남아 있었습니다. 이후 실제 로그인 계정의 교사 역할 연결을 완료했고, 사용자가 로그인 성공을 확인했습니다. 이는 학급 전체의 공동 운영 검증을 뜻하지 않습니다.

실제 교사 브라우저와 학생 브라우저의 공동 운영, 27명 동시 사용, CSV의 NEIS 가져오기, 서버 보관 기간은 별도 확인 대상입니다. 원본 감사 35건 전체 해결이나 교실 운영 무결성을 선언하지 않습니다.

## 2026-09-12 UI 개편 미리보기

* 제품 커밋: `af3b2f5ba3ed099c76902d715ab1102c2be3508b`, 브랜치 `codex/responsive-studio-ui`.
* 변경·검증 내용: [UI 개편 검토서](UI_REVIEW.md). 문법·로컬 파일 참조 확인, 기본 기능 12개 및 브라우저 시나리오 23개 통과, 페이지 예외·콘솔 오류 0개.
* GitHub 검사: https://github.com/DonghyunT/algorithm-studio/actions/runs/34697423638 — success.
* Vercel 미리보기: https://algorithm-studio-nu4bl2v31-donghyun2.vercel.app/ — Ready, `dpl_ArkD7pHKrSxykmCdir3kxxA5KTip`.
* 미리보기는 Vercel 로그인 보호가 적용되어 있습니다. 실제 브라우저 접근 시 Vercel 로그인 화면을 확인했으며, 이 미리보기에서 Google 교사 인증·운영 DB 저장·AI 응답을 확인했다고 간주하지 않습니다.
* 운영 반영 승인: 자동 승인 검토가 별도 병합 승인을 요구한 뒤, 사용자가 “병합하고 기존 주소에 배포해주세요”라고 명시적으로 승인했습니다. 아래 운영 배포 결과가 기록되기 전까지 미리보기 검증과 운영 검증을 구분합니다.

### 운영 UI 배포 확인

* `42512574e0e4ee2472177bcd8b36770f30f7d513`에서 UI 브랜치를 main에 병합했습니다.
* Vercel Production `dpl_Ay8QMzDoNBrHXqBDaZ2GRatgd1UE` (`algorithm-studio-fmm3o4ygh-donghyun2.vercel.app`) Ready, `algorithm-studio-ten.vercel.app` 연결 확인.
* main GitHub 검사: https://github.com/DonghyunT/algorithm-studio/actions/runs/34697588279 — success.
* 운영 주소의 HTML·CSS·JS 7개가 로컬 검증본과 일치합니다. 1440/1024/390px에서 홈·개념·전체 메뉴 키보드 조작·교사용 버튼 접근·평가 입장을 확인했습니다. 시연 모드는 꺼져 있으며 이번 운영 검사는 학생 입장·DB 쓰기·AI 호출을 수행하지 않았습니다.
* 최초 운영 UI 확인에서는 페이지 예외는 없었으나 기존 `favicon.ico` 누락 404가 있었습니다. 같은 배포 작업에서 외부 요청이 필요 없는 SVG 탭 아이콘을 추가하여 보완합니다. 최종 재확인 결과는 `tests/results/ui-production.json`에 보관합니다.
