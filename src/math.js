'use strict';
/* Schampschot: rekenkern. Breuken, opmaak, invoerparser en opgavengeneratoren.
   Geen DOM hier, zodat alles in node te testen is (zie test/math.test.js). */

/* ---------- basis ---------- */
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sgn = () => (Math.random() < 0.5 ? -1 : 1);
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const isSq = n => Number.isInteger(n) && n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;

class Q {
  constructor(n, d = 1) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); this.n = n / g; this.d = d / g; }
  static of(x) { if (x instanceof Q) return x; if (Number.isInteger(x)) return new Q(x); return new Q(Math.round(x * 12), 12); }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(Math.abs(this.n), this.d); }
  get v() { return this.n / this.d; }
  isInt() { return this.d === 1; }
}
const q = (n, d = 1) => new Q(n, d);

/* ---------- opmaak (HTML) ---------- */
const V = s => `<var>${s}</var>`;
const rc = s => `rc<sub>${V(s)}</sub>`;
function fq(x) { // gemengde breuk zoals in het boek: −1⅓
  x = Q.of(x); const neg = x.n < 0, n = Math.abs(x.n), d = x.d;
  if (d === 1) return (neg ? '−' : '') + n;
  const w = Math.floor(n / d), r = n % d;
  return (neg ? '−' : '') + (w || '') + `<span class="fr"><span>${r}</span><span>${d}</span></span>`;
}
function fdec(x, dec) {
  const v = x instanceof Q ? x.v : x;
  const s = dec == null ? String(Math.round(v * 1000) / 1000) : v.toFixed(dec);
  return s.replace('-', '−').replace('.', ',');
}
const pn = x => { x = Q.of(x); return x.n < 0 ? `(${fq(x)})` : fq(x); };
const pp = x => { x = Q.of(x); return x.n < 0 || x.d !== 1 ? `(${fq(x)})` : fq(x); }; // ook breuken tussen haakjes
function rt(x) {
  x = Q.of(x);
  if (x.d === 1 && isSq(x.n)) return String(Math.sqrt(x.n));
  return `<span class="sqrt">√<span class="rad">${fq(x)}</span></span>`;
}
const root = inner => `<span class="sqrt">√<span class="rad">${inner}</span></span>`;
const frac = (a, b) => `<span class="fr big"><span>${a}</span><span>${b}</span></span>`;
function sq(v, c) { c = Q.of(c); if (c.n === 0) return `${V(v)}<sup>2</sup>`; return `(${V(v)} ${c.n < 0 ? '+' : '−'} ${fq(c.abs())})<sup>2</sup>`; }
function vterm(c, v, first) {
  c = Q.of(c); if (c.n === 0) return '';
  const a = c.abs();
  const body = ((a.n === 1 && a.d === 1 && v) ? '' : fq(a)) + (v ? V(v) : '');
  return first ? (c.n < 0 ? '−' : '') + body : (c.n < 0 ? ' − ' : ' + ') + body;
}
const circEq = (M, r2) => `${sq('x', M[0])} + ${sq('y', M[1])} = ${fq(r2)}`;
const circExp = (p, qq, s) => `${V('x')}<sup>2</sup> + ${V('y')}<sup>2</sup>${vterm(p, 'x')}${vterm(qq, 'y')}${vterm(s, '')} = 0`;
function lineEq(a, b) { a = Q.of(a); b = Q.of(b); if (a.n === 0) return `${V('y')} = ${fq(b)}`; return `${V('y')} = ${vterm(a, 'x', true)}${vterm(b, '')}`; }
const lineStd = (A, B, C) => `${vterm(A, 'x', true)}${vterm(B, 'y', Q.of(A).n === 0)} = ${fq(C)}`;
const P = (name, p) => `${V(name)}(${fq(p[0])}, ${fq(p[1])})`;
const dd = (a, b) => `${V('d')}(${a}, ${b})`;
const distWork = (A, B) => root(`(${fq(A[0])} − ${pn(B[0])})<sup>2</sup> + (${fq(A[1])} − ${pn(B[1])})<sup>2</sup>`);
function poly(A, B, C) { return `${vterm(A, 'a', true)}<sup>2</sup>${vterm(B, 'a')}${vterm(C, '')} = 0`; }

/* ---------- invoer ---------- */
function evalExpr(str) {
  const s = String(str).replace(/\s/g, '').replace(/,/g, '.').replace(/−/g, '-').replace(/[·×]/g, '*');
  if (!s) return NaN;
  let i = 0;
  const peek = () => s[i];
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const t = term(); v = o === '+' ? v + t : v - t; } return v; }
  function term() {
    let v = factor();
    for (;;) {
      const c = peek();
      if (c === '*' || c === '/') { i++; const f = factor(); v = c === '*' ? v * f : v / f; }
      else if (c === '√' || c === '(') v *= factor();
      else break;
    }
    return v;
  }
  function factor() {
    const c = peek();
    if (c === '-') { i++; return -factor(); }
    if (c === '+') { i++; return factor(); }
    if (c === '√') { i++; return Math.sqrt(factor()); }
    if (c === '(') { i++; const v = expr(); if (peek() !== ')') throw 0; i++; return v; }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length; return parseFloat(m[0]);
  }
  try { const v = expr(); return i === s.length && isFinite(v) ? v : NaN; } catch (e) { return NaN; }
}

const close = (v, e, tol) => Math.abs(v - e) <= (tol || 1e-7 * Math.max(1, Math.abs(e)));
function checkInput(step, vals) {
  if (step.check) return step.check(vals);
  const ex = step.slots.map(s => s.v);
  const match = es => vals.every((v, i) => close(v, es[i], step.slots[i].tol));
  if (match(ex)) return { ok: true };
  if (step.unordered && match(ex.slice().reverse())) return { ok: true };
  const nearTo = es => vals.every((v, i) => Math.abs(v - es[i]) < 0.011);
  return { ok: false, near: nearTo(ex) || (!!step.unordered && nearTo(ex.slice().reverse())) };
}

/* ---------- lijnen en scenes ---------- */
function twoPts(ln) { if (ln.x != null) return [[ln.x, 0], [ln.x, 1]]; if (ln.p) return [ln.p, ln.q]; return [[0, ln.b], [1, ln.a + ln.b]]; }
function lineStatus(ln, target) { // ligging van lijn t.o.v. cirkel {M, r}
  const [p, w] = twoPts(ln), dx = w[0] - p[0], dy = w[1] - p[1], L2 = dx * dx + dy * dy;
  const mx = target.M[0] - p[0], my = target.M[1] - p[1];
  const t = (mx * dx + my * dy) / L2, foot = [p[0] + t * dx, p[1] + t * dy];
  const d = Math.abs(dx * my - dy * mx) / Math.sqrt(L2), r = target.r;
  let kind = 'mist', pts = [];
  if (Math.abs(d - r) < 1e-6) { kind = 'raak'; pts = [foot]; }
  else if (d < r) { kind = 'snijdt'; const h = Math.sqrt(r * r - d * d) / Math.sqrt(L2); pts = [[foot[0] + h * dx, foot[1] + h * dy], [foot[0] - h * dx, foot[1] - h * dy]]; }
  let through = true;
  if (target.through) { const ax = target.through[0] - p[0], ay = target.through[1] - p[1]; through = Math.abs(dx * ay - dy * ax) / Math.sqrt(L2) < 1e-6; }
  return { kind, d, foot, pts, through };
}
const sceneBase = () => ({ circles: [], points: [], lines: [], segs: [], extent: [] });
function fitView(sc, aspect = 1) {
  const xs = [0], ys = [0];
  const add = (x, y) => { xs.push(x); ys.push(y); };
  sc.circles.forEach(c => { add(c.M[0] - c.r, c.M[1] - c.r); add(c.M[0] + c.r, c.M[1] + c.r); });
  sc.points.forEach(p => add(p.p[0], p.p[1]));
  sc.segs.forEach(s => { add(s.p[0], s.p[1]); add(s.q[0], s.q[1]); });
  (sc.extent || []).forEach(e => add(e[0], e[1]));
  const pad = sc.pad == null ? 1.2 : sc.pad;
  let x0 = Math.floor(Math.min(...xs) - pad), x1 = Math.ceil(Math.max(...xs) + pad);
  let y0 = Math.floor(Math.min(...ys) - pad), y1 = Math.ceil(Math.max(...ys) + pad);
  const w = x1 - x0, h = y1 - y0;
  if (w / h < aspect) { const d = (h * aspect - w) / 2; x0 -= d; x1 += d; }
  else { const d = (w / aspect - h) / 2; y0 -= d; y1 += d; }
  return [x0, x1, y0, y1];
}

/* ---------- stappen ---------- */
// lvl 0 = kern (altijd), 1 = tussenstap, 2 = extra hulp (alleen in de eerste ronde)
const inp = (lvl, prompt, slots, o = {}) => ({ type: 'input', lvl, prompt, slots, ...o });
const cho = (lvl, prompt, choices, o = {}) => ({ type: 'choice', lvl, prompt, choices: shuffle(choices), ...o });
const tap = (lvl, prompt, test, answer, o = {}) => ({ type: 'tap', lvl, prompt, test, answer, ansHtml: `(${answer[0]}, ${answer[1]})`.replace(/-/g, '−'), ...o });
const S = (v, show) => (v instanceof Q ? { v: v.v, show: show || fq(v) } : { v, show: show != null ? show : fq(v) });
const inRange = (pts, m = 10) => pts.every(p => Math.abs(p[0]) <= m && Math.abs(p[1]) <= m);

