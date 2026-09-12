# 정보 알고리즘 스튜디오 검증 보고서

검증일: 2026-09-12 · 기준 커밋: cacfc5e (main) · 대상: C:/workspace/algorithm-studio

## 판정

전체 모듈을 대상으로 정적 확인과 격리 브라우저 검증을 수행했습니다. 확인된 문제는 원인별 **35개 항목(P1 12개, P2 19개, P3 4개)**입니다. 현재 버전의 수행평가는 저장 성공 여부·채점·권한·마감 처리에 문제가 있어 실제 성적 반영 전에 수정이 필요합니다.

P1은 성적·개인정보·작업 보존 또는 핵심 사용에 직접 영향을 주는 우선 수정 항목, P2는 기능·수업 흐름·개념 설명의 오류, P3는 표시·정밀도 문제입니다. 실제 서비스 장애나 정보 유출이 이미 발생했다는 의미는 아닙니다.

## 검증 범위와 방법

- AGENTS.md, INTENT.md, PRD.md, README.md 및 전체 파일 구성 확인.
- 로컬 설정을 포함한 JavaScript 19개 구문 검사: 모두 통과. 실제 설정값은 결과물에 기록하지 않음.
- index.html의 로컬 정적 참조 파일 존재 검사: 누락 없음.
- Edge 기반 Playwright 격리 프로필. 기본 1440×900, 추가 1920×900·1366×768·1024×900·768×900 확인.
- 로드맵, 3개 코스의 개념·퀴즈·실습, 순서도 Step1~5, 평가, 클래스룸의 기본 진입 16개 기록.
- 6개 상위 화면의 36개 전환 조합: 7개에서 화면 중복 재현. 이 검사는 DOM 가시성과 레이아웃 기준이며 모든 픽셀 조합을 검증했다는 뜻은 아님.
- 퀴즈 12문항 오답→정답 수정, 기초 퍼즐 3종 정답·오답·빈칸 판정, 추상화 맛보기→워크북→AI 장애 대체 결과, 샌드위치 정상·오류·초기화 흐름 확인.
- 실제 마우스 블록 추가·이동·포트 연결, 캔버스 이동, Step4 양쪽 분기와 중지, Step5 수식·변수·반복·누락 분기·검사 상태·이미지 생성 확인.
- 평가 객관식 10문항/단답형 6문항 채점, 잘못된 순서도, 재접속·새로고침·마감·저장 실패·점수 조정·CSV 확인.
- 교사·학생 역할의 별도 두 탭으로 로컬 대체 통신 확인. Firestore 저장 실패와 서버리스 호출은 모의 응답으로 검증.
- file:///index.html 직접 열기에서 앱 초기화 및 3개 미션 로드 확인.

브라우저 검사에서는 Firebase SDK/Firestore 및 Upstage 통신을 차단했습니다. HTTP 테스트 서버는 실제 config.js와 firebase-config.js 대신 비어 있는 테스트 설정을 제공합니다. 마지막 직접 파일 실행은 초기화만 확인했고 AI·평가 제출을 하지 않았습니다. 실제 학급 데이터 읽기·쓰기, 실제 AI 과금, 배포·커밋은 수행하지 않았습니다. Tailwind·폰트 등 화면 자원 CDN은 사용했습니다.

검사 중 나타나는 차단된 리소스 오류, 의도적으로 만든 503, 모의 permission denied는 테스트 조건입니다. 이를 실제 서비스 오류 수에 더하지 않았습니다. final-results.json의 미정의 버튼 함수 두 건은 실제 앱 오류입니다.

## 정상 확인 항목

