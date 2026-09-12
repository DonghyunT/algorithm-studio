/**
 * ==============================================================================
 * 🍜🎡🔒 [순서도 미션 데이터]
 * ==============================================================================
 * 순서도 1번, 2번, 3번 문제의 제목, 설명, 힌트 문구, 선택 블록 텍스트를 수정할 수 있습니다.
 * - title: 미션 제목
 * - desc: 미션 설명
 * - slots: 순서도 캔버스에 들어갈 빈칸 목록
 * - palette: 하단 보관함에 주어질 선택지 블록들
 * - validate: 정답 판정 규칙
 */
const missions = [
      // [미션 1] 순차 구조: 라면 조리법
      {
        id: 1,
        title: "라면 끓이기 알고리즘 (순차 구조)",
        type: "순차 구조",
        desc: "물 500ml를 넣고 끓인 뒤 면과 스프를 넣어 조리를 완성하는 순차 구조 순서도를 설계하세요.",
        slots: [
          { id: "s1", type: "terminal", label: "시작", fixed: true, shape: "terminal" },
          { id: "s2", type: "io", hint: "입출력 ▱ (물 500ml 붓기)", shape: "io" },
          { id: "s3", type: "process", hint: "처리 ▭ (물 끓이기)", shape: "process" },
          { id: "s4", type: "process", hint: "처리 ▭ (면과 스프 넣기)", shape: "process" },
          { id: "s5", type: "terminal", label: "종료 (라면 완성)", fixed: true, shape: "terminal" }
        ],
        palette: [
          { id: "b-m1-1", type: "io", text: "물 500ml 냄비에 붓기", shape: "io" },
          { id: "b-m1-2", type: "process", text: "가스레인지 켜서 물 끓이기", shape: "process" },
          { id: "b-m1-3", type: "process", text: "면과 분말스프 넣고 4분 끓이기", shape: "process" }
        ],
        validate: (placed) => placed.s2 === "b-m1-1" && placed.s3 === "b-m1-2" && placed.s4 === "b-m1-3"
      },

      // [미션 2] 선택 구조: 놀이기구 탑승 판정기
      {
        id: 2,
        title: "놀이기구 탑승 판정기 (선택 구조)",
        type: "선택 구조",
        desc: "키를 입력받아 조건(150cm 이상)을 검사한 후 [예] 탑승 가능과 [아니오] 탑승 불가로 분기하여 각각 종료로 합류하는 순서도를 완성하세요.",
        slots: [
          { id: "s1", type: "terminal", label: "시작", fixed: true, shape: "terminal" },
          { id: "s2", type: "io", hint: "입출력 ▱ (키 입력받기)", shape: "io" },
          { id: "s3", type: "decision", hint: "판단 ◇ (키 >= 150cm 인가?)", shape: "decision" },
          { id: "s4_yes", type: "io", hint: "출력 ▱ (탑승 가능 안내)", shape: "io" },
          { id: "s4_no", type: "io", hint: "출력 ▱ (탑승 불가 안내)", shape: "io" },
          { id: "s5", type: "terminal", label: "종료", fixed: true, shape: "terminal" }
        ],
        palette: [
          { id: "b-m2-1", type: "io", text: "사용자 키(Height) 입력", shape: "io" },
          { id: "b-m2-2", type: "decision", text: "키 >= 150cm 인가?", shape: "decision" },
          { id: "b-m2-yes", type: "io", text: "'탑승 가능' 안내 출력", shape: "io" },
          { id: "b-m2-no", type: "io", text: "'탑승 불가' 안내 출력", shape: "io" }
        ],
        validate: (placed) => placed.s2 === "b-m2-1" && placed.s3 === "b-m2-2" && placed.s4_yes === "b-m2-yes" && placed.s4_no === "b-m2-no"
      },

      // [미션 3] 반복 구조: 비밀번호 맞추기 루프
      {
        id: 3,
        title: "비밀번호 맞추기 루프 (반복 구조)",
        type: "반복 구조",
        desc: "비밀번호를 입력받아 판단(◇)하여 맞으면 [예] 성공 출력 후 종료, 틀리면 [아니오] 불일치 처리 후 우측 'ㄷ'자 반전 화살표를 타고 입력 노드로 루프백하는 순서도를 완성하세요.",
        slots: [
          { id: "s1", type: "terminal", label: "시작", fixed: true, shape: "terminal" },
          { id: "s2", type: "io", hint: "입출력 ▱ (비밀번호 입력받기)", shape: "io" },
          { id: "s3", type: "decision", hint: "판단 ◇ (비밀번호 == 7777 인가?)", shape: "decision" },
          { id: "s4_yes", type: "io", hint: "출력 ▱ [예] (로그인 성공 출력)", shape: "io" },
          { id: "s4_no", type: "process", hint: "처리 ▭ [아니오] (불일치 안내 처리)", shape: "process" },
          { id: "s5", type: "terminal", label: "종료", fixed: true, shape: "terminal" }
        ],
        palette: [
          { id: "b-m3-in", type: "io", text: "비밀번호 입력받기", shape: "io" },
          { id: "b-m3-chk", type: "decision", text: "비밀번호 == 7777 인가?", shape: "decision" },
          { id: "b-m3-yes", type: "io", text: "'로그인 성공' 안내 출력", shape: "io" },
          { id: "b-m3-no", type: "process", text: "'비밀번호 불일치' 안내 처리", shape: "process" }
        ],
        validate: (placed) => placed.s2 === "b-m3-in" && placed.s3 === "b-m3-chk" && placed.s4_yes === "b-m3-yes" && placed.s4_no === "b-m3-no"
      }
    ];