/* ===================== M0: middelpunt en straal ===================== */
function gM0(variant) {
  const sc = sceneBase();
  if (variant === 'half') {
    let p, qq, s, r2;
    do { p = pick([1, 3, 5, 7]) * sgn(); qq = pick([1, 3, 5, 7]) * sgn(); s = rnd(-8, 10); r2 = q(p * p + qq * qq, 4).sub(s); } while (s === 0 || r2.v < 2 || r2.v > 30);
    const M = [q(-p, 2), q(-qq, 2)], hx = q(p, 2), hy = q(qq, 2);
    const circ = { M: [M[0].v, M[1].v], r: Math.sqrt(r2.v), name: 'c', hidden: true }, pm = { p: circ.M, name: 'M', hidden: true };
    sc.circles.push(circ); sc.points.push(pm);
    return {
      given: `Cirkel ${V('c')}: ${circExp(p, qq, s)}. Bepaal het middelpunt ${V('M')} en de straal ${V('r')}.`, scene: sc,
      steps: [inp(0, `${V('M')}({0}, {1}) en ${V('r')} = √{2}`, [S(M[0]), S(M[1]), S(r2)], {
        hint: `Splits kwadraten af. De helft van ${fq(p)} is ${fq(hx)}, dus ${V('x')}<sup>2</sup>${vterm(p, 'x')} = ${sq('x', M[0])} − ${fq(hx.mul(hx))}. Doe hetzelfde voor ${V('y')}.`,
        uitleg: `${sq('x', M[0])} − ${fq(hx.mul(hx))} + ${sq('y', M[1])} − ${fq(hy.mul(hy))}${vterm(s, '')} = 0<br>${circEq(M, r2)}<br>Dus ${P('M', M)} en ${V('r')} = ${rt(r2)}.`,
        after: () => { circ.hidden = false; pm.hidden = false; },
      })],
    };
  }
  let a, b, r2, s;
  do { a = rnd(-5, 5); b = rnd(-5, 5); r2 = pick([4, 9, 16, 25, 5, 10, 13, 20]); s = a * a + b * b - r2; } while (a === 0 || b === 0 || s === 0);
  const p = -2 * a, qq = -2 * b, M = [a, b];
  const circ = { M, r: Math.sqrt(r2), name: 'c', hidden: true }, pm = { p: M, name: 'M', hidden: true };
  sc.circles.push(circ); sc.points.push(pm);
  const form = (cx, kx, cy, ky, sg) => `${sq('x', cx)} ${sg} ${kx} + ${sq('y', cy)} ${sg} ${ky}${vterm(s, '')} = 0`;
  const xsplit = `${V('x')}<sup>2</sup>${vterm(p, 'x')} = ${sq('x', a)} − ${a * a}`;
  return {
    given: `Cirkel ${V('c')}: ${circExp(p, qq, s)}. Bepaal het middelpunt ${V('M')} en de straal ${V('r')}.`, scene: sc,
    steps: [
      cho(2, 'Splits de kwadraten af. Welke regel klopt?', [
        { html: form(a, a * a, b, b * b, '−'), ok: true },
        { html: form(a, a * a, b, b * b, '+'), why: `Het kwadraat van de helft trek je er juist af: ${xsplit}.` },
        { html: form(2 * a, 4 * a * a, 2 * b, 4 * b * b, '−'), why: `Neem de helft van het getal voor ${V('x')}, niet het hele getal: ${xsplit}.` },
        { html: form(-a, a * a, -b, b * b, '−'), why: `Let op het teken binnen de haakjes: ${xsplit}.` },
      ], { short: 'Kwadraat afsplitsen:', hint: `Gebruik ${xsplit}.`, uitleg: `${xsplit} en ${V('y')}<sup>2</sup>${vterm(qq, 'y')} = ${sq('y', b)} − ${b * b}.` }),
      inp(1, `${sq('x', a)} + ${sq('y', b)} = {0}`, [S(r2)], {
        hint: `Breng de losse getallen naar de andere kant: ${a * a} + ${b * b}${vterm(-s, '')}.`,
        uitleg: `${form(a, a * a, b, b * b, '−')}<br>${sq('x', a)} + ${sq('y', b)} = ${a * a} + ${b * b}${vterm(-s, '')} = ${r2}`,
      }),
      inp(0, `${V('M')}({0}, {1}) en ${V('r')} = {2}`, [S(a), S(b), S(Math.sqrt(r2), rt(r2))], {
        hint: `Schrijf de vergelijking als (${V('x')} − ${V('a')})<sup>2</sup> + (${V('y')} − ${V('b')})<sup>2</sup> = ${V('r')}<sup>2</sup> door kwadraten af te splitsen. Dan is het middelpunt (${V('a')}, ${V('b')}). Let op de tekens en vergeet de wortel niet bij ${V('r')}.`,
        uitleg: `${circEq(M, r2)}<br>Dus ${P('M', M)} en ${V('r')} = ${isSq(r2) ? `${root(r2)} = ` : ''}${rt(r2)}.`,
        after: () => { circ.hidden = false; pm.hidden = false; },
      }),
    ],
  };
}