- 기본 16개 화면 진입에서 JavaScript 실행 예외 없음. 초기 DOM의 중복 id 없음.
- 3개 퀴즈의 각 4문항 정답·오답 수정 및 달성률 상태 정상.
- 순서도 기초 퍼즐 3종의 validate 함수가 정답을 통과시키고 오답·빈칸을 거부.
- 추상화 튜토리얼 완료 후 워크북 해금, 개념 화면 주요 토글·노이즈 삭제/초기화 정상.
- 샌드위치 봉지 미개봉 오류 감지 및 12개 정상 조리 행동 후 완성 판정 정상.
- Step5 자료 기호 더블클릭 추가, 블록 마우스 이동, 시작→처리 포트 드래그 연결, 캔버스 이동 후 선 좌표 유지 정상.
- 수식 우선순위·괄호·음수·나머지·0 나누기 오류·미정의 변수 오류의 기본 파서 검사 정상. 예외는 F15/F28/F32 참조.
- 1~3 합계 반복: 15단계 후 i=4, sum=6, 종료 상태 확인.
- 평가 객관식 정답 30점, 단답형 공백 정규화 정답 30점 확인.
- 순수 Canvas 포트폴리오 840×990 생성·파일 저장 확인. 실제 클립보드 권한 및 외부 게시판 붙여넣기는 미검증.
- Step4 양쪽 분기 실행 종료 및 중지 작동. 완료 알림은 F34 문제 존재.

## 문제 목록

### F01 · P1 · 서버에서 교사·학생 권한을 구분하지 않음

- 근거: [firestore.rules](/C:/workspace/algorithm-studio/firestore.rules:7) · 정적 확인
- 재현·영향: 평가 세션 read/write가 모두 허용되고, 학생 scores 변경 및 in_progress 전환에도 request.auth 검사가 없습니다. 브라우저 PIN은 서버 권한을 부여하거나 제한하지 않습니다. 이 규칙이 배포되어 있다면 타인의 답안·성적 열람, 점수 수정, 세션 제어가 가능합니다.
- 수정 방향: 인증된 교사와 학생 본인 소유권을 규칙에서 검증하고 서버에서 채점·마감 권한을 확정해야 합니다. 실제 배포 규칙은 이번에 조회하지 않았습니다.

### F02 · P1 · 학생 이름이 교사 화면에서 HTML/스크립트로 실행됨

- 근거: [js/core/classroom.js](/C:/workspace/algorithm-studio/js/core/classroom.js:256) · 브라우저 재현
- 재현·영향: 이름에 테스트용 img/onerror를 넣고 관제 좌석을 렌더링하자 window.auditMarker가 1로 변경되었습니다. studentName을 속성과 본문에 그대로 넣습니다. 다른 입력·AI 응답의 innerHTML 삽입 경로에도 같은 패턴이 있습니다.
- 수정 방향: 사용자 데이터는 textContent 또는 문맥에 맞는 escaping으로 출력하고, 필요한 서식만 제한적으로 허용해야 합니다. deep-results.json의 student name 항목 참조.

### F03 · P1 · AI 프록시가 인증 없이 유료 API 요청을 중계함

- 근거: [api/chat.js](/C:/workspace/algorithm-studio/api/chat.js:31) · 모의 서버 재현
- 재현·영향: 인증 헤더 없는 POST를 로컬 모의 fetch로 호출했을 때 Upstage 요청이 전달되고 200 응답을 반환했습니다. 호출자 인증·요청량 제한·허용 모델 제한이 코드에 없습니다.
- 수정 방향: 교실 사용 범위에 맞는 호출자 검증과 요청량·본문·모델 제한이 필요합니다. 실제 키나 과금 API는 사용하지 않았고 Vercel 외부 접근 정책은 미검증입니다.

### F04 · P1 · 답안 저장 실패를 제출 성공으로 표시함

- 근거: [js/core/eval-service.js](/C:/workspace/algorithm-studio/js/core/eval-service.js:283) · 브라우저+모의 저장 실패
- 재현·영향: Firestore set을 거절시키면 서비스가 예외를 삼킨 후 정상 반환합니다. submitExam은 isSubmitted=true와 결과 화면을 유지해 학생은 저장된 것으로 오해하며 재시도도 막힙니다. 시작·재시험·점수 변경에도 실패를 삼키는 유사 처리가 있습니다.
- 수정 방향: 서버 저장 성공을 확인한 뒤 제출을 잠그고 실패 시 답안 보존·재시도·미제출 표시가 필요합니다.

