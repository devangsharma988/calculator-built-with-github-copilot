(function(){
  const display = document.getElementById('display');

  function setDisplay(v){
    display.textContent = v === '' ? '0' : String(v);
  }

  // Append input with basic guards to prevent obvious invalid sequences
  function append(value){
    let cur = display.textContent === '0' ? '' : display.textContent;
    const lastChar = cur.slice(-1);

    const isOperator = c => ['+','-','*','/'].includes(c);
    const isDigit = c => /[0-9]/.test(c);

    // Prevent multiple dots in the current number segment
    if (value === '.') {
      // find last operator or opening parenthesis to delimit current number
      const idx = Math.max(cur.lastIndexOf('+'), cur.lastIndexOf('-'), cur.lastIndexOf('*'), cur.lastIndexOf('/'), cur.lastIndexOf('('));
      const segment = idx === -1 ? cur : cur.slice(idx + 1);
      if (segment.includes('.')) return; // ignore extra dot
      if (segment === '') value = '0.'; // start decimal as 0.
    }

    // Handle operators: avoid consecutive binary operators
    if (isOperator(value)) {
      // allow unary minus at start or after '(' 
      if (cur === '' && value === '-') {
        setDisplay('-');
        return;
      }
      if (lastChar === '' || lastChar === '(') {
        // don't allow other operators at start or after '('
        if (value !== '-') return;
      }
      if (isOperator(lastChar)) {
        // replace previous operator with the new one (except allow "(-" for unary)
        // if previous was '-' and before that was operator or start -> it's unary, keep it
        const beforeLast = cur.slice(-2, -1);
        const prevWasUnaryMinus = lastChar === '-' && (cur.length === 1 || isOperator(beforeLast) || beforeLast === '(');
        if (!prevWasUnaryMinus) {
          // replace last operator
          cur = cur.slice(0, -1);
          setDisplay(cur + value);
          return;
        }
      }
    }

    // Prevent a ')' directly after an operator
    if (value === ')' && isOperator(lastChar)) return;

    setDisplay(cur + value);
  }

  function backspace(){
    let cur = display.textContent;
    if (cur.length <= 1) setDisplay('0');
    else setDisplay(cur.slice(0, -1));
  }

  function clearAll(){ setDisplay('0'); }

  // Tokenize the expression into numbers, operators and parentheses.
  // Numbers include optional decimal point. Unary minus is emitted as token 'u-'.
  function tokenize(expr) {
    // Reject any disallowed characters early
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) throw new Error('Invalid characters');
    const tokens = [];
    const cleaned = expr.replace(/\s+/g, '');
    for (let i = 0; i < cleaned.length; ) {
      const ch = cleaned[i];

      // Parentheses
      if (ch === '(' || ch === ')') {
        tokens.push(ch);
        i++;
        continue;
      }

      // Operator or unary minus detection
      if (/[+\-*/]/.test(ch)) {
        // Unary minus: at start, or after another operator, or after '('
        if (ch === '-') {
          const prev = tokens.length === 0 ? null : tokens[tokens.length - 1];
          if (prev === null || prev === '(' || (typeof prev === 'string' && /[+\-*/]/.test(prev))) {
            tokens.push('u-'); // unary minus
            i++;
            continue;
          }
        }
        tokens.push(ch);
        i++;
        continue;
      }

      // Number (integer or decimal)
      if (/[0-9.]/.test(ch)) {
        let j = i;
        let dotCount = 0;
        while (j < cleaned.length && /[0-9.]/.test(cleaned[j])) {
          if (cleaned[j] === '.') dotCount++;
          if (dotCount > 1) throw new Error('Invalid number format');
          j++;
        }
        const numStr = cleaned.slice(i, j);
        // disallow lone '.' or trailing '.' without digits after (but allow '3.' which parses)
        if (numStr === '.' ) throw new Error('Invalid number format');
        tokens.push(numStr);
        i = j;
        continue;
      }

      // Anything else is invalid
      throw new Error('Invalid token');
    }
    return tokens;
  }

  // Convert infix tokens to RPN using shunting-yard algorithm
  function toRPN(tokens) {
    const out = [];
    const ops = [];
    const precedence = { 'u-': 4, '*': 3, '/': 3, '+': 2, '-': 2 };
    const rightAssociative = { 'u-': true };

    for (const token of tokens) {
      if (/^\d+(\.\d+)?$/.test(token)) {
        out.push(token);
      } else if (token === 'u-' || ['+','-','*','/'].includes(token)) {
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top === '(') break;
          const pTop = precedence[top] || 0;
          const pTok = precedence[token] || 0;
          if ((rightAssociative[token] && pTok < pTop) || (!rightAssociative[token] && pTok <= pTop)) {
            out.push(ops.pop());
          } else break;
        }
        ops.push(token);
      } else if (token === '(') {
        ops.push(token);
      } else if (token === ')') {
        let found = false;
        while (ops.length) {
          const t = ops.pop();
          if (t === '(') { found = true; break; }
          out.push(t);
        }
        if (!found) throw new Error('Mismatched parentheses');
      } else {
        throw new Error('Unknown token in shunting yard');
      }
    }

    while (ops.length) {
      const t = ops.pop();
      if (t === '(' || t === ')') throw new Error('Mismatched parentheses');
      out.push(t);
    }
    return out;
  }

  // Evaluate RPN, check for division by zero and other invalid operations
  function evalRPN(rpn) {
    const st = [];
    for (const token of rpn) {
      if (/^\d+(\.\d+)?$/.test(token)) {
        st.push(parseFloat(token));
      } else if (token === 'u-') {
        if (st.length < 1) throw new Error('Invalid expression');
        const a = st.pop();
        st.push(-a);
      } else if (['+','-','*','/'].includes(token)) {
        if (st.length < 2) throw new Error('Invalid expression');
        const b = st.pop();
        const a = st.pop();
        let res;
        if (token === '+') res = a + b;
        else if (token === '-') res = a - b;
        else if (token === '*') res = a * b;
        else if (token === '/') {
          if (b === 0) throw new Error('Division by zero');
          res = a / b;
        }
        st.push(res);
      } else {
        throw new Error('Invalid RPN token');
      }
    }
    if (st.length !== 1) throw new Error('Invalid expression');
    const result = st[0];
    if (!isFinite(result)) throw new Error('Math error');
    return result;
  }

  // Combined safe evaluation using the above helpers
  function safeEval(expr){
    // Tokenize -> convert to RPN -> evaluate
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    return evalRPN(rpn);
  }

  function evaluate(){
    const expr = display.textContent;
    try{
      const result = safeEval(expr);
      setDisplay(String(result));
    }catch(e){
      // Show a short "Error" indicator
      setDisplay('Error');
      // Reset after a short delay so user can continue
      setTimeout(()=> setDisplay('0'), 1200);
    }
  }

  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const action = btn.dataset.action;
      const value = btn.dataset.value;
      if (action === 'clear') return clearAll();
      // support both 'back' and 'delete' action keys
      if (action === 'back' || action === 'delete') return backspace();
      if (action === 'equals') return evaluate();
      if (value) return append(value);
    });
  });

  // Keyboard support (mirrors click behaviour)
  window.addEventListener('keydown', e=>{
    if (e.key >= '0' && e.key <= '9') return append(e.key);
    if (['+','-','*','/','(',')','.'].includes(e.key)) return append(e.key);
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return evaluate(); }
    if (e.key === 'Backspace') return backspace();
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c') return clearAll();
  });

})();