/* ===================== M1: afstand punt tot cirkel ===================== */
function gM1(variant) {
  const sc = sceneBase(), dc = n => dd(V(n), V('c')), dM = n => dd(V(n), V('M'));
  if (variant === 'tapnear') {
    let dx, dy, t, M, A, T;
    do {
      const v = pick([[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [3, 4], [4, 3]]);
      dx = v[0] * sgn(); dy = v[1] * sgn(); t = v[0] + v[1] > 6 ? 2 : pick([2, 3]);
      M = [rnd(-3, 4), rnd(-3, 4)]; A = [M[0] + t * dx, M[1] + t * dy]; T = [M[0] + dx, M[1] + dy];
    } while (!inRange([A], 9));
    const r2 = dx * dx + dy * dy, seg = { p: A, q: M, hidden: true }, pT = { p: T, name: 'T', hidden: true };
    sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' }, { p: A, name: 'A' }, pT); sc.segs.push(seg);
    const dAM = t * t * r2;
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r2)} met middelpunt ${V('M')} en het punt ${P('A', A)} buiten ${V('c')}.`, scene: sc,
      steps: [
        tap(0, `Tik het roosterpunt op ${V('c')} aan dat het dichtst bij ${V('A')} ligt.`, pt => pt[0] === T[0] && pt[1] === T[1], T, {
          short: 'Dichtstbijzijnde punt op de cirkel:', hint: `De kortste weg van ${V('A')} naar de cirkel loopt recht op ${V('M')} af.`,
          uitleg: `Het dichtstbijzijnde punt ligt op het lijnstuk ${V('AM')}: dat is ${P('T', T)}.`, after: () => { seg.hidden = false; pT.hidden = false; },
        }),
        inp(1, `${dc('A')} = {0}`, [S(Math.sqrt(dAM) - Math.sqrt(r2), isSq(r2) ? String(Math.sqrt(dAM) - Math.sqrt(r2)) : `${rt(dAM)} − ${rt(r2)}`)], {
          hint: `${dc('A')} = ${dM('A')} − ${V('r')}. Bereken eerst ${dM('A')}.`,
          uitleg: `${dM('A')} = ${distWork(M, A)} = ${rt(dAM)} en ${V('r')} = ${rt(r2)}, dus ${dc('A')} = ${rt(dAM)} − ${rt(r2)}${isSq(r2) ? ` = ${Math.sqrt(dAM) - Math.sqrt(r2)}` : ` = ${t === 2 ? '' : t - 1}${rt(r2)}, want ${rt(dAM)} = ${t}${rt(r2)}`}.`,
        }),
      ],
    };
  }
  if (variant === 'tapdist') {
    const M = [rnd(-2, 3), rnd(-2, 3)], r = pick([2, 3]), k = 5 - r, ans = [M[0] + 3, M[1] + 4];
    sc.circles.push({ M, r, name: 'c' }); sc.points.push({ p: M, name: 'M' });
    sc.extent.push([M[0] - 5, M[1] - 5], [M[0] + 5, M[1] + 5]);
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r * r)} met middelpunt ${V('M')}.`, scene: sc,
      steps: [tap(0, `Zet ${V('A')} op een roosterpunt buiten ${V('c')} zodat ${dc('A')} = ${k}.`, pt => (pt[0] - M[0]) ** 2 + (pt[1] - M[1]) ** 2 === 25, ans, {
        short: `Een punt met ${dc('A')} = ${k}:`, hint: `Dan moet ${dM('A')} = ${V('r')} + ${k} = 5 zijn. Zoek een roosterpunt op afstand 5 van ${V('M')}. Denk aan 3-4-5.`,
        uitleg: `${dc('A')} = ${dM('A')} − ${V('r')}, dus ${dM('A')} = ${r} + ${k} = 5. Bijvoorbeeld 3 opzij en 4 omhoog vanaf ${V('M')}: ${root('3<sup>2</sup> + 4<sup>2</sup>')} = 5.`,
        after: s => { const m = s.marker || ans; s.points.push({ p: m, name: 'A' }); s.segs.push({ p: m, q: M }); s.marker = null; },
      })],
    };
  }
  if (variant === 'blind') {
    let M, r, A, d2, inside;
    do {
      M = [rnd(-4, 5), rnd(-4, 5)]; r = rnd(3, 5); inside = Math.random() < 0.5;
      const dx = rnd(-8, 8), dy = rnd(-8, 8); A = [M[0] + dx, M[1] + dy]; d2 = dx * dx + dy * dy;
    } while (M[0] === 0 || M[1] === 0 || M[0] * M[0] + M[1] * M[1] === r * r || isSq(d2) || !inRange([A], 9) || (inside ? !(d2 > 1 && d2 < (r - 0.7) ** 2) : !(d2 > (r + 1) ** 2 && d2 < (r + 5) ** 2)));
    const circ = { M, r, name: 'c', hidden: true }, pm = { p: M, name: 'M', hidden: true }, seg = { p: A, q: M, hidden: true };
    sc.circles.push(circ); sc.points.push(pm, { p: A, name: 'A' }); sc.segs.push(seg);
    const ans = inside ? r - Math.sqrt(d2) : Math.sqrt(d2) - r, ansH = inside ? `${r} − ${rt(d2)}` : `${rt(d2)} − ${r}`;
    return {
      given: `Cirkel ${V('c')}: ${circExp(-2 * M[0], -2 * M[1], M[0] * M[0] + M[1] * M[1] - r * r)} en het punt ${P('A', A)}. Bereken exact ${dc('A')}.`, scene: sc,
      steps: [
        inp(0, `${V('M')}({0}, {1}) en ${V('r')} = {2}`, [S(M[0]), S(M[1]), S(r)], {
          hint: 'Splits kwadraten af om het middelpunt en de straal te vinden.', uitleg: `Kwadraat afsplitsen geeft ${circEq(M, r * r)}, dus ${P('M', M)} en ${V('r')} = ${r}.`,
          after: () => { circ.hidden = false; pm.hidden = false; },
        }),
        inp(1, `${dM('A')} = {0}`, [S(Math.sqrt(d2), rt(d2))], { hint: `Afstand tussen twee punten: ${root(`(Δ${V('x')})<sup>2</sup> + (Δ${V('y')})<sup>2</sup>`)}.`, uitleg: `${dM('A')} = ${distWork(M, A)} = ${rt(d2)}`, after: () => { seg.hidden = false; } }),
        cho(1, `${dM('A')} = ${rt(d2)} ≈ ${fdec(Math.sqrt(d2), 2)} en ${V('r')} = ${r}. Waar ligt ${V('A')}?`, [
          { html: `binnen ${V('c')}`, ok: inside, why: inside ? '' : `${rt(d2)} is groter dan ${r}, dus ${V('A')} ligt verder van ${V('M')} dan de cirkelrand.` },
          { html: `buiten ${V('c')}`, ok: !inside, why: inside ? `${rt(d2)} is kleiner dan ${r}, dus ${V('A')} ligt dichter bij ${V('M')} dan de cirkelrand.` : '' },
        ], { short: `${V('A')} ligt`, hint: `Vergelijk ${dM('A')} met ${V('r')}.`, uitleg: `${dM('A')} ${inside ? '<' : '>'} ${V('r')}, dus ${V('A')} ligt ${inside ? 'binnen' : 'buiten'} ${V('c')}.` }),
        inp(0, `${dc('A')} = {0}`, [S(ans, ansH)], {
          hint: `Bereken ${dM('A')} en vergelijk met ${V('r')}. Buiten de cirkel: ${dM('A')} − ${V('r')}. Binnen de cirkel: ${V('r')} − ${dM('A')}.`,
          uitleg: `${dM('A')} = ${distWork(M, A)} = ${rt(d2)} ${inside ? '<' : '>'} ${r}, dus ${V('A')} ligt ${inside ? 'binnen' : 'buiten'} ${V('c')}.<br>${dc('A')} = ${inside ? `${V('r')} − ${dM('A')}` : `${dM('A')} − ${V('r')}`} = ${ansH}`,
          after: () => { seg.hidden = false; },
        }),
      ],
    };
  }
  const inside = variant === 'binnen', nm = inside ? 'B' : 'A';
  let M, r, A, d2;
  do {
    M = [rnd(-3, 5), rnd(-3, 5)]; r = inside ? rnd(3, 6) : rnd(2, 5);
    const dx = rnd(-9, 9), dy = rnd(-9, 9); A = [M[0] + dx, M[1] + dy]; d2 = dx * dx + dy * dy;
  } while (!inRange([A], 10) || (isSq(d2) && Math.random() < 0.8) || (inside ? !(d2 > 1 && d2 < (r - 0.6) ** 2) : !(d2 > (r + 1) ** 2 && d2 <= (r + 6) ** 2)));
  const seg = { p: A, q: M, hidden: true };
  sc.circles.push({ M, r, name: 'c' }); sc.points.push({ p: M, name: 'M' }, { p: A, name: nm }); sc.segs.push(seg);
  const sqd = Math.sqrt(d2), ans = inside ? r - sqd : sqd - r;
  const ansH = isSq(d2) ? String(ans) : inside ? `${r} − ${rt(d2)}` : `${rt(d2)} − ${r}`;
  return {
    given: `Cirkel ${V('c')}: ${circEq(M, r * r)} met middelpunt ${V('M')} en het punt ${P(nm, A)} ${inside ? 'binnen' : 'buiten'} ${V('c')}. Bereken exact ${dc(nm)}.`, scene: sc,
    steps: [
      inp(1, `${dM(nm)} = {0}`, [S(sqd, rt(d2))], { hint: `Afstand tussen twee punten: ${root(`(Δ${V('x')})<sup>2</sup> + (Δ${V('y')})<sup>2</sup>`)}.`, uitleg: `${dM(nm)} = ${distWork(M, A)} = ${isSq(d2) ? `${root(d2)} = ` : ''}${rt(d2)}`, after: () => { seg.hidden = false; } }),
      inp(0, `${dc(nm)} = {0}`, [S(ans, ansH)], {
        hint: inside ? `${V('B')} ligt binnen ${V('c')}: de afstand tot de rand is ${V('r')} − ${dM('B')}. Bereken eerst ${dM('B')}.` : `${V('A')} ligt buiten ${V('c')}: haal de straal van ${dM('A')} af. Bereken eerst ${dM('A')}.`,
        uitleg: `${dM(nm)} = ${distWork(M, A)} = ${rt(d2)} en ${V('r')} = ${r}.<br>${dc(nm)} = ${inside ? `${V('r')} − ${dM(nm)} = ${r} − ${rt(d2)}` : `${dM(nm)} − ${V('r')} = ${rt(d2)} − ${r}`}${isSq(d2) ? ` = ${ans}` : ''}`,
        after: () => { seg.hidden = false; },
      }),
    ],
  };
}