### F05 · P1 · 교사 강제 마감이 학생 시험을 종료하지 않음

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:387) · 두 브라우저 탭 재현
- 재현·영향: 교사 endSession이 ended를 보내도 학생 리스너는 in_progress만 처리합니다. 시험 시작 후 마감했을 때 sessionStatus=in_progress, isSubmitted=false, 타이머 활성 상태가 남았습니다.
- 수정 방향: ended 신호와 이미 마감된 세션의 입장·제출 정책을 처리하고 서버 마감 시각도 검증해야 합니다.

### F06 · P1 · 새로고침하면 평가 답안과 실습 초안이 사라짐

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:297) · 브라우저 재현
- 재현·영향: 객관식 답안과 자연어 카드를 작성한 후 새로고침하면 답안은 {}, 순서도 블록은 []로 돌아갑니다. sessionStorage는 이름·일부 관제 정보 등에만 사용되고 평가 초안·자유 순서도·퀴즈·추상화 상태 복원은 구현되어 있지 않습니다.
- 수정 방향: 세션별 초안 자동 저장과 복원, 제출 상태 재조회가 필요합니다. 저장 방식은 AGENTS.md의 sessionStorage 원칙을 따라 설계해야 합니다.

### F07 · P1 · 대기실 재입장이 기존 기록을 빈 답안으로 덮어씀

- 근거: [js/core/eval-service.js](/C:/workspace/algorithm-studio/js/core/eval-service.js:189) · 브라우저 재현+코드 확인
- 재현·영향: 같은 반·번호로 joinWaitingRoom을 재호출하면 기존 answers·scores·progress를 비우고 waiting으로 덮습니다. 모의 기록으로 재현했습니다. 실제 Firestore에도 동일 studentData를 merge 저장하여 기존 필드를 대체하려고 합니다.
- 수정 방향: 기존 응시 기록을 먼저 조회하고 새 응시·재접속·재시험을 구분해야 합니다. 번호 중복 입장도 본인 확인 없이 덮어쓰지 않아야 합니다.

### F08 · P1 · 시작·종료가 고립된 평가 순서도에 40점 부여

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:1075) · 브라우저 재현
- 재현·영향: 시작·종료는 연결하지 않고 자료·판단·처리만 순환 연결한 5블록/4연결 순서도가 isVerified=true, Part3=40을 받았습니다. 테마와 무관한 문장도 통과했습니다. 채점은 isVerified 플래그만 사용합니다.
- 수정 방향: 시작·종료 도달성, 분기 라벨, 기호별 연결 규칙, 테마의 필수 행동을 실제 그래프로 검사하고 제출 시 다시 계산해야 합니다.

### F09 · P1 · 평가 기호 스타일 누락으로 도형·연결 좌표가 깨짐

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:893) · 브라우저+화면 재현
- 재현·영향: 평가에서 쓰는 shape-terminal-block / shape-io-block / shape-process-block CSS가 없습니다. 단말·자료·처리는 색과 도형 없이 글자만 표시되고 실제 폭은 51~124px인데 포트 계산은 180px로 가정합니다. 화살표가 실제 연결점과 어긋납니다.
- 수정 방향: 공통 기호 렌더러와 실제 DOM 기반 포트 좌표 계산을 공유해야 합니다. eval-shapes.png 및 coverage-results.json 참조.

### F10 · P1 · 교사용·평가 화면에서 단원 이동 시 화면이 겹침

- 근거: [js/core/navigation.js](/C:/workspace/algorithm-studio/js/core/navigation.js:134) · 브라우저 전환 행렬
- 재현·영향: 6개 목적지의 36개 전환 조합 중 7개에서 main 뷰가 동시에 표시되었습니다. eval/classroom→unit1~3에서 이전 뷰를 숨기지 않습니다. Step5→교사용은 studio-mode CSS의 display:flex !important가 hidden을 덮습니다.
- 수정 방향: 모든 뷰와 스튜디오 모드를 한 전환 경로에서 정리해야 합니다. coverage-results.json의 all navigation pairs, studio-1440.png 참조.

