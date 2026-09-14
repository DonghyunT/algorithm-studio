const EVAL_QUESTION_BANK = {
  part1: [
    // [하 (easy)] A형 (concept) - 9문항
    {
      id: "p1_e_c_1",
      difficulty: "easy",
      subType: "concept",
      title: "문제 해결을 위한 첫 걸음",
      desc: "문제의 핵심적인 요소만 남기고 불필요한 부분을 제거하여 문제를 단순하게 만드는 과정을 무엇이라고 하나요?",
      options: ["순서도", "추상화", "알고리즘", "코딩"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_e_c_2",
      difficulty: "easy",
      subType: "concept",
      title: "알고리즘의 조건",
      desc: "알고리즘의 명령어는 누구나 이해할 수 있도록 뜻이 한 가지로 분명해야 합니다. 이는 알고리즘의 어떤 조건에 해당하나요?",
      options: ["유한성", "수행 가능성", "명확성", "효율성"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_e_c_3",
      difficulty: "easy",
      subType: "concept",
      title: "알고리즘의 조건 2",
      desc: "알고리즘은 정해진 단계를 거친 후에는 반드시 끝이 나야 합니다. 무한히 반복되면 안 된다는 이 조건은 무엇인가요?",
      options: ["명확성", "유한성", "수행 가능성", "정확성"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_e_c_4",
      difficulty: "easy",
      subType: "concept",
      title: "순서도 기호의 의미 (시작/끝)",
      desc: "순서도에서 알고리즘의 '시작'과 '끝'을 나타낼 때 사용하는 기호의 이름은 무엇인가요?",
      options: ["단말 기호", "자료 기호", "처리 기호", "판단 기호"],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_e_c_5",
      difficulty: "easy",
      subType: "concept",
      title: "순서도 기호의 의미 (입출력)",
      desc: "순서도에서 데이터를 입력받거나 결과를 출력할 때 사용하는 기호는 무엇인가요?",
      options: ["단말 기호", "처리 기호", "자료 기호", "판단 기호"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_e_c_6",
      difficulty: "easy",
      subType: "concept",
      title: "순서도 기호의 의미 (계산)",
      desc: "순서도에서 연산이나 명령을 실행하는 과정을 나타내는 기호는 무엇인가요?",
      options: ["판단 기호", "처리 기호", "단말 기호", "자료 기호"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_e_c_7",
      difficulty: "easy",
      subType: "concept",
      title: "제어 구조의 종류 (순차)",
      desc: "명령어들을 위에서 아래로 차례대로 한 번씩만 실행하는 제어 구조는 무엇인가요?",
      options: ["선택 구조", "반복 구조", "순차 구조", "분기 구조"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_e_c_8",
      difficulty: "easy",
      subType: "concept",
      title: "제어 구조의 종류 (선택)",
      desc: "조건에 따라 참(Yes)일 때와 거짓(No)일 때 서로 다른 명령을 실행하도록 나누어지는 제어 구조는 무엇인가요?",
      options: ["반복 구조", "선택 구조", "순차 구조", "단일 구조"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_e_c_9",
      difficulty: "easy",
      subType: "concept",
      title: "제어 구조의 종류 (반복)",
      desc: "특정 조건이 만족하는 동안 똑같은 명령을 여러 번 되풀이해서 실행하는 제어 구조는 무엇인가요?",
      options: ["순차 구조", "선택 구조", "반복 구조", "분리 구조"],
      correctAnswer: 2,
      points: 3
    },

    // [하 (easy)] B형 (applied) - 3문항 (입력/출력 단어 명시)
    {
      id: "p1_e_a_1",
      difficulty: "easy",
      subType: "applied",
      title: "자동판매기의 입출력 기호",
      desc: "자동판매기 알고리즘을 순서도로 그릴 때, '동전을 입력 받는다'는 단계는 어떤 기호를 사용해야 할까요?",
      options: ["처리 기호 (직사각형)", "단말 기호 (둥근 사각형)", "판단 기호 (마름모)", "자료 기호 (평행사변형)"],
      correctAnswer: 3,
      points: 3
    },
    {
      id: "p1_e_a_2",
      difficulty: "easy",
      subType: "applied",
      title: "점수 출력 기호 찾기",
      desc: "채점 프로그램에서 최종적으로 '학생의 점수를 화면에 출력한다'는 단계를 순서도로 표현하려 합니다. 알맞은 기호는 무엇인가요?",
      options: ["단말 기호 (둥근 사각형)", "자료 기호 (평행사변형)", "처리 기호 (직사각형)", "판단 기호 (마름모)"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_e_a_3",
      difficulty: "easy",
      subType: "applied",
      title: "비밀번호 입력 기호 매칭",
      desc: "스마트폰 잠금 해제 과정에서 '사용자로부터 비밀번호를 입력 받는다'를 나타내기에 가장 적절한 순서도 기호는?",
      options: ["처리 기호", "판단 기호", "자료 기호", "단말 기호"],
      correctAnswer: 2,
      points: 3
    },

    // [중 (medium)] 12문항
    {
      id: "p1_m_1",
      difficulty: "medium",
      subType: "standard",
      title: "경계값 판정 - 에어컨 온도",
      desc: "에어컨 알고리즘에 [현재 온도 > 28℃] 라는 판단 기호가 있습니다. 현재 실내 온도가 정확히 28℃일 때, 이 조건의 결과는 무엇인가요?",
      options: ["참 (Yes)", "거짓 (No)", "오류 발생", "다시 측정"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_m_2",
      difficulty: "medium",
      subType: "standard",
      title: "경계값 판정 - 놀이기구 탑승",
      desc: "놀이기구 탑승 조건이 [키 >= 130cm] 입니다. 어떤 학생의 키가 130cm라면 판단 기호의 결과는 어떻게 될까요?",
      options: ["참 (Yes)", "거짓 (No)", "조건 불명확", "탑승 불가"],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_m_3",
      difficulty: "medium",
      subType: "standard",
      title: "자료(입출력) vs 처리 구분 1",
      desc: "로봇 청소기의 동작 중 '장애물 감지 센서로 거리를 측정(입력)한다'는 순서도에서 어떤 기호로 그려야 가장 적절할까요?",
      options: ["자료 기호 (평행사변형)", "처리 기호 (직사각형)", "단말 기호 (둥근 사각형)", "판단 기호 (마름모)"],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_m_4",
      difficulty: "medium",
      subType: "standard",
      title: "자료(입출력) vs 처리 구분 2",
      desc: "'두 수의 합을 계산한다'는 순서도에서 어떤 기호를 사용해야 할까요?",
      options: ["단말 기호 (둥근 사각형)", "자료 기호 (평행사변형)", "판단 기호 (마름모)", "처리 기호 (직사각형)"],
      correctAnswer: 3,
      points: 3
    },
    {
      id: "p1_m_5",
      difficulty: "medium",
      subType: "standard",
      title: "자료 vs 처리 - 스피커 출력",
      desc: "스마트 스피커가 '오늘 날씨를 음성으로 출력한다'는 행동은 어떤 기호로 나타낼까요?",
      options: ["자료 기호 (평행사변형)", "단말 기호 (둥근 사각형)", "처리 기호 (직사각형)", "판단 기호 (마름모)"],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_m_6",
      difficulty: "medium",
      subType: "standard",
      title: "자료 vs 처리 - 알람 시간 설정",
      desc: "알람 시계에서 '알람 시간을 7시로 저장(계산/설정)한다'는 내부 동작은 어떤 기호에 해당하나요?",
      options: ["자료 기호", "처리 기호", "판단 기호", "단말 기호"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_m_7",
      difficulty: "medium",
      subType: "standard",
      title: "추상화 - 샌드위치 만들기",
      desc: "샌드위치를 만드는 알고리즘을 설계하려 합니다. 다음 중 추상화 과정에서 '불필요한 정보(노이즈)'로 제거해도 좋은 것은 무엇일까요?",
      options: ["빵의 종류 선택", "햄과 치즈 넣기", "주방 조명의 밝기", "완성된 샌드위치 포장"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_m_8",
      difficulty: "medium",
      subType: "standard",
      title: "추상화 - 학교 가는 길",
      desc: "집에서 학교까지 가장 빨리 가는 길을 찾는 알고리즘을 만들 때, 불필요한 정보로 빼야 할 것은?",
      options: ["이동 거리", "교차로의 신호등 개수", "도로변에 피어있는 꽃의 색깔", "이동 수단(도보, 버스)"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_m_9",
      difficulty: "medium",
      subType: "standard",
      title: "추상화 - 배달 로봇",
      desc: "배달 로봇이 목적지까지 가는 알고리즘 설계 시 제외해야 할 불필요한 정보는?",
      options: ["목적지의 층수", "배달 물품의 무게", "목적지까지의 경로", "배달 로봇의 생산 연도"],
      correctAnswer: 3,
      points: 3
    },
    {
      id: "p1_m_10",
      difficulty: "medium",
      subType: "trace",
      title: "순차 구조 흐름 예측",
      desc: "다음 명령이 순서대로 실행됩니다.\n1. A에 5를 넣는다.\n2. B에 3을 넣는다.\n3. A와 B를 더해 화면에 출력한다.\n최종 출력되는 값은?",
      options: ["3", "5", "8", "15"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_m_11",
      difficulty: "medium",
      subType: "trace",
      title: "선택 구조 실행 예측",
      desc: "사용자가 10을 입력했습니다. 조건 [입력된 수 > 5]가 참이면 '크다', 거짓이면 '작다'를 출력합니다. 결과는 무엇인가요?",
      options: ["크다", "작다", "5", "10"],
      correctAnswer: 0,
      points: 3
    },
    {
      id: "p1_m_12",
      difficulty: "medium",
      subType: "trace",
      title: "경계값 선택 구조",
      desc: "점수가 80점 이상이면 '합격', 미만이면 '불합격'입니다. 점수로 80을 입력받았을 때 출력 결과는?",
      options: ["합격", "불합격", "보류", "에러"],
      correctAnswer: 0,
      points: 3
    },

    // [상 (hard)] 6문항
    {
      id: "p1_h_1",
      difficulty: "hard",
      subType: "trace",
      title: "반복문 실행 추적 (덧셈)",
      desc: "시작 숫자 0이 있습니다. '숫자에 2를 더한다'는 과정을 3번 반복했습니다. 최종 숫자는 얼마가 될까요?",
      options: ["2", "4", "6", "8"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_h_2",
      difficulty: "hard",
      subType: "trace",
      title: "반복문 실행 추적 (카운트다운)",
      desc: "숫자 5에서 시작합니다. '조건: 숫자가 3보다 클 때까지' 반복하며 '숫자에서 1을 뺀다'를 실행합니다. 반복이 끝난 후 숫자는?",
      options: ["2", "3", "4", "5"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_h_3",
      difficulty: "hard",
      subType: "trace",
      title: "반복과 조건의 결합",
      desc: "상자에 사과가 4개 있습니다. 조건: [사과가 0개가 아닐 동안 반복] -> [사과를 1개 먹는다. 만약 사과가 2개 남았다면 '절반'이라고 출력한다]. '절반'이라는 글자는 몇 번 출력될까요?",
      options: ["0번", "1번", "2번", "3번"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_h_4",
      difficulty: "hard",
      subType: "trace",
      title: "다중 조건 분기 1",
      desc: "영화관 요금입니다. [나이가 14세 미만인가?] 참이면 5000원, 거짓일 때 [조조 할인인가?] 참이면 6000원, 거짓이면 9000원입니다. 15세 학생이 조조 할인이 아닐 때 내야 할 요금은?",
      options: ["5000원", "6000원", "9000원", "무료"],
      correctAnswer: 2,
      points: 3
    },
    {
      id: "p1_h_5",
      difficulty: "hard",
      subType: "trace",
      title: "다중 조건 분기 2",
      desc: "날씨에 따른 추천입니다. [비가 오는가?] 참이면 '우산', 거짓일 때 [기온이 10도 이하인가?] 참이면 '외투', 거짓이면 '반팔'을 추천합니다. 비가 오지 않고 기온이 5도일 때 추천하는 것은?",
      options: ["우산", "외투", "반팔", "추천 없음"],
      correctAnswer: 1,
      points: 3
    },
    {
      id: "p1_h_6",
      difficulty: "hard",
      subType: "trace",
      title: "다중 조건 분기 3",
      desc: "놀이공원 입장료입니다. [키 120cm 미만인가?] 참이면 무료. 거짓일 때 [회원인가?] 참이면 만원, 거짓이면 이만원입니다. 키가 130cm이고 회원이 아닌 사람의 입장료는?",
      options: ["무료", "만원", "이만원", "알 수 없음"],
      correctAnswer: 2,
      points: 3
    }
  ],
  part2: [
    // [하 (easy)] 6문항 (term)
    {
      id: "p2_e_1",
      difficulty: "easy",
      subType: "term",
      title: "제어 구조 용어 1",
      desc: "명령어들이 위에서 아래로 순서대로 차례차례 실행되는 제어 구조를 4글자로 쓰시오.",
      placeholder: "ㅇㅇㄱㅈ",
      answers: ["순차구조", "순차 구조", "순차"],
      points: 5
    },
    {
      id: "p2_e_2",
      difficulty: "easy",
      subType: "term",
      title: "제어 구조 용어 2",
      desc: "조건을 만족하는지에 따라 참일 때와 거짓일 때 실행할 명령을 다르게 나누는 제어 구조를 4글자로 쓰시오.",
      placeholder: "ㅇㅇㄱㅈ",
      answers: ["선택구조", "선택 구조", "선택"],
      points: 5
    },
    {
      id: "p2_e_3",
      difficulty: "easy",
      subType: "term",
      title: "제어 구조 용어 3",
      desc: "조건을 만족하는 동안 같은 명령을 여러 번 되풀이해서 실행하는 제어 구조를 4글자로 쓰시오.",
      placeholder: "ㅇㅇㄱㅈ",
      answers: ["반복구조", "반복 구조", "반복"],
      points: 5
    },
    {
      id: "p2_e_4",
      difficulty: "easy",
      subType: "term",
      title: "순서도 기호 용어 1",
      desc: "조건에 따라 흐름이 나뉘어질 때 사용하며, 보통 마름모 모양으로 그리는 순서도 기호의 이름을 4글자로 쓰시오.",
      placeholder: "ㅇㅇㄱㅎ",
      answers: ["판단기호", "판단 기호"],
      points: 5
    },
    {
      id: "p2_e_5",
      difficulty: "easy",
      subType: "term",
      title: "순서도 기호 용어 2",
      desc: "알고리즘의 시작과 끝을 나타내는 둥근 사각형 모양의 기호 이름을 4글자로 쓰시오.",
      placeholder: "ㅇㅇㄱㅎ",
      answers: ["단말기호", "단말 기호"],
      points: 5
    },
    {
      id: "p2_e_6",
      difficulty: "easy",
      subType: "term",
      title: "문제 해결 용어",
      desc: "복잡한 문제에서 중요한 핵심 정보만 남기고 불필요한 정보(노이즈)를 제거하여 단순화하는 과정을 3글자로 쓰시오.",
      placeholder: "ㅊㅅㅎ",
      answers: ["추상화"],
      points: 5
    },

    // [중 (medium)] 6문항 (condition)
    {
      id: "p2_m_1",
      difficulty: "medium",
      subType: "condition",
      title: "선풍기 동작 조건",
      desc: "조건: [현재 온도 >= 26℃] 일 때 참이면 '켜기', 거짓이면 '끄기'를 출력합니다. 현재 온도가 24℃라면 어떻게 출력될지 2글자로 쓰시오.",
      placeholder: "ㅇㅇ",
      answers: ["끄기", "꺼짐"],
      points: 5
    },
    {
      id: "p2_m_2",
      difficulty: "medium",
      subType: "condition",
      title: "자동문 센서",
      desc: "조건: [사람이 감지되었는가?] 참이면 '열림', 거짓이면 '닫힘' 입니다. 사람이 감지기 앞에 서 있을 때 출력 결과를 2글자로 쓰시오.",
      placeholder: "ㅇㄹ",
      answers: ["열림", "열리기"],
      points: 5
    },
    {
      id: "p2_m_3",
      difficulty: "medium",
      subType: "condition",
      title: "경계값 판정 - 미만",
      desc: "조건: [무게 < 10kg] 일 때 참이면 '통과', 거짓이면 '초과' 입니다. 수하물의 무게가 정확히 10kg일 때 출력 결과를 2글자로 쓰시오.",
      placeholder: "ㅊㄱ",
      answers: ["초과", "불통과"],
      points: 5
    },
    {
      id: "p2_m_4",
      difficulty: "medium",
      subType: "condition",
      title: "경계값 판정 - 초과",
      desc: "속도 위반 단속 카메라 조건이 [속도 > 60km/h] 입니다. 참이면 '단속', 거짓이면 '정상' 입니다. 현재 속도가 60km/h일 때 결과를 2글자로 쓰시오.",
      placeholder: "ㅈㅅ",
      answers: ["정상", "통과"],
      points: 5
    },
    {
      id: "p2_m_5",
      difficulty: "medium",
      subType: "condition",
      title: "비밀번호 일치 확인",
      desc: "조건: [입력한 번호 == 비밀번호] 참이면 '성공', 거짓이면 '실패'입니다. 올바른 비밀번호를 입력했을 때 결과를 2글자로 쓰시오.",
      placeholder: "ㅅㄱ",
      answers: ["성공", "통과"],
      points: 5
    },
    {
      id: "p2_m_6",
      difficulty: "medium",
      subType: "condition",
      title: "놀이기구 신장 제한",
      desc: "조건: [키 >= 150cm] 이면 '탑승', 아니면 '불가'입니다. 키가 150cm인 학생의 결과를 2글자로 쓰시오.",
      placeholder: "ㅌㅅ",
      answers: ["탑승", "가능"],
      points: 5
    },

    // [상 (hard)] 6문항 (trace 3, scenario 3)
    {
      id: "p2_h_1",
      difficulty: "hard",
      subType: "trace",
      title: "반복 추적 - 컵 씻기",
      desc: "싱크대에 컵이 5개 있습니다. 조건: [컵이 남아있는 동안 반복]하여 '컵을 1개 씻는다'를 수행합니다. 컵을 씻는 동작은 총 몇 번 실행될지 숫자만 쓰시오.",
      placeholder: "숫자 입력",
      answers: ["5", "5번", "5회", "다섯", "다섯번", "다섯 번"],
      points: 5
    },
    {
      id: "p2_h_2",
      difficulty: "hard",
      subType: "trace",
      title: "반복 추적 - 상자 공 꺼내기",
      desc: "상자에 공이 10개 있습니다. '공을 2개씩 꺼낸다'를 상자가 빌 때까지 반복합니다. 꺼내는 동작을 총 몇 번 반복하게 되는지 숫자만 쓰시오.",
      placeholder: "숫자 입력",
      answers: ["5", "5번", "5회", "다섯", "다섯번", "다섯 번"],
      points: 5
    },
    {
      id: "p2_h_3",
      difficulty: "hard",
      subType: "trace",
      title: "반복 추적 - 사탕 나눠주기",
      desc: "사탕이 7개 있습니다. 학생들에게 1개씩 나누어줍니다. 3명의 학생에게 나누어준 직후, 남아있는 사탕은 몇 개인지 숫자만 쓰시오.",
      placeholder: "숫자 입력",
      answers: ["4", "4개", "네개", "네 개"],
      points: 5
    },
    {
      id: "p2_h_4",
      difficulty: "hard",
      subType: "scenario",
      title: "시나리오 - 도서관 방역 로봇",
      desc: "방역 로봇의 규칙입니다.\n[규칙1] 현재 시간이 오후 6시 이후인가? (참이면 소독 시작, 거짓이면 규칙2로)\n[규칙2] 사람 움직임이 감지되었는가? (참이면 정지, 거짓이면 대기)\n현재 오후 5시이고 사람이 지나가고 있습니다. 로봇은 어떤 동작을 할까요? 지문에서 알맞은 동작을 찾아 2글자로 쓰시오.",
      placeholder: "ㅇㅇ",
      answers: ["정지", "정지하기", "멈춤"],
      points: 5
    },
    {
      id: "p2_h_5",
      difficulty: "hard",
      subType: "scenario",
      title: "시나리오 - 스마트 화재 경보",
      desc: "경보 시스템 규칙입니다.\n[규칙1] 연기 농도가 50 이상인가? (참이면 대피 방송, 거짓이면 규칙2로)\n[규칙2] 온도가 60도 이상인가? (참이면 경고음, 거짓이면 정상)\n현재 연기 농도는 30, 온도는 70도입니다. 수행할 동작을 지문에서 찾아 3글자로 쓰시오.",
      placeholder: "ㅇㅇㅇ",
      answers: ["경고음", "경보음"],
      points: 5
    },
    {
      id: "p2_h_6",
      difficulty: "hard",
      subType: "scenario",
      title: "시나리오 - 무인 택배 보관함",
      desc: "보관함 규칙입니다.\n[규칙1] 비밀번호가 일치하는가? (참이면 문 열림, 거짓이면 규칙2로)\n[규칙2] 3회 이상 틀렸는가? (참이면 잠금, 거짓이면 재입력)\n사용자가 비밀번호를 1번 틀렸습니다. 수행할 동작을 지문에서 찾아 3글자로 쓰시오.",
      placeholder: "ㅇㅇㅇ",
      answers: ["재입력", "재입", "다시입력"],
      points: 5
    }
  ]
};

// Node.js 환경에서 모듈 내보내기 (문법 검증 등)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EVAL_QUESTION_BANK };
}
// 브라우저 환경에서 전역 변수로 내보내기
if (typeof window !== 'undefined') {
  window.EVAL_QUESTION_BANK = EVAL_QUESTION_BANK;
}
