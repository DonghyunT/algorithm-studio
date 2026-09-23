# 다른 PC·에이전트로 작업 이어가기

갱신: 2026-09-23 KST. 기능은 [PRD](../PRD.md), 운영 반영 근거와 검증 범위는 [배포 기록](DEPLOYMENT.md)이 기준입니다.

## 1. 현재 상태

| 구분 | 인수인계 기준 |
|---|---|
| 운영 기준 | `main` (실시간 점수 수정 PR #5 merge `0c0c76e`; 제품 커밋 `2d13396`) |
| 현재 작업 | `codex/archive-history-ux-plan` — 교사용 보관 회차 답안 읽기 전용 조회 UI·서비스·로컬 검증 완료. 제품 변경과 문서 수정은 이 작업 브랜치에 있으며 PR·main 병합·운영 배포는 대기 중 |
| 최신 제품 수정 | V4 서버 점수 캐시를 `attemptId`로 격리해 이전 회차와 V3 모의평가 점수가 섞이지 않게 수정. 배포 근거는 [배포 기록](DEPLOYMENT.md) 참조 |
| 전달 기준 | 전체 테스트 127개, 정적 검사 72개, 로컬 Edge 점수 화면 확인 통과. Vercel Production 성공과 기존 운영 주소의 수정 JS 일치 확인. 전체 브라우저 흐름은 미완료이며 운영 DB·실제 교사 로그인은 확인하지 않음 |
| 평가 운영 | V4 실전평가 운영 중, V3 모의평가·기존 회차 호환 유지 |
| 운영 프로젝트 | Firebase `donghyun-algo`, Vercel `algorithm-studio` · 새 PC에서 재생성하지 않음 |
| 운영 웹 | [정보 알고리즘 스튜디오](https://algorithm-studio-ten.vercel.app/) |
| 저장소 | [DonghyunT/algorithm-studio](https://github.com/DonghyunT/algorithm-studio) |

최근 완료한 제품 변경 내역 (2026-09-22~23):
1. **컴퓨터실 시계 오차(Clock Skew) 방어 알고리즘 (`api/evaluation.js`, `ai-service.js`, `eval-service.js`, `lab-eval.js`)**:
   - 특정 PC의 윈도우 로컬 시계가 15분 빠르게 설정되어 있어 학생 타이머가 조기 종료 및 자동 제출되던 사고 원천 방지.
   - `api/evaluation`의 경량 `ping` 및 응답 헤더/바디의 `serverTime`을 통해 클라이언트가 `serverTimeOffset`을 자동 산출.
   - `getNow()` 메서드로 로컬 시계 오차를 자동 보정하여 학생 PC 시계 왜곡과 무관하게 정확한 정합성 보장.
2. **선생님 스케치 반영: 학생 관리 모달 좌우 2단 분할 개편 (`index.html`, `classroom.js`)**:
   - 모달 하단에 길게 세로로 나열되던 조치 버튼을 데스크탑 `max-w-6xl` 크기의 2단 분할 레이아웃으로 전면 개편.
   - 좌측 280px 액션 패널: 학생 미니 카드(좌석, 상태 뱃지, 이름, 실시간 카운트다운 타이머) + 상태별 스마트 버튼 그룹.
   - 상태별 스마트 노출:
     * 제출 완료(`submitted`): `[🔄 제출 취소 및 복귀 (+10분)]` (추천 메인), `[제출 취소 및 복귀 (+5분)]`
     * 풀이 중(`in_progress`): `[시간 +10분]`, `[시간 +5분]`, `[풀던 답안 유지 재접속 허용]`, `[현재 답안으로 정상 제출 마감]`
     * 결시/미응시: `[개별 30분 추가 응시 허용]`
     * 주의 조치(하단 분리): `[답안 초기화 (완전 백지화)]`, `[좌석 비우기 (퇴장 처리)]`
3. **제출 취소 및 풀던 답안 100% 보존 복귀 (`reopenStudentExam`)**:
   - 조기 제출된 학생의 답안(`Part 1~3`)을 완전 보존한 채 `status: 'in_progress'`로 전환하고 추가 시간 즉시 부여.
   - `makeupAllowed: true`, `allowReconnect: true`를 세팅하여 학생 화면이 실시간으로 풀이 화면으로 복원되며 새 브라우저 재접속도 허용.
   - `archives/` 감사 컬렉션에 원본 답안과 세션 상태를 자동 아카이빙.
4. **학급 전체 및 개별 시간 연장 (`extendClassSessionTime`, `extendStudentTime`)**:
   - 관제탑 상단 툴바에 `[⏱️ 전체 5분 연장]` 버튼 신설.
   - 학생 모달에서 개별 학생에게 원클릭 `+5분 / +10분` 시간 부여.
5. **제출 완료 화면 UX 개선 (`index.html`)**:
   - `[📋 문항별 내 답안과 정답 확인]` 버튼을 상단 점수 확인 카드(섬) 내부로 통합.
   - 하단 액션 버튼을 좌측 `[🗺️ 학습 로드맵으로 나가기]`, 우측 `[로그아웃 · 사용 종료]`로 직관적 재정렬.
6. **실시간 리스너 영구 지속성 및 타이머 연속성 보장 (`lab-eval.js`, `eval-service.js`)**:
   - 새로고침/재접속 후 복구 진입 시 리스너가 누락되던 버그를 `attachAssessmentListeners()`로 완전 해결.
   - 개별 시간 연장 수신 시 `this.sessionStatus`와 무관하게 타이머를 즉시 재가동하고 상단 토스트 알림 노출.
   - 교사의 `[현재 답안으로 정상 제출 마감]` 수신 시 실시간으로 즉시 결과 화면 전환.
   - 이미 진행 중인 시험에 뒤늦게 입장한 학생이 대기실에서 멈추지 않고 즉시 시험 화면으로 직행하도록 보장.
7. **검증**: `tests/eval-time-extension.test.cjs` 전용 테스트 6종(데모 BroadcastChannel 동기화 포함) 포함 전체 123개 단위 테스트 100% 통과, `tools/check.cjs` 72개 스크립트 정적 검사 통과.
8. **관제탑 점수 회차 격리 (`js/core/classroom.js`) — 2026-09-23**:
   - V4 `class-grades` 점수 캐시를 평가 `attemptId`와 묶고 회차·평가 유형 전환 때 초기화. 현재 V4 세션·학생·캐시 회차가 일치할 때만 서버 점수를 표시.
   - 이전 회차의 늦은 API 응답과 학생 상세 응답을 무시하고, 회차 전환 중 엑셀 내보내기는 중단. V3 모의평가 소계 표시를 기존 방식으로 유지.
   - PR #5, main merge `0c0c76e`, Vercel Production 성공. 회귀 테스트 10개·전체 127개·정적 검사 72개와 로컬 Edge 표시 확인 통과.

## 2. 읽는 순서와 다음 작업

1. [AGENTS](../AGENTS.md) → [INTENT](../INTENT.md) → [PRD](../PRD.md) → 이 문서를 읽습니다.
2. 점수 캐시 수정 PR #5는 `main` merge `0c0c76e`로 통합됐고, Vercel Production `6606016018` 성공 및 기존 고정 운영 주소의 수정 JS 일치를 확인했습니다. 이전 배포의 세부 확인 범위는 [배포 기록](DEPLOYMENT.md)을 따릅니다.
3. 다음 제품 점검은 로컬 시연에서 실습↔평가 왕복, 처방전·블록 조작, 학생·교사 대표 화면부터 진행합니다. 운영 평가를 임의로 개설하거나 기존 답안을 초기화하지 않습니다.
4. V4 후속 설계는 [계획 8~11절](EVALUATION_V4_PLAN.md#8-다음-순서와-활성화-조건)의 회차 재현·버전 보관·복구 조건을 확인합니다. 이미 배포한 기반을 재구축하지 않습니다.
5. 현재 작업 브랜치는 교사용 `이전 평가 기록` 탭, 학급별 회차 목록, 학생 답안 상세를 읽기 전용으로 구현했습니다. 저장된 점수를 재채점하지 않으며 V4 원문이 보관되지 않은 경우 최신 문항을 대신 표시하지 않습니다. PR·main 병합·운영 배포는 아직 대기 중입니다. 구현·로컬 검증 범위는 [PRD 3.4절](../PRD.md), 운영 상태는 [배포 기록](DEPLOYMENT.md)을 따릅니다.

과거 인수인계는 [보존본](HANDOFF_HISTORY_2026-09-15.md)에 있습니다. 당시 미배포·준비 전 표현을 현재 상태로 해석하지 않습니다.

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
| 학생 자료·교사 역할·보관 기록 | 기존 Firebase에 남음. clone 과정에서 초기화·재등록하지 않음 |
| 운영 환경 변수 | 기존 서비스에 등록됨. 화면 개발을 위해 내려받을 필요 없음 |
| GitHub·Firebase·Vercel 인증 | 필요한 PC에서 개별 로그인. 인증 폴더 통째로 복사 금지 |
| 운영 교사 비밀번호 | 관리자를 통한 별도 전달. 로컬 시연 비밀번호와 구분 |
| `.env.preview.local` | 로컬 AI 체험 첫 실행 시 PC마다 생성 |
| `scratch/eval_bank_v4.json` | 필요한 경우 교사 백업으로 받은 로컬 사본. Git으로 전달되지 않음 |
| V4 문항·배정 비밀값 | 운영 환경 변수에 등록됨. 회차별 원본·키 버전 보관과 복구는 별도 과제 |

### 5.1 다른 PC에서 실전평가 비공개 문제은행(V4) 다루기

운영 평가 개설에는 로컬 문항 파일이 필요 없습니다. 로컬 검토가 필요한 경우 교사 로그인 후 학급 선택 바의 `[⬇ 백업]`에서 JSON을 내려받습니다. 백업 API는 활성 교사 역할을 확인하며, 학생별 답안 조회와 전체 은행 내보내기의 접근 범위는 다릅니다.

다운로드 파일을 승인된 로컬 검토 위치 `scratch/eval_bank_v4.json`에 두고 사용합니다. 파일 존재만으로 테스트 환경 설정까지 끝난 것은 아닙니다. 비공개 원본·정답을 공개 Git·채팅·검사 로그에 넣지 않습니다. Git 제외 규칙은 실수 방지 장치이며 유출 방지나 영구 보관을 보장하지 않습니다.

운영 은행은 gzip-base64로 등록한 기록이 있습니다. 환경 변수 문자열을 그대로 `.json` 파일로 저장하면 JSON이 아닐 수 있으므로 교사 백업을 기본 경로로 사용합니다. 백업은 현재 문항 은행이며 배정 비밀값·과거 은행·학생 답안·채점 코드까지 포함한 회차 복구본이 아닙니다. 상세 형식과 변경 조건은 [V4 설정 안내](EVALUATION_V4_SETUP.md)를 확인합니다.

`.env*`, `.vercel/`, `temp/`, `js/data/config.js`, PDF, `백업용/` 등은 제외 규칙과 실제 존재 여부를 각각 확인합니다. `백업용/`은 수정·삭제하지 않습니다.

## 6. 남은 한계와 주의할 재개 작업

- **V3 정답이 학생 코드에 포함되는 기존 한계는 V4 기반 배포만으로 해소되지 않습니다.**
- 운영 /api/evaluation GET의 405 응답은 API 반영 확인이며 실제 V4 배정·제출·권한 전체 검증이 아닙니다.
- V4 문항 은행·배정 비밀값을 바꾸면 과거 배정·채점 재현에 영향을 줄 수 있습니다. 회차별 보관·버전 관리 방식을 확정하기 전 운영 값을 교체하지 않습니다. 현재 V4가 운영 중이라는 사실과 회차 재현·복구 검증 완료는 구분합니다.
- 학급 동시 사용, 교실 기기·네트워크, Solar 채점 타당성, 다음 차시 이어하기·서버 보관/삭제 기간은 별도 확인·결정 대상입니다. 과거 감사 항목 전체가 해결되었다고 단정하지 않습니다.
- tools/provision-*.cjs, tools/close-idle-classrooms.cjs 등은 PC 설정용 기본 명령이 아닙니다. 계정·DB 준비·대기실 종료를 인수인계 과정에서 실행하지 않습니다.
- 과거 PC의 Vercel CLI에는 비 Latin 문자 ByteString 오류 기록이 있습니다. 조회 오류만으로 재배포하거나 프로젝트를 새로 만들지 않습니다.

## 7. 확인 기록 — 이전 인수인계와 이번 문서화 구분

2026-09-19 문서 정비: Windows/PowerShell, 기준 `a998d3c`, 작업 `codex/docs-current-state`. 평가 서비스·V4 API·은행 파서·AI 쿼터·로컬 Firestore 규칙을 대조했습니다. 변경한 Markdown 18개의 내부 파일 링크 154개와 그중 제목 연결 4개를 확인했고, 문항·검토서 본문 및 AGENTS·INTENT·보존본·원본 감사 보고서가 유지되는지 검사했습니다. `git diff --check` 통과. 앱 테스트·운영 DB 조회·AI 호출·배포는 수행하지 않았습니다. 결과 상세는 로컬 `temp/docs-check.json`이며 Git 제외 파일입니다.

이전 PR #3 확인 지시는 현재 재개 지시에서 제외했습니다. 이번에는 GitHub PR 상태를 새로 조회하지 않았으며 병합 여부를 새로 판정한 것이 아닙니다. 현재 운영 기준과 제품 반영은 Git `a998d3c` 및 배포 기록으로 확인했습니다.

이전 인수인계 정비 기록: 2026-09-15 Windows/PowerShell·Node.js v24.19.0, 시작 기준 c73e8c4에서 Git 상태·최근 이력·실제 원격 main 일치, 문서·개발 명령·CI 설정·제외 목록을 확인했습니다. 코드 전수 검토·운영 DB 검사·유료 AI 호출·학급 시나리오 재검증은 이번 범위가 아닙니다. 이전 제품 검사 결과는 해당 검토서와 배포 기록을 따릅니다.

문서 정리 후 6개 문서의 내부 파일 링크 63개, 기존 인수인계 원문 보존, git diff --check를 확인했습니다. node tools/check.cjs는 스크립트 62개 문법과 HTML 로컬 참조 검사에 통과했습니다. 제품 동작 변경이 없어 전체 단위·브라우저 회귀 검사는 반복하지 않았습니다.

이번 V4 방향 문서화(2026-09-15, 기준 7d24e50)는 문서·핵심 구조의 제한적 확인이며 새로운 운영 검증이 아닙니다. V4 계획의 검증표는 향후 수용 기준입니다. 문항 보관·API·DB 스키마·환경 변수는 변경하지 않았습니다. 변경한 문서 5개의 내부 파일 링크 49개와 제목 연결 6개, 네 검토 영역의 공통 형식, git diff --check를 확인했습니다. 이번에 제품 전체 검사·브라우저·운영 DB 검증은 반복하지 않았습니다.

## 다음 에이전트에게 전달할 문장

> AGENTS.md, INTENT.md, PRD.md, docs/HANDOFF.md를 읽고 이어가 주세요. 운영 기준은 `main`입니다. V4 실시간 점수 캐시의 회차 격리 수정은 PR #5, merge `0c0c76e`로 통합했고 Vercel Production 배포 성공 및 기존 운영 주소의 수정 JS를 확인했습니다. 전체 테스트 127개, 정적 검사 72개, 로컬 Edge 점수 화면 검증은 통과했습니다. 전체 브라우저 흐름과 실제 교실 공동 사용은 별도 확인 대상입니다. 자세한 범위는 [배포 기록](DEPLOYMENT.md)을 확인하고, 회차별 문항·채점 재현과 보관·복구 설계는 `docs/EVALUATION_V4_PLAN.md`의 남은 과제를 따릅니다. AGENTS.md는 명시적 사전 승인 없이 수정하지 않습니다.