/* ===================== M2: twee cirkels, lijn en cirkel ===================== */
function gM2(variant) {
  const sc = sceneBase(), c1 = `${V('c')}<sub>1</sub>`, c2 = `${V('c')}<sub>2</sub>`, dMN = dd(V('M'), V('N'));
  if (variant === 'twee') {
    let M, N, r1, r2, d2;
    do { M = [rnd(-4, 2), rnd(-2, 5)]; N = [M[0] + rnd(3, 8), M[1] + rnd(-5, 5)]; r1 = pick([1, 1.5, 2, 2.5, 3]); r2 = pick([1, 1.5, 2, 2.5]); d2 = (N[0] - M[0]) ** 2 + (N[1] - M[1]) ** 2; }
    while (isSq(d2) || N[1] === M[1] || Math.sqrt(d2) < r1 + r2 + 0.4 || !inRange([N], 9));
    const seg = { p: M, q: N, hidden: true }, rs = Q.of(r1 + r2);
    sc.circles.push({ M, r: r1, name: 'c₁', lab: 130 }, { M: N, r: r2, name: 'c₂', lab: 50 }); sc.points.push({ p: M, name: 'M' }, { p: N, name: 'N' }); sc.segs.push(seg);
    return {
      given: `Cirkel ${c1} heeft middelpunt ${P('M', M)} en straal ${fq(r1)}. Cirkel ${c2} heeft middelpunt ${P('N', N)} en straal ${fq(r2)}. Bereken exact ${dd(c1, c2)}.`, scene: sc,
      steps: [
        inp(1, `${dMN} = {0}`, [S(Math.sqrt(d2), rt(d2))], { hint: 'Bereken de afstand tussen de twee middelpunten.', uitleg: `${dMN} = ${distWork(N, M)} = ${rt(d2)}`, after: () => { seg.hidden = false; } }),
        inp(0, `${dd(c1, c2)} = {0}`, [S(Math.sqrt(d2) - r1 - r2, `${rt(d2)} − ${fq(rs)}`)], {
          hint: `De kortste weg loopt over het lijnstuk ${V('MN')}. Haal van ${dMN} beide stralen af.`,
          uitleg: `${dMN} = ${distWork(N, M)} = ${rt(d2)}<br>${dd(c1, c2)} = ${dMN} − ${V('r')}<sub>1</sub> − ${V('r')}<sub>2</sub> = ${rt(d2)} − ${fq(r1)} − ${fq(r2)} = ${rt(d2)} − ${fq(rs)}`,
          after: () => { seg.hidden = false; },
        }),
      ],
    };
  }
  if (variant === 'in') {
    let M, R, N, r, d2;
    do { M = [rnd(-2, 4), rnd(-2, 4)]; R = rnd(5, 7); r = pick([1, 2]); N = [M[0] + rnd(-3, 3), M[1] + rnd(-3, 3)]; d2 = (N[0] - M[0]) ** 2 + (N[1] - M[1]) ** 2; }
    while (isSq(d2) || Math.sqrt(d2) + r > R - 0.6);
    const seg = { p: M, q: N, hidden: true }, dcd = dd(V('c'), V('d'));
    sc.circles.push({ M, r: R, name: 'c' }, { M: N, r, name: 'd', lab: 200 }); sc.points.push({ p: M, name: 'M' }, { p: N, name: 'N' }); sc.segs.push(seg);
    const rc_ = `${V('r')}<sub>${V('c')}</sub>`, rd_ = `${V('r')}<sub>${V('d')}</sub>`;
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, R * R)} met middelpunt ${V('M')} en cirkel ${V('d')}: ${circEq(N, r * r)} met middelpunt ${V('N')}. Cirkel ${V('d')} ligt binnen ${V('c')}. Bereken exact ${dcd}.`, scene: sc,
      steps: [
        cho(2, `${V('d')} ligt binnen ${V('c')}. Welke formule geeft ${dcd}?`, [
          { html: `${rc_} − ${dMN} − ${rd_}`, ok: true },
          { html: `${dMN} − ${rc_} − ${rd_}`, why: `Dat is de formule voor twee cirkels die naast elkaar liggen. Hier zou het antwoord negatief worden.` },
          { html: `${rc_} − ${rd_}`, why: `Dat klopt alleen als de middelpunten samenvallen. Hier ligt ${V('N')} niet op ${V('M')}.` },
          { html: `${dMN} + ${rd_} − ${rc_}`, why: `Dit is precies het omgekeerde van de afstand en dus een negatief getal. Van ${V('M')} naar de rand van ${V('c')} is ${rc_}. Haal daar ${dMN} en ${rd_} van af.` },
        ], { short: 'Formule:', hint: `Loop van ${V('M')} via ${V('N')} naar de rand van ${V('c')}. Die weg is ${rc_} lang.`, uitleg: `Van ${V('M')} naar de rand van ${V('c')} is ${rc_}. Daarvan gaat ${dMN} op aan de weg naar ${V('N')} en ${rd_} aan de straal van ${V('d')}.`, after: () => { seg.hidden = false; } }),
        inp(1, `${dMN} = {0}`, [S(Math.sqrt(d2), rt(d2))], { hint: 'Afstand tussen de middelpunten.', uitleg: `${dMN} = ${distWork(N, M)} = ${rt(d2)}`, after: () => { seg.hidden = false; } }),
        inp(0, `${dcd} = {0}`, [S(R - r - Math.sqrt(d2), `${R - r} − ${rt(d2)}`)], {
          hint: `Binnen elkaar: ${dcd} = ${rc_} − ${dMN} − ${rd_}.`,
          uitleg: `${dMN} = ${distWork(N, M)} = ${rt(d2)}<br>${dcd} = ${rc_} − ${dMN} − ${rd_} = ${R} − ${rt(d2)} − ${r} = ${R - r} − ${rt(d2)}`,
          after: () => { seg.hidden = false; },
        }),
      ],
    };
  }
  if (variant === 'lijnpos' || variant === 'lijndist') {
    let a, b, M, r, dist, c, kind;
    do {
      [a, b] = pick([[3, 4], [4, 3], [3, -4], [4, -3]]); M = [rnd(-2, 4), rnd(-2, 4)]; r = rnd(2, 4);
      kind = variant === 'lijndist' ? 'mist' : pick(['snijdt', 'raakt', 'mist']);
      dist = kind === 'snijdt' ? rnd(1, r - 1) : kind === 'raakt' ? r : r + rnd(1, 3);
      c = a * M[0] + b * M[1] + sgn() * 5 * dist;
    } while (c === 0);
    const val = a * M[0] + b * M[1] - c, f = val / 25, F = [M[0] - f * a, M[1] - f * b];
    const ln = { a: -a / b, b: c / b, name: 'k', hidden: variant === 'lijnpos' }, seg = { p: M, q: F, hidden: true };
    sc.circles.push({ M, r, name: 'c' }); sc.points.push({ p: M, name: 'M' }); sc.lines.push(ln); sc.segs.push(seg); sc.extent.push(F);
    const dMk = dd(V('M'), V('k')), dkc = dd(V('k'), V('c'));
    const formula = `${dMk} = ${frac(`|${V('a')}${V('x')}<sub>${V('M')}</sub> + ${V('b')}${V('y')}<sub>${V('M')}</sub> − ${V('c')}|`, root(`${V('a')}<sup>2</sup> + ${V('b')}<sup>2</sup>`))}`;
    const work = `${dMk} = ${frac(`|${a} · ${pn(M[0])} ${b < 0 ? '−' : '+'} ${Math.abs(b)} · ${pn(M[1])} − ${pn(c)}|`, root(`${a}<sup>2</sup> + ${pn(b)}<sup>2</sup>`))} = ${frac(`|${fq(val)}|`, 5)} = ${dist}`;
    const first = inp(variant === 'lijnpos' ? 0 : 1, `${dMk} = {0}`, [S(dist)], { hint: `Voor ${V('k')}: ${V('ax')} + ${V('by')} = ${V('c')} geldt ${formula}.`, uitleg: work, after: () => { ln.hidden = false; seg.hidden = false; } });
    if (variant === 'lijnpos') {
      return {
        given: `Cirkel ${V('c')}: ${circEq(M, r * r)} met middelpunt ${V('M')} en de lijn ${V('k')}: ${lineStd(a, b, c)}. Onderzoek of ${V('k')} de cirkel snijdt, raakt of mist.`, scene: sc,
        steps: [first, cho(0, `${dMk} = ${dist} en ${V('r')} = ${r}. Dus lijn ${V('k')} …`, [
          { html: `snijdt ${V('c')} in twee punten`, ok: kind === 'snijdt', why: `Snijden kan alleen als de lijn dichter bij ${V('M')} komt dan de straal: ${dMk} < ${V('r')}.` },
          { html: `raakt ${V('c')}`, ok: kind === 'raakt', why: `Raken betekent precies ${dMk} = ${V('r')}.` },
          { html: `heeft geen punt gemeen met ${V('c')}`, ok: kind === 'mist', why: `Dat is zo als ${dMk} > ${V('r')}.` },
        ], { short: `Lijn ${V('k')}`, hint: `Vergelijk ${dMk} met ${V('r')}.`, uitleg: `${dist} ${kind === 'snijdt' ? '<' : kind === 'raakt' ? '=' : '>'} ${r}, dus ${dMk} ${kind === 'snijdt' ? '<' : kind === 'raakt' ? '=' : '>'} ${V('r')} en ${V('k')} ${kind === 'snijdt' ? `snijdt ${V('c')} in twee punten` : kind === 'raakt' ? `raakt ${V('c')}` : `heeft geen punt gemeen met ${V('c')}`}.` })],
      };
    }
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r * r)} met middelpunt ${V('M')} en de lijn ${V('k')}: ${lineStd(a, b, c)}. Bereken ${dkc}.`, scene: sc,
      steps: [first, inp(0, `${dkc} = {0}`, [S(dist - r)], {
        hint: `De afstand van een lijn tot een cirkel is ${dMk} − ${V('r')}. ${formula}`, uitleg: `${work}<br>${dkc} = ${dMk} − ${V('r')} = ${dist} − ${r} = ${dist - r}`, after: () => { seg.hidden = false; },
      })],
    };
  }
  // 'xas': toetsstijl, twee cirkels die de x-as raken met middelpunten op een lijn
  let p, yM, yN, xM, xN, q0, d2;
  do {
    p = pick([2, 3, 4]); const ys = p % 2 ? [1, 2, 3, 4] : [1, 1.5, 2, 2.5, 3, 3.5, 4];
    yM = pick(ys); yN = pick(ys); xM = rnd(0, 3); q0 = xM + p * yM; xN = q0 - p * yN; d2 = (xN - xM) ** 2 + (yN - yM) ** 2;
  } while (yM === yN || xN <= xM || xN > 12 || Math.sqrt(d2) < yM + yN + 0.25);
  const M = [xM, yM], N = [xN, yN];
  const cM = { M, r: yM, name: 'c', hidden: true, lab: 120 }, cN = { M: N, r: yN, name: 'd', hidden: true, lab: 60 }, pM = { p: M, name: 'M', hidden: true }, pN = { p: N, name: 'N', hidden: true }, seg = { p: M, q: N, hidden: true };
  sc.circles.push(cM, cN); sc.points.push(pM, pN); sc.segs.push(seg); sc.lines.push({ a: -1 / p, b: q0 / p, name: 'k' });
  const dcd = dd(V('c'), V('d')), val = Math.sqrt(d2) - yM - yN, xs = (n, v) => `${V('x')}<sub>${V(n)}</sub> = ${v}`;
  const wM = `${V('M')} op ${V('k')}: ${xM} + ${p}${V('y')} = ${q0} geeft ${V('y')} = ${fq(yM)}. De cirkel raakt de ${V('x')}-as, dus de straal is de hoogte van ${V('M')}: ${V('r')}<sub>${V('c')}</sub> = ${fq(yM)}.`;
  const wN = `${V('N')} op ${V('k')}: ${xN} + ${p}${V('y')} = ${q0} geeft ${V('y')} = ${fq(yN)}, dus ${P('N', N)} en ${V('r')}<sub>${V('d')}</sub> = ${fq(yN)}.`;
  const wD = `${dMN} = ${distWork(N, M)} = ${rt(Q.of(d2))}`;
  return {
    given: `Op de lijn ${V('k')}: ${lineStd(1, p, q0)} ligt het punt ${V('M')} met ${xs('M', xM)} en het punt ${V('N')} met ${xs('N', xN)}. De cirkels ${V('c')} met middelpunt ${V('M')} en ${V('d')} met middelpunt ${V('N')} raken de ${V('x')}-as. Bereken ${dcd}. Rond af op twee decimalen.`, scene: sc,
    steps: [
      inp(1, `${V('M')}(${xM}, {0}) en ${V('r')}<sub>${V('c')}</sub> = {1}`, [S(Q.of(yM)), S(Q.of(yM))], { hint: `Vul ${xs('M', xM)} in de vergelijking van ${V('k')} in. Raakt een cirkel de ${V('x')}-as, dan is de straal gelijk aan de ${V('y')}-coördinaat van het middelpunt.`, uitleg: wM, after: () => { cM.hidden = false; pM.hidden = false; } }),
      inp(1, `${V('N')}(${xN}, {0}) en ${V('r')}<sub>${V('d')}</sub> = {1}`, [S(Q.of(yN)), S(Q.of(yN))], { hint: `Dezelfde aanpak met ${xs('N', xN)}.`, uitleg: wN, after: () => { cN.hidden = false; pN.hidden = false; } }),
      inp(1, `${dMN} = {0}`, [S(Math.sqrt(d2), rt(Q.of(d2)))], { hint: 'Afstand tussen de middelpunten. Laat de wortel staan.', uitleg: wD, after: () => { seg.hidden = false; } }),
      inp(0, `${dcd} ≈ {0}`, [{ v: val, show: fdec(val, 2), tol: 0.0051 }], {
        hint: `Zoek eerst ${V('M')} en ${V('N')} op de lijn. De stralen zijn de hoogtes van de middelpunten. Daarna ${dcd} = ${dMN} − ${V('r')}<sub>${V('c')}</sub> − ${V('r')}<sub>${V('d')}</sub>.`,
        uitleg: `${wM}<br>${wN}<br>${wD}<br>${dcd} = ${rt(Q.of(d2))} − ${fq(yM)} − ${fq(yN)} ≈ ${fdec(val, 2)}`,
        after: () => { [cM, cN, pM, pN, seg].forEach(o => { o.hidden = false; }); },
      }),
    ],
  };
}