### F11 · P1 · AI 연결 실패에도 AI 검사 통과 인증을 발급함

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:4664) · 브라우저 장애 재현
- 재현·영향: AI 네트워크를 차단한 상태에서 구조 검사를 통과하는 그래프를 검사하면 catch가 [판정: 통과]를 만들어 isFlowchartAiPassed=true와 Solar AI 설계 검사 통과 배너를 표시합니다.
- 수정 방향: 로컬 구조 검사 통과와 실제 AI 검사 완료를 분리하고 통신 실패로 AI 인증을 발급하지 않아야 합니다.

### F12 · P1 · 검사 통과 후 내용을 바꿔도 합격 상태가 유지됨

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:2433) · 브라우저 재현
- 재현·영향: 합격 후 블록 내용을 비우고 자연어 카드도 다른 내용으로 바꿨지만 isFlowchartAiPassed가 true로 남았습니다. updateNlCardText/updateNlCardField도 인증을 무효화하지 않습니다.
- 수정 방향: 내용·기획·연결의 모든 변경에 검증 상태를 무효화하고 비동기 검사 결과도 검사 당시 버전과 대조해야 합니다.

### F13 · P2 · 로컬 대체 통신에서 교사 좌석·재시험 동기화가 안 됨

- 근거: [js/core/eval-service.js](/C:/workspace/algorithm-studio/js/core/eval-service.js:331) · 두 브라우저 탭 재현
- 재현·영향: 학생 탭에서 입장 방송을 보냈지만 교사 listenStudents 결과는 []였습니다. 수신 측이 메시지 payload를 반영하지 않고 자기 탭의 sessionStorage만 다시 읽습니다. 개별 재시험 리스너도 동일한 구조입니다.
- 수정 방향: BroadcastChannel 수신 데이터를 각 탭의 상태에 반영해야 합니다. 이 방식은 같은 브라우저/출처 탭용이며 별도 PC 간 통신을 대체할 수 없습니다.

### F14 · P2 · 3단 평가 작업대에 4단 CSS를 적용함

- 근거: [index.html](/C:/workspace/algorithm-studio/index.html:2266) · 브라우저+화면 재현
- 재현·영향: 평가 프레임 자식은 3개인데 entry-studio-container는 320px 108px 1fr 280px의 4열입니다. 우측 빈 열이 생기고 보관함과 완료 검사 툴바가 잘립니다.
- 수정 방향: 평가용 3열 레이아웃을 명시하거나 공유 레이아웃에 열 구성 옵션을 두어야 합니다. eval-part3.png 참조.

### F15 · P2 · 한글 변수명 내부의 조사 글자까지 삭제함

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:3904) · 브라우저 재현
- 재현·영향: 나이 입력은 변수 나로, 나이 출력도 나로 해석됩니다. /[을를이가은는]/g가 조사 위치를 구분하지 않고 단어 내부를 훼손합니다. 이름 등 다른 일반 변수도 영향을 받습니다.
- 수정 방향: 입출력 동사·조사를 문장 경계에서 처리하고 변수명 자체는 보존해야 합니다.

### F16 · P2 · 없는 아니오 분기를 예 연결로 대신 실행함

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:3853) · 브라우저 재현
- 재현·영향: 판단에서 예→밥 먹기 연결만 둔 뒤 아니오를 선택했는데 밥 먹기가 실행되었습니다. targetConn 탐색 실패 시 outConns[0]으로 대체하는 로직 때문이며 자동 판단에도 같은 대체가 있습니다.
- 수정 방향: 선택한 분기가 없으면 오류로 중지하고 정확한 분기를 추가하도록 안내해야 합니다.

### F17 · P2 · 빈 실행·기본 문구가 검사에서 통과할 수 있음

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:3640) · 브라우저 재현
- 재현·영향: 시작→종료만 실행해도 완주 검증 성공을 받습니다. 카드가 없으면 정량 검사도 통과합니다. 내용을 지워 생성되는 내용 입력 문구는 DUMMY_TEXTS에 없어 구조가 맞으면 통과합니다.
- 수정 방향: 실제 명령의 존재와 유효한 내용을 검사하고, 이전 시뮬레이터와 현재 디버거의 검증 조건을 통일해야 합니다.

