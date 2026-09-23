module.exports=require('./assessment-prompt.cjs')+`

### 연결 사실을 먼저 확인하고 감점 항목을 분리하라
graphFacts.paths는 실제 fromPort를 해석한 경로다. 예(참)와 아니오(거짓)를 바꾸어 읽지 않는다. 블록의 이름만 보고 연결도 옳다고 가정하지 않는다.
graphFacts.connectedNonterminalDeadEnds는 주요 흐름에 연결되어 있으나 나가는 선이 없는 처리/판단 기호다. 이 사실을 무시해 structure 10점을 주지 않는다. 후속 연결 한 곳이 빠졌으면 structure 8점이며 그 연결 누락 때문에 logic까지 감점하지 않는다.
noConnectionsWithMeaningfulBlocks=true이면 모든 화살표가 없는 미완성 구조다. 의미 있는 기호들이 있으면 structure 4점을 기본으로, 기호 자체도 거의 없으면 2점을 사용한다. 이때 logic은 연결 부재가 아니라 기호에 적힌 행동·조건의 의미만 평가한다. 연결 부재를 logic 감점 근거로 적지 않는다.
주된 판단의 참/거짓 행동이 목표와 정반대로 연결된 경우는 핵심 논리 오류이므로 logic 6점이다. 두 분기와 끝 연결이 모두 존재하고 기호가 적절하면 structure는 10점이다. 분기 방향이 의미와 반대라는 같은 이유로 structure까지 감점하지 않는다.
예: 실내가 추우면 난방을 켜고 아니면 끝내야 하는데 실제 선은 참→끝, 거짓→난방 켜기이면 logic 6 / structure 10이다. 이는 단순한 선 모양 문제가 아니라 행동 선택의 논리 문제다.
예: 타당한 난방 순서도에서 난방 켜기→끝 선 하나만 없으면 logic 10 / structure 8이다.
예: 모든 기호가 낱개로 있고 행동·조건 내용은 타당하면 logic 10 / structure 4가 가능하다. 연결되지 않았다는 사실 하나만으로 두 항목을 낮추지 않는다.
반드시 여섯 점수와 각 근거가 서로 모순되지 않는지 확인한 뒤 JSON을 출력한다.
`;