/* ===================== M3: raaklijn in een gegeven raakpunt ===================== */
function gM3(variant) {
  const sc = sceneBase();
  if (variant === 'recht') {
    const M = [rnd(-3, 4), rnd(-3, 4)], r = rnd(2, 4), dir = pick(['boven', 'onder', 'links van', 'rechts van']);
    const A = dir === 'boven' ? [M[0], M[1] + r] : dir === 'onder' ? [M[0], M[1] - r] : dir === 'links van' ? [M[0] - r, M[1]] : [M[0] + r, M[1]];
    const hor = dir === 'boven' || dir === 'onder', ln = hor ? { a: 0, b: A[1], name: 'k', hidden: true } : { x: A[0], name: 'k', hidden: true };
    sc.circles.push({ M, r, name: 'c' }); sc.points.push({ p: M, name: 'M' }, { p: A, name: 'A' }); sc.lines.push(ln);
    const eq = (v, n) => `${V(v)} = ${fq(n)}`;
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r * r)} met middelpunt ${V('M')}. Het punt ${P('A', A)} ligt recht ${dir} ${V('M')} op de cirkel.`, scene: sc,
      steps: [cho(0, `Welke lijn raakt ${V('c')} in ${V('A')}?`, [
        { html: hor ? eq('y', A[1]) : eq('x', A[0]), ok: true },
        { html: hor ? eq('x', A[0]) : eq('y', A[1]), why: `Die lijn gaat door ${V('M')} en ${V('A')}. De raaklijn staat daar loodrecht op.` },
        { html: hor ? eq('y', M[1]) : eq('x', M[0]), why: `Die lijn gaat door het middelpunt en snijdt de cirkel dus in twee punten.` },
        { html: lineEq(1, A[1] - A[0]), why: `Een schuine lijn door ${V('A')} snijdt de cirkel nog een keer.` },
      ], {
        short: `Raaklijn in ${V('A')}:`, hint: `De raaklijn staat loodrecht op de straal ${V('MA')}. Die straal loopt hier ${hor ? 'verticaal' : 'horizontaal'}.`,
        uitleg: `${V('MA')} is ${hor ? 'verticaal' : 'horizontaal'}, dus de raaklijn is ${hor ? 'horizontaal' : 'verticaal'}: ${hor ? eq('y', A[1]) : eq('x', A[0])}. Het werkschema met richtingscoëfficiënten werkt hier niet, want een verticale lijn heeft geen rc.`,
        after: () => { ln.hidden = false; },
      })],
    };
  }
  if (variant === 'xas') {
    let a, b, m, which;
    do { a = rnd(-3, 4); b = pick([1, 2, 3]) * sgn(); m = rnd(1, 4); which = pick(['C', 'D']); } while (m === Math.abs(b) && Math.random() < 0.7);
    const M = [a, b], r2 = b * b + m * m, C = [a - m, 0], D = [a + m, 0], T = which === 'C' ? C : D;
    const dx = T[0] - a, dy = -b, rl = q(dy, dx), rk = q(-dx, dy), bq = rk.mul(T[0]).neg();
    const pC = { p: C, name: 'C', hidden: true, o: [-10, 14] }, pD = { p: D, name: 'D', hidden: true, o: [10, 14] };
    sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' }, pC, pD);
    const xC = `${V('x')}<sub>${V('C')}</sub>`, xD = `${V('x')}<sub>${V('D')}</sub>`;
    const w1 = `${V('y')} = 0 geeft ${sq('x', a)} + ${b * b} = ${r2}, dus ${sq('x', a)} = ${m * m}. Dat geeft ${V('x')} = ${fq(a - m)} ∨ ${V('x')} = ${fq(a + m)}.`;
    const w2 = `${rc('l')} van de lijn door ${V('M')} en ${V(which)}: ${frac(`0 − ${pn(b)}`, `${fq(T[0])} − ${pn(a)}`)} = ${fq(rl)}. ${V('q')} ⊥ ${V('l')}, dus ${rc('q')} = ${fq(rk)}.<br>${P(which, T)} invullen: 0 = ${fq(rk)} · ${pn(T[0])} + ${V('b')} geeft ${V('b')} = ${fq(bq)}. Dus ${V('q')}: ${lineEq(rk, bq)}.`;
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r2)} met middelpunt ${V('M')} snijdt de ${V('x')}-as in de punten ${V('C')} en ${V('D')} met ${xC} < ${xD}. Stel een vergelijking op van de lijn ${V('q')} die ${V('c')} raakt in ${V(which)}.`, scene: sc,
      steps: [
        inp(1, `${xC} = {0} en ${xD} = {1}`, [S(C[0]), S(D[0])], { hint: `Op de ${V('x')}-as geldt ${V('y')} = 0. Vul dat in de cirkelvergelijking in. Let op: ${xC} is de kleinste.`, uitleg: w1, after: () => { pC.hidden = false; pD.hidden = false; } }),
        inp(0, `${V('q')}: ${V('y')} = {0}${V('x')} + {1}`, [S(rk), S(bq)], {
          fire: v => [{ a: v[0], b: v[1] }], target: { M, r: Math.sqrt(r2), through: T, name: 'q', pt: which }, log: `${V('q')}: ${lineEq(rk, bq)}`,
          hint: `Zoek eerst ${V(which)} met ${V('y')} = 0. Daarna het werkschema: ${rc('l')} van ${V('M')} naar ${V(which)}, dan ${rc('q')} · ${rc('l')} = −1, dan ${V(which)} invullen.`,
          uitleg: `${w1}<br>${w2}`, after: () => { pC.hidden = false; pD.hidden = false; },
        }),
      ],
    };
  }
  let dx, dy, M, A;
  do { const v = pick([[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [1, 1], [2, 4], [4, 2], [1, 4], [4, 1], [3, 4], [4, 3]]); dx = v[0] * sgn(); dy = v[1] * sgn(); M = [rnd(-3, 4), rnd(-3, 4)]; A = [M[0] + dx, M[1] + dy]; } while (false);
  const r2 = dx * dx + dy * dy, rl = q(dy, dx), rk = q(-dx, dy), bq = q(A[1]).sub(rk.mul(A[0]));
  const seg = { p: M, q: A, hidden: true, name: 'l' };
  sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' }, { p: A, name: 'A' }); sc.segs.push(seg);
  const w1 = `${rc('l')} = ${frac(`${fq(A[1])} − ${pn(M[1])}`, `${fq(A[0])} − ${pn(M[0])}`)} = ${fq(rl)}`;
  const w2 = `${V('k')} ⊥ ${V('l')}, dus ${rc('k')} · ${pn(rl)} = −1 en dat geeft ${rc('k')} = ${fq(rk)}.`;
  const w3 = `${P('A', A)} invullen in ${V('y')} = ${vterm(rk, 'x', true)} + ${V('b')}: ${fq(A[1])} = ${fq(rk)} · ${pn(A[0])} + ${V('b')} geeft ${V('b')} = ${fq(bq)}.<br>Dus ${V('k')}: ${lineEq(rk, bq)}.`;
  return {
    given: `Op de cirkel ${V('c')}: ${circEq(M, r2)} met middelpunt ${V('M')} ligt het punt ${P('A', A)}. Stel een vergelijking op van de lijn ${V('k')} die ${V('c')} raakt in ${V('A')}.`, scene: sc,
    steps: [
      inp(2, `${rc('l')} = {0}`, [S(rl)], { hint: `${V('l')} is de lijn door ${P('M', M)} en ${V('A')}. Richtingscoëfficiënt = Δ${V('y')} gedeeld door Δ${V('x')}.`, uitleg: w1, after: () => { seg.hidden = false; } }),
      inp(1, `${rc('k')} = {0}`, [S(rk)], { hint: `Bereken eerst ${rc('l')} van de lijn door ${V('M')} en ${V('A')}. De raaklijn staat daar loodrecht op: ${rc('k')} · ${rc('l')} = −1.`, uitleg: `${w1}<br>${w2}`, after: () => { seg.hidden = false; } }),
      inp(0, `${V('k')}: ${V('y')} = {0}${V('x')} + {1}`, [S(rk), S(bq)], {
        fire: v => [{ a: v[0], b: v[1] }], target: { M, r: Math.sqrt(r2), through: A, name: 'k', pt: 'A' }, log: `${V('k')}: ${lineEq(rk, bq)}`,
        hint: `Werkschema: 1. ${rc('l')} van de lijn door ${V('M')} en ${V('A')}. 2. ${rc('k')} · ${rc('l')} = −1. 3. Vul ${V('A')} in om ${V('b')} te vinden.`,
        uitleg: `${w1}<br>${w2}<br>${w3}`, after: () => { seg.hidden = false; },
      }),
    ],
  };
}