### F18 · P2 · 기초 퍼즐 실행이 학생 배치 대신 정답 흐름을 보여줌

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:511) · 브라우저 재현
- 재현·영향: 선택 퍼즐의 탑승 가능·불가 블록을 뒤집고 키 160을 입력했는데 출력과 추적 기록은 탑승 가능을 실행한 것으로 나왔습니다. 오답 판정은 별도로 하지만 시뮬레이션은 정답 문구를 하드코딩합니다.
- 수정 방향: 학생이 실제 배치한 블록을 실행하거나, 정답 시범 실행임을 명확히 분리해야 합니다.

### F19 · P2 · 샌드위치 초기화 후 이전 명령이 계속 실행됨

- 근거: [js/labs/lab-sandwich.js](/C:/workspace/algorithm-studio/js/labs/lab-sandwich.js:935) · 브라우저 재현
- 재현·영향: 여러 명령 실행 직후 초기화했는데 약 1초 후 이전 명령이 잼 뚜껑을 다시 열었습니다. 큐는 빈 배열인데 상태만 바뀌어 화면과 기록이 불일치합니다.
- 수정 방향: 진행 중 타이머와 AI 요청을 취소하거나 실행 세대 번호로 오래된 콜백을 무효화해야 합니다.

### F20 · P2 · AI 장애 대체 파서가 명령 순서를 바꾸고 단계를 누락함

- 근거: [js/labs/lab-sandwich.js](/C:/workspace/algorithm-studio/js/labs/lab-sandwich.js:513) · 브라우저 함수 재현
- 재현·영향: 빵을 꺼내고 봉지를 열어는 OPEN_BAG→TAKE_BREAD로 순서가 뒤집힙니다. 잼 뚜껑을 열고 칼에 잼을 떠서 빵에 골고루 발라는 OPEN_JAM이 누락됩니다.
- 수정 방향: 문장을 순서대로 파싱하거나 복합 명령을 한 단계씩 다시 입력하도록 안내해야 합니다. 학생의 오류를 자동으로 고쳐 실행하지 않아야 합니다.

### F21 · P2 · 단원 과제 취합표가 예시 데이터·미구현 버튼 상태임

- 근거: [js/core/classroom.js](/C:/workspace/algorithm-studio/js/core/classroom.js:29) · 브라우저 클릭+코드 확인
- 재현·영향: 첫 반에 예시 학생 2명이 실제 제출처럼 표시되지만 학생 실습에서 취합표를 갱신하는 연결이 없습니다. CSV와 검토 클릭은 각각 exportClassroomCSV/openStudentDetailModal is not defined 예외를 냅니다. copyPadletFormat/closeStudentDetailModal도 없습니다.
- 수정 방향: 실제 제출 경로와 조회·내보내기를 구현하거나 준비 중인 기능을 분명하게 표시해야 합니다. final-results.json 참조.

### F22 · P2 · 일반 PC 폭에서도 실행·제출 버튼이 줄바꿈되거나 잘림

- 근거: [css/flowchart.css](/C:/workspace/algorithm-studio/css/flowchart.css:1168) · 브라우저+화면 재현
- 재현·영향: 1440px와 1366px에서 실행 검증이 글자 단위로 세로 줄바꿈되고 플로팅 바 높이가 약 95px/92px가 됩니다. 상단 우측 제출 버튼도 잘립니다. 1366px에서는 전체 가로 넘침도 발생했습니다.
- 수정 방향: 툴바 최소 너비·줄바꿈·overflow 정책을 정리하고 교실 PC 해상도에서 주요 버튼을 항상 보이게 해야 합니다. fresh-studio-1366.png 참조.

### F23 · P2 · 768px 폭에서 순서도 캔버스 높이가 0이 됨

