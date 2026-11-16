// Promo V2: snelle montage van het echte spel, getimed op de ElevenLabs-voice-over (vo2.json).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'frames2');
const vo = JSON.parse(fs.readFileSync(path.join(__dirname, 'vo2.json'), 'utf8'));
const V = Object.fromEntries(vo.map(v => [v.id, v]));
const LEAD = 0.05, GAP = 0.22;
const INDEX = fs.existsSync(path.join(__dirname, '..', 'index.html')) ? path.join(__dirname, '..', 'index.html') : '/home/user/Wiskunde-spel-H7/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cue = (id, re, n = 0) => { const w = V[id].words.filter(x => re.test(x.w))[n]; if (!w) throw new Error('cue ' + id + ' ' + re); return LEAD + w.t; };
// ondertitels: korte brokken, per woord getimed
function chunks(v) {
  const out = []; let cur = [];
  v.words.forEach((w, i) => { cur.push({ w: w.w, t: LEAD + w.t }); if (/[.?!:,]$/.test(w.w) || cur.length >= 6 || i === v.words.length - 1) { if (cur.length >= 2 || /[.?!]$/.test(w.w) || i === v.words.length - 1) { out.push({ t: cur[0].t, words: cur }); cur = []; } } });
  return out;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + INDEX);
  await page.evaluate(() => { localStorage.setItem('schampschot.v1', JSON.stringify({ xp: 430, stars: { m0: 3, m1: 3, m2: 2 }, best: 14, sound: false, day: '', streak: 3 })); });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `
    html { zoom: 1.5; } html, body { overflow: hidden !important; }
    body { height: calc(100% - 92px) !important; }
    .app { transform-origin: 0 0; will-change: transform; }
    .app.shake, #ptitle.shake { animation: pshake .32s linear; }
    @keyframes pshake { 15% { translate: -9px 6px; } 30% { translate: 8px -7px; } 45% { translate: -6px -4px; } 60% { translate: 5px 4px; } 80% { translate: -2px 1px; } }
    #pcap { position: fixed; left: 0; right: 0; bottom: 0; height: 92px; z-index: 9000; background: #0A1424; border-top: 2px solid #E94B6B; display: grid; place-items: center; padding: 0 40px; text-align: center; }
    #pcap span { font: 700 31px/1.2 'Chakra Petch', 'Arial Black', sans-serif; letter-spacing: .03em; text-transform: uppercase; }
    #pcap b { font-weight: 700; color: rgba(245,248,255,.4); } #pcap b.cw-now { color: #F2B84B; } #pcap b.cw-done { color: #F5F8FF; }
    body.demo-only .brief-txt, body.demo-only #brief .hud, body.demo-only #demoRead { visibility: hidden; }
    #pcur { position: fixed; left: -50px; top: -50px; z-index: 9500; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: rgba(242,184,75,.32); border: 2px solid #F2B84B; pointer-events: none; transition: transform .08s; }
    #pcur.down { transform: scale(.6); background: rgba(242,184,75,.75); }
    #pflash { position: fixed; inset: 0 0 92px 0; z-index: 8600; background: #F5F8FF; opacity: 0; pointer-events: none; }
    #pflash.go { animation: pflash .26s ease-out; } @keyframes pflash { from { opacity: .6; } to { opacity: 0; } }
    #pkin { position: fixed; inset: 0 0 92px 0; z-index: 8700; pointer-events: none; overflow: hidden; }
    .kin { position: absolute; font: 700 90px/1 'Chakra Petch', 'Arial Black', sans-serif; letter-spacing: .02em; text-transform: uppercase; white-space: nowrap; padding: 6px 22px 10px; background: #0A1424; border-radius: 6px; box-shadow: 0 10px 40px rgba(6,12,24,.7); animation: kin-in .2s cubic-bezier(.2,1.5,.3,1) both; rotate: var(--r, -3deg); translate: -50% -50%; }
    @keyframes kin-in { from { scale: 2.6; opacity: 0; } to { scale: 1; opacity: 1; } }
    #ptitle { position: fixed; inset: 0 0 92px 0; z-index: 8400; background: #0E1B30; display: grid; place-content: center; justify-items: center; gap: 14px; text-align: center; overflow: hidden; }
    #ptitle .ln { font: 700 104px/1.02 'Chakra Petch', 'Arial Black', sans-serif; letter-spacing: .02em; text-transform: uppercase; color: #F5F8FF; animation: kin-in .2s cubic-bezier(.2,1.5,.3,1) both; transition: opacity .15s, color .15s; position: relative; }
    #ptitle .ln.sm { font-size: 60px; color: #8FD3F0; }
    #ptitle .ln.amber { color: #F2B84B; }
    #ptitle .e { font: 600 20px 'IBM Plex Sans', sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #F2B84B; }
    #ptitle.meh .ln { color: #5d6f8c; }
    #ptitle .ln.cut::after, #ptitle.meh .ln::after { content: ''; position: absolute; left: -3%; right: -3%; top: 52%; height: 9px; background: #E94B6B; transform-origin: left; animation: strike .18s ease-out both; }
    @keyframes strike { from { scale: 0 1; } to { scale: 1 1; } }
    #ptitle svg { width: 170px; height: 170px; animation: kin-in .2s cubic-bezier(.2,1.5,.3,1) both; }
    #ptitle .beam { position: absolute; left: -10%; top: 50%; width: 120%; height: 7px; background: #F2B84B; box-shadow: 0 0 30px #F2B84B; rotate: -9deg; transform-origin: left; animation: sweep .35s ease-out both; }
    @keyframes sweep { from { scale: 0 1; opacity: 1; } 70% { scale: 1 1; opacity: 1; } to { scale: 1 1; opacity: 0; } }
    .overlay { bottom: 92px !important; }
  ` });
  await page.evaluate(() => {
    for (const id of ['pcap', 'pcur', 'pflash', 'pkin', 'ptitle']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
    const $ = s => document.querySelector(s), app = $('.app'), capEl = document.createElement('span'); $('#pcap').appendChild(capEl);
    $('#ptitle').hidden = true;
    const c = $('#pcur');
    // pointer-events: het veld onderdrukt muis-events tijdens slepen
    document.addEventListener('pointermove', e => { c.style.left = e.clientX / 1.5 + 'px'; c.style.top = e.clientY / 1.5 + 'px'; }, true);
    document.addEventListener('pointerdown', () => c.classList.add('down'), true);
    document.addEventListener('pointerup', () => c.classList.remove('down'), true);
    window.__cur = on => { c.style.display = on ? '' : 'none'; };
    // ondertitels die per woord oplichten
    let capId = 0;
    window.__capSeq = chs => { const id = ++capId; chs.forEach(ch => setTimeout(() => {
      if (id !== capId) return; capEl.innerHTML = ch.words.map(w => `<b>${w.w}</b>`).join(' '); const bs = capEl.querySelectorAll('b');
      ch.words.forEach((w, i) => setTimeout(() => { if (id !== capId || !bs[i].isConnected) return; bs.forEach((b, j) => { if (j < i) b.className = 'cw-done'; }); bs[i].className = 'cw-now'; }, Math.max(0, (w.t - ch.t) * 1000)));
    }, ch.t * 1000)); };
    window.__capClear = () => { capId++; capEl.innerHTML = ''; };
    // camera: zoom in op een element van het spel
    window.__camS = 1;
    window.__cam = (s, sel, instant, fx = 0.5, fy = 0.5) => {
      const Z = 1.5, VW = innerWidth / Z, VH = innerHeight / Z - 92, prev = app.style.transform;
      app.style.transition = 'none'; app.style.transform = 'none';
      let tf = 'none';
      if (sel && s !== 1) { const ar = app.getBoundingClientRect(), er = $(sel).getBoundingClientRect(); const lx = (er.left + er.width * fx - ar.left) / Z, ly = (er.top + er.height * fy - ar.top) / Z; tf = `translate(${(VW / 2 - ar.left / Z - s * lx).toFixed(1)}px, ${(VH / 2 - ar.top / Z - s * ly).toFixed(1)}px) scale(${s})`; }
      app.style.transform = prev; void app.offsetWidth;
      app.style.transition = instant ? 'none' : 'transform .3s cubic-bezier(.2,.9,.2,1)'; app.style.transform = tf; window.__camS = sel ? s : 1;
    };
    window.__flash = () => { const f = $('#pflash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };
    window.__shake = () => { for (const e of [app, $('#ptitle')]) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); } };
    window.__kin = (text, o = {}) => { const d = document.createElement('div'); d.className = 'kin'; d.textContent = text; d.style.left = (o.x == null ? 50 : o.x) + '%'; d.style.top = (o.y == null ? 50 : o.y) + '%'; d.style.color = o.color || '#F2B84B'; d.style.fontSize = (o.size || 90) + 'px'; d.style.setProperty('--r', (o.rot == null ? -3 : o.rot) + 'deg'); $('#pkin').appendChild(d); if (o.hold) setTimeout(() => d.remove(), o.hold * 1000); };
    window.__kinClear = () => { $('#pkin').innerHTML = ''; };
    window.__title = (html, cls) => { const t = $('#ptitle'); if (html == null) { t.hidden = true; return; } t.className = cls || ''; t.innerHTML = html; t.hidden = false; };
    window.__titleAdd = html => { $('#ptitle').insertAdjacentHTML('beforeend', html); };
    // het veld meet zichzelf vergroot door zoom en camera; reken dat terug zodat labels meeschalen
    const fld = window.__schampschot.field;
    fld.set = function (scene, view) {
      this.scene = scene; const r = this.svg.getBoundingClientRect(), k = 1.5 * window.__camS; this.W = r.width / k; this.H = r.height / k;
      this.svg.setAttribute('viewBox', `0 0 ${this.W.toFixed(1)} ${this.H.toFixed(1)}`);
      this.view = view || fitView(scene, this.W / this.H); this.u = this.W / (this.view[1] - this.view[0]); this.draw();
    };
    const o = window.reflexQ; window.reflexQ = () => (window.__lastQ = o());
    const fmt = v => { if (Number.isInteger(v)) return String(v).replace('-', '−'); for (const d of [2, 3, 4]) if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return `${Math.round(v * d)}/${d}`.replace('-', '−'); return String(v); };
    window.__fmt = fmt;
    window.__start = (code, prob, mode, rounds = 2) => window.__schampschot.startMission({ id: 'promo', code, name: 'Schampschot', plan: Array.from({ length: rounds }, () => [() => prob, 'x', mode]) });
    window.__fill = vals => { const R = window.__schampschot.R; R.vals = vals.map(fmt); document.querySelectorAll('#step .slot').forEach((b, i) => { b.textContent = R.vals[i]; }); };
    window.__fillOk = () => window.__fill(window.__schampschot.R.st.slots.map(s => s.v));
    window.__go = () => $('#go').click();
    // een M3-opgave met mooie gehele antwoorden; wrong = een lijn die dwars door de cirkel gaat
    window.__m3 = (slopes) => { for (;;) { const p = gM3('std'), v = p.steps[2].slots.map(s => s.v), c = p.scene.circles[0];
      if (!(Number.isInteger(v[0]) && Number.isInteger(v[1]) && slopes.includes(v[0]) && Math.abs(v[1]) <= 9 && Math.abs(v[1]) >= 1 && c.r > 2.1)) continue;
      const d = [-3, -2, 2, 3, -4, 4].find(d => { const s = lineStatus({ a: v[0], b: v[1] + d }, c); return s.kind === 'snijdt' && s.d < 0.6 * c.r && Math.abs(v[1] + d) <= 9; });
      if (d == null) continue; return { p, v, wrong: [v[0], v[1] + d] }; } };
    window.__home = () => $('#brief [data-home]').click();
    let m5; for (;;) { m5 = gM5('std'); if (m5.steps.every(s => s.slots.every(x => Number.isInteger(x.v * 2) && Math.abs(x.v) <= 15))) break; }
    window.__pre = { any: [1, 2, 3, 4].map(() => window.__m3([2, 3, -2, -3])), pos: window.__m3([2, 3]), m5 };
  });

  const client = await ctx.newCDPSession(page);
  const frames = []; let n = 0;
  client.on('Page.screencastFrame', ev => {
    const f = `f${String(n++).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(OUT, f), Buffer.from(ev.data, 'base64'));
    frames.push({ f, t: Date.now() / 1000 });
    client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  const timeline = { scenes: [], sfx: [], lead: LEAD };
  let cur = { x: 1500, y: 700 };
  async function moveTo(x, y, ms = 200) {
    const steps = Math.max(2, Math.round(ms / 16)), x0 = cur.x, y0 = cur.y;
    for (let i = 1; i <= steps; i++) { const k = i / steps, e = k * k * (3 - 2 * k); await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e); await sleep(16); }
    cur = { x, y };
  }
  async function center(sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('geen element ' + sel); return [b.x + b.width / 2, b.y + b.height / 2]; }
  async function click(sel, ms = 170) { const [x, y] = await center(sel); await moveTo(x, y, ms); await page.mouse.down(); await sleep(45); await page.mouse.up(); }
  const keySel = k => `#pad [data-k="${k}"]`;
  async function tapKeys(str, ms = 150) { for (const ch of str) { await click(keySel(ch === '-' ? '−' : ch), ms); sfx('tick'); } }
  let T0 = 0;
  const now = () => Date.now() / 1000 - T0;
  const until = async t => { const d = t - now(); if (d > 0) await sleep(d * 1000); };
  const sfx = (name, dt = 0) => timeline.sfx.push({ t: Date.now() / 1000 + dt, name });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const slam = async (text, o) => { await ev(([t, o]) => { window.__kin(t, o); }, [text, o || {}]); sfx('slam'); };
  const impact = async () => { await ev(() => { window.__flash(); window.__shake(); }); };
  async function scene(id, fn, extra = 0) {
    const v = V[id], dur = LEAD + v.dur + GAP + extra;
    T0 = Date.now() / 1000; timeline.scenes.push({ id, t: T0, dur });
    await ev(ch => window.__capSeq(ch), chunks(v));
    await fn(dur);
    await until(dur);
    await ev(() => { window.__kinClear(); });
    console.log('scene', id, dur.toFixed(2), 'eind', now().toFixed(2));
  }
  const LOGO = '<svg viewBox="0 0 100 100"><circle cx="42" cy="58" r="30" fill="#E94B6B" fill-opacity=".14" stroke="#E94B6B" stroke-width="3"/><line x1="6" y1="40" x2="96" y2="4" stroke="#F2B84B" stroke-width="4" stroke-linecap="round"/><circle cx="30.9" cy="30.1" r="4" fill="#F5F8FF"/></svg>';

  // voorbereiding scène 1: een schot klaarzetten achter de titel
  await ev(() => { window.__cur(false); const m = window.__pre.any.shift(); window.__start('M3', m.p, 'core'); window.__fillOk(); window.__cam(1.32, '#field', true); window.__title('', ''); });
  await page.mouse.move(cur.x, cur.y);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 93, everyNthFrame: 1 });
  await sleep(350);

  // S1: haak. "Wiskunde B stampen uit je boek? Kan. Maar schieten is leuker."
  await scene('s1', async () => {
    await ev(() => window.__titleAdd('<div class="ln">Wiskunde B</div>')); sfx('slam');
    await until(cue('s1', /^stampen/)); await ev(() => window.__titleAdd('<div class="ln">stampen</div>')); sfx('slam');
    await until(cue('s1', /^uit/)); await ev(() => window.__titleAdd('<div class="ln sm">uit je boek?</div>')); sfx('tick');
    await until(cue('s1', /^Kan/)); await ev(() => document.querySelector('#ptitle').classList.add('meh')); sfx('bad');
    await until(cue('s1', /^Maar/) - 0.05); await ev(() => { window.__title(null); window.__flash(); }); sfx('slam');
    await until(cue('s1', /^schieten/) - 0.25); await ev(() => window.__go()); sfx('fire');
    await sleep(540); await impact(); sfx('hit');
    await until(cue('s1', /^leuker/) - 0.1); await slam('Schieten is leuker', { y: 78, size: 84 });
  });

  // S2: "Dit is Schampschot. Elke cirkel is een schild. Een voltreffer ketst af."
  await scene('s2', async () => {
    await ev(L => { window.__title(`${L}<div class="ln">Schampschot</div>`); window.__flash(); window.__shake(); }, LOGO); sfx('slam');
    await sleep(250); await ev(() => { const m = window.__pre.any.shift(); window.__cam(1, null, true); window.__start('M3', m.p, 'core'); window.__fill(m.wrong); window.__cam(1.32, '#field', true); });
    await until(cue('s2', /^Elke/) - 0.05); await ev(() => { window.__title(null); window.__flash(); });
    await until(cue('s2', /^schild/) - 0.05); await slam('Schild', { x: 22, y: 20, size: 70, color: '#E94B6B', rot: -5 });
    await until(cue('s2', /^voltreffer/) - 0.1); await ev(() => window.__go()); sfx('fire');
    await sleep(540); await ev(() => window.__shake()); sfx('bad');
    await until(cue('s2', /^ketst/) + 0.05); await slam('Ketst af', { x: 74, y: 76, size: 84, color: '#FF8A7A', rot: 4 });
  });

  // S3: "Alleen een lijn die de cirkel precies raakt, schakelt het uit. Dus: reken hem uit, en vuur!"
  await scene('s3', async dur => {
    await ev(() => { window.__cam(1, null, true); window.__schampschot.openMission('m3'); document.body.classList.add('demo-only'); window.__cam(1.45, '#demo', true); window.__flash(); window.__cur(true); });
    const b = await page.locator('#demo').boundingBox(), size = Math.min(b.width, b.height), u = size / 12, cx = b.x + (b.width - size) / 2 + 6 * u, cy = b.y + (b.height - size) / 2 + 6 * u, r = 3 * u;
    const pt = a => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    const p0 = pt(2.4); await page.mouse.move(p0[0], p0[1]); cur = { x: p0[0], y: p0[1] }; await page.mouse.down();
    const tEnd = cue('s3', /^Dus/) - 0.12, t1 = now(), a0 = 2.4, a1 = 2.4 - 2 * Math.PI * 1.15; let said = false;
    while (now() < tEnd) {
      const k = (now() - t1) / (tEnd - t1), p = pt(a0 + (a1 - a0) * (k * k * (3 - 2 * k))); await page.mouse.move(p[0], p[1]); cur = { x: p[0], y: p[1] };
      if (!said && now() > cue('s3', /^raakt/) - 0.05) { said = true; await slam('Raaklijn', { x: 24, y: 80, size: 76, color: '#8FD3F0', rot: -4 }); }
      await sleep(16);
    }
    await page.mouse.up();
    const v = await ev(() => { window.__kinClear(); const m = window.__pre.pos; document.body.classList.remove('demo-only'); window.__cam(1, null, true); window.__start('M3', m.p, 'core'); window.__flash(); return m.v; });
    await until(cue('s3', /^reken/) - 0.15); await tapKeys(String(v[0]), 170);
    await click('#step .slot[data-i="1"]', 170); await tapKeys(String(v[1]), 150);
    const g = await center('#go'); await moveTo(g[0], g[1], 180); await until(cue('s3', /^vuur/) - 0.08);
    await page.mouse.down(); await sleep(45); await page.mouse.up(); sfx('fire');
    await ev(() => window.__cam(1.32, '#field', false));
    await sleep(540); await impact(); sfx('hit'); await slam('Raak!', { x: 72, y: 24, size: 110, rot: 5 });
  }, 0.5);

  // S4: "Mis? Dan zie je meteen waarom, en krijg je een hint."
  await scene('s4', async () => {
    await ev(() => { window.__cur(false); const m = window.__pre.any.shift(); window.__cam(1, null, true); window.__start('M3', m.p, 'core'); window.__fill(m.wrong); window.__cam(1.32, '#field', true); window.__flash(); window.__go(); }); sfx('fire');
    await slam('Mis?', { x: 76, y: 24, size: 120, color: '#FF8A7A', rot: 5 });
    await sleep(500); await ev(() => window.__shake()); sfx('bad');
    await until(cue('s4', /^waarom/) - 0.1); await ev(() => { window.__kinClear(); window.__cam(1.7, '#fb', false, 0.5, 0.35); });
    await until(cue('s4', /^hint/) - 0.05); await slam('Hint', { x: 17, y: 15, size: 96, rot: -5 });
  });

  // S5: "Korte missies. Punten scoren. Steeds een rang hoger."
  await scene('s5', async () => {
    await ev(() => { window.__cam(1, null, true); window.__schampschot.store.xp = 430; window.__home(); window.__cam(1.3, '#missions', true); window.__flash(); window.__cur(true); }); sfx('slam');
    const a = await center('.mission[data-m="m0"]'); await page.mouse.move(a[0], a[1]); cur = { x: a[0], y: a[1] };
    const b = await center('.mission[data-m="m5"]'); await moveTo(b[0], b[1], 900);
    await until(cue('s5', /^Punten/) - 0.08);
    await ev(() => { window.__cur(false); window.__cam(1, null, true); window.__start('M5', window.__pre.m5, 'full'); window.__cam(1.9, '.hud-r', true, 0.2, 2.4); window.__flash(); }); sfx('slam');
    for (let i = 0; i < 4; i++) { await sleep(i ? 215 : 120); await ev(() => { window.__fillOk(); window.__go(); }); sfx('ok'); if (i === 1) await slam('+XP', { x: 26, y: 70, size: 110, rot: -5 }); }
    await until(cue('s5', /^Steeds/) - 0.08);
    await ev(() => { window.__kinClear(); window.__cam(1, null, true); window.__schampschot.store.xp = 0; window.__home(); window.__cam(2.1, '#status', true, 0.22, 0.5); window.__flash(); });
    const steps = [150, 400, 800, 1400, 2200], t0 = now(), tEnd = LEAD + V.s5.dur - 0.25;
    for (let i = 0; i < steps.length; i++) { await until(t0 + 0.2 + (tEnd - t0 - 0.2) * i / steps.length); await ev(x => { window.__schampschot.store.xp = x; window.__home(); }, steps[i]); sfx('rank' + i); }
    await ev(() => window.__shake());
  });

  // S6: "En de reflextest: zestig seconden. Hoeveel haal jij?"
  await scene('s6', async dur => {
    await ev(() => { window.__cam(1, null, true); window.__schampschot.startReflex(); window.__cam(1.45, '#reflex .rf-body', true, 0.5, 0.3); window.__flash(); window.__cur(true); }); sfx('slam');
    const tZoom = cue('s6', /^Hoeveel/) - 0.15; let said = false;
    while (now() < tZoom - 0.4) {
      const i = await ev(() => window.__lastQ.opts.findIndex(o => o.ok));
      await click(`#rfOpts .opt[data-i="${i}"]`, 170); sfx('ok'); await sleep(230);
      if (!said && now() > cue('s6', /^zestig/) - 0.1) { said = true; await ev(() => window.__kinClear()); await slam('60 sec', { x: 80, y: 70, size: 100, rot: 5 }); }
    }
    await until(tZoom); await ev(() => { window.__kinClear(); window.__cur(false); window.__cam(2.6, '#rfScore', false, 0.2, 2.2); });
    while (now() < dur - 0.3) { const i = await ev(() => window.__lastQ.opts.findIndex(o => o.ok)); await page.keyboard.press(String(i + 1)); sfx('ok'); await sleep(250); }
  });

  // S7: "Een paar minuten per dag, en hoofdstuk zeven zit erin. Schampschot. Niet stampen. Schieten."
  await scene('s7', async dur => {
    await ev(() => { document.querySelector('#reflex [data-home]').click(); const m = window.__pre.any.shift(); window.__cam(1, null, true); window.__start('M3', m.p, 'core', 1); window.__fillOk(); window.__cam(1.32, '#field', true); window.__flash(); window.__go(); }); sfx('fire');
    await sleep(540); await impact(); sfx('hit');
    await until(cue('s7', /^dag/) - 0.1); await ev(() => { window.__cam(1, null, true); window.__go(); window.__cam(1.5, '#resultCard', true); window.__flash(); }); sfx('win');
    await until(cue('s7', /^Schampschot/) - 0.08); await ev(L => { window.__cam(1, null, true); window.__title(`<div class="e">Wiskunde B · hoofdstuk 7.4</div>${L}<div class="ln">Schampschot</div>`); window.__flash(); window.__shake(); }, LOGO); sfx('slam');
    await until(cue('s7', /^Niet/) - 0.05); await ev(() => window.__titleAdd('<div class="ln sm" id="ns">Niet stampen.</div>')); sfx('tick');
    await until(cue('s7', /^Schieten/) - 0.06); await ev(() => { document.querySelector('#ns').classList.add('cut'); document.querySelector('#ns').style.color = '#5d6f8c'; window.__titleAdd('<div class="ln amber">Schieten.</div><i class="beam"></i>'); window.__flash(); window.__shake(); }); sfx('fire'); sfx('hit', 0.3);
    await until(dur - 0.8); await ev(() => window.__capClear());
  }, 1.5);

  await sleep(200);
  await client.send('Page.stopScreencast');
  timeline.end = Date.now() / 1000; timeline.frames = frames;
  fs.writeFileSync(path.join(__dirname, 'timeline2.json'), JSON.stringify(timeline));
  console.log('frames', frames.length, 'duur', (timeline.end - timeline.scenes[0].t).toFixed(1));
  await browser.close();
})().catch(e => { console.error('FOUT', e); process.exit(1); });