/* ===================== M4: raaklijnen met gegeven rc ===================== */
function gM4(variant) {
  const sc = sceneBase(), dMk = n => dd(V('M'), V(n));
  if (variant === 'toon') {
    let a, t, M, b0;
    do { a = pick([1, 2, 3]) * sgn(); t = Math.abs(a) === 1 ? pick([1, 2, 3]) : Math.abs(a) === 2 ? pick([1, 2]) : 1; M = [rnd(-3, 4), rnd(-3, 4)]; b0 = M[1] - a * M[0] + sgn() * t * (a * a + 1); } while (b0 === 0 || Math.abs(b0) > 14);
    const k2 = a * a + 1, r2 = t * t * k2, N = Math.abs(a * M[0] - M[1] + b0), ln = { a, b: b0, name: 'p', hidden: true };
    sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' }); sc.lines.push(ln);
    const zero = (A, B, C, rhs) => `${vterm(A, 'x', true)}${vterm(B, 'y')}${rhs == null ? vterm(C, '') + ' = 0' : ' = ' + fq(rhs)}`;
    const work = `${dMk('p')} = ${frac(`|${fq(a)} · ${pn(M[0])} − ${pn(M[1])}${vterm(b0, '')}|`, root(`${pn(a)}<sup>2</sup> + (−1)<sup>2</sup>`))} = ${frac(N, rt(k2))} = ${rt(r2)}`;
    return {
      given: `Cirkel ${V('c')}: ${circEq(M, r2)} met middelpunt ${V('M')} en de lijn ${V('p')}: ${lineEq(a, b0)}. Toon aan dat ${V('p')} de cirkel raakt.`, scene: sc,
      steps: [
        cho(1, `Schrijf ${V('p')} in de vorm … = 0, zodat je de afstandsformule kunt gebruiken. Welke klopt?`, [
          { html: zero(a, -1, b0), ok: true },
          { html: zero(a, 1, b0), why: `Haal ${V('y')} naar de andere kant: dan krijg je −${V('y')}, niet +${V('y')}.` },
          { html: zero(a, -1, -b0), why: `Het losse getal blijft aan dezelfde kant staan als ${vterm(a, 'x', true)}, dus het teken verandert niet.` },
          { html: zero(a, -1, 0, b0), why: `Controleer met ${V('x')} = 0: dan moet ${V('y')} = ${fq(b0)} zijn, hier krijg je ${V('y')} = ${fq(-b0)}.` },
        ], { short: `${V('p')}:`, hint: `Trek aan beide kanten ${V('y')} af.`, uitleg: `${lineEq(a, b0)} wordt ${zero(a, -1, b0)}.` }),
        inp(0, `${dMk('p')} = {0} en ${V('r')} = {1}`, [S(Math.sqrt(r2), rt(r2)), S(Math.sqrt(r2), rt(r2))], {
          hint: `Schrijf ${V('p')} als ${zero(a, -1, b0)} en gebruik: voor een lijn ${V('ax')} − ${V('y')} + ${V('b')} = 0 is de afstand tot ${V('M')} gelijk aan ${frac(`|${V('a')}${V('x')}<sub>${V('M')}</sub> − ${V('y')}<sub>${V('M')}</sub> + ${V('b')}|`, root(`${V('a')}<sup>2</sup> + 1`))}. De straal lees je af uit de cirkelvergelijking.`,
          uitleg: `${work}<br>${V('r')} = ${rt(r2)}, dus ${dMk('p')} = ${V('r')} en ${V('p')} raakt ${V('c')}.`,
          after: () => { ln.hidden = false; }, showLines: [{ a, b: b0 }], target: { M, r: Math.sqrt(r2), name: 'p' },
        }),
      ],
    };
  }
  let a, M, r2, rH, R, k2H, pre = null, givenTail;
  if (variant === 'frac') {
    a = pick([q(3, 4), q(-3, 4), q(4, 3), q(-4, 3)]); const den = a.d;
    do { M = [den * pick([-1, 0, 1]), rnd(-3, 4)]; } while (a.mul(M[0]).sub(M[1]).n === 0);
    r2 = den * den; R = 5; rH = String(den); k2H = `${fq(q(5, den))}`;
  } else {
    let ai, t;
    do { ai = pick([1, 2, 3]) * sgn(); t = Math.abs(ai) === 1 ? pick([1, 2, 3]) : Math.abs(ai) === 2 ? pick([1, 2]) : 1; M = [rnd(-3, 4), rnd(-3, 4)]; } while (ai * M[0] - M[1] === 0);
    a = q(ai); r2 = t * t * (ai * ai + 1); R = t * (ai * ai + 1); rH = rt(r2); k2H = rt(ai * ai + 1);
  }
  const c0 = a.mul(M[0]).sub(M[1]), b1 = c0.neg().sub(R), b2 = c0.neg().add(R);
  sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' });
  const kform = sg => `${vterm(a, 'x', true)} ${sg[0]} ${V('y')} ${sg[1]} ${V('b')} = 0`;
  if (variant === 'lood' || variant === 'even') {
    const lood = variant === 'lood', am = lood ? q(-1).div(a) : a, bm = rnd(-4, 5);
    givenTail = `De lijnen ${V('k')} ${lood ? 'staan loodrecht op' : 'zijn evenwijdig aan'} de lijn ${V('m')}: ${lineEq(am, bm)} en raken ${V('c')}.`;
    pre = inp(1, `${rc('k')} = {0}`, [S(a)], { hint: lood ? `Loodrecht: ${rc('k')} · ${rc('m')} = −1.` : `Evenwijdige lijnen hebben dezelfde richtingscoëfficiënt.`, uitleg: lood ? `${rc('m')} = ${fq(am)} en ${rc('k')} · ${rc('m')} = −1, dus ${rc('k')} = ${fq(a)}.` : `${V('k')} ∥ ${V('m')}, dus ${rc('k')} = ${rc('m')} = ${fq(a)}.` });
  } else givenTail = `De lijnen ${V('k')} hebben richtingscoëfficiënt ${fq(a)} en raken ${V('c')}.`;
  const wA = `${V('k')}: ${V('y')} = ${vterm(a, 'x', true)} + ${V('b')}, oftewel ${kform('−+')}.`;
  const wB = `${dMk('k')} = ${V('r')} geeft ${frac(`|${fq(a)} · ${pn(M[0])} − ${pn(M[1])} + ${V('b')}|`, root(`${pp(a)}<sup>2</sup> + (−1)<sup>2</sup>`))} = ${rH}<br>|${fq(c0)} + ${V('b')}| = ${rH} · ${k2H} = ${R}`;
  const wC = `${fq(c0)} + ${V('b')} = ${R} ∨ ${fq(c0)} + ${V('b')} = −${R}<br>${V('b')} = ${fq(b2)} ∨ ${V('b')} = ${fq(b1)}<br>Dus ${V('k')}<sub>1</sub>: ${lineEq(a, b2)} en ${V('k')}<sub>2</sub>: ${lineEq(a, b1)}.`;
  const steps = [
    cho(2, `Stel ${V('k')}: ${V('y')} = ${vterm(a, 'x', true)} + ${V('b')}. Welke vorm gebruik je in de afstandsformule?`, [
      { html: kform('−+'), ok: true },
      { html: kform('++'), why: `Trek aan beide kanten ${V('y')} af: je krijgt −${V('y')}.` },
      { html: kform('−−'), why: `${V('b')} staat al aan de goede kant, het teken blijft +.` },
      { html: `${vterm(a, 'x', true)} − ${V('y')} = ${V('b')}`, why: `Uit deze regel volgt ${V('y')} = ${vterm(a, 'x', true)} − ${V('b')}, en dat is een andere lijn. Trek in ${V('y')} = ${vterm(a, 'x', true)} + ${V('b')} aan beide kanten ${V('y')} af.` },
    ], { short: `${V('k')}:`, hint: `Trek aan beide kanten ${V('y')} af.`, uitleg: wA }),
    inp(1, `|{0} + ${V('b')}| = {1}`, [S(c0), S(R)], {
      hint: `${dMk('k')} = ${V('r')}: ${frac(`|${V('a')} · ${V('x')}<sub>${V('M')}</sub> − ${V('y')}<sub>${V('M')}</sub> + ${V('b')}|`, root(`${V('a')}<sup>2</sup> + 1`))} = ${V('r')}. Vul ${V('M')} in en vermenigvuldig beide kanten met de wortel.`,
      uitleg: `${wA}<br>${wB}`,
    }),
    inp(0, `${V('k')}: ${V('y')} = ${vterm(a, 'x', true)} + ${V('b')} met ${V('b')} = {0} ∨ ${V('b')} = {1}`, [S(b1), S(b2)], {
      unordered: true, fire: v => v.map(b => ({ a: a.v, b })), target: { M, r: Math.sqrt(r2), name: 'k' }, log: `${V('k')}<sub>1</sub>: ${lineEq(a, b2)} en ${V('k')}<sub>2</sub>: ${lineEq(a, b1)}`,
      hint: `Stel ${V('k')}: ${kform('−+')} en gebruik ${dMk('k')} = ${V('r')}. Een absolute waarde geeft twee oplossingen: … = ${R} of … = −${R}.`,
      uitleg: `${wA}<br>${wB}<br>${wC}`,
    }),
  ];
  if (pre) steps.unshift(pre);
  return { given: `Cirkel ${V('c')}: ${circEq(M, r2)} met middelpunt ${V('M')}. ${givenTail} Stel vergelijkingen op van de lijnen ${V('k')}.`, scene: sc, steps };
}