- 근거: [css/flowchart.css](/C:/workspace/algorithm-studio/css/flowchart.css:513) · 브라우저+화면 재현
- 재현·영향: 한 열 반응형 전환과 고정 높이 스튜디오 규칙이 충돌합니다. 768×900에서 free-flowchart-canvas 높이가 0px로 측정되어 조립할 영역이 없습니다.
- 수정 방향: 작은 화면에서는 문서 스크롤과 캔버스 최소 높이를 보장하거나 지원 화면 크기를 명시해야 합니다. fresh-studio-768.png 참조.

### F24 · P2 · 이미 선택한 평가 테마를 눌러도 작업이 삭제됨

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:608) · 브라우저 재현
- 재현·영향: 자료 블록을 추가한 후 현재 선택된 테마를 다시 클릭하자 블록 수가 2개에서 시작 1개로 줄었습니다. 변경 여부나 작성 상태를 확인하지 않고 항상 초기화합니다.
- 수정 방향: 같은 테마 클릭은 유지하고 다른 테마로 바꿀 때는 작성 내용 보존 또는 명확한 초기화 절차가 필요합니다.

### F25 · P2 · 시험 시간은 실제 경과 시간이 아닌 타이머 호출 횟수로 감소함

- 근거: [js/labs/lab-eval.js](/C:/workspace/algorithm-studio/js/labs/lab-eval.js:439) · 브라우저 모의 시계 재현
- 재현·영향: 실제 타이머 콜백을 캡처하고 2분의 시계 경과 후 한 번 호출했을 때 1680초가 아니라 1799초가 남았습니다. 탭 지연·절전 후 시간 차이가 생길 수 있습니다.
- 수정 방향: 각 틱에서 서버가 정한 종료 시각과 현재 시각 차이를 재계산하고 서버에서도 제출 마감 시각을 확인해야 합니다.

### F26 · P2 · 수동 성적 조정에 0~100 범위 검사가 없음

- 근거: [js/core/eval-service.js](/C:/workspace/algorithm-studio/js/core/eval-service.js:375) · 브라우저 재현
- 재현·영향: 150을 입력한 조정 점수가 그대로 저장되었습니다. UI는 parseInt 후 서비스를 호출하고 서비스도 Number 변환만 합니다. 빈 값·NaN·음수도 검증 경로가 없습니다.
- 수정 방향: UI·서비스·저장 규칙에서 유한한 숫자 및 점수 범위를 검사해야 합니다.

### F27 · P2 · CSV 값의 큰따옴표를 escape하지 않음

- 근거: [js/core/eval-service.js](/C:/workspace/algorithm-studio/js/core/eval-service.js:503) · 브라우저 Blob 검사
- 재현·영향: 이름 테스트"이름이 CSV에서 "테스트"이름"으로 기록됩니다. 내부 큰따옴표가 이중화되지 않아 CSV 구문이 깨집니다.
- 수정 방향: 공통 CSV 셀 인코더를 사용하고 쉼표·줄바꿈·큰따옴표를 포함하는 값과 스프레드시트 수식 시작 문자를 처리해야 합니다. 실제 NEIS 가져오기는 미검증입니다.

### F28 · P2 · 숫자 조건을 자동 계산하지 못하면 수동 분기로 조용히 바뀜

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:3781) · 브라우저 재현+코드 확인
- 재현·영향: 변수 없는 2 > 1은 계산 가능한 조건인데 isWaitingUserChoice=true가 되어 학생 선택을 요구합니다. 변수 오타나 수식 평가 예외도 catch에서 수동 판단으로 바뀌어 오류가 감춰집니다.
- 수정 방향: 수식·자연어의 분류와 수식 평가 실패를 구분하고 상수 조건은 바로 계산해야 합니다.

### F29 · P2 · 유한성 예시가 종료 조건이 있는 문장을 무한 반복으로 설명함

- 근거: [js/core/concept.js](/C:/workspace/algorithm-studio/js/core/concept.js:352) · 콘텐츠 확인
- 재현·영향: 무한루프 예시의 명령에는 물이 찰 때까지라는 종료 조건이 이미 있는데 종료 조건 없음이라고 설명합니다. 유한성 개념을 반대로 학습시킬 수 있습니다.
- 수정 방향: 무조건 계속 붓기와 특정 수위에 도달할 때까지 붓기를 명확히 구분해야 합니다. 실제 화면 문구 확인 대상입니다.

