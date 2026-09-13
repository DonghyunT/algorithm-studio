# 강사 계정과 담당 학급 접근

2026-09-14 KST. 기준 `3842f58`, 작업 브랜치 `codex/instructor-class-access`. 사용자가 선생님 전체 반·강사님 10·11반 권한과 데이터베이스 설정부터 웹 배포까지 승인했습니다. 직전 튜터·실습 제출·AI 의미 검사·변수 화면 개선도 함께 배포하는 범위입니다.

## 운영 방식

선생님은 기존 Google 로그인, 강사님은 교사용 → 교사 비밀번호 로그인으로 접속합니다. 강사님용 내부 이메일은 앱에 지정되어 별도 입력하지 않습니다. 비밀번호는 `.env.instructor.local`의 `INSTRUCTOR_PASSWORD` 값이며 Git과 배포에서 제외됩니다. 이 문서·코드·검증 출력에는 비밀번호를 기록하지 않습니다. 선생님이 강사님께 직접 전달합니다. 로컬 체험 `.env.preview.local`과 별개의 운영 계정입니다.

계정 UID와 역할:

* 기존 선생님 `lb20pFOCGybl1EXmMA5iVShKi7Y2`: `enabled:true, allClasses:true`.
* 강사님 `UqZwPkn9bwQ7z4XNYpFOoIPBjnr2`: `enabled:true, allClasses:false, classIds:['2-10','2-11']`.

브라우저는 담당 반만 표시하고, 로그인·새로고침 복원 시 Firestore 역할을 읽습니다. 평가 시작·종료·준비·점수 저장·재시험 시 담당 반을 다시 확인합니다. 실제 접근 제어는 Firestore 규칙이 수행합니다. 학급·학생·보관 문서의 교사 읽기·쓰기 모두 범위를 확인하며 범위 누락·비활성은 거부합니다. `/api/assessment`는 다른 반 요청을 답안 조회와 유료 호출보다 먼저 거부합니다. 학생의 익명 인증은 교사 권한과 분리됩니다.

최종 검토에서 공유 PC의 늦은 로그인 성공과 권한 회수 화면을 보완했습니다. 취소한 로그인 결과가 도착하면 같은 UID의 인증만 해제하여 그 사이 바뀐 계정을 로그아웃시키지 않습니다. 구독이 거부되면 구독·타이머를 중단하고 학생 목록·열린 답안·점수 입력을 지웁니다. 이는 오류 수신 시 화면 정리이며 이미 읽은 데이터를 원격에서 회수하는 기능은 아닙니다.

권한 변경은 Firebase 관리자만 할 수 있습니다. 강사 접근 중지 시 `teachers/{uid}.enabled=false`로 바꾸고 Authentication 계정도 비활성화합니다. 선생님 역할의 전체 범위를 제거하지 않습니다. 비밀번호 재설정은 Firebase 관리자에서 같은 UID 계정에 적용하며, 새 계정을 무작정 만들어 기존 역할과 분리하지 않습니다. 기존 학생 답안·성적·회차·보관 자료는 마이그레이션하지 않았습니다.

## 적용 순서와 근거

1. 기존 선생님의 Auth 이메일과 UID를 확인하고 전체 반 역할을 명시했습니다.
2. 강사 Auth와 역할을 비활성 상태로 준비했습니다.
3. Firestore 규칙 컴파일·배포를 완료했습니다.
4. 운영 규칙 원문이 로컬 검토본과 일치하는지 확인한 뒤 이메일/비밀번호 공급자와 강사 계정을 활성화했습니다.
5. 실제 강사·익명 계정 권한 검사 12건 통과. 고유 검증용 보관 문서만 생성하고 정리했으며 기존 학급·학생 자료는 변경하지 않았습니다.

`tools/provision-instructor.cjs`의 `--prepare`, `--activate`는 이 순서를 재현합니다. 이미 활성화된 계정을 prepare로 덮어쓰지 않습니다. 기존 로그인 세션을 보존하고 새 권한 필드를 추가했습니다. Google·익명 공급자는 유지했습니다.

검토에 사용한 공식 자료(2026-09-14): [Firestore 역할별 접근](https://firebase.google.com/docs/firestore/solutions/role-based-access), [쿼리와 보안 규칙](https://firebase.google.com/docs/firestore/security/rules-query), [관리자 계정 생성](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signUp), [계정 활성화·수정](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/update). 실제 적용 결과는 아래 검증으로 별도 확인합니다.

## 검증과 배포 상태

**운영 배포 완료:** 제품 `a1737d2`, 운영 병합 `b0bd14e`. Firebase 권한 검사 13개(운영 API 포함), 실제 운영 UI 4흐름을 통과했고 페이지·콘솔 오류는 없었습니다. 현재 전달 기준은 GitHub `main`입니다. [배포 기록](DEPLOYMENT.md)에서 운영 URL·검사 링크와 범위를 확인합니다.

공유 PC 후속 보완은 제품 `5affdfd`, 운영 병합 `b530f1d`로 배포했습니다. 단위/API 37개, 관련 교사 UI 18흐름, 기본 UI 24·학생 평가 10개를 통과했고 운영 강사 UI 4흐름을 다시 확인했습니다. DB 규칙과 계정 범위는 바꾸지 않았습니다.

단위/API 검사 36개 통과. 담당 반 허용·다른 반 거부·범위 누락·비활성·역할 복원·로그아웃과 기존 평가 정책을 포함합니다. 새 로컬 UI 4흐름은 강사 10·11반 표시, 타 반 전환 거부, 1440/1024/768/390px 화면, 선생님 전체 반 표시를 확인했습니다. 기존 전체 회귀와 운영 웹 최종 검증은 배포 기록에 이어 적습니다.

Firestore 실제 검사 도구 `tests/instructor-live.cjs --run`은 학생 자료의 내용을 출력하지 않으며 담당 반은 빈 목록을 전제로 검사합니다. `--production`을 추가하면 운영 AI 평가 API의 다른 반 거부도 확인하며 이 요청은 AI를 호출하지 않습니다. 운영 UI `tests/instructor-ui.cjs --production`은 실제 강사 로그인·반 선택·새로고침 복원·로그아웃을 검증하고 시험 시작·성적 변경은 실행하지 않습니다.

운영 웹 배포 및 GitHub 검사 결과는 `docs/DEPLOYMENT.md`에 기록합니다. 로컬 체험 서버와 비밀번호는 운영에서 활성화되지 않습니다. 실제 학급 동시 수업과 선생님 Google 팝업 재로그인은 이번 자동 검증 범위 밖입니다.
