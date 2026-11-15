'use strict';
/* Schampschot: interface. Gebruikt de globale functies uit math.js. */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- opslag ---------- */
  const KEY = 'schampschot.v1';
  const store = Object.assign({ xp: 0, stars: {}, best: 0, sound: true, day: '', streak: 0 }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* zonder opslag werkt het spel ook */ } };
  const RANKS = [[0, 'Rekruut'], [150, 'Schutter'], [400, 'Scherpschutter'], [800, 'Tacticus'], [1400, 'Commandant'], [2200, 'Legende']];
  function rank(xp) { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; const nx = RANKS[i + 1]; return { name: RANKS[i][1], lo: RANKS[i][0], hi: nx ? nx[0] : null, next: nx ? nx[1] : null }; }
  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function dayStreak() { const now = new Date(), t = dayKey(now); if (store.day === t) return; const y = new Date(now); y.setDate(y.getDate() - 1); store.streak = store.day === dayKey(y) ? store.streak + 1 : 1; store.day = t; }

  /* ---------- geluid ---------- */
  let AC = null;
  function tone(f, t, type, g, when, f2) {
    if (!store.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), ga = AC.createGain(), t0 = AC.currentTime + (when || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
      ga.gain.setValueAtTime(g || 0.05, t0); ga.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
      o.connect(ga); ga.connect(AC.destination); o.start(t0); o.stop(t0 + t + 0.02);
    } catch (e) { /* geen geluid beschikbaar */ }
  }
  const sfx = {
    ok() { tone(660, 0.07, 'triangle'); tone(990, 0.1, 'triangle', 0.05, 0.07); },
    bad() { tone(170, 0.18, 'sawtooth', 0.035); },
    key() { tone(420, 0.03, 'square', 0.012); },
    fire() { tone(1500, 0.4, 'sawtooth', 0.03, 0, 220); },
    hit() { tone(1300, 0.05, 'square', 0.03); tone(1900, 0.14, 'triangle', 0.04, 0.05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, 'triangle', 0.05, i * 0.1)); },
  };

  /* ---------- veld ---------- */
  class Field {
    // fit = true: het assenstelsel vult het hele vak en tekst houdt zijn echte grootte
    constructor(svg, fit) {
      this.svg = svg; this.scene = null; this.mode = null; this.cb = null; this.down = false; this.fit = !!fit; this.W = this.H = 360;
      svg.setAttribute('viewBox', '0 0 360 360');
      if (fit && window.ResizeObserver) new ResizeObserver(() => { if (this.scene && this.svg.getBoundingClientRect().width) this.set(this.scene); }).observe(svg);
      const h = e => { if (!this.mode || !this.scene) return; e.preventDefault(); if (this.cb) this.cb(this.toMath(e)); };
      svg.addEventListener('pointerdown', e => { if (!this.mode) return; this.down = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* niet nodig */ } h(e); });
      svg.addEventListener('pointermove', e => { if (this.down) h(e); });
      const up = () => { this.down = false; };
      svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    }
    interact(mode, cb) { this.mode = mode; this.cb = cb || null; this.svg.classList.toggle('live', !!mode); }
    set(scene, view) {
      this.scene = scene;
      if (this.fit) { const r = this.svg.getBoundingClientRect(); if (r.width > 20 && r.height > 20) { this.W = r.width; this.H = r.height; } this.svg.setAttribute('viewBox', `0 0 ${this.W.toFixed(1)} ${this.H.toFixed(1)}`); }
      this.view = view || fitView(scene, this.W / this.H); this.u = this.W / (this.view[1] - this.view[0]); this.draw();
    }
    geom() { const r = this.svg.getBoundingClientRect(), s = Math.min(r.width / this.W, r.height / this.H); return { s, ox: r.left + (r.width - this.W * s) / 2, oy: r.top + (r.height - this.H * s) / 2 }; }
    toMath(e) { const g = this.geom(); return [this.view[0] + (e.clientX - g.ox) / g.s / this.u, this.view[3] - (e.clientY - g.oy) / g.s / this.u]; }
    toScreen(p) { const g = this.geom(); return [g.ox + (p[0] - this.view[0]) * this.u * g.s, g.oy + (this.view[3] - p[1]) * this.u * g.s]; }
    clip(ln) {
      const [x0, x1, y0, y1] = this.view, [p, w] = twoPts(ln), dx = w[0] - p[0], dy = w[1] - p[1];
      if (Math.abs(dx) + Math.abs(dy) < 1e-12) return null;
      let t0 = -Infinity, t1 = Infinity;
      for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]]) {
        if (Math.abs(pp) < 1e-12) { if (qq < 0) return null; } else { const t = qq / pp; if (pp < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); }
      }
      if (t0 > t1) return null;
      return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
    }
    lineTag(ln, cls, extra) {
      const c = this.clip(ln); if (!c) return '';
      const n = v => v.toFixed(1), X = x => (x - this.view[0]) * this.u, Y = y => (this.view[3] - y) * this.u;
      return `<line class="${cls}" ${extra || ''} x1="${n(X(c[0][0]))}" y1="${n(Y(c[0][1]))}" x2="${n(X(c[1][0]))}" y2="${n(Y(c[1][1]))}"/>`;
    }
    draw() {
      const sc = this.scene; if (!sc) return;
      const [x0, x1, y0, y1] = this.view, u = this.u, VW = this.W, VH = this.H, X = x => (x - x0) * u, Y = y => (y1 - y) * u, n = v => v.toFixed(1), num = v => String(v).replace('-', '−');
      let h = '<g class="grid">';
      for (let x = Math.ceil(x0); x <= x1; x++) h += `<line x1="${n(X(x))}" y1="0" x2="${n(X(x))}" y2="${n(VH)}"/>`;
      for (let y = Math.ceil(y0); y <= y1; y++) h += `<line x1="0" y1="${n(Y(y))}" x2="${n(VW)}" y2="${n(Y(y))}"/>`;
      h += '</g>';
      if (!sc.bare) {
        const st = u >= 17 ? 1 : u >= 9 ? 2 : 5, ax = X(0), ay = Y(0);
        h += `<g class="axes"><line x1="0" y1="${n(ay)}" x2="${n(VW)}" y2="${n(ay)}"/><line x1="${n(ax)}" y1="0" x2="${n(ax)}" y2="${n(VH)}"/><path d="M${n(VW)} ${n(ay)}l-7-3.5v7z"/><path d="M${n(ax)} 0l-3.5 7h7z"/></g><g class="ticks">`;
        for (let x = Math.ceil((x0 + 0.5) / st) * st; x < x1; x += st) if (x !== 0) h += `<text x="${n(X(x))}" y="${n(ay + 11)}" text-anchor="middle">${num(x)}</text>`;
        for (let y = Math.ceil((y0 + 0.5) / st) * st; y < y1; y += st) if (y !== 0) h += `<text x="${n(ax - 4)}" y="${n(Y(y) + 3)}" text-anchor="end">${num(y)}</text>`;
        h += `<text class="it" x="${n(ax - 5)}" y="${n(ay + 13)}" text-anchor="end">O</text><text class="it" x="${n(VW - 5)}" y="${n(ay - 6)}" text-anchor="end">x</text><text class="it" x="${n(ax + 7)}" y="12">y</text></g>`;
      }
      sc.circles.forEach(c => {
        if (c.hidden) return;
        h += `<circle class="circ" cx="${n(X(c.M[0]))}" cy="${n(Y(c.M[1]))}" r="${n(c.r * u)}"/>`;
        if (c.name) { const a = (c.lab == null ? -40 : c.lab) * Math.PI / 180; h += `<text class="lab lc" text-anchor="middle" x="${n(X(c.M[0] + c.r * Math.cos(a)) + 10 * Math.cos(a))}" y="${n(Y(c.M[1] + c.r * Math.sin(a)) - 10 * Math.sin(a) + 4)}">${c.name}</text>`; }
      });
      sc.segs.forEach(s => {
        if (s.hidden) return;
        const ax = X(s.p[0]), ay = Y(s.p[1]), bx = X(s.q[0]), by = Y(s.q[1]);
        h += `<line class="seg" x1="${n(ax)}" y1="${n(ay)}" x2="${n(bx)}" y2="${n(by)}"/>`;
        if (s.name) { const L = Math.hypot(bx - ax, by - ay) || 1; h += `<text class="lab ll" text-anchor="middle" x="${n((ax + bx) / 2 - (by - ay) / L * 11)}" y="${n((ay + by) / 2 + (bx - ax) / L * 11 + 4)}">${s.name}</text>`; }
      });
      sc.lines.forEach(l => {
        if (l.hidden) return; const c = this.clip(l); if (!c) return;
        h += this.lineTag(l, 'ln');
        if (l.name) {
          const ax = X(c[0][0]), ay = Y(c[0][1]), bx = X(c[1][0]), by = Y(c[1][1]), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
          h += `<text class="lab ll" text-anchor="middle" x="${n(clamp(bx - ux * 22 - uy * 11, 10, VW - 10))}" y="${n(clamp(by - uy * 22 + ux * 11 + 4, 14, VH - 6))}">${l.name}</text>`;
        }
      });
      (sc.beams || []).forEach(b => { h += this.lineTag(b.ln, `beam st-${b.st}`); });
      (sc.right || []).forEach(m => { const px = X(m.at[0]), py = Y(m.at[1]), s = 9, a = [m.u[0] * s, -m.u[1] * s], b = [m.v[0] * s, -m.v[1] * s]; h += `<path class="sq" d="M${n(px + a[0])} ${n(py + a[1])}L${n(px + a[0] + b[0])} ${n(py + a[1] + b[1])}L${n(px + b[0])} ${n(py + b[1])}"/>`; });
      const c0 = sc.circles.find(c => !c.hidden);
      sc.points.forEach(p => {
        if (p.hidden) return;
        const px = X(p.p[0]), py = Y(p.p[1]); let o = p.o;
        if (!o) {
          const dx = c0 ? p.p[0] - c0.M[0] : 0, dy = c0 ? p.p[1] - c0.M[1] : 0, L = Math.hypot(dx, dy);
          o = c0 && L > 1e-9 && p.name !== 'M' && p.name !== 'N' ? [dx / L * 14, -dy / L * 14 + 5] : [10, 15];
        }
        h += `<circle class="pt${p.drag ? ' drag' : ''}" cx="${n(px)}" cy="${n(py)}" r="${p.drag ? 7 : 3.4}"/>`;
        if (p.name) h += `<text class="lab" text-anchor="middle" x="${n(px + o[0])}" y="${n(py + o[1])}">${p.name}</text>`;
      });
      if (sc.marker) { const px = n(X(sc.marker[0])), py = n(Y(sc.marker[1])); h += `<g class="marker" transform="translate(${px} ${py})"><circle r="8"/><path d="M-13 0h7M6 0h7M0-13v7M0 6v7"/></g>`; }
      this.svg.innerHTML = h;
    }
    fire(lines, target, cb) {
      const res = lines.map(ln => lineStatus(ln, target));
      this.svg.insertAdjacentHTML('beforeend', `<g>${lines.map((ln, i) => this.lineTag(ln, 'beam fly', `pathLength="1" style="animation-delay:${i * 200}ms"`)).join('')}</g>`);
      sfx.fire();
      setTimeout(() => {
        if (!this.scene) return;
        this.scene.beams = (this.scene.beams || []).concat(lines.map((ln, i) => ({ ln, st: res[i].kind })));
        this.draw();
        const X = x => ((x - this.view[0]) * this.u).toFixed(1), Y = y => ((this.view[3] - y) * this.u).toFixed(1);
        let h = '';
        res.forEach(r => r.pts.forEach(p => {
          if (r.kind === 'raak') h += `<g transform="translate(${X(p[0])} ${Y(p[1])})"><g class="spark">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="5" y1="0" x2="13" y2="0" transform="rotate(${a})"/>`).join('')}</g></g>`;
          else h += `<circle class="hitdot" cx="${X(p[0])}" cy="${Y(p[1])}" r="4"/>`;
        }));
        this.svg.insertAdjacentHTML('beforeend', h);
        cb(res);
      }, RM ? 0 : 520 + 200 * (lines.length - 1));
    }
  }

  /* ---------- missies ---------- */
  const mth = s => s.replace(/rc_(\w)/g, '\u0001$1\u0002').replace(/([A-Za-z])/g, '<var>$1</var>').replace(/\^(\d)/g, '<sup>$1</sup>').replace(/_<var>(\w)<\/var>/g, '<sub><var>$1</var></sub>').replace(/_(\d)/g, '<sub>$1</sub>').replace(/\u0001<var>(\w)<\/var>\u0002/g, 'rc<sub><var>$1</var></sub>').replace(/√\{([^}]*)\}/g, '<span class="sqrt">√<span class="rad">$1</span></span>');
  const rule = (s, note) => `<div class="rule">${mth(s)}${note ? ` <small>${note}</small>` : ''}</div>`;
  const dfrac = (a, b) => `<span class="fr big"><span>${mth(a)}</span><span>${mth(b)}</span></span>`;
  const LV = { core: 0, mid: 1, full: 2 };
  const MISSIONS = [
    {
      id: 'm0', code: 'M0', name: 'Scan', sub: 'Middelpunt en straal aflezen', tag: 'Voorkennis', min: 3,
      plan: [[gM0, 'int', 'full'], [gM0, 'int', 'mid'], [gM0, 'int', 'core'], [gM0, 'half', 'core']],
      brief: `<p>Elk schild is een cirkel. Voor je iets kunt uitrekenen heb je twee dingen nodig: het middelpunt en de straal.</p>${rule('(x − a)^2 + (y − b)^2 = r^2', 'middelpunt (a, b), straal r')}<p>Let op de tekens: bij ${mth('(x + 3)^2')} hoort ${mth('x')} = −3. Rechts staat ${mth('r^2')}, dus trek nog de wortel.</p><p>Staat de vergelijking uitgeschreven? Splits dan kwadraten af:</p>${rule('x^2 − 10x = (x − 5)^2 − 25')}`,
      sheet: [rule('(x − a)^2 + (y − b)^2 = r^2', 'middelpunt (a, b), straal r'), rule('x^2 + px = (x + ½p)^2 − (½p)^2', 'kwadraat afsplitsen')],
    },
    {
      id: 'm1', code: 'M1', name: 'Afstand tot het schild', sub: 'Punt en cirkel', tag: 'Theorie A', min: 4, demo: 'm1',
      plan: [[gM1, 'buiten', 'full'], [gM1, 'binnen', 'full'], [gM1, 'tapnear', 'full'], [gM1, 'tapdist', 'full'], [gM1, 'blind', 'core']],
      brief: `<p>Hoe ver ligt een punt van het schild? De kortste weg naar een cirkel loopt altijd recht op het middelpunt af. Reken dus eerst de afstand tot ${mth('M')} uit.</p>${rule('d(A, c) = d(A, M) − r', 'A buiten de cirkel')}${rule('d(B, c) = r − d(B, M)', 'B binnen de cirkel')}<p>Sleep ${mth('A')} door het veld en kijk wat er met de formule gebeurt.</p>`,
      sheet: [rule('d(A, M) = √{(x_A − x_M)^2 + (y_A − y_M)^2}'), rule('d(A, c) = d(A, M) − r', 'A buiten de cirkel'), rule('d(B, c) = r − d(B, M)', 'B binnen de cirkel')],
    },
    {
      id: 'm2', code: 'M2', name: 'Tussenruimte', sub: 'Twee cirkels, lijn en cirkel', tag: 'Theorie A', min: 5,
      plan: [[gM2, 'twee', 'full'], [gM2, 'in', 'full'], [gM2, 'lijnpos', 'full'], [gM2, 'lijndist', 'full'], [gM2, 'xas', 'full']],
      brief: `<p>Ook tussen twee schilden, of tussen een lijn en een schild, loopt de kortste weg via de middelpunten.</p>${rule('d(c_1, c_2) = d(M, N) − r_1 − r_2', 'cirkels naast elkaar')}${rule('d(c, d) = r_c − d(M, N) − r_d', 'd ligt binnen c')}<p>Voor een lijn ${mth('k')}: ${mth('ax + by = c')} gebruik je de afstandsformule:</p><div class="rule">${mth('d(M, k)')} = ${dfrac('|ax_M + by_M − c|', '√{a^2 + b^2}')} <small>en dan</small> ${mth('d(k, c) = d(M, k) − r')}</div><p>Is ${mth('d(M, k)')} kleiner dan ${mth('r')}, dan snijdt de lijn de cirkel. Gelijk aan ${mth('r')}: de lijn raakt. Groter: de lijn mist.</p>`,
      sheet: [rule('d(c_1, c_2) = d(M, N) − r_1 − r_2', 'cirkels naast elkaar'), rule('d(c, d) = r_c − d(M, N) − r_d', 'd ligt binnen c'), `<div class="rule">${mth('d(M, k)')} = ${dfrac('|ax_M + by_M − c|', '√{a^2 + b^2}')} <small>voor</small> ${mth('k')}: ${mth('ax + by = c')}</div>`, rule('d(k, c) = d(M, k) − r'), `<div class="rule">${mth('d(M, k) < r')} <small>snijdt</small> · ${mth('d(M, k) = r')} <small>raakt</small> · ${mth('d(M, k) > r')} <small>mist</small></div>`],
    },
    {
      id: 'm3', code: 'M3', name: 'Schampschot', sub: 'Raaklijn in een gegeven raakpunt', tag: 'Theorie B', min: 5, demo: 'm3',
      plan: [[gM3, 'std', 'full'], [gM3, 'std', 'mid'], [gM3, 'recht', 'full'], [gM3, 'std', 'core'], [gM3, 'xas', 'mid']],
      brief: `<p>Een raaklijn staat loodrecht op de straal naar het raakpunt. Dat is het hele geheim. Sleep ${mth('A')} over de cirkel en zie het.</p><p>Werkschema voor de raaklijn ${mth('k')} in een punt ${mth('A')} op de cirkel:</p><ol><li>Bereken ${mth('rc_l')} van de lijn ${mth('l')} door ${mth('M')} en ${mth('A')}.</li><li>${mth('k')} ⊥ ${mth('l')}, dus ${mth('rc_k')} · ${mth('rc_l')} = −1.</li><li>Vul ${mth('A')} in ${mth('y = ax + b')} in om ${mth('b')} te vinden.</li></ol>`,
      sheet: [`<div class="rule">1. ${mth('rc_l')} <small>van de lijn door M en A</small><br>2. ${mth('rc_k')} · ${mth('rc_l')} = −1<br>3. ${mth('A')} <small>invullen geeft</small> ${mth('b')}</div>`],
    },
    {
      id: 'm4', code: 'M4', name: 'Vaste koers', sub: 'Raaklijnen met gegeven richtingscoëfficiënt', tag: 'Theorie C', min: 5,
      plan: [[gM4, 'toon', 'full'], [gM4, 'int', 'full'], [gM4, 'int', 'mid'], [gM4, 'lood', 'mid'], [gM4, 'frac', 'core']],
      brief: `<p>Nu ligt de richting van je schot vast en zoek je de hoogte ${mth('b')}. Een lijn raakt een cirkel precies als de afstand van het middelpunt tot de lijn gelijk is aan de straal.</p>${rule('d(M, k) = r')}<p>Stel ${mth('k')}: ${mth('y = ax + b')} en schrijf dat als ${mth('ax − y + b = 0')}. Dan:</p><div class="rule">${dfrac('|ax_M − y_M + b|', '√{a^2 + 1}')} = ${mth('r')}</div><p>De absolute waarde geeft twee oplossingen. Logisch: er passen altijd twee evenwijdige raaklijnen om een cirkel.</p>`,
      sheet: [`<div class="rule">${mth('k')}: ${mth('y = ax + b')} <small>wordt</small> ${mth('ax − y + b = 0')}<br>${dfrac('|ax_M − y_M + b|', '√{a^2 + 1}')} = ${mth('r')} <small>geeft twee waarden van</small> ${mth('b')}</div>`, rule('k ∥ m: rc_k = rc_m', ''), rule('k ⊥ m: rc_k · rc_m = −1', '')],
    },
    {
      id: 'm5', code: 'M5', name: 'Dubbelschot', sub: 'Raaklijnen door een punt buiten de cirkel', tag: 'Theorie C', min: 6, demo: 'm5',
      plan: [[gM5, 'std', 'full'], [gM5, 'std', 'mid'], [gM5, 'std', 'core']],
      brief: `<p>Vanuit een punt ${mth('A')} buiten de cirkel kun je twee schampschoten lossen. Sleep ${mth('A')} om ze te zien. Zo reken je ze uit:</p><ol><li>Stel ${mth('l')}: ${mth('y = ax + b')} en vul ${mth('A')} in. Dat geeft ${mth('b')} uitgedrukt in ${mth('a')}.</li><li>Gebruik ${mth('d(M, l) = r')}.</li><li>Kwadrateer en herleid op nul.</li><li>Los op met de abc-formule: twee waarden van ${mth('a')}.</li><li>Bereken bij elke ${mth('a')} de ${mth('b')}.</li></ol><p>Dit is de langste som van de paragraaf. In deze missie doe je hem eerst in kleine stappen.</p>`,
      sheet: [`<div class="rule">1. ${mth('l')}: ${mth('y = ax + b')}, ${mth('A')} <small>invullen geeft</small> ${mth('b')} <small>in</small> ${mth('a')}<br>2. ${mth('d(M, l) = r')}<br>3. <small>kwadrateren, op nul herleiden</small><br>4. <small>abc-formule geeft twee waarden van</small> ${mth('a')}<br>5. <small>bij elke</small> ${mth('a')} <small>de</small> ${mth('b')}</div>`],
    },
  ];
  const BOSS = { id: 'boss', code: 'EX', name: 'Toets-sim', sub: 'Zes opgaven zonder tussenstappen', min: 10, plan: [[gM0, 'half', 'core'], [gM1, 'blind', 'core'], [gM2, 'in', 'core'], [gM3, 'std', 'core'], [gM4, 'int', 'core'], [gM5, 'std', 'core']] };
  const byId = id => (id === 'boss' ? BOSS : MISSIONS.find(m => m.id === id));

  /* ---------- schermen ---------- */
  const el = {};
  ['status', 'missions', 'extras', 'soundBtn', 'resetBtn', 'briefCode', 'briefTitle', 'briefBody', 'briefStart', 'briefDemo', 'demoRead', 'hudCode', 'pips', 'combo', 'hudXp', 'verdict', 'scroll', 'given', 'log', 'step', 'fb', 'choices', 'pad', 'hintBtn', 'go', 'quit', 'resultCard', 'timeFill', 'rfScore', 'rfQ', 'rfOpts', 'rfCombo', 'sheet', 'sheetTitle', 'sheetBody'].forEach(k => { el[k] = $('#' + k); });
  const field = new Field($('#field'), true), demo = new Field($('#demo')), hero = new Field($('#hero'));
  let R = null, RF = null, heroRaf = 0;
  function show(id) {
    ['home', 'brief', 'play', 'result', 'reflex'].forEach(k => { $('#' + k).hidden = k !== id; });
    document.body.classList.toggle('fixed', id === 'play');
    demo.interact(null); window.scrollTo(0, 0);
    if (id === 'home') { renderHome(); startHero(); } else cancelAnimationFrame(heroRaf);
  }
  const pips = (n, on, now) => `<span class="pips">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : i === now ? 'now' : ''}"></i>`).join('')}</span>`;

  function renderHome() {
    const rk = rank(store.xp), pct = rk.hi ? Math.round((store.xp - rk.lo) / (rk.hi - rk.lo) * 100) : 100;
    el.status.innerHTML = `<span>Rang <b>${rk.name}</b></span><span class="xpbar"><i style="width:${pct}%"></i></span><span>${store.xp} XP${rk.next ? ` · nog ${rk.hi - store.xp} tot ${rk.next}` : ''}</span>${store.streak >= 2 ? `<span>${store.streak} dagen op rij</span>` : ''}`;
    const nextId = (MISSIONS.find(m => !store.stars[m.id]) || {}).id;
    el.missions.innerHTML = MISSIONS.map(m => `<li><button type="button" class="mission${m.id === nextId ? ' next' : ''}" data-m="${m.id}"><span class="code">${m.code}</span><span><b>${m.name}</b><small>${m.sub}</small></span><span class="meta">${pips(3, store.stars[m.id] || 0, -1)}<small>${m.tag} · ± ${m.min} min</small></span></button></li>`).join('');
    el.extras.innerHTML = `<button type="button" class="mission" data-x="reflex"><span class="code">RX</span><span><b>Reflextest</b><small>60 seconden, zoveel mogelijk goed</small></span><span class="meta"><small>${store.best ? `Record ${store.best}` : 'Nog geen record'}</small></span></button><button type="button" class="mission" data-m="boss"><span class="code">EX</span><span><b>${BOSS.name}</b><small>${BOSS.sub}</small></span><span class="meta">${pips(3, store.stars.boss || 0, -1)}<small>± ${BOSS.min} min</small></span></button>`;
    el.soundBtn.textContent = store.sound ? 'Geluid uit' : 'Geluid aan';
  }
  function startHero() {
    const sc = { bare: true, circles: [{ M: [0, 0], r: 3 }], points: [{ p: [3, 0] }], lines: [{ p: [0, 0], q: [1, 1] }], segs: [{ p: [0, 0], q: [3, 0] }], beams: [] };
    let th = 0.9, last = 0;
    const put = () => { const A = [3 * Math.cos(th), 3 * Math.sin(th)]; sc.points[0].p = A; sc.segs[0].q = A; sc.lines = []; sc.beams = [{ ln: { p: A, q: [A[0] - Math.sin(th), A[1] + Math.cos(th)] }, st: 'raak' }]; sc.right = [{ at: A, u: [-Math.cos(th), -Math.sin(th)], v: [-Math.sin(th), Math.cos(th)] }]; };
    put(); hero.set(sc, [-6, 6, -6, 6]);
    cancelAnimationFrame(heroRaf);
    if (RM) return;
    const tick = t => { if (t - last > 40) { th += 0.012; last = t; put(); hero.draw(); } heroRaf = requestAnimationFrame(tick); };
    heroRaf = requestAnimationFrame(tick);
  }

  /* ---------- briefing en proefvelden ---------- */
  const DEMOS = {
    m1() {
      const M = [4, 3], r = 3; let A = [8, 7];
      const sc = { circles: [{ M, r, name: 'c' }], points: [{ p: M, name: 'M' }, { p: A, name: 'A', drag: true }], lines: [], segs: [{ p: A, q: M }] };
      const upd = () => {
        sc.points[1].p = A; sc.segs[0].p = A; demo.draw();
        const d2 = (A[0] - M[0]) ** 2 + (A[1] - M[1]) ** 2, d = Math.sqrt(d2), dAM = mth('d(A, M)'), dAc = mth('d(A, c)');
        el.demoRead.innerHTML = d > r ? `<small>A ligt buiten c</small>${dAc} = ${dAM} − ${mth('r')} = ${rt(d2)} − 3${isSq(d2) ? '' : ` ≈ ${fdec(d - r, 2)}`}` : d < r ? `<small>A ligt binnen c</small>${dAc} = ${mth('r')} − ${dAM} = 3 − ${rt(d2)}${isSq(d2) ? '' : ` ≈ ${fdec(r - d, 2)}`}` : `<small>A ligt op c</small>${dAc} = 0`;
      };
      demo.set(sc, [-2, 10, -3, 9]); demo.interact('drag', m => { A = [clamp(Math.round(m[0]), -1, 9), clamp(Math.round(m[1]), -2, 8)]; upd(); }); upd();
    },
    m3() {
      const M = [4, 3], r = 3; let th = 0.9;
      const sc = { circles: [{ M, r, name: 'c' }], points: [{ p: M, name: 'M' }, { p: M, name: 'A', drag: true }], lines: [{ p: M, q: M, name: 'k' }], segs: [{ p: M, q: M, name: 'l' }] };
      const upd = () => {
        const c = Math.cos(th), s = Math.sin(th), A = [M[0] + r * c, M[1] + r * s];
        sc.points[1].p = A; sc.segs[0].q = A; sc.lines[0].p = A; sc.lines[0].q = [A[0] - s, A[1] + c]; sc.right = [{ at: A, u: [-c, -s], v: [-s, c] }]; demo.draw();
        const steep = Math.abs(c) < 0.06, flat = Math.abs(s) < 0.06;
        el.demoRead.innerHTML = steep ? `<small>l is verticaal</small>De raaklijn ${mth('k')} is dan horizontaal.` : flat ? `<small>l is horizontaal</small>De raaklijn ${mth('k')} is dan verticaal en heeft geen rc.` : `<small>k staat loodrecht op l</small>${mth('rc_l')} ≈ ${fdec(s / c, 2)} en ${mth('rc_k')} ≈ ${fdec(-c / s, 2)}, samen ${mth('rc_k')} · ${mth('rc_l')} = −1`;
      };
      demo.set(sc, [-2, 10, -3, 9]); demo.interact('drag', m => { th = Math.atan2(m[1] - M[1], m[0] - M[0]); upd(); }); upd();
    },
    m5() {
      const M = [3, 3], r = 2.5; let A = [9, 5];
      const sc = { circles: [{ M, r, name: 'c' }], points: [{ p: M, name: 'M' }, { p: A, name: 'A', drag: true }], lines: [], segs: [] };
      const upd = () => {
        sc.points[1].p = A; const d = Math.hypot(A[0] - M[0], A[1] - M[1]), phi = Math.atan2(A[1] - M[1], A[0] - M[0]);
        sc.beams = []; sc.segs = []; sc.right = [];
        if (d > r + 1e-9) { const al = Math.acos(r / d); [phi + al, phi - al].forEach(t => { const T = [M[0] + r * Math.cos(t), M[1] + r * Math.sin(t)]; sc.beams.push({ ln: { p: A, q: T }, st: 'raak' }); sc.segs.push({ p: M, q: T }); }); }
        demo.draw();
        el.demoRead.innerHTML = d > r + 1e-9 ? `<small>A ligt buiten c</small>Twee raaklijnen door ${mth('A')}. Beide stralen staan loodrecht op hun raaklijn.` : d < r - 1e-9 ? `<small>A ligt binnen c</small>Geen enkele lijn door ${mth('A')} raakt de cirkel.` : `<small>A ligt op c</small>Precies één raaklijn.`;
      };
      demo.set(sc, [-2, 10, -3, 9]); demo.interact('drag', m => { A = [clamp(Math.round(m[0] * 2) / 2, -1.5, 9.5), clamp(Math.round(m[1] * 2) / 2, -2.5, 8.5)]; upd(); }); upd();
    },
  };
  function openMission(id) {
    const m = byId(id);
    if (!m.brief) return startMission(m);
    el.briefCode.textContent = `${m.code} · ${m.tag}`; el.briefTitle.textContent = m.name; el.briefBody.innerHTML = m.brief;
    el.briefStart.onclick = () => startMission(m);
    show('brief');
    el.briefDemo.hidden = !m.demo; if (m.demo) DEMOS[m.demo]();
  }

  /* ---------- een missie spelen ---------- */
  function startMission(m) { R = { m, plan: m.plan, ri: -1, first: 0, total: 0, gained: 0, combo: 0 }; show('play'); nextRound(); }
  function hud() {
    if (!R) return;
    el.hudCode.textContent = `${R.m.code} · ronde ${Math.min(R.ri + 1, R.plan.length)}/${R.plan.length}`;
    el.pips.innerHTML = pips(R.plan.length, R.ri, R.ri).replace(/^<span class="pips">|<\/span>$/g, '');
    el.combo.textContent = R.combo >= 2 ? `reeks ${R.combo}` : '';
    el.hudXp.textContent = `${store.xp} XP`;
  }
  function addXp(g) { store.xp += g; if (R) R.gained += g; save(); hud(); el.hudXp.classList.remove('bump'); void el.hudXp.offsetWidth; el.hudXp.classList.add('bump'); }
  const scrollDown = () => { el.scroll.scrollTop = Math.max(0, el.step.offsetTop - el.scroll.offsetTop - 4); };
  function fb(kind, html, title) { el.fb.className = 'fb ' + kind; el.fb.innerHTML = `<span class="fbt">${title || ''}</span>${html}`; el.fb.hidden = false; scrollDown(); }
  function flash(text) { el.verdict.textContent = text; el.verdict.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { el.verdict.hidden = true; }, 1500); }

  function nextRound() {
    R.ri++;
    if (R.ri >= R.plan.length) return finish();
    const [gen, variant, mode] = R.plan[R.ri];
    R.prob = gen(variant); R.steps = R.prob.steps.filter(s => s.lvl <= LV[mode]); R.si = 0;
    el.given.innerHTML = R.prob.given; el.log.innerHTML = ''; el.scroll.scrollTop = 0;
    field.set(R.prob.scene); hud(); renderStep();
  }
  function renderStep() {
    const st = R.steps[R.si];
    Object.assign(R, { st, tries: 0, hinted: false, phase: 'answer', busy: false, vals: st.type === 'input' ? st.slots.map(() => '') : [], active: 0 });
    el.fb.hidden = true; field.interact(null);
    el.pad.hidden = st.type !== 'input'; el.choices.hidden = st.type !== 'choice'; el.go.hidden = st.type === 'choice';
    el.hintBtn.hidden = false; el.hintBtn.textContent = 'Hint';
    el.go.textContent = st.fire ? 'Vuur' : 'Check'; el.go.classList.toggle('fire', !!st.fire);
    if (st.type === 'input') { el.step.innerHTML = `<p class="eq">${st.prompt.replace(/\{(\d)\}/g, (m, i) => `<button type="button" class="slot" data-i="${i}" aria-label="Invulvak ${+i + 1}"></button>`)}</p>`; paintSlots(); }
    else if (st.type === 'choice') { el.step.innerHTML = `<p class="ask">${st.prompt}</p>`; el.choices.innerHTML = st.choices.map((c, i) => `<button type="button" class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${c.html}</span></button>`).join(''); }
    else {
      el.step.innerHTML = `<p class="ask">${st.prompt}</p><p class="note">Tik op een roosterpunt in het veld en druk op Check.</p>`;
      const sc = R.prob.scene; sc.marker = null;
      field.interact('tap', m => { const p = [Math.round(m[0]), Math.round(m[1])]; if (!sc.marker || sc.marker[0] !== p[0] || sc.marker[1] !== p[1]) { sc.marker = p; field.draw(); sfx.key(); } });
    }
    scrollDown();
  }
  function paintSlots(reveal) {
    $$('#step .slot').forEach(b => {
      const i = +b.dataset.i;
      if (reveal) { b.innerHTML = R.st.slots[i].show; b.classList.add('shown'); b.classList.remove('on'); }
      else { b.textContent = R.vals[i]; b.classList.toggle('on', i === R.active); }
    });
  }
  function shake(i) { const b = $$('#step .slot')[i]; if (!b) return; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  function key(k) {
    if (!R || R.phase !== 'answer' || R.st.type !== 'input' || R.busy) return;
    let t = R.vals[R.active];
    if (k === '⌫') t = t.slice(0, -1); else if (t.length < 12) t += k;
    R.vals[R.active] = t; paintSlots(); sfx.key();
  }
  const logBody = st => (st.log ? st.log : st.type === 'input' ? st.prompt.replace(/\{(\d)\}/g, (m, i) => `<b>${st.slots[i].show}</b>`) : st.type === 'choice' ? `${st.short || st.prompt} <b>${st.choices.find(c => c.ok).html}</b>` : `${st.short || st.prompt} <b>${st.ansHtml}</b>`);
  function verdict(stats, st) {
    for (const s of stats) {
      if (s.kind === 'snijdt') return 'Je lijn gaat dwars door het schild: de afstand van <var>M</var> tot je lijn is kleiner dan de straal.';
      if (s.kind === 'mist') return 'Je lijn mist het schild: de afstand van <var>M</var> tot je lijn is groter dan de straal.';
      if (!s.through) return `Je lijn raakt de cirkel wel, maar gaat niet door <var>${st.target.pt}</var>.`;
    }
    return 'Dit zijn niet twee verschillende raaklijnen.';
  }
  function onGo() {
    if (!R || R.busy) return;
    if (R.phase === 'next') return advance(true);
    if (R.phase === 'round') return nextRound();
    const st = R.st, sc = R.prob.scene;
    if (st.type === 'tap') { if (!sc.marker) return fb('note', 'Tik eerst een roosterpunt aan in het veld.'); return st.test(sc.marker) ? correct() : wrong(); }
    if (st.type !== 'input') return;
    const empty = R.vals.findIndex(t => !t);
    if (empty >= 0) { if (empty === R.active) shake(empty); R.active = empty; paintSlots(); return; }
    const vals = R.vals.map(evalExpr), bad = vals.findIndex(x => !isFinite(x));
    if (bad >= 0) { R.active = bad; paintSlots(); shake(bad); return fb('note', 'Dat kan ik niet lezen. Gebruik cijfers, een minteken, een komma, / voor een breuk en √ voor een wortel.'); }
    const res = checkInput(st, vals);
    if (st.fire && !res.near) {
      R.busy = true; sc.beams = []; field.draw();
      field.fire(st.fire(vals), st.target, stats => { R.busy = false; if (res.ok) { sfx.hit(); flash('Schampschot'); correct(); } else wrong(verdict(stats, st)); });
      return;
    }
    if (res.ok) return correct();
    if (res.near) return fb('note', 'Bijna. Geef het exacte antwoord: laat de wortel staan of gebruik een breuk in plaats van een afgerond getal.');
    wrong();
  }
  function wrong(extra) {
    const st = R.st; R.tries++; R.combo = 0; sfx.bad(); hud();
    if (R.tries >= 2) return reveal(extra);
    fb('hint', `${extra ? extra + '<br>' : ''}${st.hint}`, 'Nog niet goed');
  }
  function reveal(extra) {
    const st = R.st, sc = R.prob.scene; R.phase = 'next'; field.interact(null);
    if (st.type === 'input') { paintSlots(true); if (st.fire) { sc.beams = []; field.draw(); R.busy = true; field.fire(st.fire(st.slots.map(s => s.v)), st.target, () => { R.busy = false; }); } }
    if (st.type === 'choice') $$('#choices .opt').forEach((b, i) => { b.disabled = true; if (st.choices[i].ok) b.classList.add('right'); });
    if (st.type === 'tap') { sc.marker = st.answer; field.draw(); }
    fb('uitleg', `${extra ? extra + '<br>' : ''}${st.uitleg}`, 'Zo zit het');
    el.go.hidden = false; el.go.textContent = 'Verder'; el.go.classList.remove('fire'); el.hintBtn.hidden = true; el.pad.hidden = true;
  }
  function correct() {
    const st = R.st, firstTry = R.tries === 0 && !R.hinted;
    if (firstTry) { R.first++; R.combo++; } else R.combo = 0;
    const mult = 1 + Math.min(3, Math.floor(R.combo / 3)) * 0.5;
    addXp(Math.round((firstTry ? 10 : 5) * mult) + (st.fire ? 5 : 0));
    if (!st.fire) sfx.ok();
    advance(false);
  }
  function advance(missed) {
    const st = R.st, sc = R.prob.scene; R.total++;
    el.log.insertAdjacentHTML('beforeend', `<li class="${missed ? 'miss' : ''}">${logBody(st)}</li>`);
    if (st.after) st.after(sc);
    sc.marker = null; field.draw();
    if (st.showLines) field.fire(st.showLines, st.target, () => {});
    R.si++;
    if (R.si < R.steps.length) return renderStep();
    R.phase = 'round'; field.interact(null); el.fb.hidden = true; el.pad.hidden = true; el.choices.hidden = true;
    el.step.innerHTML = `<p class="done">Ronde ${R.ri + 1} van ${R.plan.length} klaar.</p>`;
    el.go.hidden = false; el.go.classList.remove('fire'); el.go.textContent = R.ri === R.plan.length - 1 ? 'Afronden' : 'Volgende ronde';
    el.hintBtn.hidden = false; el.hintBtn.textContent = 'Uitwerking';
    hud(); el.scroll.scrollTop = el.scroll.scrollHeight;
  }
  function onOpt(i) {
    if (!R || R.phase !== 'answer' || R.busy) return;
    const st = R.st, c = st.choices[i], bs = $$('#choices .opt'), b = bs[i];
    if (!c || b.disabled) return;
    if (c.ok) { b.classList.add('right'); bs.forEach(x => { x.disabled = true; }); R.busy = true; setTimeout(() => { R.busy = false; correct(); }, RM ? 0 : 320); return; }
    b.classList.add('wrong'); b.disabled = true; R.tries++; R.combo = 0; sfx.bad(); hud();
    if (R.tries >= 2 || st.choices.length <= 2) reveal(c.why); else fb('hint', c.why || st.hint, 'Nog niet goed');
  }
  function onHint() {
    if (!R) return;
    if (R.phase === 'round') return openSheet('Uitwerking', `<p class="given">${R.prob.given}</p><ol class="sol">${R.prob.steps.map(st => `<li>${logBody(st)}<div class="why">${st.uitleg}</div></li>`).join('')}</ol>`);
    if (R.phase !== 'answer') return;
    R.hinted = true; fb('hint', R.st.hint, 'Hint');
  }
  function finish() {
    const acc = R.total ? R.first / R.total : 0, stars = acc >= 0.9 ? 3 : acc >= 0.65 ? 2 : 1, id = R.m.id, m = R.m;
    store.stars[id] = Math.max(store.stars[id] || 0, stars); dayStreak(); store.xp += 20 * stars; R.gained += 20 * stars; save(); sfx.win();
    const idx = MISSIONS.indexOf(m), nx = idx >= 0 && idx < MISSIONS.length - 1 ? MISSIONS[idx + 1] : idx === MISSIONS.length - 1 ? BOSS : null;
    const title = stars === 3 ? 'Schild uitgeschakeld' : stars === 2 ? 'Missie geslaagd' : 'Missie afgerond';
    const tip = stars === 3 ? 'Vrijwel alles in één keer goed. Deze stof zit erin.' : stars === 2 ? 'Goed bezig. Nog een rondje en het zit er helemaal in.' : 'Je hebt de stappen nu gezien. Speel hem nog een keer, dan gaat het al veel sneller.';
    showResult({ eyebrow: `${m.code} · ${m.name}`, title, stars, facts: [['In één keer goed', `${R.first}/${R.total}`], ['XP verdiend', `+${R.gained}`], ['Rang', rank(store.xp).name]], tip, again: () => openMission(id), next: nx ? [`Door naar ${nx.code}`, () => openMission(nx.id)] : null });
    R = null;
  }
  function showResult(o) {
    el.resultCard.innerHTML = `<p class="eyebrow">${o.eyebrow}</p><h2>${o.title}</h2>${o.stars ? pips(3, o.stars, -1) : ''}<dl class="facts">${o.facts.map(f => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join('')}</dl><p class="sub">${o.tip}</p><div class="row"><button type="button" class="btn sec" id="resAgain">Nog een keer</button><button type="button" class="btn pri" id="resNext">${o.next ? o.next[0] : 'Naar de basis'}</button></div>${o.next ? '<button type="button" class="link" data-home>Terug naar de basis</button>' : ''}`;
    $('#resAgain').onclick = o.again; $('#resNext').onclick = o.next ? o.next[1] : () => show('home');
    show('result');
  }

  /* ---------- reflextest ---------- */
  function startReflex() {
    RF = { t: 60, score: 0, combo: 0, lock: false };
    el.rfScore.textContent = '0'; el.rfCombo.textContent = ''; el.timeFill.style.transform = 'scaleX(1)';
    show('reflex'); rfNext();
    RF.iv = setInterval(() => { if (!RF) return; RF.t -= 0.1; el.timeFill.style.transform = `scaleX(${Math.max(0, RF.t / 60)})`; if (RF.t <= 0) rfEnd(); }, 100);
  }
  function rfNext() { if (!RF) return; RF.q = reflexQ(); el.rfQ.innerHTML = RF.q.q; el.rfOpts.innerHTML = RF.q.opts.map((o, i) => `<button type="button" class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${o.html}</span></button>`).join(''); RF.lock = false; }
  function rfPick(i) {
    if (!RF || RF.lock) return; const o = RF.q.opts[i]; if (!o) return;
    RF.lock = true; const bs = $$('#rfOpts .opt');
    if (o.ok) { RF.score++; RF.combo++; bs[i].classList.add('right'); sfx.ok(); setTimeout(rfNext, RM ? 0 : 200); }
    else { RF.combo = 0; bs[i].classList.add('wrong'); bs[RF.q.opts.findIndex(x => x.ok)].classList.add('right'); sfx.bad(); setTimeout(rfNext, 1200); }
    el.rfScore.textContent = RF.score; el.rfCombo.textContent = RF.combo >= 3 ? `reeks ${RF.combo}` : '';
  }
  function stopReflex() { if (RF) { clearInterval(RF.iv); RF = null; } }
  function rfEnd() {
    const s = RF.score, rec = s > store.best; stopReflex();
    if (rec) store.best = s; store.xp += s * 3; dayStreak(); save(); sfx.win();
    showResult({ eyebrow: 'RX · Reflextest', title: rec ? 'Nieuw record' : 'Tijd om', stars: 0, facts: [['Goed', String(s)], ['Record', String(store.best)], ['XP verdiend', `+${s * 3}`]], tip: 'Snel herkennen welke formule je nodig hebt scheelt op de toets veel tijd.', again: startReflex, next: null });
  }

  /* ---------- spiekbrief ---------- */
  function openSheet(title, html) { el.sheetTitle.textContent = title; el.sheetBody.innerHTML = html; el.sheet.hidden = false; el.sheet.firstElementChild.scrollTop = 0; }
  const cheat = () => openSheet('Spiekbrief', MISSIONS.map(m => `<h3>${m.code} · ${m.sub}</h3><div class="prose">${m.sheet.join('')}</div>`).join(''));

  /* ---------- bediening ---------- */
  el.pad.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', ',', '/', '√', '⌫'].map(k => `<button type="button" data-k="${k}"${/\d/.test(k) ? '' : ' class="fn"'}${k === '⌫' ? ' aria-label="Wissen"' : ''}>${k}</button>`).join('');
  el.pad.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) key(b.dataset.k); });
  el.step.addEventListener('click', e => { const b = e.target.closest('.slot'); if (b && R && R.phase === 'answer') { R.active = +b.dataset.i; paintSlots(); } });
  el.choices.addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) onOpt(+b.dataset.i); });
  el.rfOpts.addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) rfPick(+b.dataset.i); });
  el.go.addEventListener('click', onGo); el.hintBtn.addEventListener('click', onHint);
  $('#openSheet').addEventListener('click', cheat); $('#sheetBtn').addEventListener('click', cheat);
  $('#sheetClose').addEventListener('click', () => { el.sheet.hidden = true; });
  el.sheet.addEventListener('click', e => { if (e.target === el.sheet) el.sheet.hidden = true; });
  el.soundBtn.addEventListener('click', () => { store.sound = !store.sound; save(); renderHome(); if (store.sound) sfx.ok(); });
  let armReset = 0, armQuit = 0;
  el.resetBtn.addEventListener('click', () => {
    if (Date.now() - armReset < 4000) { Object.assign(store, { xp: 0, stars: {}, best: 0, day: '', streak: 0 }); save(); armReset = 0; el.resetBtn.textContent = 'Voortgang wissen'; renderHome(); return; }
    armReset = Date.now(); el.resetBtn.textContent = 'Zeker weten? Tik nog een keer'; setTimeout(() => { if (armReset) { armReset = 0; el.resetBtn.textContent = 'Voortgang wissen'; } }, 4000);
  });
  el.quit.addEventListener('click', () => {
    if (Date.now() - armQuit < 3000) { armQuit = 0; el.quit.textContent = '✕'; R = null; show('home'); return; }
    armQuit = Date.now(); el.quit.textContent = 'Stoppen?'; setTimeout(() => { armQuit = 0; el.quit.textContent = '✕'; }, 3000);
  });
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-m]'); if (m) return openMission(m.dataset.m);
    if (e.target.closest('[data-x="reflex"]')) return startReflex();
    if (e.target.closest('[data-home]')) { stopReflex(); R = null; show('home'); }
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.sheet.hidden) { if (e.key === 'Escape') el.sheet.hidden = true; return; }
    if (RF && /^[1-4]$/.test(e.key)) return rfPick(+e.key - 1);
    if (!R || $('#play').hidden) return;
    if (e.key === 'Enter') { e.preventDefault(); if (!el.go.hidden) onGo(); return; }
    if (R.phase !== 'answer') return;
    const st = R.st;
    if (st.type === 'choice' && /^[1-4]$/.test(e.key)) return onOpt(+e.key - 1);
    if (st.type !== 'input') return;
    const map = { '-': '−', ',': ',', '.': ',', '/': '/', '+': '+', r: '√', w: '√', s: '√', '(': '(', ')': ')' };
    if (/^\d$/.test(e.key)) key(e.key);
    else if (map[e.key]) key(map[e.key]);
    else if (e.key === 'Backspace') { e.preventDefault(); key('⌫'); }
    else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = st.slots.length; R.active = (R.active + (e.key === 'ArrowLeft' || e.shiftKey ? n - 1 : 1)) % n; paintSlots(); }
  });

  window.__schampschot = { store, field, get R() { return R; }, openMission, startMission, byId, startReflex };
  show('home');
})();
