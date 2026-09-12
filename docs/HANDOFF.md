# 다른 PC에서 개발 이어가기

갱신: 2026-09-13. 코드 전달 기준은 GitHub `main`입니다. 운영 주소는 https://algorithm-studio-ten.vercel.app/ 이며 저장소는 https://github.com/DonghyunT/algorithm-studio 입니다.

## 지금 인수인계할 작업

* 작업 공간 개선과 자유 설계 수행평가, Solar 초벌 검토·교사 확정은 운영 배포되었습니다. 이전 평가 회차는 유지합니다. 새 문항은 기존 평가 종료 후 새 평가 준비에서 적용됩니다.
* 이번 승인된 작업: 교사 평가 상태 안내와 단일 조작 버튼. 준비 전 → 입장 대기 → 평가 중 → 평가 종료에 따라 평가 준비 → 평가 시작 → 평가 종료 → 새 평가 준비로 전환합니다. 사용자는 간단한 검증 후 병합·배포까지 승인했습니다.
* 위 버튼 작업 상태: **구현·로컬 검증 완료, 병합·배포 준비 중**. 작업 브랜치는 `codex/teacher-session-control`입니다. [변경과 검증](TEACHER_CONTROLS_REVIEW.md)을 확인합니다. 완료 후 이 문서와 PRD·배포 기록을 갱신합니다. 다른 PC에서 같은 파일을 동시에 수정하지 말고 먼저 원격 브랜치 상태를 확인합니다.
* 현재 운영 기준은 [배포 기록](DEPLOYMENT.md), 데이터 구조는 [DATABASE.md](DATABASE.md)를 확인합니다. `students`는 현재 회차, `archives`는 이전 회차이며 병존이 정상입니다.

## 노트북으로 가져오기

Git과 Node.js 24를 설치한 개발 환경을 기준으로 합니다. 폴더 경로는 달라도 됩니다. 새 노트북에 저장소가 없다면 먼저 원하는 상위 폴더에서 실행합니다.

```powershell
git clone https://github.com/DonghyunT/algorithm-studio.git
cd algorithm-studio
```

이미 저장소를 내려받았다면 해당 폴더에서 아래 순서로 실행합니다. `git status`에 수정 파일이 있으면 먼저 그 작업을 커밋하거나 별도로 보관하고 진행합니다. 강제 초기화로 덮어쓰지 않습니다.

```powershell
git status
git switch main
git pull --ff-only origin main
git log -3 --oneline
```

새 개발을 시작할 때는 목적에 맞는 별도 `codex/…` 브랜치를 만듭니다. 진행 중인 위 작업을 넘겨받는 상황이라면 `git fetch origin` 후 원격 작업 브랜치를 확인하고 이어갑니다. `pull`은 코드·문서만 가져오며 Firestore 자료를 복사하거나 배포를 실행하지 않습니다.

## 로컬 실행과 기본 검사

제품 프런트엔드는 별도 npm 설치·번들 빌드가 필요 없습니다.

```powershell
node tools/preview.cjs
```

브라우저에서 http://127.0.0.1:4173/index.html?demo=1 을 엽니다. 이 미리보기는 운영 Firebase 초기화를 차단하므로 실제 학생 자료를 변경하지 않습니다. 같은 주소의 별도 탭에서 교사·학생 역할을 시험할 수 있습니다. 실제 AI·Google 로그인·운영 저장 검증은 이 시연과 다릅니다. 서버 종료는 터미널에서 Ctrl+C입니다.

별도 터미널에서 기본 검사를 실행합니다.

```powershell
node tools/check.cjs
node --test tests/*.test.cjs
```

브라우저 자동 검사는 Playwright와 브라우저가 필요합니다. 기존 PC 경로가 기본값인 검사에는 새 PC의 `PLAYWRIGHT_MODULE`(설치된 Playwright 모듈 절대 경로), `BROWSER_EXE`(Edge/Chrome 실행 파일 절대 경로)를 지정합니다. 테스트 도구 설정을 위해 제품에 프레임워크를 도입할 필요는 없습니다.

## Git으로 옮겨지지 않는 설정

* GitHub 푸시 권한, Vercel·Firebase CLI 로그인과 MCP 연결은 PC마다 별도입니다. 코드 수정·로컬 시연부터 시작할 수 있으며, 원격 작업이 필요할 때 해당 계정으로 인증합니다.
* `.vercel/`, `.env*`, 로컬 AI 비밀 설정과 인증 토큰은 저장소에 포함되지 않습니다. 비밀 값을 문서에 붙여 넣거나 이전 PC의 인증 폴더를 통째로 복사하지 않습니다.
* GitHub `main` 푸시는 기존 Vercel 자동 배포에 연결되어 있습니다. 새 PC에서 프로젝트·DB를 새로 만들 필요는 없습니다. 운영 Firebase 프로젝트는 `donghyun-algo`, Vercel 프로젝트는 `algorithm-studio`입니다.
* 운영 AI 환경 변수는 Vercel에 남아 있습니다. 단순 clone/pull이나 로컬 UI 작업을 위해 내려받을 필요는 없습니다.
* 서버의 학생 기록·교사 권한은 Firebase에 남습니다. 브라우저 시연 데이터·미커밋 파일·무시된 로컬 파일은 다른 PC로 자동 이동하지 않습니다.

## 다음 에이전트에게 전달할 문장

> AGENTS.md, INTENT.md, PRD.md와 docs/HANDOFF.md를 읽고 Git 원격·로컬 상태를 확인해 주십시오. 완료된 배포와 진행 중 작업을 구분하고 기존 변경을 보존하며 이어서 작업해 주십시오.

실제 Solar 채점 품질, 학급 동시 사용과 보관 기간, 감사 보고서의 미해결 항목은 완료로 단정하지 않습니다. 상세 검증 범위는 PRD와 각 검토서에 기록되어 있습니다.
