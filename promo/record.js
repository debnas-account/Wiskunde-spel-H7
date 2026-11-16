// Neemt de promo op: speelt het echte spel af in Chromium en bewaart elk beeld met tijdstempel.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'frames');
const vo = JSON.parse(fs.readFileSync(path.join(__dirname, 'vo.json'), 'utf8'));
const V = Object.fromEntries(vo.map(v => [v.id, v]));
const LEAD = 0.4, TAIL = 0.55;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const word = (id, re) => { const w = V[id].words.find(x => re.test(x[1])); if (!w) throw new Error('cue ' + id + ' ' + re); return w[0] + LEAD; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { localStorage.setItem('schampschot.v1', JSON.stringify({ xp: 430, stars: { m0: 3, m1: 3, m2: 2 }, best: 14, sound: false, day: '', streak: 3 })); });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  // opname-opmaak: ondertitelbalk, zichtbare cursor, overgang en eindkaart
  await page.addStyleTag({ content: `
    html { zoom: 1.5; }
    body { height: calc(100% - 92px) !important; }
    #pcap { position: fixed; left: 0; right: 0; bottom: 0; height: 92px; z-index: 9000; background: #0A1424; border-top: 1px solid #2B4366; display: grid; place-items: center; padding: 0 60px; font: 500 23px/1.35 'IBM Plex Sans', sans-serif; color: #F5F8FF; text-align: center; }
    #pcap span { max-width: 1040px; }
    #pcur { position: fixed; left: -50px; top: -50px; z-index: 9500; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: rgba(242,184,75,.32); border: 2px solid #F2B84B; pointer-events: none; transition: transform .1s; }
    #pcur.down { transform: scale(.62); background: rgba(242,184,75,.7); }
    #pfade { position: fixed; inset: 0 0 92px 0; z-index: 8000; background: #0E1B30; opacity: 0; pointer-events: none; transition: opacity .16s; }
    #pfade.on { opacity: 1; }
    #pend { position: fixed; inset: 0 0 92px 0; z-index: 8500; background: #0E1B30; display: grid; place-content: center; justify-items: center; gap: 18px; opacity: 0; pointer-events: none; transition: opacity .45s; text-align: center; }
    #pend.on { opacity: 1; }
    #pend .e { font: 600 20px 'IBM Plex Sans', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #F2B84B; }
    #pend .t { font: 700 118px/1 'Chakra Petch', 'Arial Black', sans-serif; letter-spacing: .02em; text-transform: uppercase; color: #F5F8FF; }
    #pend .s { font: 600 40px 'Chakra Petch', 'Arial Black', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #8FD3F0; opacity: 0; transition: opacity .4s; }
    #pend.tag .s { opacity: 1; }
    #pend svg { width: 150px; height: 150px; }
    .overlay { bottom: 92px !important; }
  ` });
  await page.evaluate(() => {
    for (const id of ['pcap', 'pcur', 'pfade', 'pend']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
    document.querySelector('#pcap').innerHTML = '<span></span>';
    document.querySelector('#pend').innerHTML = '<div class="e">Wiskunde B · hoofdstuk 7.4</div><svg viewBox="0 0 100 100"><circle cx="42" cy="58" r="30" fill="#E94B6B" fill-opacity=".14" stroke="#E94B6B" stroke-width="3"/><line x1="6" y1="40" x2="96" y2="4" stroke="#F2B84B" stroke-width="4" stroke-linecap="round"/><circle cx="30.9" cy="30.1" r="4" fill="#F5F8FF"/></svg><div class="t">Schampschot</div><div class="s">Raak voor je toets</div>';
    const c = document.querySelector('#pcur');
    document.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => c.classList.add('down'), true);
    document.addEventListener('mouseup', () => c.classList.remove('down'), true);
    window.__cap = t => { document.querySelector('#pcap span').textContent = t; };
    window.__fade = on => document.querySelector('#pfade').classList.toggle('on', on);
    // door de vergroting meet het veld zichzelf 1,5 keer te groot; reken dat terug zodat labels en lijnen meeschalen
    const fld = window.__schampschot.field;
    fld.set = function (scene, view) {
      this.scene = scene; const r = this.svg.getBoundingClientRect(); this.W = r.width / 1.5; this.H = r.height / 1.5;
      this.svg.setAttribute('viewBox', `0 0 ${this.W.toFixed(1)} ${this.H.toFixed(1)}`);
      this.view = view || fitView(scene, this.W / this.H); this.u = this.W / (this.view[1] - this.view[0]); this.draw();
    };
    const o = window.reflexQ; window.reflexQ = () => (window.__lastQ = o());
    window.__pickM3 = pred => { for (;;) { const p = gM3('std'); if (pred(p.steps[2].slots.map(s => s.v), p)) return p; } };
    window.__play = (code, prob, mode) => window.__schampschot.startMission({ id: 'promo', code, name: 'Promo', plan: [[() => prob, 'x', mode], [() => prob, 'x', mode]] });
  });

  // ---- opname via screencast ----
  const client = await ctx.newCDPSession(page);
  const frames = []; let n = 0;
  client.on('Page.screencastFrame', ev => {
    const f = `f${String(n++).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(OUT, f), Buffer.from(ev.data, 'base64'));
    frames.push({ f, t: Date.now() / 1000 });
    client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  const timeline = { scenes: [], sfx: [] };
  let cur = { x: 1300, y: 760 };
  async function moveTo(x, y, ms = 420) {
    const steps = Math.max(2, Math.round(ms / 16)), x0 = cur.x, y0 = cur.y;
    for (let i = 1; i <= steps; i++) { const k = i / steps, e = k * k * (3 - 2 * k); await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e); await sleep(16); }
    cur = { x, y };
  }
  async function center(sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('geen element ' + sel); return [b.x + b.width / 2, b.y + b.height / 2]; }
  async function click(sel, ms = 380) { const [x, y] = await center(sel); await moveTo(x, y, ms); await page.mouse.down(); await sleep(70); await page.mouse.up(); }
  const keySel = k => `#pad [data-k="${k}"]`;
  async function tapKeys(str, ms = 250) { for (const ch of str) await click(keySel(ch === '-' ? '−' : ch), ms); }
  let T0 = 0;
  const now = () => Date.now() / 1000 - T0;
  const until = async t => { const d = t - now(); if (d > 0) await sleep(d * 1000); };
  const sfx = name => timeline.sfx.push({ t: Date.now() / 1000, name });
  async function scene(id, fn, extra = 0) {
    const v = V[id], dur = LEAD + v.dur + TAIL + extra;
    await page.evaluate(() => window.__fade(false));
    T0 = Date.now() / 1000; timeline.scenes.push({ id, t: T0, dur });
    const capJob = (async () => { for (const c of v.caps) { await until(LEAD + c.t - 0.1); await page.evaluate(t => window.__cap(t), c.text); } })();
    await fn(dur);
    await capJob; await until(dur - 0.16);
    await page.evaluate(() => { window.__fade(true); }); await until(dur);
    await page.evaluate(() => window.__cap(''));
    console.log('scene', id, dur.toFixed(2), 'eind', now().toFixed(2));
  }

  await page.evaluate(() => window.__fade(true));
  await page.mouse.move(cur.x, cur.y);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 93, everyNthFrame: 1 });
  await sleep(300);

  // S1: startscherm
  await scene('s1', async dur => {
    await until(1.2); const [x, y] = await center('.mission[data-m="m0"]'); await moveTo(x + 120, y, 900);
    await until(3.2); await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'smooth' }));
    await until(3.6); const m3 = await center('.mission[data-m="m3"]'); await moveTo(m3[0], m3[1], 1100);
    await until(word('s1', /^Dat/) - 0.2); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await moveTo(495, 225, 1000);
  });

  // S2: het idee, met het proefveld van M3
  await page.evaluate(() => { window.scrollTo(0, 0); window.__schampschot.openMission('m3'); });
  await sleep(150);
  await scene('s2', async dur => {
    const b = await page.locator('#demo').boundingBox(), u = b.width / 12, cx = b.x + (4 + 2) * u, cy = b.y + (9 - 3) * u, r = 3 * u;
    const pt = a => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    let a = 0.9; const p0 = pt(a); await moveTo(p0[0], p0[1], 600); await page.mouse.down();
    const tEnd = dur - 0.9, t1 = now(), a1 = 0.9 + 2 * Math.PI * 0.82;
    while (now() < tEnd) { const k = (now() - t1) / (tEnd - t1), e = k * k * (3 - 2 * k); const p = pt(0.9 + (a1 - 0.9) * e); await page.mouse.move(p[0], p[1]); cur = { x: p[0], y: p[1] }; await sleep(16); }
    await page.mouse.up();
  });

  // S3: uitrekenen en vuren
  const p3 = await page.evaluate(() => { const p = window.__pickM3(v => Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 2 && v[0] <= 3 && Math.abs(v[1]) <= 9 && v[1] !== 0); window.__play('M3', p, 'core'); return p.steps[2].slots.map(s => s.v); });
  await sleep(150);
  await scene('s3', async () => {
    await until(0.5); await tapKeys(String(p3[0]), 330);
    await click('#step .slot[data-i="1"]', 300); await tapKeys(String(p3[1]), 260);
    const tv = word('s3', /^vuur/i); const [x, y] = await center('#go'); await moveTo(x, y, 320); await until(tv); await page.mouse.down(); await sleep(70); await page.mouse.up(); sfx('fire');
    await sleep(560); sfx('hit');
  });

  // S4: fout antwoord, hint, uitwerking
  const p4 = await page.evaluate(() => {
    const p = window.__pickM3((v, q) => { if (!(Number.isInteger(v[0]) && Number.isInteger(v[1]) && Math.abs(v[0]) === 2 && Math.abs(v[1]) <= 7 && Math.abs(v[1]) >= 2)) return false; const c = q.scene.circles[0]; return [-3, -2, 2, 3].some(d => lineStatus({ a: v[0], b: v[1] + d }, c).kind === 'snijdt' && Math.abs(v[1] + d) <= 9 && lineStatus({ a: v[0], b: v[1] + d }, c).d < 0.75 * c.r); });
    const v = p.steps[2].slots.map(s => s.v), c = p.scene.circles[0];
    const d1 = [-3, -2, 2, 3].find(d => lineStatus({ a: v[0], b: v[1] + d }, c).kind === 'snijdt' && Math.abs(v[1] + d) <= 9 && lineStatus({ a: v[0], b: v[1] + d }, c).d < 0.75 * c.r);
    window.__play('M3', p, 'core'); return { v, w1: v[1] + d1, w2: v[1] + (d1 > 0 ? d1 + 1 : d1 - 1) };
  });
  await sleep(150);
  await scene('s4', async () => {
    await until(0.35); await tapKeys(String(p4.v[0]), 230);
    await click('#step .slot[data-i="1"]', 240); await tapKeys(String(p4.w1), 220);
    const [x, y] = await center('#go'); await moveTo(x, y, 280); await until(word('s4', /^gaat/i) - 0.35); await page.mouse.down(); await sleep(70); await page.mouse.up(); sfx('fire');
    await sleep(600); sfx('bad');
    await until(word('s4', /^hint/i) + 0.5);
    await click('#step .slot[data-i="1"]', 300); for (const _ of String(p4.w1)) await click(keySel('⌫'), 150); await tapKeys(String(p4.w2), 200);
    const g = await center('#go'); await moveTo(g[0], g[1], 260); await until(word('s4', /^daarna/i) + 0.5); await page.mouse.down(); await sleep(70); await page.mouse.up(); sfx('fire');
    await sleep(600); sfx('bad');
    await sleep(700); sfx('fire');
    await moveTo(1500, 495, 700);
  });

  // S5: de lange som in kleine stappen
  const fmt = v => { if (Number.isInteger(v)) return String(v); for (const d of [2, 3, 4]) if (Number.isInteger(Math.round(v * d * 1e6) / 1e6)) return `${Math.round(v * d)}/${d}`; return String(v); };
  await page.evaluate(() => {
    let p; for (;;) { p = gM5('std'); const ok = p.steps.every(s => s.slots.every(x => Number.isInteger(x.v * 2) && Math.abs(x.v) <= 15)) && p.meta.as.every(a => Number.isInteger(a.v * 2)) && Math.abs(p.meta.A[0]) <= 7 && Math.abs(p.meta.A[1]) <= 7; if (ok) break; }
    window.__play('M5', p, 'full');
  });
  await sleep(150);
  await scene('s5', async dur => {
    const g = await center('#go'); await moveTo(g[0], g[1], 500);
    const starts = [0.7, 2.2, 3.7, 5.3, 6.9];
    for (let i = 0; i < 5; i++) {
      await until(starts[i]);
      const vals = await page.evaluate(() => window.__schampschot.R.st.slots.map(s => s.v));
      for (let j = 0; j < vals.length; j++) { if (j) await page.keyboard.press('Tab'); for (const ch of fmt(vals[j])) { await page.keyboard.press(ch); await sleep(75); } await sleep(90); }
      await sleep(160); await page.mouse.down(); await sleep(70); await page.mouse.up();
      if (i === 4) { sfx('fire'); await sleep(760); sfx('hit'); } else sfx('ok');
    }
  });

  // S6: reflextest
  await page.evaluate(() => window.__schampschot.startReflex());
  await sleep(120);
  await scene('s6', async dur => {
    await until(0.5);
    while (now() < dur - 0.9) {
      const i = await page.evaluate(() => window.__lastQ.opts.findIndex(o => o.ok));
      await click(`#rfOpts .opt[data-i="${i}"]`, 420); sfx('ok'); await sleep(430);
    }
  });

  // S7: overzicht en eindkaart
  await page.evaluate(() => { document.querySelector('#reflex [data-home]').click(); window.scrollTo(0, 0); });
  await sleep(150);
  await scene('s7', async dur => {
    await until(0.3); await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    const a = await center('.mission[data-m="m4"]'); await moveTo(a[0], a[1], 900);
    await until(word('s7', /^steeds/i)); const b = await center('.mission[data-m="m5"]'); await moveTo(b[0] + 60, b[1], 600);
    await until(word('s7', /^toets/i) - 0.3); await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
    const c = await center('.mission[data-m="boss"]'); await sleep(350); const c2 = await center('.mission[data-m="boss"]'); await moveTo(c2[0], c2[1], 600);
    await until(word('s7', /^Scham/i) - 0.35); await page.evaluate(() => { document.querySelector('#pend').classList.add('on'); document.querySelector('#pcur').style.display = 'none'; });
    await until(word('s7', /^Raak/i) - 0.15); await page.evaluate(() => document.querySelector('#pend').classList.add('tag'));
    await until(dur - 1.5); await page.evaluate(() => { window.__cap(''); });
  }, 1.8);

  await sleep(200);
  await client.send('Page.stopScreencast');
  timeline.end = Date.now() / 1000; timeline.frames = frames;
  fs.writeFileSync(path.join(__dirname, 'timeline.json'), JSON.stringify(timeline));
  console.log('frames', frames.length, 'duur', (timeline.end - timeline.scenes[0].t).toFixed(1));
  await browser.close();
})().catch(e => { console.error('FOUT', e); process.exit(1); });
