# 다른 PC·에이전트로 작업 이어가기

갱신: 2026-09-18 KST. 기능 명세는 [PRD](../PRD.md), 운영 반영 근거는 [배포 기록](DEPLOYMENT.md)이 기준입니다.

## 1. 현재 상태

| 구분 | 인수인계 기준 |
|---|---|
| 현재 운영 브랜치 | main |
| 현재 작업 브랜치 | main (codex/eval-score-reveal-ui-polish 병합 완료) |
| 현재 평가 운영 상태 | 선생님 확인에 따라 V4 실전평가도 운영에 적용 중이며, V3는 모의평가·기존 회차 호환용으로 유지 |
| 인수인계 전달 기준 | 1) [순서도 흐름]/[알고리즘] 단락이 cbt-condition-box 섬으로 렌더링되도록 formatCbtPrompt 정규식 확장, 2) V4 교사 상세 조회의 학급 ID 전달 오류 수정, 3) V4 객관식 답안의 선지 번호·문구 표시 보완, 4) 학생 본인 전용 V4 객관·단답 점수 API 및 누르는 동안만 표시 UI, 5) 관련 권한·평가 API·UI 38개 테스트 및 운영 정적 파일·화면 확인 |
| 최신 제품 코드 | `api/evaluation.js`(`student-score` 본인 전용 서버 점수 조회), `js/core/ai-service.js`(보안 점수 요청), `js/labs/lab-eval.js`(V4 점수 폴링·누르는 동안 표시), `index.html`(점수 보기 UI), `js/core/classroom.js`(V4 교사 답안 표시), `css/common.css`(조건 카드 들여쓰기 보존) |
| 최신 제품 코드 커밋 | `3a4575b` — feat: polish evaluation score reveal layout and masking interaction |
| 배포 기록 | Vercel Production (`https://algorithm-studio-ten.vercel.app/`)에 반영 완료 |
| 현재 평가 UI | 평소에는 점수판과 세부 카드가 `🔒 • •`로 보호되고, 버튼을 누르고 있는 동안에만 제자리에서 선명하게 열리는 토스/애플 스타일 프라이버시 카드 적용 |
| 이번 구현 완료 내용 | 1) 학생 점수 확인 화면에서 '점수 보기' 중복 노출 및 하단 덜컹거림 패널 개선, 2) 대형 점수판 및 Part 1·2 카드를 `🔒 • • / 60점`, `🔒 •• / 30점`으로 마스킹하고 누르는 동안에만 해당 영역에 직접 점수 표시, 3) 긴 안내문구를 간결화하고 하단 중복 텍스트 박스를 스크린리더용(`sr-only`)으로 전환, 4) 관련 단위 테스트 90개 100% 통과 |
| 최신 운영 의도 | 점수판과 카드 자체가 블라인드 마스킹되어 시각적 위계와 카드 높이가 흔들림 없이 고정됨 |
| 이번 교사 조회 수정 | `currentSelectedClass` 표시명(`2학년 1반`)을 V4 보안 API가 요구하는 ID(`2-1`)로 변환하고, 0-based 객관식 답안을 `1번 (선지 내용)` 형식으로 표시. 기존 답안·Firestore 자료·채점 로직은 변경하지 않음 |

