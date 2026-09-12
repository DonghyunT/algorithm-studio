function tokenizeFlowchartExpr(s) {
  const t = [];
  let i = 0;
  const isD = c => c >= '0' && c <= '9';
  const isI = c => /[A-Za-z_\uAC00-\uD7A3]/.test(c);
  const isIN = c => /[A-Za-z0-9_\uAC00-\uD7A3]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (isD(c) || (c === '.' && isD(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && (isD(s[j]) || s[j] === '.')) j++;
      const raw = s.slice(i, j);
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new Error('숫자 표기를 확인해 주세요.');
      t.push({ k: 'num', v: Number(raw) });
      i = j;
      continue;
    }
    if (isI(c)) {
      let j2 = i;
      while (j2 < s.length && isIN(s[j2])) j2++;
      t.push({ k: 'id', v: s.slice(i, j2) });
      i = j2;
      continue;
    }
    const two = s.substr(i, 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '<>') {
      t.push({ k: 'op', v: two === '<>' ? '!=' : two });
      i += 2;
      continue;
    }
    if ('+-*/%()<>='.indexOf(c) >= 0) {
      t.push({ k: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`사용할 수 없는 기호입니다: '${c}'`);
  }
  return t;
}

function makeFlowchartParser(tk) {
  let p = 0;
  function peek() { return tk[p]; }
  function expr() {
    let n = term();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const o = tk[p++].v;
      n = { k: 'bin', o, l: n, r: term() };
    }
    return n;
  }
  function term() {
    let n = unary();
    while (peek() && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
      const o = tk[p++].v;
      n = { k: 'bin', o, l: n, r: unary() };
    }
    return n;
  }
  function unary() {
    if (peek() && peek().v === '-') {
      p++;
      return { k: 'neg', e: unary() };
    }
    return primary();
  }
  function primary() {
    const t = peek();
    if (!t) throw new Error('수식이 완성되지 않았습니다.');
    if (t.k === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.k === 'id') { p++; return { k: 'var', v: t.v }; }
    if (t.v === '(') {
      p++;
      const e = expr();
      if (!peek() || peek().v !== ')') throw new Error("닫는 괄호 ')'가 빠졌습니다.");
      p++;
      return e;
    }
    throw new Error(`예상하지 못한 수식 요소입니다: '${t.v}'`);
  }
  return {
    expr,
    peek,
    take: () => tk[p++],
    atEnd: () => p >= tk.length
  };
}

function evalFlowchartAST(ast, vars) {
  if (ast.k === 'num') return ast.v;
  if (ast.k === 'var') {
    if (!Object.prototype.hasOwnProperty.call(vars, ast.v)) {
      throw new Error(`아직 값이 지정되지 않은 변수 '${ast.v}'입니다.`);
    }
    return vars[ast.v];
  }
  if (ast.k === 'neg') return -evalFlowchartAST(ast.e, vars);
  const l = evalFlowchartAST(ast.l, vars);
  const r = evalFlowchartAST(ast.r, vars);
  if (ast.o === '+') return l + r;
  if (ast.o === '-') return l - r;
  if (ast.o === '*') return l * r;
  if (ast.o === '/') {
    if (r === 0) throw new Error('0으로 나눌 수 없습니다.');
    return l / r;
  }
  if (ast.o === '%') {
    if (r === 0) throw new Error('0으로 나눈 나머지를 구할 수 없습니다.');
    return l % r;
  }
  throw new Error(`알 수 없는 연산자: ${ast.o}`);
}

function parseFlowchartAssign(text) {
  const tk = tokenizeFlowchartExpr(text);
  if (tk.length < 3 || tk[0].k !== 'id' || tk[1].v !== '=') {
    throw new Error("처리 기호는 '변수 = 식' 형태로 적어주세요 (예: sum = 0, sum = sum + i)");
  }
  const name = tk[0].v;
  const ps = makeFlowchartParser(tk.slice(2));
  const ast = ps.expr();
  if (!ps.atEnd()) throw new Error('식 뒤에 해석할 수 없는 부분이 남아있습니다.');
  return { name, ast };
}

function parseFlowchartCond(text) {
  const tk = tokenizeFlowchartExpr(text);
  const ps = makeFlowchartParser(tk);
  const left = ps.expr();
  const op = ps.peek();
  if (!op || ['<', '>', '<=', '>=', '==', '!='].indexOf(op.v) < 0) {
    throw new Error("판단 기호는 '식 <  <=  >  >=  ==  != 식' 형태로 적어주세요 (예: i <= 10)");
  }
  ps.take();
  const right = ps.expr();
  if (!ps.atEnd()) throw new Error('조건식 뒤에 해석할 수 없는 부분이 남아있습니다.');
  return { l: left, o: op.v, r: right };
}

function evalFlowchartCond(c, vars) {
  const a = evalFlowchartAST(c.l, vars);
  const b = evalFlowchartAST(c.r, vars);
  switch (c.o) {
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
  }
  return false;
}

