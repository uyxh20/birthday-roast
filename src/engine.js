/*
 * [INPUT]: a card config (from window.CARD_CONFIG, the URL hash, or a postMessage from the maker preview),
 *          plus ROAST_PACKS / ROAST_SIGNS / ROAST_PRONOUNS (packs.js), ROAST_AVATARS / ROAST_DEMO (demo.js), RoastCodec (codec.js)
 * [OUTPUT]: renders the whole card into #app; exposes window.RoastCard = { render, normalize, buildCtx, fill, resolvePack, spriteURL, GAMES }
 * [POS]: the card runtime. Pure presentation: it never writes anywhere
 * [PROTOCOL]: links are untrusted input. Every config string goes through normalize() and esc() before touching the DOM
 */
(function () {
  const SIGNS = window.ROAST_SIGNS;
  const PRONOUNS = window.ROAST_PRONOUNS;
  const PACKS = window.ROAST_PACKS;
  const GAMES = ['compat', 'quiz', 'excuse', 'drinks'];
  const HOME = 'https://uyxh20.github.io/birthday-roast/';
  const NB = ' ';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four'];

  // Score bands live here, not in the packs, so edited jokes can't break the maths.
  const COMPAT_BANDS = [
    { min: 4, max: 6, color: '#43b047', bg: '#071a07' },
    { min: 7, max: 10, color: '#fbd000', bg: '#1a1200' },
    { min: 11, max: 15, color: '#e86a17', bg: '#1a0600' },
    { min: 16, max: 20, color: '#e52521', bg: '#1f0000' },
  ];
  const QUIZ_BANDS = [
    { min: 0, max: 5, color: '#43b047' },
    { min: 6, max: 10, color: '#049cd8' },
    { min: 11, max: 15, color: '#e86a17' },
    { min: 16, max: 25, color: '#e52521' },
  ];
  const SCORE_CLASS = { 1: 'ok', 2: 'ok', 3: 'mid', 4: 'bad', 5: 'chaos' };

  // ------------------------------------------------------------ config

  function str(v, max, fallback) {
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback;
  }

  function normalizePhoto(p) {
    if (typeof p === 'string') return window.ROAST_AVATARS[p] ? p : null;
    if (!p || typeof p !== 'object') return null;
    const w = p.w | 0, h = p.h | 0;
    if (w < 1 || h < 1 || w > 64 || h > 64) return null;
    if (!Array.isArray(p.p) || p.p.length > 16 || !p.p.every(c => c === '' || /^[0-9a-f]{6}$/i.test(c))) return null;
    if (typeof p.d !== 'string' || p.d.length !== w * h || !/^[0-9a-f]*$/i.test(p.d)) return null;
    return { w, h, p: p.p.slice(), d: p.d };
  }

  function normalize(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const age = parseInt(c.age, 10);
    const games = {};
    GAMES.forEach(g => { games[g] = !(c.games && c.games[g] === false); });
    if (!GAMES.some(g => games[g])) GAMES.forEach(g => { games[g] = true; });
    const overrides = {};
    if (c.overrides && typeof c.overrides === 'object') {
      Object.keys(c.overrides).forEach(k => {
        const v = c.overrides[k];
        if (/^[a-zA-Z0-9.]{1,60}$/.test(k) && typeof v === 'string') overrides[k] = v.slice(0, 600);
      });
    }
    return {
      v: 1,
      name: str(c.name, 30, 'Birthday Human'),
      age: age > 0 && age < 150 ? age : 30,
      bday: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(c.bday) ? c.bday : '',
      sign: Object.prototype.hasOwnProperty.call(SIGNS, c.sign) ? c.sign : 'aries',
      pronouns: Object.prototype.hasOwnProperty.call(PRONOUNS, c.pronouns) ? c.pronouns : 'they',
      pack: Object.prototype.hasOwnProperty.call(PACKS, c.pack) ? c.pack : 'dating',
      origin: str(c.origin, 40, 'CLASSIFIED'),
      fuel: str(c.fuel, 40, 'iced coffee'),
      food: str(c.food, 40, 'pizza'),
      from: str(c.from, 40, ''),
      year: parseInt(c.year, 10) || new Date().getFullYear(),
      photo: normalizePhoto(c.photo),
      games,
      overrides,
    };
  }

  // ------------------------------------------------------------ templating

  function ordinal(n) {
    const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function withArticle(word) {
    return (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
  }

  function buildCtx(cfg) {
    const sign = SIGNS[cfg.sign];
    const pr = PRONOUNS[cfg.pronouns];
    const n = GAMES.filter(g => cfg.games[g]).length;
    const [m, d] = cfg.bday ? cfg.bday.split('-').map(Number) : sign.start;
    return {
      name: cfg.name,
      age: String(cfg.age),
      ageth: ordinal(cfg.age),
      sign: sign.label,
      asign: withArticle(sign.label),
      symbol: sign.symbol,
      element: sign.element,
      aelement: withArticle(sign.element),
      fuel: cfg.fuel,
      food: cfg.food,
      origin: cfg.origin,
      from: cfg.from,
      bday: MONTHS[m - 1] + ' ' + d,
      year: String(cfg.year),
      tools: n === 1 ? 'one tool stands' : NUM_WORDS[n] + ' tools stand',
      they: pr.they, them: pr.them, their: pr.their, theyre: pr.theyre,
      is: pr.is, has: pr.has, was: pr.was, s: pr.s,
    };
  }

  // {name} -> as typed, {Name} -> Capitalised, {NAME} -> UPPERCASE. Unknown tokens are left alone.
  function fill(text, ctx) {
    return String(text).replace(/\{([A-Za-z]+)\}/g, (match, tok) => {
      const key = tok.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(ctx, key)) return match;
      const val = ctx[key];
      if (tok !== key && tok === tok.toUpperCase()) return val.toUpperCase();
      if (tok[0] !== tok[0].toLowerCase()) return val.charAt(0).toUpperCase() + val.slice(1);
      return val;
    });
  }

  // Copy the pack and swap in the creator's edited lines. Only existing text lines can be replaced.
  function resolvePack(cfg) {
    const pack = JSON.parse(JSON.stringify(PACKS[cfg.pack]));
    const own = Object.prototype.hasOwnProperty;
    Object.keys(cfg.overrides).forEach(path => {
      const keys = path.split('.');
      let node = pack;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!node || typeof node !== 'object' || !own.call(node, keys[i])) return;
        node = node[keys[i]];
      }
      const last = keys[keys.length - 1];
      if (node && own.call(node, last) && typeof node[last] === 'string') node[last] = cfg.overrides[path];
    });
    return pack;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function spriteURL(sp) {
    const cv = document.createElement('canvas');
    cv.width = sp.w;
    cv.height = sp.h;
    const g = cv.getContext('2d');
    const img = g.createImageData(sp.w, sp.h);
    for (let i = 0; i < sp.w * sp.h; i++) {
      const hex = sp.p[parseInt(sp.d[i], 16)];
      if (!hex) continue;
      img.data[i * 4] = parseInt(hex.slice(0, 2), 16);
      img.data[i * 4 + 1] = parseInt(hex.slice(2, 4), 16);
      img.data[i * 4 + 2] = parseInt(hex.slice(4, 6), 16);
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  // ------------------------------------------------------------ render

  function render(raw, opts) {
    opts = opts || {};
    const cfg = normalize(raw);
    const ctx = buildCtx(cfg);
    const P = resolvePack(cfg);
    const sign = SIGNS[cfg.sign];
    const F = s => fill(s, ctx);
    const T = s => esc(F(s)).replace(/\n/g, '<br>');
    const app = document.getElementById('app');
    const active = app.querySelector('.screen.active');
    const keep = opts.keepScreen && active ? active.id : null;

    document.title = '⚠️ WARNING: ' + F(P.title.headline).replace(/\n/g, ' ');

    const toolHud = label => `
      <div class="hud" style="max-width:600px;width:100%">
        <span class="hud-lives">♥ ♥ ♥</span>
        <span class="hud-world">${T(label)}</span>
        <span class="hud-coins">COINS: <span class="coin-count">00</span></span>
      </div>`;
    const toolHead = (title, act) => `
      <div class="tool-head">
        <button class="btn-back" data-act="${act}" data-go="screen-dash">◀ BACK</button>
        <div class="tool-title-txt">${T(title)}</div>
      </div>`;

    // ---- title
    const t = P.title;
    const photo = cfg.photo ? (typeof cfg.photo === 'string' ? window.ROAST_AVATARS[cfg.photo] : cfg.photo) : null;
    const sheetRows = t.sheet.filter(r => (r.k + r.v).trim());
    const alerts = t.alerts.filter(a => a.trim());
    let html = `
    <div class="screen" id="screen-title">
      <div class="title-wrap">
        <div class="badge-warning">${T(t.badge)}</div>
        <div class="title-big">${T(t.headline)}</div>
        <div class="fish-row">${esc(sign.emoji)}</div>
        ${photo ? `<img class="portrait" alt="${esc(F('{NAME}: SUBJECT IN QUESTION'))}" src="${spriteURL(photo)}">` : ''}
        <div class="warning-card">
          <div class="warning-card-head">${T(t.sheetHead)}</div>
          <div class="warning-body">
            ${sheetRows.map(r => `<div class="wrow"><span class="wlabel">${T(r.k)}</span><span class="wval">${T(r.v)}</span></div>`).join('')}
          </div>
        </div>
        ${alerts.length ? `<div class="alerts-box">${alerts.map(a => `<div class="alert-line">${T(a)}</div>`).join('')}</div>` : ''}
        <button class="btn-start" data-go="screen-dash">${T(t.start)}</button>
        <div class="copyright-txt">${T(t.footer)}</div>
      </div>
    </div>`;

    // ---- dashboard
    const d = P.dash;
    const tiles = {
      compat: { icon: sign.symbol, label: P.compat.tile },
      quiz: { icon: '☣', label: P.quiz.tile },
      excuse: { icon: '🔮', label: P.excuse.tile },
      drinks: { icon: '🍹', label: P.drinks.tile },
    };
    html += `
    <div class="screen" id="screen-dash">
      <div class="dash-inner">
        <div class="hud">
          <span class="hud-lives">♥ ♥ ♥ ${NB}LIVES</span>
          <span class="hud-world">${T(d.hud)}</span>
          <span class="hud-coins">COINS: <span class="coin-count">00</span></span>
        </div>
        <div style="width:100%;padding-bottom:4px;"><button class="btn-back" data-go="screen-title">◀ TITLE</button></div>
        <div class="section-head">${T(d.head)}<div class="section-sub">${T(d.sub)}</div></div>
        <div class="intro-text">${T(d.intro)}</div>
        <div class="tool-grid">
          ${GAMES.filter(g => cfg.games[g]).map(g => `
            <div class="tool-block" role="button" tabindex="0" data-go="screen-${g}">
              <div class="tool-icon">${esc(tiles[g].icon)}</div>
              <div class="tool-name">${T(tiles[g].label)}</div>
            </div>`).join('')}
        </div>
        <div class="dash-footer">
          ${T(d.footer)}
          ${cfg.from ? `<div class="dash-from">${T(d.from)}</div>` : ''}
          <div style="margin-top:14px"><a href="${HOME}" target="_blank" rel="noopener" style="color:#665588">MAKE ONE FOR YOUR FRIEND ▶</a></div>
        </div>
      </div>
    </div>`;

    // ---- compat
    const c = P.compat;
    if (cfg.games.compat) html += `
    <div class="screen" id="screen-compat">
      <div class="tool-screen">
        ${toolHud(c.hud)}
        ${toolHead(c.title, 'reset-compat')}
        <div class="hint-txt">${T(c.hint)}</div>
        <div id="compat-form" style="display:flex;flex-direction:column;gap:20px;">
          ${c.traits.map((tr, i) => `
            <div class="trait-category">
              <div class="trait-label">${T(tr.label)}</div>
              <div class="trait-opts">
                ${tr.opts.map((o, j) => `<div class="trait-opt" role="button" tabindex="0" data-trait="${i}" data-opt="${j}">${T(o.t)}</div>`).join('')}
              </div>
            </div>`).join('')}
          <button class="btn-diagnose" id="btn-diagnose" data-act="diagnose">${T(c.diagnose)}</button>
        </div>
        <div class="trait-results" id="trait-results"></div>
        <div class="diag-screen" id="diag-final">
          <div class="diag-title" id="diag-title"></div>
          <div class="diag-score-wrap">
            <div class="diag-score-num" id="diag-num"></div>
            <div class="diag-score-lbl">${T(c.scoreLabel)}</div>
          </div>
          <div class="diag-prognosis" id="diag-prognosis"></div>
          <div class="diag-cert" id="diag-cert">${T(c.cert)}</div>
          <button class="btn-reset-compat" data-act="reset-compat">${T(c.reset)}</button>
        </div>
      </div>
    </div>`;

    // ---- quiz
    const q = P.quiz;
    if (cfg.games.quiz) html += `
    <div class="screen" id="screen-quiz">
      <div class="tool-screen">
        ${toolHud(q.hud)}
        ${toolHead(q.title, 'reset-quiz')}
        <div id="quiz-area">
          <div class="quiz-progress-bar">
            <span id="quiz-progress-txt"></span>
            <div class="progress-dots" id="progress-dots"></div>
          </div>
          <div class="quiz-q-box" id="quiz-q"></div>
          <div class="answers-list" id="quiz-answers"></div>
        </div>
        <div class="quiz-result-panel" id="quiz-result">
          <div class="quiz-result-title" id="quiz-result-title"></div>
          <div class="score-box">
            <div class="score-big" id="quiz-score">00</div>
            <div class="score-lbl">${T(q.scoreLabel)}</div>
          </div>
          <div class="quiz-result-desc" id="quiz-result-desc"></div>
          <button class="btn-play-again" data-act="reset-quiz">${T(q.again)}</button>
        </div>
      </div>
    </div>`;

    // ---- excuses
    const x = P.excuse;
    if (cfg.games.excuse) html += `
    <div class="screen" id="screen-excuse">
      <div class="tool-screen">
        ${toolHud(x.hud)}
        ${toolHead(x.title, '')}
        <div class="hint-txt">${T(x.hint)}</div>
        <div class="situation-grid">
          ${x.crimes.map((cr, i) => `<div class="situation-tile" role="button" tabindex="0" data-crime="${i}">${T(cr.tile)}</div>`).join('')}
        </div>
        <div class="excuse-panel" id="excuse-panel">
          <div class="excuse-crime" id="excuse-crime"></div>
          <div class="excuse-body" id="excuse-body"></div>
          <div class="excuse-cert">${T(x.cert)}</div>
          <button class="btn-another" data-act="another">${T(x.another)}</button>
        </div>
      </div>
    </div>`;

    // ---- drinks
    const k = P.drinks;
    if (cfg.games.drinks) html += `
    <div class="screen" id="screen-drinks">
      <div class="tool-screen">
        ${toolHud(k.hud)}
        ${toolHead(k.title, 'reset-drinks')}
        <div class="hint-txt">${T(k.hint)}</div>
        <div class="vibe-grid">
          ${k.vibes.map((v, i) => `<div class="vibe-tile" role="button" tabindex="0" data-vibe="${i}">${T(v.label)}</div>`).join('')}
        </div>
        <div class="drinks-result" id="drinks-result">
          <div class="drinks-header" id="drinks-vibe-label"></div>
          <div class="drink-card" id="drink-a"></div>
          <div class="drink-card" id="drink-b"></div>
          <div class="drink-card" id="drink-r2"></div>
          <div class="drink-warning" id="drink-warning"></div>
          <button class="btn-new-vibe" data-act="reset-drinks">${T(k.reset)}</button>
        </div>
      </div>
    </div>`;

    app.innerHTML = html;

    // ------------------------------------------------------------ behaviour
    const $ = id => document.getElementById(id);
    const state = { coins: opts.coins || 0, sel: {}, qIndex: 0, qScore: 0, crime: 0, excuseCount: {} };

    function syncCoins() {
      const s = String(state.coins).padStart(2, '0');
      app.querySelectorAll('.coin-count').forEach(el => { el.textContent = s; });
    }
    function addCoin() {
      state.coins = Math.min(state.coins + 1, 99);
      syncCoins();
    }
    function showScreen(id) {
      if (!$(id)) id = 'screen-dash';
      app.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
      window.scrollTo(0, 0);
      syncCoins();
    }

    function resetCompat() {
      if (!cfg.games.compat) return;
      state.sel = {};
      app.querySelectorAll('.trait-opt').forEach(el => el.classList.remove('selected'));
      $('btn-diagnose').classList.remove('visible');
      $('trait-results').classList.remove('visible');
      $('trait-results').innerHTML = '';
      $('diag-final').classList.remove('visible');
      $('compat-form').style.display = 'flex';
    }
    function diagnose() {
      let total = 0;
      let rows = `<div class="trait-results-header">${T(c.reportHead)}</div>`;
      c.traits.forEach((tr, i) => {
        const o = tr.opts[state.sel[i]];
        total += o.score;
        const cls = SCORE_CLASS[o.score] || 'chaos';
        rows += `
          <div class="trait-result-row ${cls}">
            <div class="tr-top">
              <div class="tr-left">
                <div class="tr-cat">${T(tr.label)}</div>
                <div class="tr-choice">▸ ${T(o.t)}</div>
              </div>
              <div class="tr-score ${cls}">${T(o.tag)}</div>
            </div>
            <div class="tr-verdict">${T(o.verdict)}</div>
          </div>`;
      });
      const bandIndex = COMPAT_BANDS.findIndex(b => total >= b.min && total <= b.max);
      const i = bandIndex < 0 ? COMPAT_BANDS.length - 1 : bandIndex;
      const band = COMPAT_BANDS[i];
      const diag = c.diagnoses[i];
      $('compat-form').style.display = 'none';
      $('trait-results').innerHTML = rows;
      $('trait-results').classList.add('visible');
      const fin = $('diag-final');
      fin.style.background = band.bg;
      fin.style.borderColor = band.color;
      $('diag-title').style.color = band.color;
      $('diag-title').textContent = F(diag.title);
      $('diag-num').style.color = band.color;
      $('diag-num').textContent = total;
      $('diag-cert').style.borderColor = band.color;
      $('diag-prognosis').textContent = F(diag.prognosis);
      fin.classList.add('visible');
      setTimeout(() => $('trait-results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      addCoin();
    }

    function loadQ() {
      const n = q.questions.length;
      $('quiz-progress-txt').textContent = 'Q ' + (state.qIndex + 1) + ' / ' + n;
      $('progress-dots').innerHTML = q.questions.map((_, i) =>
        `<div class="dot${i < state.qIndex ? ' done' : i === state.qIndex ? ' active' : ''}"></div>`).join('');
      const cur = q.questions[state.qIndex];
      $('quiz-q').textContent = F(cur.q);
      $('quiz-answers').innerHTML = cur.opts.map((o, j) => `<button class="answer-btn" data-answer="${j}">${T(o.t)}</button>`).join('');
    }
    function answer(j) {
      state.qScore += q.questions[state.qIndex].opts[j].p;
      state.qIndex++;
      addCoin();
      if (state.qIndex < q.questions.length) return loadQ();
      $('quiz-area').style.display = 'none';
      const bandIndex = QUIZ_BANDS.findIndex(b => state.qScore >= b.min && state.qScore <= b.max);
      const i = bandIndex < 0 ? QUIZ_BANDS.length - 1 : bandIndex;
      $('quiz-result-title').textContent = F(q.results[i].title);
      $('quiz-result-title').style.color = QUIZ_BANDS[i].color;
      $('quiz-score').textContent = state.qScore;
      $('quiz-result-desc').textContent = F(q.results[i].desc);
      $('quiz-result').classList.add('visible');
    }
    function resetQuiz() {
      if (!cfg.games.quiz) return;
      state.qIndex = 0;
      state.qScore = 0;
      $('quiz-area').style.display = '';
      $('quiz-result').classList.remove('visible');
      loadQ();
    }

    function excuse(i) {
      state.crime = i;
      const cr = x.crimes[i];
      const list = cr.list.filter(l => l.trim());
      const n = state.excuseCount[i] || 0;
      state.excuseCount[i] = n + 1;
      $('excuse-crime').textContent = F(cr.label);
      $('excuse-body').textContent = list.length ? F(list[n % list.length]) : '';
      $('excuse-panel').classList.add('visible');
      $('excuse-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      addCoin();
    }

    function drinks(i) {
      const v = k.vibes[i];
      const card = (who, dr) => `<div class="drink-who">${T(who)}</div><div class="drink-name">${T(dr.name)}</div><div class="drink-why">${T(dr.why)}</div>`;
      $('drinks-vibe-label').textContent = '★ ' + F(v.label).replace(/\n/g, ' ') + ' ★';
      $('drink-a').innerHTML = card(k.whoA, v.a);
      $('drink-b').innerHTML = card(k.whoB, v.b);
      $('drink-r2').innerHTML = card(k.whoR2, v.r2);
      $('drink-warning').textContent = F(v.warn);
      $('drinks-result').classList.add('visible');
      setTimeout(() => $('drinks-result').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      addCoin();
    }
    function resetDrinks() {
      if (!cfg.games.drinks) return;
      $('drinks-result').classList.remove('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const ACTIONS = {
      'reset-compat': resetCompat,
      'reset-quiz': resetQuiz,
      'reset-drinks': resetDrinks,
      'diagnose': diagnose,
      'another': () => excuse(state.crime),
    };

    app.onclick = e => {
      const el = e.target.closest('[data-go],[data-act],[data-trait],[data-answer],[data-crime],[data-vibe]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.act && ACTIONS[ds.act]) ACTIONS[ds.act]();
      if (ds.go) {
        if (ds.go === 'screen-quiz') resetQuiz();
        showScreen(ds.go);
      }
      if (ds.trait !== undefined) {
        const i = +ds.trait;
        el.parentElement.querySelectorAll('.trait-opt').forEach(o => o.classList.toggle('selected', o === el));
        state.sel[i] = +ds.opt;
        if (Object.keys(state.sel).length === c.traits.length) $('btn-diagnose').classList.add('visible');
        addCoin();
      }
      if (ds.answer !== undefined) answer(+ds.answer);
      if (ds.crime !== undefined) excuse(+ds.crime);
      if (ds.vibe !== undefined) drinks(+ds.vibe);
    };
    app.onkeydown = e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
        e.preventDefault();
        e.target.click();
      }
    };

    if (cfg.games.quiz) loadQ();
    showScreen(keep || 'screen-title');
    if (keep) window.scrollTo(0, opts.scrollY || 0);
    return cfg;
  }

  // ------------------------------------------------------------ boot

  (function buildStars() {
    const box = document.getElementById('stars');
    if (!box) return;
    for (let i = 0; i < 100; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      s.style.opacity = (Math.random() * 0.6 + 0.2).toFixed(2);
      box.appendChild(s);
    }
  })();

  async function boot() {
    let cfg = window.CARD_CONFIG || null;
    const hash = location.hash.slice(1);
    if (!cfg && hash) {
      try {
        cfg = await window.RoastCodec.decode(hash);
      } catch (err) {
        document.getElementById('app').innerHTML = `
          <div class="card-error">THIS CARD LINK IS BROKEN OR GOT CUT OFF.<br><br>
          ASK THE SENDER TO SEND YOU THE DOWNLOADED CARD,<br>OR <a href="${HOME}">MAKE YOUR OWN</a>.</div>`;
        document.title = 'BIRTHDAY ROAST';
        return;
      }
    }
    render(cfg || window.ROAST_DEMO);
  }

  // The maker's live preview sends configs straight in, so typing never has to re-encode a link.
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'roast-preview') return;
    render(e.data.config, { keepScreen: true, scrollY: window.scrollY });
  });
  window.addEventListener('hashchange', boot);

  window.RoastCard = { render, normalize, buildCtx, fill, resolvePack, spriteURL, GAMES };
  // The maker page loads this file for its helpers only; it has no #app to render into.
  if (document.getElementById('app')) boot();
})();