// ==============================================================================
// 🛠️ [Level 2 / Step 4: 선생님과 함께하는 추천 예시 공방 데이터]
// ==============================================================================
const level2Walkthrough = {
  id: "l2-walkthrough",
  title: "⏰ 지각 방지 아침 등교 알고리즘 (선생님과 함께하는 예시 공방)",
  desc: "좌측의 자연어 카드를 1단계부터 차례대로 클릭해 보세요! 우측 캔버스에 해당 구조에 맞는 표준 순서도 기호가 직접 생겨나며 완성됩니다.",
  steps: [
    {
      stepIdx: 1,
      cardTitle: "1단계: 순차 구조 (자료 입력)",
      cardBadge: "🟢 자료 입출력 (▱)",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      naturalText: "오전 7시 알람 소리를 듣고 현재 시각을 확인한다.",
      symbolType: "io",
      symbolShapeName: "평행사변형 (입출력)",
      blockText: "현재 시각 확인",
      explanation: "주변 환경의 데이터(알람 시계)를 입력받습니다."
    },
    {
      stepIdx: 2,
      cardTitle: "2단계: 순차 구조 (명령 동작)",
      cardBadge: "🔵 처리 동작 (▭)",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      naturalText: "침대에서 일어나 세수를 한다.",
      symbolType: "process",
      symbolShapeName: "직사각형 (처리)",
      blockText: "기상 및 세수하기",
      explanation: "명령에 따라 정해진 행동을 수행합니다."
    },
    {
      stepIdx: 3,
      cardTitle: "3단계: 선택 구조 (조건 판단)",
      cardBadge: "🟠 조건 판단 (분기 ◇)",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      condition: "현재 시각 <= 07:30 인가?",
      yesAction: "여유롭게 아침밥을 먹는다.",
      noAction: "서둘러 즉시 출발 준비를 한다.",
      symbolType: "decision",
      symbolShapeName: "마름모 (판단)",
      blockText: "현재 시각 <= 07:30 ?",
      yesBlockText: "아침밥 든든히 먹기",
      noBlockText: "서둘러 즉시 출발",
      explanation: "기준 시간에 따라 실행 흐름이 갈라집니다."
    },
    {
      stepIdx: 4,
      cardTitle: "4단계: 순차 구조 (동작 합류 & 완료)",
      cardBadge: "🔵 처리 합류 ➔ 🟣 종료 (⬭)",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      naturalText: "현관문을 열고 등교 버스를 타러 간다.",
      symbolType: "process",
      symbolShapeName: "직사각형 (처리) & 단말 (종료)",
      blockText: "등교 버스 탑승",
      explanation: "갈라진 경로가 합류하여 목표를 완료합니다."
    }
  ]
};

if (typeof window !== 'undefined') {
  window.level2Walkthrough = level2Walkthrough;
}