### F30 · P2 · 개념 설명·예시 카드의 기호 색상이 프로젝트 표준과 다름

- 근거: [js/core/concept.js](/C:/workspace/algorithm-studio/js/core/concept.js:383) · 브라우저+콘텐츠 확인
- 재현·영향: 상세 설명은 단말 녹색·자료 주황·처리 보라·판단 파랑으로 표시됩니다. Step4 데이터의 배지도 같은 구색을 사용합니다. AGENTS.md의 단말 보라·자료 녹색·판단 주황·처리 파랑과 충돌합니다.
- 수정 방향: 공통 기호 메타데이터를 사용해 개념·예시·편집기·제출 이미지 색을 통일해야 합니다.

### F31 · P2 · 연결되지 않아도 교실 네트워크 연결됨 표시

- 근거: [index.html](/C:/workspace/algorithm-studio/index.html:2452) · 브라우저 재현
- 재현·영향: Firebase를 차단하여 isFirebaseReady=false인 상태에서도 교사용 화면에 교실 실시간 네트워크 연결됨이 표시됩니다. 현재 문구는 정적 HTML입니다.
- 수정 방향: SDK 생성 여부와 실제 연결·구독 성공 여부를 구분하여 연결 중·오프라인·저장 실패 상태를 표시해야 합니다.

### F32 · P3 · 잘못된 소수 표기를 정상 숫자로 잘라 읽음

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:3251) · 브라우저 재현
- 재현·영향: x = 1.2.3이 오류 없이 1.2로 계산됩니다. 숫자 토큰에 점 개수 제한이 없고 parseFloat가 앞부분만 읽습니다.
- 수정 방향: 숫자 토큰 전체가 유효한지 검사하고 잘못된 표기를 오류로 알려야 합니다.

### F33 · P3 · 가까운 X 좌표의 연결선을 대각선으로 그림

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:2727) · 브라우저 함수·실제 포트 재현
- 재현·영향: X 차이 1~7px에서는 M 100 100 L 104 200 같은 대각선이 만들어집니다. 초기 화면의 서로 다른 기호 폭 때문에도 발생합니다. 직각 연결선이라는 명세와 다릅니다.
- 수정 방향: 같은 X일 때만 수직선으로 단순화하고 나머지는 수평·수직 경로를 유지해야 합니다.

### F34 · P3 · Step4 완주 알림을 생성 직후 삭제함

- 근거: [js/labs/lab-flowchart.js](/C:/workspace/algorithm-studio/js/labs/lab-flowchart.js:1233) · 양쪽 분기 실제 클릭+코드 확인
- 재현·영향: 예/아니오 양쪽 완주 후 토스트가 0개였습니다. showL2CompletionToast 직후 finally가 clearL2SimulationHighlights를 호출하고 이 함수가 완주 토스트도 삭제합니다.
- 수정 방향: 하이라이트 정리와 완료 안내 정리를 분리해야 합니다.

### F35 · P3 · 단답형 탭의 문항 수가 실제와 다름

- 근거: [index.html](/C:/workspace/algorithm-studio/index.html:2229) · 화면·데이터 확인
- 재현·영향: 탭에는 5문항, 문항 목록과 채점 데이터에는 6문항으로 표시됩니다. 실제 채점은 6×5=30점입니다.
- 수정 방향: 문항 개수·배점을 데이터에서 계산해 표시해야 합니다.

## 권장 수정 순서

1. **평가 신뢰성 확보:** F01~F09, F13, F25~F27, F31. 인증·저장 확인·초안 복구·마감·채점 기준부터 정리합니다.
2. **화면과 순서도 엔진 통일:** F10~F18, F22~F24, F28, F32~F34. 평가와 일반 순서도의 중복 구현을 점검하고 공통 상태·렌더링·검사를 공유합니다.
3. **학습 흐름·콘텐츠 정리:** F19~F21, F29~F30, F35. 진행 중 작업 취소, 과제 취합의 실제 동작, 개념 설명을 수정합니다.

