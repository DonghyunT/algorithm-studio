/* Shared structural validation and bounded, deterministic assessment execution. */
function validateFlowGraph(blocks = [], connections = []) {
  const issues = [];
  const add = (id, message) => issues.push({ blockId: id || null, message });
  if (!Array.isArray(blocks) || !Array.isArray(connections) || blocks.length > 200 || connections.length > 400) {
    return { valid: false, issues: [{ blockId: null, message: '순서도 자료의 크기나 형식을 확인해 주세요.' }] };
  }
  const nodes = new Map();
  for (const block of blocks) {
    if (!block || typeof block.id !== 'string' || !/^[\w-]+$/.test(block.id) || nodes.has(block.id) || !['terminal','io','decision','process'].includes(block.shape)) {
      add(null, '기호 정보를 확인해 주세요.'); continue;
    }
    nodes.set(block.id, block);
    if (typeof block.text !== 'string' || !block.text.trim() || block.text.trim() === '내용 입력') add(block.id, '이 기호의 내용이 비어 있습니다.');
  }
  const starts = blocks.filter(b => b?.shape === 'terminal' && typeof b.text === 'string' && /^시작$/.test(b.text.trim()));
  const ends = blocks.filter(b => b?.shape === 'terminal' && typeof b.text === 'string' && /^(종료|끝)$/.test(b.text.trim()));
  if (starts.length !== 1) add(null, '시작 기호를 하나 지정해 주세요.');
  if (!ends.length) add(null, '종료 기호를 확인해 주세요.');
  const out = new Map(), incoming = new Map();
  for (const edge of connections) {
    if (!edge || !nodes.has(edge.from) || !nodes.has(edge.to)) { add(null, '연결선 끝의 기호를 찾을 수 없습니다.'); continue; }
    if (!out.has(edge.from)) out.set(edge.from, []);
    out.get(edge.from).push(edge);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  for (const [id, block] of nodes) {
    const exits = out.get(id) || [];
    if (ends.includes(block)) { if (exits.length) add(id, '종료 기호 뒤에 연결선이 있습니다.'); }
    else if (block.shape === 'decision') {
      if (exits.length !== 2 || !exits.some(e => e.fromPort === 'yes') || !exits.some(e => e.fromPort === 'no')) add(id, '이 판단 기호의 예·아니오 연결을 확인해 주세요.');
    } else if (exits.length !== 1) add(id, '이 기호에서 다음 단계로 이어지는 연결을 확인해 주세요.');
  }
  if (starts.length === 1) {
    const visited = new Set(), todo = [starts[0].id];
    while (todo.length) { const id = todo.pop(); if (visited.has(id)) continue; visited.add(id); (out.get(id)||[]).forEach(e=>todo.push(e.to)); }
    for (const id of nodes.keys()) if (!visited.has(id)) add(id, '시작에서 이 기호까지 연결되지 않았습니다.');
    const canEnd = new Set(), back = ends.map(b=>b.id);
    while (back.length) { const id = back.pop(); if (canEnd.has(id)) continue; canEnd.add(id); (incoming.get(id)||[]).forEach(e=>back.push(e.from)); }
    for (const id of visited) if (!canEnd.has(id)) add(id, '이 단계에서 종료로 이어지는 길이 없습니다.');
  }
  return { valid: issues.length === 0, issues, nodes, out, startId: starts[0]?.id };
}

const EVAL_EXECUTION_CASES = {
  theme_greenhouse: { label: '기온', inputs: [27,28,29], variable: /기온|온도/, outputs: ['창문 닫기','창문 열기'], expected: n=>n>28, actions: [/창문.*닫|보온/, /창문.*열|팬.*(가동|돌)/] },
  theme_vending: { label: '금액', inputs: [999,1000,1001], variable: /금액|잔액|돈/, outputs: ['잔액 부족 안내','음료 배출'], expected: n=>n>=1000, actions: [/부족|모자/, /음료.*(배출|제공|출력)/] },
  theme_transit: { label: '나이', inputs: [12,13,18,19], variable: /나이/, outputs: ['일반 요금','청소년 요금'], expected: n=>n>=13&&n<=18, actions: [/일반|성인|1,?400/, /할인|청소년|720/] },
  theme_traffic: { label: '대기시간', inputs: [29,30,31], variable: /시간|대기|버튼/, outputs: ['빨간불','초록불'], expected: n=>n>=30, actions: [/빨간|적색/, /초록|녹색/] }
};

function evaluateAssessmentCondition(text, input, spec) {
  let source = String(text).trim().replace(/,/g, '').replace(/[?？。.]$/g, '');
  // Only a documented subset of natural-language comparisons is executable.
  // Unknown sentences fail visibly; they are never replaced with the expected branch.
  if (/아니|않|또는|미만.*이상|\|\|/.test(source)) throw Error('이 조건 표현은 실행기가 해석할 수 없습니다. 교사 검토가 필요합니다.');
  const range = source.match(/^(?:나이)(?:가|는)?\s*(\d+)\s*(?:세)?\s*이상\s*(?:이고\s*)?(\d+)\s*(?:세)?\s*이하(?:인가|인가요|이다)?$/);
  if (range && spec.variable.test(source)) return input >= Number(range[1]) && input <= Number(range[2]);
  const comparison = source.match(/^[가-힣]+\s*(-?\d+(?:\.\d+)?)\s*(?:℃|도|원|세|초)?\s*(초과|이상|미만|이하)(?:인가|인가요|이다)?$/);
  if (comparison && spec.variable.test(source)) {
    const n = Number(comparison[1]);
    return ({초과:input>n,이상:input>=n,미만:input<n,이하:input<=n,경과:input>=n,지났:input>=n})[comparison[2]];
  }
  const vars = Object.create(null);
  ['x','기온','온도','현재기온','금액','투입금액','나이','시간','대기시간'].forEach(name=>vars[name]=input);
  const parts=source.split(/\s*(?:&&|그리고|이고)\s*/);
  return parts.every(part=>evalFlowchartCond(parseFlowchartCond(part),vars));
}

function inspectAssessmentFlow(part3 = {}) {
  const graph = validateFlowGraph(part3.blocks || [], part3.connections || []);
  const spec = typeof part3.selectedThemeId === 'string' && Object.hasOwn(EVAL_EXECUTION_CASES,part3.selectedThemeId) ? EVAL_EXECUTION_CASES[part3.selectedThemeId] : null;
  if (!graph.valid || !spec) return { passed:false, issues:graph.issues, cases:[], score:0 };
  const cases = [];
  const issues = [];
  for (const input of spec.inputs) {
    let id=graph.startId, count=0, hasInput=false;
    const actions=[], trace=[];
    let stopped=false;
    while (id && count++ < 200) {
      const block=graph.nodes.get(id), exits=graph.out.get(id)||[];
      trace.push({blockId:block.id,text:block.text});
      try {
        if (block.shape==='terminal' && /^(종료|끝)$/.test(block.text.trim())) break;
        if (block.shape==='io' && /입력|감지|측정/.test(block.text)) {
          if (!spec.variable.test(block.text)) throw Error('이 입력 표현은 실행기가 해석할 수 없습니다.');
          hasInput=true;
        } else if (block.shape==='process' || block.shape==='io') {
          if (/않|말고|아니|안\s*(열|닫|가동|배출)/.test(block.text)) throw Error('이 동작 표현은 실행기가 해석할 수 없습니다.');
          const matches=spec.actions.map(pattern=>pattern.test(block.text));
          if (matches.filter(Boolean).length!==1) throw Error('이 동작 표현은 실행기가 해석할 수 없습니다.');
          actions.push(spec.outputs[matches[1]?1:0]);
        }
        if (block.shape==='decision') {
          if (!hasInput) throw Error('이 단계에서 사용할 입력값이 없습니다.');
          const condition=evaluateAssessmentCondition(block.text,input,spec);
          id=exits.find(edge=>edge.fromPort===(condition?'yes':'no'))?.to;
        } else id=exits[0]?.to;
      } catch(error) {
        issues.push({blockId:block.id,message:'이 단계에서 실행을 이어갈 수 없어요. '+error.message}); stopped=true; break;
      }
    }
    if(count>=200) { issues.push({blockId:id,message:'실행 횟수 제한에 도달해 멈췄어요.'}); stopped=true; }
    const expected=spec.outputs[spec.expected(input)?1:0];
    const actual=actions.join(' → ') || '동작 없음';
    cases.push({input:spec.label+' '+input,expected,actual:stopped?'실행 중단':actual,trace,passed:!stopped&&hasInput&&actions.length===1&&actions[0]===expected});
  }
  const passed=cases.length>0&&cases.every(item=>item.passed);
  return {passed,issues,cases,score:passed?40:0};
}

function gradeEvaluation(answers = {}, questionVersion=answers?.part3?.questionVersion) {
  if (!answers || typeof answers !== 'object') answers = {};
  let part1=0,part2=0;
  evaluationQuestions(answers,questionVersion).part1.forEach(q=>{if(answers.part1?.[q.id]===q.correctAnswer)part1+=q.points;});
  evaluationQuestions(answers,questionVersion).part2.forEach(q=>{
    const raw=answers.part2?.[q.id];
    const value=(typeof raw==='string'?raw:'').toLowerCase().replace(/\s/g,'');
    if(q.answers.some(answer=>answer.toLowerCase().replace(/\s/g,'')===value))part2+=q.points;
  });
  if(questionVersion===3)return {scores:{part1,part2,part3:null,objectiveTotal:part1+part2,total:null,teacherOverride:null,pendingReview:true},feedback:{part2:'문항 기준으로 계산',part3:'자유 설계 답안은 교사 검토 후 점수가 확정됩니다.'}};
    const inspection=inspectAssessmentFlow(answers.part3||{}), part3=inspection.score;
  return {scores:{part1,part2,part3,total:part1+part2+part3,teacherOverride:null},feedback:{part2:'문항 기준으로 계산',part3:inspection.passed?'지정된 검사 입력 통과. 교사 최종 검토 대상.':'실행 결과 확인 및 교사 검토 필요.'}};
}