- 저장소: [DonghyunT/algorithm-studio](https://github.com/DonghyunT/algorithm-studio)
- 운영 웹: [정보 알고리즘 스튜디오](https://algorithm-studio-ten.vercel.app/)
- 기존 프로젝트: Firebase **donghyun-algo**, Vercel **algorithm-studio**. PC가 달라져도 프로젝트·DB를 새로 만들지 않습니다.
- 이전 인수인계는 [보존본](HANDOFF_HISTORY_2026-09-15.md)에 있습니다. 과거의 미배포 표현을 보고 다시 병합·배포하지 않습니다.

## 2. 읽는 순서와 다음 작업

1. [AGENTS](../AGENTS.md) → [INTENT](../INTENT.md) → [PRD](../PRD.md) → 이 문서를 읽습니다.
2. **실전평가 V4 운영 적용·교사 상세 조회·학생 점수 표시 수정 완료:** Vercel Production에 V4 운영 설정과 `559fc09` 수정이 반영되어 사용 중입니다. `node tools/check.cjs`와 관련 인증·학급 권한·평가 API·V4 결과 UI 테스트 38개를 통과했고, 운영 정적 JS·HTML HTTP 200 및 학생 탭 콘솔 오류 없음을 확인했습니다. 학생 점수 API는 본인 제출 자료의 Part 1·2 소계만 반환하고, 결과 화면의 `점수 보기`를 누르는 동안에만 표시합니다. 샘플 V4 답안의 교사 객관식 번호·문구 매핑은 앞선 작업에서 확인했습니다. 현재 읽기 전용 운영 탭에는 새 V4 제출 카드가 없어 학생 버튼의 운영 실데이터 조작 확인은 하지 않았으며, 다음 V4 제출 자료에서 이어갑니다. 관련 최신 기록은 선생님 운영 확인과 [배포 기록](DEPLOYMENT.md)을 기준으로 합니다.
3. **다음 작업:**
   - 다른 PC에서는 `git switch main && git pull --ff-only origin main`으로 최신 커밋을 받아서 작업을 시작합니다.
   - 교실 환경에서 모의평가(V3) 및 실전평가(V4) 라이브 시험을 원활히 진행하고 관찰합니다.
   - 선생님의 추가 UI/UX 요청이나 운영 피드백이 있을 경우 새 작업 브랜치를 생성하여 진행합니다.

## 3. 다른 PC에서 받기

Git과 Node.js 24를 사용합니다. 저장소 폴더·사용자 이름은 달라도 됩니다. 완료된 작업은 main으로 통합하고 다른 PC는 최신 main에서 새 작업 브랜치를 만듭니다.

처음 받는 PC:

~~~powershell
git clone https://github.com/DonghyunT/algorithm-studio.git
cd algorithm-studio
git switch main
~~~

이미 저장소가 있는 PC는 먼저 확인합니다:

~~~powershell
git status
git branch -vv
git log -n 5 --oneline
git fetch origin
~~~

수정 파일이나 아직 push하지 않은 커밋이 있으면 기존 작업을 먼저 보존합니다. 깨끗한 상태에서:

~~~powershell
git switch main
git pull --ff-only origin main
git status
git log -n 5 --oneline
~~~

fast-forward 불가 오류는 로컬과 원격 이력이 갈라졌다는 뜻입니다. 강제 초기화·강제 push로 해결하지 말고 미반영 작업부터 확인합니다. 문서를 읽고 새 작업의 목적을 정한 뒤 브랜치를 만듭니다. 아래 이름은 예시이며 실제 작업에 맞춰 정합니다:

~~~powershell
git switch -c codex/next-task
~~~

**기본 협업 순서:** 최신 main 받기 → 작업별 브랜치 → 수정·검증 → PR(변경 검토 기록) → 선생님 승인 후 main 병합 → 자동 배포 확인. 완료된 브랜치는 병합 여부와 다른 작업의 사용 여부를 확인한 뒤 정리할 수 있습니다. 아직 진행 중인 작업만 해당 브랜치로 인수인계합니다.

clone/fetch/pull은 소스·문서만 가져오며 Firebase 자료를 복사하거나 배포하지 않습니다. main push는 Vercel 운영 자동 배포와 연결됩니다. 작업 브랜치 Preview도 운영 Firebase와 자동 분리되는 것은 아닙니다. 일반적인 협업 흐름의 참고: [GitHub flow 공식 안내](https://docs.github.com/en/get-started/using-github/github-flow), 2026-09-15 확인.

## 4. 로컬 실행과 필요한 검사

제품 프런트엔드는 npm 설치·번들 빌드가 필요 없습니다.

~~~powershell
node --version
node tools/preview.cjs
~~~

[로컬 시연](http://127.0.0.1:4173/index.html?demo=1)을 열고 종료할 때 Ctrl+C를 누릅니다. 이 서버는 운영 Firebase 초기화를 차단합니다. 외부 CDN·SDK 때문에 인터넷은 필요할 수 있으며 실제 로그인·서버 저장 검증과 다릅니다.

새 PC 기본 검사(CI도 동일):

~~~powershell
node tools/check.cjs
node --test tests/*.test.cjs
~~~

브라우저 검사는 필요한 기능 변경 때만 실행하며 위 단위 검사와 별개입니다. tests/browser.cjs 등은 **PLAYWRIGHT_MODULE**, **BROWSER_EXE** 환경 변수로 새 PC의 실제 설치 경로를 지정합니다. 기존 기본 경로는 과거 PC 경로입니다. 아래 꺾쇠 부분을 실제 경로로 바꿉니다:

~~~powershell
$env:PLAYWRIGHT_MODULE = '<playwright 모듈 폴더의 절대 경로>'
$env:BROWSER_EXE = '<Edge 또는 Chrome 실행 파일의 절대 경로>'
$env:BROWSER_TEST_OUTPUT = 'temp/browser-results'
node tests/browser.cjs
~~~

**audit/*.cjs는 과거 환경 경로가 직접 들어 있는 재현 자료**로 새 PC 기본 검사 목록이 아닙니다. 재사용 시 경로 조정이 필요합니다. 개발 도구 설정 때문에 제품에 프레임워크·빌드 체계를 도입하지 않습니다.

실제 AI 체험은 선택 사항입니다. **node tools/preview.cjs --ai** → [4174 시연](http://127.0.0.1:4174/index.html?demo=1). 교사용 로컬 로그인에는 새 PC에서 자동 생성되는 .env.preview.local 비밀번호를 사용합니다. 실제 운영 AI 사용량을 소비하며 운영 학생 DB·교사 계정 검증은 아닙니다. [상세 범위](SEMANTIC_REVIEW_LOCAL_PREVIEW.md).

## 5. Git으로 전달되지 않는 것

| 항목 | 준비 방법 |
|---|---|
| 실제 학생 자료·교사 역할·서버 보관 기록 | 기존 Firebase에 남음. clone 과정에서 초기화·재등록하지 않음 |
| Vercel 운영 AI 환경 변수 | 기존 서비스에 남음. UI 개발을 위해 내려받을 필요 없음 |
| GitHub·Firebase·Vercel 인증 | 필요한 PC에서 개별 로그인. 인증 폴더 통째로 복사 금지 |
| 운영 교사 비밀번호 | 관리자에게 별도 전달받음. 이 PC에 비밀번호 파일이 있다고 가정하지 않음 |
| .env.preview.local | 로컬 AI 체험 첫 실행 시 PC마다 생성 |
| scratch/eval_bank_v4.json | Vercel 환경 변수에 영구 보관 (아래 5.1 절차 참조) |

### 5.1 다른 PC에서 실전평가 비공개 문제은행(V4) 다루기
1. **운영 평가 개설 시 (교단 PC 등)**: Vercel Production에 이미 `EVAL_BANK_V4_JSON`과 `EVAL_ASSIGNMENT_SECRET`이 등록되어 있으므로, 어떤 PC에서든 운영 웹([정보 알고리즘 스튜디오](https://algorithm-studio-ten.vercel.app/))에 접속하여 바로 평가를 개설할 수 있습니다. 로컬 파일 다운로드가 필요 없습니다.
2. **다른 PC에서 로컬 문항 조회 및 오프라인 테스트가 필요한 경우**:
   - Vercel CLI 사용 시: `npx vercel env pull .env.local` 명령으로 안전하게 주입받습니다.
   - 대시보드 사용 시: Vercel 대시보드(Settings > Environment Variables)의 `EVAL_BANK_V4_JSON` 내용을 복사하여 `scratch/eval_bank_v4.json`으로 저장합니다. (`.gitignore`에 의해 Git 추적에서 영구 제외되어 GitHub 유출 위험이 없습니다.)
| V4 비공개 문항·배정 비밀값 | Vercel 환경 변수(EVAL_BANK_V4_JSON, EVAL_ASSIGNMENT_SECRET)에 등록 완료. 공개 Git에 절대 커밋 금지 |
| 미커밋·Git 제외 자료 | 자동 이동하지 않음. 필요한 개인 자료만 별도 확인 |

이번 점검의 Git 제외 목록에는 temp/가 있었습니다. 내용은 인수인계 대상으로 확정하거나 업로드하지 않았습니다. .env*, .vercel/, js/data/config.js, PDF, 백업용/도 제외 규칙 대상입니다. 제외 규칙과 실제 파일 존재는 다릅니다. 백업용/은 수정·삭제하지 않습니다.

## 6. 남은 한계와 주의할 재개 작업

- **V3 정답이 학생 코드에 포함되는 기존 한계는 V4 기반 배포만으로 해소되지 않습니다.**
- 운영 /api/evaluation GET의 405 응답은 API 반영 확인이며 실제 V4 배정·제출·권한 전체 검증이 아닙니다.
- V4 문항 은행·배정 비밀값을 바꾸면 과거 배정·채점 재현에 영향을 줄 수 있습니다. 회차별 보관·버전 관리 방식을 확정하기 전 운영 값을 교체하지 않습니다. 현재 V4가 운영 중이라는 사실과 회차 재현·복구 검증 완료는 구분합니다.
- 학급 동시 사용, 교실 기기·네트워크, Solar 채점 타당성, 다음 차시 이어하기·서버 보관/삭제 기간은 별도 확인·결정 대상입니다. 과거 감사 항목 전체가 해결되었다고 단정하지 않습니다.
- tools/provision-*.cjs, tools/close-idle-classrooms.cjs 등은 PC 설정용 기본 명령이 아닙니다. 계정·DB 준비·대기실 종료를 인수인계 과정에서 실행하지 않습니다.
- 과거 PC의 Vercel CLI에는 비 Latin 문자 ByteString 오류 기록이 있습니다. 조회 오류만으로 재배포하거나 프로젝트를 새로 만들지 않습니다.

## 7. 확인 기록 — 이전 인수인계와 이번 문서화 구분

이전 인수인계 정비 기록: 2026-09-15 Windows/PowerShell·Node.js v24.19.0, 시작 기준 c73e8c4에서 Git 상태·최근 이력·실제 원격 main 일치, 문서·개발 명령·CI 설정·제외 목록을 확인했습니다. 코드 전수 검토·운영 DB 검사·유료 AI 호출·학급 시나리오 재검증은 이번 범위가 아닙니다. 이전 제품 검사 결과는 해당 검토서와 배포 기록을 따릅니다.

문서 정리 후 6개 문서의 내부 파일 링크 63개, 기존 인수인계 원문 보존, git diff --check를 확인했습니다. node tools/check.cjs는 스크립트 62개 문법과 HTML 로컬 참조 검사에 통과했습니다. 제품 동작 변경이 없어 전체 단위·브라우저 회귀 검사는 반복하지 않았습니다.

이번 V4 방향 문서화(2026-09-15, 기준 7d24e50)는 문서·핵심 구조의 제한적 확인이며 새로운 운영 검증이 아닙니다. V4 계획의 검증표는 향후 수용 기준입니다. 문항 보관·API·DB 스키마·환경 변수는 변경하지 않았습니다. 변경한 문서 5개의 내부 파일 링크 49개와 제목 연결 6개, 네 검토 영역의 공통 형식, git diff --check를 확인했습니다. 이번에 제품 전체 검사·브라우저·운영 DB 검증은 반복하지 않았습니다.

## 다음 에이전트에게 전달할 문장

> AGENTS.md, INTENT.md, PRD.md, docs/HANDOFF.md를 읽고 작업을 이어가 주세요. 먼저 기존 작업을 보존하고 최신 main을 받은 뒤 새 작업 브랜치를 만들어 주세요. V4도 현재 운영 중이며 V3는 모의평가·기존 회차 호환용입니다. PR #3의 main 반영 여부도 확인해 주세요. V4 운영 적용을 근거로 회차 재현·비공개 보관·교실 전체 검증까지 완료되었다고 표현하지 말고, PRD 3.5절과 V4 계획 8~12절을 먼저 읽어 주세요. 완료된 기반을 재구축하거나 재배포하지 말고 다음 문항 품질 작업 범위와 운영 보완 조건을 확인해 주세요.