/* ===================== M5: raaklijnen door een punt buiten de cirkel ===================== */
const M5C = (() => {
  const out = [];
  for (const r2 of [4, 9, 16, 25, 2, 5, 8, 10, 13, 20]) for (let Pv = -8; Pv <= 8; Pv++) for (let Qv = -8; Qv <= 8; Qv++) {
    if (Pv === 0 || Qv === 0 || Pv * Pv === r2 || Qv * Qv === r2) continue;
    const k = Pv * Pv + Qv * Qv - r2; if (k <= 0 || Pv * Pv + Qv * Qv > 100) continue;
    const D4 = r2 * k; if (!isSq(D4)) continue;
    const s = Math.sqrt(D4), den = Pv * Pv - r2, a1 = q(-Pv * Qv - s, den), a2 = q(-Pv * Qv + s, den);
    if (a1.d > 4 || a2.d > 4 || Math.abs(a1.v) > 4 || Math.abs(a2.v) > 4) continue;
    out.push({ r2, P: Pv, Q: Qv });
  }
  return out;
})();
function gM5(variant, fixed) {
  const sc = sceneBase();
  let c, M, A, as, bs;
  for (;;) {
    c = fixed || pick(M5C);
    M = fixed ? fixed.M : [rnd(-4, 5), rnd(-4, 5)]; A = [M[0] - c.P, M[1] + c.Q];
    const s = Math.sqrt(c.r2 * (c.P * c.P + c.Q * c.Q - c.r2)), den = c.P * c.P - c.r2;
    as = [q(-c.P * c.Q - s, den), q(-c.P * c.Q + s, den)].sort((x, y) => x.v - y.v);
    bs = as.map(a => q(A[1]).sub(a.mul(A[0])));
    if (fixed || (A[0] !== 0 && inRange([A], 9) && bs.every(b => Math.abs(b.v) <= 20))) break;
  }
  const { r2, P: Pv, Q: Qv } = c, A0 = Pv * Pv - r2, B0 = 2 * Pv * Qv, C0 = Qv * Qv - r2;
  let g = gcd(gcd(A0, B0), C0); if (A0 < 0) g = -g;
  const Ap = A0 / g, Bp = B0 / g, Cp = C0 / g, D = Bp * Bp - 4 * Ap * Cp, sD = Math.sqrt(D);
  sc.circles.push({ M, r: Math.sqrt(r2), name: 'c' }); sc.points.push({ p: M, name: 'M' }, { p: A, name: 'A' });
  const dMl = dd(V('M'), V('l')), wortel = root(`${V('a')}<sup>2</sup> + 1`), rH = rt(r2), va = V('a'), vb = V('b');
  const num = `${vterm(Pv, 'a', true)}${vterm(Qv, '')}`;
  const bIn = A[1] === 0 ? vterm(-A[0], 'a', true) : `${fq(A[1])}${vterm(-A[0], 'a')}`, lTail = `${vterm(A[1], '')}${vterm(-A[0], 'a')}`;
  const w1 = `${V('l')}: ${V('y')} = ${V('ax')} + ${vb}. ${P('A', A)} op ${V('l')} geeft ${A[0] === 0 ? vb : `${vterm(A[0], 'a', true)} + ${vb}`} = ${fq(A[1])}, dus ${vb} = ${bIn}.<br>${V('l')}: ${V('ax')} − ${V('y')}${lTail} = 0`;
  const w2 = `${dMl} = ${V('r')} geeft ${frac(`|${vterm(M[0], 'a', true) || '0'} − ${pn(M[1])}${vterm(A[1], '')}${vterm(-A[0], 'a')}|`, root(`${va}<sup>2</sup> + (−1)<sup>2</sup>`))} = ${rH}<br>|${num}| = ${rH}${wortel}`;
  const w3 = `Kwadrateren geeft ${vterm(Pv * Pv, 'a', true)}<sup>2</sup>${vterm(B0, 'a')}${vterm(Qv * Qv, '')} = ${r2}${va}<sup>2</sup> + ${r2}<br>${poly(A0, B0, C0)}${Math.abs(g) !== 1 ? `<br>Delen door ${fq(g)} geeft ${poly(Ap, Bp, Cp)}` : ''}`;
  const w4 = `${V('D')} = ${pn(Bp)}<sup>2</sup> − 4 · ${Ap} · ${pn(Cp)} = ${D}, dus ${root(V('D'))} = ${sD}<br>${va} = ${frac(`${fq(-Bp)} + ${sD}`, 2 * Ap)} = ${fq(as[1])} ∨ ${va} = ${frac(`${fq(-Bp)} − ${sD}`, 2 * Ap)} = ${fq(as[0])}`;
  const bw = i => `${va} = ${fq(as[i])} geeft ${vb} = ${A[1] === 0 ? `${fq(-A[0])} · ${pp(as[i])}` : `${fq(A[1])} ${A[0] > 0 ? '−' : '+'} ${Math.abs(A[0])} · ${pp(as[i])}`} = ${fq(bs[i])}, dus ${V('l')}<sub>${i + 1}</sub>: ${lineEq(as[i], bs[i])}.`;
  const w5 = `${bw(0)}<br>${bw(1)}`;
  return {
    given: `Cirkel ${V('c')}: ${circEq(M, r2)} en het punt ${P('A', A)} buiten ${V('c')}. Stel langs algebraïsche weg vergelijkingen op van de lijnen ${V('l')} die door ${V('A')} gaan en ${V('c')} raken.`, scene: sc,
    meta: { M, A, r2, as, bs, coef: [Ap, Bp, Cp] },
    steps: [
      inp(2, `${V('l')}: ${V('y')} = ${V('ax')} + ${vb}. ${V('A')} op ${V('l')} geeft ${vb} = {0} − {1} · ${va}`, [S(A[1]), S(A[0])], {
        log: `${V('l')}: ${V('y')} = ${V('ax')} + ${vb} met ${vb} = ${bIn}`,
        hint: `Vul ${P('A', A)} in: ${A[0] === 0 ? vb : `${vterm(A[0], 'a', true)} + ${vb}`} = ${fq(A[1])}. Haal de term met ${va} naar de andere kant.`, uitleg: w1,
      }),
      inp(1, `${dMl} = ${V('r')} geeft |{0}${va} + {1}| = ${rH}${wortel}`, [S(Pv), S(Qv)], {
        check: v => ({ ok: (close(v[0], Pv) && close(v[1], Qv)) || (close(v[0], -Pv) && close(v[1], -Qv)) }), log: `${dMl} = ${V('r')} geeft |${num}| = ${rH}${wortel}`,
        hint: `Schrijf ${V('l')} als ${V('ax')} − ${V('y')} + ${vb} = 0 met ${vb} = ${bIn}. Vul ${P('M', M)} in de teller in en neem de termen met ${va} samen.`,
        uitleg: `${w1}<br>${w2}`,
      }),
      inp(0, `Kwadrateren en op nul herleiden: {0}${va}<sup>2</sup> + {1}${va} + {2} = 0`, [S(Ap), S(Bp), S(Cp)], {
        log: poly(Ap, Bp, Cp), check: v => ({ ok: v.some(x => Math.abs(x) > 1e-9) && close(v[0] * Bp, v[1] * Ap, 1e-6) && close(v[0] * Cp, v[2] * Ap, 1e-6) && close(v[1] * Cp, v[2] * Bp, 1e-6) }),
        hint: `Je hebt |${num}| = ${rH}${wortel}. Kwadrateer beide kanten: links een merkwaardig product met dubbel product, rechts ${r2}(${va}<sup>2</sup> + 1). Breng daarna alles naar links.`,
        uitleg: `${w1}<br>${w2}<br>${w3}`,
      }),
      inp(0, `${va} = {0} ∨ ${va} = {1}`, [S(as[0]), S(as[1])], {
        unordered: true, hint: `Los ${poly(Ap, Bp, Cp)} op met de abc-formule. De discriminant is een mooi kwadraat.`, uitleg: w4,
      }),
      inp(0, `${V('l')}<sub>1</sub>: ${V('y')} = ${vterm(as[0], 'x', true)} + {0} en ${V('l')}<sub>2</sub>: ${V('y')} = ${vterm(as[1], 'x', true)} + {1}`, [S(bs[0]), S(bs[1])], {
        fire: v => [{ a: as[0].v, b: v[0] }, { a: as[1].v, b: v[1] }], target: { M, r: Math.sqrt(r2), through: A, name: 'l', pt: 'A' }, log: `${V('l')}<sub>1</sub>: ${lineEq(as[0], bs[0])} en ${V('l')}<sub>2</sub>: ${lineEq(as[1], bs[1])}`,
        hint: `Gebruik ${vb} = ${bIn} voor allebei de waarden van ${va}.`, uitleg: w5,
      }),
    ],
  };
}

