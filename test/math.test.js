'use strict';
// Controleert de opgavengeneratoren numeriek, onafhankelijk van de uitlegteksten.
const G = require('../src/math.js');
const assert = require('assert');
const { evalExpr, checkInput, lineStatus } = G;
let n = 0;
const ok = (c, m) => { n++; assert(c, m); };
const eq = (a, b, m) => ok(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);

// parser
eq(evalExpr('√34-4'), Math.sqrt(34) - 4, 'p1'); eq(evalExpr('2√5'), 2 * Math.sqrt(5), 'p2'); eq(evalExpr('-19/4'), -4.75, 'p3');
eq(evalExpr('5/√5'), Math.sqrt(5), 'p4'); eq(evalExpr('√5,5'), Math.sqrt(5.5), 'p5'); eq(evalExpr('−1,5'), -1.5, 'p6');
eq(evalExpr('7−√5−2'), 5 - Math.sqrt(5), 'p7'); eq(evalExpr('√38,25-3,5-2'), Math.sqrt(38.25) - 5.5, 'p8');
ok(isNaN(evalExpr('')) && isNaN(evalExpr('3/')) && isNaN(evalExpr('√')) && isNaN(evalExpr('1/0')), 'p9');

function generic(p, tag) {
  ok(p.given && !/NaN|undefined|null|Infinity/.test(p.given), tag + ' given ' + p.given);
  ok(p.steps.length > 0 && p.steps.some(s => s.lvl === 0), tag + ' kernstap');
  for (const s of p.steps) {
    for (const k of ['prompt', 'hint', 'uitleg']) ok(typeof s[k] === 'string' && s[k] && !/NaN|undefined|null|Infinity|\[object/.test(s[k]), `${tag} ${k}: ${s[k]}`);
    if (s.type === 'input') {
      ok((s.prompt.match(/\{\d\}/g) || []).length === s.slots.length, tag + ' slots');
      s.slots.forEach(sl => ok(isFinite(sl.v) && typeof sl.show === 'string' && !/NaN|undefined/.test(sl.show), tag + ' slot ' + JSON.stringify(sl)));
      ok(checkInput(s, s.slots.map(sl => sl.v)).ok, tag + ' eigen antwoord goed');
      ok(!checkInput(s, s.slots.map(sl => sl.v + 1)).ok, tag + ' fout antwoord fout');
    } else if (s.type === 'choice') {
      ok(s.choices.filter(c => c.ok).length === 1, tag + ' precies 1 goed: ' + s.prompt);
      ok(new Set(s.choices.map(c => c.html)).size === s.choices.length, tag + ' opties uniek ' + s.choices.map(c => c.html).join(' | '));
      s.choices.forEach(c => ok(c.ok || c.why, tag + ' why'));
    } else if (s.type === 'tap') ok(s.test(s.answer), tag + ' tap');
    if (s.fire) s.fire(s.slots.map(sl => sl.v)).forEach(ln => { const st = lineStatus(ln, s.target); ok(st.kind === 'raak' && st.through, `${tag} raaklijn ${JSON.stringify(ln)} ${st.kind} ${st.d}`); });
    if (s.showLines) s.showLines.forEach(ln => ok(lineStatus(ln, s.target).kind === 'raak', tag + ' showLines'));
    if (s.after) s.after(p.scene);
  }
  const v = G.fitView(p.scene); ok(v[1] - v[0] === v[3] - v[2] && v[1] - v[0] <= 30, tag + ' view ' + v);
  ok(p.scene.circles.every(c => !c.hidden) && p.scene.points.every(c => !c.hidden), tag + ' alles zichtbaar na afloop');
}
const circ = p => p.scene.circles[0];
const last = p => p.steps[p.steps.length - 1];
const N = 3000;
for (let i = 0; i < N; i++) {
  let p;
  // M0
  for (const v of ['int', 'half']) { p = G.gM0(v); generic(p, 'm0' + v); const s = last(p).slots, c = circ(p); eq(s[0].v, c.M[0], 'm0 M'); eq(s[1].v, c.M[1], 'm0 My'); eq(v === 'half' ? Math.sqrt(s[2].v) : s[2].v, c.r, 'm0 r'); }
  // M1
  for (const v of ['buiten', 'binnen', 'blind']) {
    p = G.gM1(v); generic(p, 'm1' + v); const c = circ(p), A = p.scene.points[1].p, d = Math.hypot(A[0] - c.M[0], A[1] - c.M[1]);
    eq(last(p).slots[0].v, Math.abs(d - c.r), 'm1 afstand'); ok(last(p).slots[0].v > 0, 'm1 positief');
    if (v === 'buiten') ok(d > c.r, 'buiten'); if (v === 'binnen') ok(d < c.r, 'binnen');
  }
  p = G.gM1('tapnear'); generic(p, 'm1tapnear'); { const c = circ(p), A = p.scene.points[1].p, T = p.steps[0].answer; eq(Math.hypot(T[0] - c.M[0], T[1] - c.M[1]), c.r, 'T op c'); eq(Math.hypot(A[0] - T[0], A[1] - T[1]), Math.hypot(A[0] - c.M[0], A[1] - c.M[1]) - c.r, 'T dichtst'); eq(p.steps[1].slots[0].v, Math.hypot(A[0] - T[0], A[1] - T[1]), 'tapnear d'); }
  p = G.gM1('tapdist'); generic(p, 'm1tapdist');
  // M2
  p = G.gM2('twee'); generic(p, 'm2twee'); { const [a, b] = p.scene.circles; eq(last(p).slots[0].v, Math.hypot(a.M[0] - b.M[0], a.M[1] - b.M[1]) - a.r - b.r, 'm2 twee'); ok(last(p).slots[0].v > 0, 'pos'); }
  p = G.gM2('in'); generic(p, 'm2in'); { const [a, b] = p.scene.circles; eq(last(p).slots[0].v, a.r - Math.hypot(a.M[0] - b.M[0], a.M[1] - b.M[1]) - b.r, 'm2 in'); ok(last(p).slots[0].v > 0, 'pos'); }
  for (const v of ['lijnpos', 'lijndist']) {
    p = G.gM2(v); generic(p, 'm2' + v); const c = circ(p), st = lineStatus(p.scene.lines[0], { M: c.M, r: c.r }); eq(p.steps[0].slots[0].v, st.d, 'm2 d(M,k)');
    if (v === 'lijndist') eq(last(p).slots[0].v, st.d - c.r, 'm2 d(k,c)');
    else { const good = last(p).choices.find(x => x.ok).html; ok((st.kind === 'snijdt' && /snijdt/.test(good)) || (st.kind === 'raak' && /raakt/.test(good)) || (st.kind === 'mist' && /geen punt/.test(good)), 'm2 ligging ' + st.kind + good); }
    // lijnvergelijking in de opgave klopt met de getekende lijn
    const m = /: (−?\d*)<var>x<\/var> ([+−]) (\d*)<var>y<\/var> = (−?\d+)\./.exec(p.given.replace(/.*lijn <var>k<\/var>/, '')); ok(m, 'm2 parse ' + p.given);
    const A = m[1] === '' ? 1 : +m[1].replace('−', '-'), B = (m[2] === '−' ? -1 : 1) * (m[3] === '' ? 1 : +m[3]), C = +m[4].replace('−', '-'), ln = p.scene.lines[0];
    eq(A * 0 + B * ln.b, C, 'm2 lijn b'); eq(A * 1 + B * (ln.a + ln.b), C, 'm2 lijn a');
  }
  p = G.gM2('xas'); generic(p, 'm2xas'); { const [a, b] = p.scene.circles, ln = p.scene.lines[0]; eq(a.r, a.M[1], 'raakt x-as'); eq(b.r, b.M[1], 'raakt x-as'); eq(ln.a * a.M[0] + ln.b, a.M[1], 'M op k'); eq(ln.a * b.M[0] + ln.b, b.M[1], 'N op k'); eq(last(p).slots[0].v, Math.hypot(a.M[0] - b.M[0], a.M[1] - b.M[1]) - a.r - b.r, 'xas d'); ok(last(p).slots[0].v > 0.2, 'xas los'); }
  // M3
  p = G.gM3('std'); generic(p, 'm3std'); { const c = circ(p), A = p.scene.points[1].p; eq(Math.hypot(A[0] - c.M[0], A[1] - c.M[1]), c.r, 'A op c'); eq(p.steps[0].slots[0].v * p.steps[1].slots[0].v, -1, 'loodrecht'); }
  p = G.gM3('xas'); generic(p, 'm3xas'); { const c = circ(p), [M, C, D] = p.scene.points; eq(Math.hypot(C.p[0] - c.M[0], C.p[1] - c.M[1]), c.r, 'C op c'); eq(Math.hypot(D.p[0] - c.M[0], D.p[1] - c.M[1]), c.r, 'D op c'); ok(C.p[0] < D.p[0] && C.p[1] === 0 && D.p[1] === 0, 'C links'); eq(p.steps[0].slots[0].v, C.p[0], 'xC'); const T = last(p).target.through; ok((T[0] === C.p[0]) === /raakt in <var>C/.test(p.given), 'juiste raakpunt'); }
  p = G.gM3('recht'); generic(p, 'm3recht'); { const c = circ(p), ln = p.scene.lines[0]; ok(lineStatus(ln, { M: c.M, r: c.r, through: p.scene.points[1].p }).kind === 'raak', 'recht raakt'); const good = p.steps[0].choices.find(x => x.ok).html; ok(ln.x != null ? good === `<var>x</var> = ${G.fq(ln.x)}` : good === `<var>y</var> = ${G.fq(ln.b)}`, 'recht optie'); }
  // M4
  p = G.gM4('toon'); generic(p, 'm4toon'); { const c = circ(p), st = lineStatus(p.scene.lines[0], { M: c.M, r: c.r }); eq(st.d, c.r, 'toon raakt'); eq(last(p).slots[0].v, c.r, 'toon d'); }
  for (const v of ['int', 'frac', 'lood', 'even']) {
    p = G.gM4(v); generic(p, 'm4' + v); const c = circ(p), s = last(p), lines = s.fire(s.slots.map(x => x.v)); ok(lines[0].a === lines[1].a && lines[0].b !== lines[1].b, 'twee evenwijdige');
    const mid = p.steps[p.steps.length - 2]; lines.forEach(ln => eq(Math.abs(mid.slots[0].v + ln.b), mid.slots[1].v, 'm4 |c0+b|=R'));
    if (v === 'lood' || v === 'even') { const m = /lijn <var>m<\/var>: (.*?) en raken/.exec(p.given)[1]; const a = lines[0].a; const am = v === 'lood' ? -1 / a : a; ok(m.startsWith(G.lineEq(G.Q.of(Math.round(am * 12) / 12), 0).replace(/ = .*/, '')), 'm4 m'); eq(p.steps[0].slots[0].v, a, 'rc_k'); }
  }
  // M5
  p = G.gM5('std'); generic(p, 'm5'); {
    const { M, A, r2, as, bs, coef } = p.meta; ok(Math.hypot(A[0] - M[0], A[1] - M[1]) > Math.sqrt(r2), 'A buiten');
    as.forEach((a, i) => { eq(coef[0] * a.v * a.v + coef[1] * a.v + coef[2], 0, 'wortel'); eq(a.v * A[0] + bs[i].v, A[1], 'door A'); // substitutie in cirkel: discriminant nul
      const b = bs[i].v, qa = 1 + a.v * a.v, qb = -2 * M[0] + 2 * a.v * (b - M[1]), qc = M[0] * M[0] + (b - M[1]) ** 2 - r2; eq(qb * qb - 4 * qa * qc, 0, 'discriminant'); });
    const s1 = p.steps[0], s2 = p.steps[1], s3 = p.steps[2];
    eq(s1.slots[0].v - s1.slots[1].v * 2, A[1] - 2 * A[0], 'b(a)');
    for (const a of [0.3, -1.7, 2.2]) { const b = s1.slots[0].v - s1.slots[1].v * a; eq(Math.abs(s2.slots[0].v * a + s2.slots[1].v), Math.abs(a * M[0] - M[1] + b), 'teller'); }
    ok(s3.check(coef.map(x => -3 * x)).ok && s3.check(coef.map(x => x / 2)).ok && !s3.check([coef[0], coef[1], coef[2] + 1]).ok && !s3.check([0, 0, 0]).ok, 'evenredig');
    ok(s2.check([-s2.slots[0].v, -s2.slots[1].v]).ok && !s2.check([s2.slots[0].v, -s2.slots[1].v]).ok, 'teken');
  }
  const r = G.reflexQ(); ok(r.opts.filter(o => o.ok).length === 1 && new Set(r.opts.map(o => o.html)).size === r.opts.length && r.opts.length >= 2 && !/NaN|undefined/.test(r.q + r.opts.map(o => o.html)), 'reflex ' + r.q + ' :: ' + r.opts.map(o => o.html).join(' | '));
}
// boekvoorbeeld als ijkpunt: M(2, 3), r = 5, A(9, 2) geeft a = 3/4 en a = -4/3, b = -4 3/4 en b = 14
{ const p = G.gM5('std', { r2: 25, P: -7, Q: -1, M: [2, 3] }); eq(p.meta.as[0].v, -4 / 3, 'boek a'); eq(p.meta.as[1].v, 0.75, 'boek a'); eq(p.meta.bs[0].v, 14, 'boek b'); eq(p.meta.bs[1].v, -4.75, 'boek b'); ok(p.meta.coef.join() === '12,7,-12', 'boek abc ' + p.meta.coef); }
console.log(`ok: ${n} controles, ${G.M5C.length} M5-configuraties`);