화면만 먼저 다듬으면 잘못된 성적·저장 결과가 더 그럴듯하게 보일 수 있습니다. 우선 저장과 판정의 정확성을 확보하는 순서를 권합니다. 개별 항목을 수정할 때는 해당 재현 사례를 회귀 테스트로 유지해야 합니다.

## 검증하지 않은 범위

- 현재 Vercel 배포 설정·접근 정책·환경변수, 실제 Solar 모델 응답 품질·요금·장애 상황.
- 현재 Firebase에 배포된 규칙·실제 학생 기록·27대 동시 접속 부하·서로 다른 PC 간 네트워크.
- 실제 NEIS 파일 가져오기, 띵커보드/패들릿 게시, 클립보드 권한, 음성 인식·마이크, 터치 기기 실물.
- 모든 자연어 문장, 임의의 큰 순서도 및 장시간 수업 전체. 이번 통과가 모든 입력의 무오류 보장은 아닙니다.
- 완전 오프라인 첫 실행: UI의 Tailwind·폰트·아이콘 CDN 의존성이 있어 설치 없는 실행과 오프라인 완전 실행은 구분해야 합니다.

AGENTS의 Node.js 금지/저장소 문구와 PRD의 서버리스·Firestore 확장은 정책 정리 사항으로 별도 남깁니다. PRD에도 과거와 최신 명세가 병존합니다. 이 문서 차이를 위 35개 실행·콘텐츠 문제에 중복 산입하지 않았습니다.

## 증거와 재실행

- [기본 결과](/C:/workspace/algorithm-studio/audit/results.json)
- [심층 결과](/C:/workspace/algorithm-studio/audit/deep-results.json)
- [36개 화면 전환 및 정상 경로 검사](/C:/workspace/algorithm-studio/audit/coverage-results.json)
- [마우스·분기·반복·파일 실행 검사](/C:/workspace/algorithm-studio/audit/interaction-results.json)
- [타이머·버튼·연결 상태 검사](/C:/workspace/algorithm-studio/audit/final-results.json)
- [구문·참조·모의 API 검사](/C:/workspace/algorithm-studio/audit/static-results.json)
- [수정 작업용 문제 목록 JSON](/C:/workspace/algorithm-studio/audit/findings.json)

대표 화면: [평가 기호 누락](/C:/workspace/algorithm-studio/audit/eval-shapes.png), [교사 화면 잔존](/C:/workspace/algorithm-studio/audit/studio-1440.png), [1366px 순서도](/C:/workspace/algorithm-studio/audit/fresh-studio-1366.png), [768px 캔버스 소실](/C:/workspace/algorithm-studio/audit/fresh-studio-768.png), [생성된 포트폴리오](/C:/workspace/algorithm-studio/audit/portfolio.png).

검증 스크립트는 audit/run.cjs, deep.cjs, coverage.cjs, interactions.cjs, final-checks.cjs입니다. 이 PC에 이미 제공된 Node·Playwright 번들과 설치된 Edge를 사용합니다. 앱에 패키지·빌드 단계를 도입하지 않았습니다. 다른 PC에서 검사 스크립트를 재사용할 때는 번들/Edge 경로를 조정해야 합니다.

PowerShell에서 프로젝트 루트를 작업 폴더로 두고 예를 들어 다음과 같이 실행합니다:

```powershell
& 'C:/Users/안동현/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' audit/run.cjs
```

심층 검사에는 의도적인 오답·장애 주입과 런타임 상태 설정이 포함됩니다. 일부 결과 값이 false 또는 error라고 해서 검사 도구 자체의 실패인 것은 아닙니다. 테스트 설정과 구체적 이름을 함께 확인해야 합니다. 화면 진입 직후 촬영한 일부 이미지는 전환 애니메이션 중일 수 있으며, 크기 검증에는 별도 fresh-studio 이미지를 사용했습니다.

**변경 범위:** audit/의 보고서·검사 스크립트·결과·스크린샷만 추가. 기존 앱 소스, AGENTS.md, INTENT.md, PRD.md, README.md, 백업용/은 수정하지 않았습니다.
