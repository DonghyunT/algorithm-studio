# 개발·배포 관리 연결 상태

확인일: 2026-09-12. 제품 배포와 운영 DB 변경 없이 관리 연결을 점검했다.

## Vercel

* 공식 CLI 로그인 성공, 프로젝트 목록 조회 성공, 기존 프로젝트로 로컬 연결 완료.
* 범위: `donghyun2`
* 프로젝트: `algorithm-studio`
* 프로젝트 ID: `prj_Y9KY7UHDZcooYKpWxzprF1BxevwX`
* 팀 ID: `team_MHMJwWab9VuvTLN1mauNKE8W`
* 운영 주소: https://algorithm-studio-ten.vercel.app
* 로컬 연결 정보: `.vercel/project.json` (Git 제외)
* `UPSTAGE_API_KEY`: Production, Preview에 Secret으로 등록됨. 값은 출력하지 않았으며 실제 AI 요청·키 유효성은 미검증. Development에는 목록상 등록되지 않음.
* CLI link가 `.env.local`에 개발 연결용 OIDC 토큰을 생성했다. 이 파일은 Git 제외이며 비밀 값을 문서에 복사하지 않는다.
* Vercel MCP 인증 저장은 확인됐으나 현재 대화에는 직접 호출 도구가 없다. 다른 작업의 `teams: []` 결과만으로 프로젝트 부재를 판단하지 않는다. 위 팀·프로젝트 ID로 직접 조회할 수 있는지 다음 MCP 세션에서 검증한다. CLI를 통한 기존 프로젝트 관리는 가능하다.

## Vercel CLI의 한글 컴퓨터 이름 문제

이 PC의 Vercel CLI 59.16.0은 OAuth 요청의 user-agent에 한글 hostname을 넣어 ByteString 오류가 났다. 패키지 코드에서 hostname이 헤더에 들어가는 것을 확인했다. 시스템 컴퓨터 이름을 바꾸지 않고 해당 Node 프로세스에서만 `os.hostname`을 ASCII 이름으로 대체하고 `syncBuiltinESMExports()`를 호출한 뒤 CLI를 로드하여 로그인·프로젝트 조회·link·환경 변수 목록 조회에 성공했다. 같은 버전으로 실행할 때 이 우회가 다시 필요할 수 있다. 패키지 자체는 수정하지 않았다.

## Firebase

* 프로젝트: `donghyun-algo`
* Firestore: `(default)`, `asia-northeast3`
* 기존 CLI 인증으로 DB 관리 정보 조회 성공.
* Firebase MCP 직접 초기 연결 및 도구 55개 목록 조회 성공. 앱 세션에 도구가 로드되는지는 별도 검증 대상.
* 로컬 Codex 설정에는 검증된 Node·Firebase CLI 절대 경로와 120초 시작 대기시간이 설정돼 있다. 다른 PC나 npm 캐시 삭제 후에는 해당 경로를 재확인해야 한다.
* 제공된 콘솔 화면에 평가 세션 자료가 있으므로 빈 DB로 가정하지 않는다. 실제 학생 자료인지 테스트 자료인지는 아직 미확인.

## 남은 사항

관리 연결 완료는 운영 준비 완료를 뜻하지 않는다. 배포된 Firestore 규칙·권한 검증, 저장·복구·채점 오류 수정, 테스트 자료를 이용한 통합 검증, 최소 실제 AI 호출 검증이 남아 있다. 이번 연결 작업에서는 학생 답안 조회, DB 쓰기, 규칙 배포, Git push, 앱 배포, 유료 AI 요청을 하지 않았다.
