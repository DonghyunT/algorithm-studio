# 운영 배포 기록

## 2026-09-13 작업 공간·수행평가 자유 설계 운영 배포

* 사용자가 빌드 완료 후 간단한 재검증, main 병합 및 운영 배포를 명시적으로 승인했습니다.
* 제품 커밋은 작업 공간 `432a4fd`, 수행평가 편집기·문항 `24bdc46`, 자유 설계·단일 실행·Solar 초벌 검토 `0d777f4`입니다. 읽기 전용 DB 점검 도구 `c456626`과 함께 main `ade1f7b6ebbe8069814c60e1aca9d220b4a57af5`로 병합·푸시했습니다.
* Vercel Production `dpl_4abR1eUeyny2zEZmh5fULViusUEA`, `algorithm-studio-aqf1ylexa-donghyun2.vercel.app`이 Ready이며 기존 [운영 주소](https://algorithm-studio-ten.vercel.app/) 연결을 확인했습니다. `/api/chat`과 새 `/api/assessment`가 함께 배포되었습니다.
* [GitHub main 검사](https://github.com/DonghyunT/algorithm-studio/actions/runs/34704645959)는 success입니다. 로컬 문법 검사 42개와 기본/API 검사 20개를 배포 전 재실행하여 통과했습니다. 앞선 로컬 브라우저 검증은 일반 23개·작업 공간 5개·수행평가 10개를 통과했습니다.
* 2026-09-13 01:19 KST 운영 확인: HTML·CSS·JS 15개가 로컬 제품과 일치합니다. Edge 1440/1024/390px에서 홈·개념·전체 메뉴 키보드 조작·교사 버튼 접근·평가 입장을 확인했습니다. 페이지 예외·콘솔 오류는 0개입니다. 새 API는 GET 405, 인증 없는 POST 401로 응답했습니다. [검증 결과](../tests/results/assessment-production.json), [운영 홈](../tests/results/assessment-production-home.png), [좁은 창](../tests/results/assessment-production-390.png).
* Firebase 11개 학급과 보관 자료를 읽기 전용으로 확인했습니다. `students`는 현재 회차, `archives/<회차>/students`는 이전 기록이며 회차 불일치는 없었습니다. 운영 규칙도 로컬 규칙과 일치했습니다. [DB 구조와 상세 근거](DATABASE.md), [조회 결과](../tests/results/firestore-structure.json).
* 기존 회차·답안·보안 규칙은 수정하지 않았습니다. 현재 진행 중인 이전 평가를 임의로 종료하지 않았습니다. **새 자유 설계 문항은 교사가 기존 평가를 종료하고 새 평가를 준비할 때 적용됩니다.**
* 이번 운영 검사는 Google 로그인·학생 입장·DB 쓰기·실제 Solar 호출을 수행하지 않았습니다. Solar 채점 품질은 모의 API 검사만으로 검증할 수 없으며 AI 제안과 교사 최종 확정은 분리되어 있습니다. 기존 감사 미해결 항목·동시 수업 운영·보관 기간 등은 계속 별도 검증 대상입니다.
* 이 기록을 추가하는 후속 커밋은 제품 코드와 배포 설정을 변경하지 않습니다.

## 이전 배포 이력

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
* 최초 운영 UI 확인에서는 페이지 예외는 없었으나 기존 `favicon.ico` 누락 404가 있었습니다. 외부 요청이 필요 없는 SVG 탭 아이콘으로 보완했습니다(`93e8f27`, main `3b0f6a6d2e016dece0818d67df1f597f31b1f131`). 보완 배포 `algorithm-studio-1ir2d5sk6-donghyun2.vercel.app` Production Ready.
* 최종 운영 재확인: 2026-09-12 22:55 KST, 7개 파일 일치·세 창 폭의 주요 동작 통과, 페이지 예외·콘솔 오류 0개. [검증 결과](../tests/results/ui-production.json), [운영 홈](../tests/results/ui-production-home.png), [좁은 창](../tests/results/ui-production-390.png).
* 보완 main 검사: https://github.com/DonghyunT/algorithm-studio/actions/runs/34697770550 — success. 이후 검증 기록만 추가한 커밋은 UI 제품 파일을 변경하지 않습니다.