/* ===================== reflextest ===================== */
function reflexQ() {
  const T = [
    () => ({ q: `${V('A')} ligt buiten cirkel ${V('c')}. Dan is ${dd(V('A'), V('c'))} =`, o: [`${dd(V('A'), V('M'))} − ${V('r')}`, `${dd(V('A'), V('M'))} + ${V('r')}`, `${V('r')} − ${dd(V('A'), V('M'))}`] }),
    () => ({ q: `${V('B')} ligt binnen cirkel ${V('c')}. Dan is ${dd(V('B'), V('c'))} =`, o: [`${V('r')} − ${dd(V('B'), V('M'))}`, `${dd(V('B'), V('M'))} − ${V('r')}`, `${dd(V('B'), V('M'))} + ${V('r')}`] }),
    () => ({ q: `Lijn ${V('k')} raakt ${V('c')} in ${V('A')}. Lijn ${V('l')} gaat door ${V('M')} en ${V('A')}. Dan geldt`, o: [`${V('k')} ⊥ ${V('l')}`, `${V('k')} ∥ ${V('l')}`, `${V('k')} = ${V('l')}`] }),
    () => { const [a, b] = pick([[1, 2], [2, 3], [3, 4], [1, 3], [2, 1], [3, 1], [3, 2], [4, 3]]), s = sgn(); return { q: `${rc('l')} = ${fq(q(s * a, b))} en ${V('k')} ⊥ ${V('l')}. Dan is ${rc('k')} =`, o: [fq(q(-s * b, a)), fq(q(s * b, a)), fq(q(-s * a, b))] }; },
    () => { const r = rnd(3, 6), k = pick([-2, -1, 0, 1, 2]), d = r + k, o = [`snijdt ${V('c')} in twee punten`, `raakt ${V('c')}`, `mist ${V('c')}`], i = k < 0 ? 0 : k === 0 ? 1 : 2; return { q: `${dd(V('M'), V('k'))} = ${d} en ${V('r')} = ${r}. Lijn ${V('k')}`, o: [o[i], ...o.filter((_, j) => j !== i)] }; },
    () => { const w = pick([['buiten', 2], ['op', 1], ['binnen', 0]]); return { q: `Punt ${V('A')} ligt ${w[0]} de cirkel. Hoeveel raaklijnen gaan er door ${V('A')}?`, o: [String(w[1]), ...[0, 1, 2].filter(n => n !== w[1]).map(String)] }; },
    () => { let a, b; do { a = rnd(1, 6) * sgn(); b = rnd(1, 6) * sgn(); } while (Math.abs(a) === Math.abs(b)); const r2 = pick([9, 16, 25, 10]); return { q: `Het middelpunt van ${circEq([a, b], r2)} is`, o: [`(${fq(a)}, ${fq(b)})`, `(${fq(-a)}, ${fq(-b)})`, `(${fq(b)}, ${fq(a)})`, `(${fq(-a)}, ${fq(b)})`] }; },
    () => { const n = pick([5, 10, 13, 20, 8]); return { q: `De straal van ${circEq([2, -1], n)} is`, o: [rt(n), String(n), fq(q(n, 2)), String(n * n)] }; },
    () => { const r1 = rnd(1, 4), r2 = rnd(1, 3), g = rnd(1, 5), d = r1 + r2 + g; return { q: `Twee cirkels naast elkaar met middelpunten ${V('M')} en ${V('N')}: ${dd(V('M'), V('N'))} = ${d}, ${V('r')}<sub>1</sub> = ${r1}, ${V('r')}<sub>2</sub> = ${r2}. De afstand tussen de cirkels is`, o: [String(g), String(d - r1), String(d + r1 + r2), String(d)].filter((x, i, a) => a.indexOf(x) === i) }; },
    () => { const r = rnd(1, 2), d = rnd(1, 3), g = rnd(1, 3), R = r + d + g; return { q: `Cirkel ${V('d')} (middelpunt ${V('N')}) ligt binnen ${V('c')} (middelpunt ${V('M')}): ${V('r')}<sub>${V('c')}</sub> = ${R}, ${V('r')}<sub>${V('d')}</sub> = ${r}, ${dd(V('M'), V('N'))} = ${d}. Dan is ${dd(V('c'), V('d'))} =`, o: [String(g), String(R - r), String(R + r + d), String(R - d)].filter((x, i, a) => a.indexOf(x) === i) }; },
    () => { const a = pick([2, 3, -2, 4]); return { q: `${V('k')}: ${V('y')} = ${vterm(a, 'x', true)} + ${V('b')} in de vorm … = 0 is`, o: [`${vterm(a, 'x', true)} − ${V('y')} + ${V('b')} = 0`, `${vterm(a, 'x', true)} + ${V('y')} + ${V('b')} = 0`, `${vterm(a, 'x', true)} − ${V('y')} − ${V('b')} = 0`] }; },
    () => { const [a, r] = pick([[q(3, 4), q(5, 4)], [q(4, 3), q(5, 3)], [q(1), null], [q(2), null]]); const n = a.mul(a).add(1); return { q: `${root(`${r ? `(${fq(a)})` : fq(a)}<sup>2</sup> + 1`)} =`, o: r ? [fq(r), fq(a.add(1)), fq(n)] : [rt(n.n), fq(a.add(1)), String(n.n + 1)] }; },
    () => { const p = rnd(2, 7), c = rnd(1, 3), r = pick([2, 3, 5]); return { q: `Kwadrateer |${p}${V('a')} + ${c}| = ${r}${root(`${V('a')}<sup>2</sup> + 1`)}`, o: [`${p * p}${V('a')}<sup>2</sup> + ${2 * p * c}${V('a')} + ${c * c} = ${r * r}${V('a')}<sup>2</sup> + ${r * r}`, `${p * p}${V('a')}<sup>2</sup> + ${c * c} = ${r * r}${V('a')}<sup>2</sup> + ${r * r}`, `${p * p}${V('a')}<sup>2</sup> + ${2 * p * c}${V('a')} + ${c * c} = ${r * r}${V('a')}<sup>2</sup> + 1`] }; },
    () => { let x = rnd(2, 6), y = rnd(2, 6); if (x === y) y++; const as = pick(['x', 'y']); return { q: `Een cirkel met middelpunt ${P('M', [x, y])} raakt de ${V(as)}-as. De straal is`, o: as === 'x' ? [String(y), String(x), rt(x * x + y * y)] : [String(x), String(y), rt(x * x + y * y)] }; },
    () => { const x = rnd(-3, 4), y = rnd(-3, 3), r = rnd(2, 4); return { q: `${P('M', [x, y])}, ${V('r')} = ${r}. De raaklijn in het hoogste punt van de cirkel is`, o: [`${V('y')} = ${fq(y + r)}`, `${V('x')} = ${fq(x)}`, `${V('y')} = ${fq(y)}`, `${V('x')} = ${fq(x + r)}`].filter((v, i, a) => a.indexOf(v) === i) }; },
    () => { const h = rnd(1, 6) * sgn(); return { q: `${V('x')}<sup>2</sup>${vterm(2 * h, 'x')} =`, o: [`${sq('x', -h)} − ${h * h}`, `${sq('x', -h)} + ${h * h}`, `${sq('x', -2 * h)} − ${4 * h * h}`, `${sq('x', h)} − ${h * h}`] }; },
    () => { const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13]]), x = rnd(-3, 3), y = rnd(-3, 3), s = sgn(); return { q: `${dd(P('A', [x, y]), P('B', [x + s * a, y + b]))} =`, o: [String(c), String(a + b), rt(a + b), String(c * c)] }; },
    () => { const x = rnd(-2, 3), y = rnd(-2, 3), dx = pick([1, 2, 3]), k = pick([-3, -2, 2, 3]); return { q: `De lijn door ${P('M', [x, y])} en ${P('A', [x + dx, y + k * dx])} heeft rc`, o: [fq(k), fq(q(1, k)), fq(-k), fq(q(-1, k))] }; },
    () => ({ q: `Bij ${dd(V('M'), V('l'))} = ${V('r')} krijg je |${V('b')} + 3| = 10. Dan is`, o: [`${V('b')} = 7 ∨ ${V('b')} = −13`, `${V('b')} = 7`, `${V('b')} = 13 ∨ ${V('b')} = −7`] }),
    () => ({ q: `De afstand van een punt tot een cirkel meet je langs de lijn door het punt en`, o: ['het middelpunt', 'de oorsprong', 'het hoogste punt van de cirkel'] }),
  ];
  const t = pick(T)();
  return { q: t.q, opts: shuffle(t.o.map((h, i) => ({ html: h, ok: i === 0 }))) };
}

if (typeof module !== 'undefined') module.exports = { Q, q, evalExpr, checkInput, lineStatus, fitView, gM0, gM1, gM2, gM3, gM4, gM5, M5C, reflexQ, fq, rt, lineEq };
