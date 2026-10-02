/*
 * [INPUT]: the form in index.html; ROAST_* data (packs.js, demo.js); RoastCard helpers (engine.js);
 *          RoastCodec (codec.js); RoastPixelate (pixelate.js)
 * [OUTPUT]: a live preview (postMessage into the card iframe), a shareable link, a standalone .html download,
 *           and a draft saved in this browser's localStorage
 * [POS]: the maker UI. It only edits a config object; the card engine does all rendering
 * [PROTOCOL]: config shape must match normalize() in engine.js; if you add a field, add it there first
 */
(function () {
  const { normalize, fill, buildCtx, spriteURL, GAMES } = window.RoastCard;
  const SIGNS = window.ROAST_SIGNS, PRONOUNS = window.ROAST_PRONOUNS, PACKS = window.ROAST_PACKS;
  const AVATARS = window.ROAST_AVATARS;
  const DRAFT_KEY = 'birthday-roast-draft-v1';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const $ = id => document.getElementById(id);
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let cfg = loadDraft() || fresh();
  let link = '';
  let customPhoto = cfg.photo && typeof cfg.photo === 'object' ? cfg.photo : null;

  function fresh() {
    const c = clone(window.ROAST_DEMO);
    c.year = new Date().getFullYear();
    return c;
  }

  // Drafts are a convenience only: private windows or blocked storage just start from the demo.
  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------ static fields

  function signFor(m, d) {
    const v = m * 100 + d;
    let best = 'capricorn', bestStart = -1; // Jan 1-19 falls before every start date: Capricorn
    Object.keys(SIGNS).forEach(k => {
      const s = SIGNS[k].start[0] * 100 + SIGNS[k].start[1];
      if (s <= v && s > bestStart) { best = k; bestStart = s; }
    });
    return best;
  }

  function buildStatic() {
    $('bday-month').innerHTML = '<option value="">Month</option>' + MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    $('sign').innerHTML = Object.keys(SIGNS).map(k => `<option value="${k}">${SIGNS[k].symbol} ${SIGNS[k].label}</option>`).join('');
    $('pronouns').innerHTML = Object.keys(PRONOUNS).map(k =>
      `<label class="pill"><input type="radio" name="pronouns" value="${k}"> ${PRONOUNS[k].label}</label>`).join('');
    $('packs').innerHTML = Object.keys(PACKS).map(k =>
      `<label class="pack"><input type="radio" name="pack" value="${k}"><b>${esc(PACKS[k].label.toUpperCase())}</b><span>${esc(PACKS[k].blurb)}</span></label>`).join('');
    renderAvatars();
    $('games').innerHTML = GAMES.map(g =>
      `<label class="check"><input type="checkbox" value="${g}"> <span data-game-name="${g}"></span></label>`).join('');
  }

  function fillDays() {
    const m = +$('bday-month').value;
    const cur = $('bday-day').value;
    const n = m ? DAYS_IN[m - 1] : 31;
    $('bday-day').innerHTML = '<option value="">Day</option>' + Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    if (cur && +cur <= n) $('bday-day').value = cur;
  }

  function renderAvatars() {
    const tiles = Object.keys(AVATARS).map(k =>
      `<button type="button" class="avatar" data-photo="${k}" aria-label="${k} avatar" aria-pressed="false"><img alt="" src="${spriteURL(AVATARS[k])}"></button>`);
    if (customPhoto) tiles.unshift(`<button type="button" class="avatar" data-photo="custom" aria-label="your photo" aria-pressed="false"><img alt="" src="${spriteURL(customPhoto)}"></button>`);
    tiles.unshift('<button type="button" class="avatar" data-photo="upload">UPLOAD<br>PHOTO</button>');
    tiles.push('<button type="button" class="avatar" data-photo="none" aria-pressed="false">NO<br>PHOTO</button>');
    $('avatars').innerHTML = tiles.join('');
  }

  // Push cfg into every control. Called on load, pack switch and reset.
  function syncForm() {
    document.querySelectorAll('[data-field]').forEach(el => { el.value = cfg[el.dataset.field] == null ? '' : cfg[el.dataset.field]; });
    const [m, d] = (cfg.bday || '').split('-').map(Number);
    $('bday-month').value = m || '';
    fillDays();
    $('bday-day').value = d || '';
    document.querySelectorAll('input[name="pronouns"]').forEach(r => { r.checked = r.value === cfg.pronouns; });
    document.querySelectorAll('input[name="pack"]').forEach(r => { r.checked = r.value === cfg.pack; });
    document.querySelectorAll('#games input').forEach(c => { c.checked = !(cfg.games && cfg.games[c.value] === false); });
    syncAvatarState();
    buildLabelFields();
    buildEditor();
    refreshGameNames();
  }

  function syncAvatarState() {
    const cur = !cfg.photo ? 'none' : typeof cfg.photo === 'string' ? cfg.photo : 'custom';
    document.querySelectorAll('.avatar[data-photo]').forEach(b => {
      if (b.dataset.photo !== 'upload') b.setAttribute('aria-pressed', String(b.dataset.photo === cur));
    });
  }

  function refreshGameNames() {
    const P = PACKS[cfg.pack];
    const ctx = buildCtx(normalize(cfg));
    GAMES.forEach(g => {
      const el = document.querySelector(`[data-game-name="${g}"]`);
      if (el) el.textContent = fill(P[g].title, ctx);
    });
  }

  // ------------------------------------------------------------ editable lines

  function leaves(obj, path, out) {
    if (typeof obj === 'string') out.push(path);
    else if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => leaves(obj[k], path ? path + '.' + k : k, out));
    return out;
  }
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  const WORDS = {
    traits: 'Trait', opts: 'option', diagnoses: 'Diagnosis', questions: 'Question', results: 'Result',
    crimes: 'Crime', list: 'excuse', vibes: 'Vibe', sheet: 'Row', alerts: 'Alert',
    t: 'text', q: 'question', k: 'label', v: 'value', a: 'their drink', b: 'other drink', r2: 'round 2',
    why: 'why', name: 'drink', warn: 'warning', tag: 'tag', verdict: 'verdict', tile: 'button', hud: 'top bar',
    whoA: 'their drink heading', whoB: 'other drink heading', whoR2: 'round 2 heading',
  };
  function humanize(path) {
    const parts = path.split('.').slice(1);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const w = WORDS[parts[i]] || parts[i];
      if (i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) { out.push(w + ' ' + (+parts[i + 1] + 1)); i++; }
      else out.push(w);
    }
    return out.join(' · ');
  }

  function lineRow(path, label, multiline) {
    const def = getPath(PACKS[cfg.pack], path);
    const val = Object.prototype.hasOwnProperty.call(cfg.overrides || {}, path) ? cfg.overrides[path] : def;
    const changed = val !== def;
    const rows = Math.max(1, Math.ceil(def.length / 55));
    const input = multiline && rows > 1
      ? `<textarea data-path="${esc(path)}" rows="${rows}" maxlength="600">${esc(val)}</textarea>`
      : `<input data-path="${esc(path)}" maxlength="600" value="${esc(val)}">`;
    return `<div class="line${changed ? ' changed' : ''}">
      <div class="k"><span>${esc(label)}</span><button type="button" class="undo" data-undo="${esc(path)}"${changed ? '' : ' hidden'}>undo</button></div>
      ${input}</div>`;
  }

  // Section 5: the warning label values and alerts, the most personal lines on the card.
  function buildLabelFields() {
    const t = PACKS[cfg.pack].title;
    $('label-fields').innerHTML =
      t.sheet.map((r, i) => lineRow(`title.sheet.${i}.v`, r.k, false)).join('') +
      t.alerts.map((a, i) => lineRow(`title.alerts.${i}`, 'Alert ' + (i + 1), false)).join('');
  }

  // Section 7: every other line, grouped by screen, built lazily when a group is opened.
  function buildEditor() {
    const P = PACKS[cfg.pack];
    const ctx = buildCtx(normalize(cfg));
    const groups = [
      ['title', 'TITLE SCREEN'], ['dash', 'DASHBOARD'],
      ['compat', fill(P.compat.title, ctx)], ['quiz', fill(P.quiz.title, ctx)],
      ['excuse', fill(P.excuse.title, ctx)], ['drinks', fill(P.drinks.title, ctx)],
    ];
    const skip = /^title\.(sheet\.\d+\.v|alerts\.\d+)$/; // already in section 5
    let total = 0;
    $('editor-groups').innerHTML = groups.map(([key, name]) => {
      const paths = leaves(P[key], key, []).filter(p => !skip.test(p));
      total += paths.length;
      return `<details class="group" data-group="${key}"><summary>${esc(name)} <small>(${paths.length})</small></summary><div class="lines"></div></details>`;
    }).join('');
    $('line-count').textContent = `(${total} lines)`;
    document.querySelectorAll('#editor-groups details').forEach(det => {
      det.addEventListener('toggle', () => {
        const box = det.querySelector('.lines');
        if (!det.open || box.childElementCount) return;
        box.innerHTML = leaves(P[det.dataset.group], det.dataset.group, [])
          .filter(p => !skip.test(p))
          .map(p => lineRow(p, humanize(p), true)).join('');
      });
    });
  }

  function setOverride(path, value) {
    const def = getPath(PACKS[cfg.pack], path);
    cfg.overrides = cfg.overrides || {};
    if (value === def) delete cfg.overrides[path];
    else cfg.overrides[path] = value;
    document.querySelectorAll(`[data-path="${CSS.escape(path)}"]`).forEach(el => {
      const row = el.closest('.line');
      row.classList.toggle('changed', value !== def);
      row.querySelector('.undo').hidden = value === def;
    });
  }

  // ------------------------------------------------------------ preview + link

  let previewTimer, linkTimer;
  function changed() {
    saveDraft();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(sendPreview, 120);
    clearTimeout(linkTimer);
    linkTimer = setTimeout(updateLink, 300);
  }

  function sendPreview() {
    const frame = $('preview');
    if (frame.contentWindow) frame.contentWindow.postMessage({ type: 'roast-preview', config: cfg }, location.origin);
  }

  async function updateLink() {
    const code = await window.RoastCodec.encode(normalize(cfg));
    link = new URL('card.html', location.href).href + '#' + code;
    $('open').href = link;
    const info = $('linkinfo');
    const n = link.length.toLocaleString();
    if (link.length > 2000) {
      info.className = 'linkinfo warn';
      info.textContent = `Link is ${n} characters. Some apps cut long links, so the download is the safer way to send it.`;
    } else {
      info.className = 'linkinfo ok';
      info.textContent = `Link is ${n} characters. Good to send anywhere.`;
    }
  }

  async function copyLink() {
    await updateLink();
    const btn = $('copy');
    try {
      await navigator.clipboard.writeText(link);
      btn.textContent = '✓ COPIED';
    } catch (e) {
      window.prompt('Copy this link:', link);
    }
    setTimeout(() => { btn.textContent = '▶ COPY LINK'; }, 1800);
  }

  // Build one self-contained HTML file: inline the CSS and scripts, then inject the config.
  async function download() {
    const get = async p => {
      const r = await fetch(p);
      if (!r.ok) throw new Error(p + ' ' + r.status);
      return r.text();
    };
    let html = await get('card.html');
    const css = await get('src/card.css');
    html = html.replace('<link rel="stylesheet" href="src/card.css">', () => `<style>\n${css}\n</style>`);
    for (const f of ['packs', 'demo', 'codec', 'engine']) {
      const js = await get(`src/${f}.js`);
      html = html.replace(`<script src="src/${f}.js"></script>`, () => `<script>\n${js}\n</script>`);
    }
    const json = JSON.stringify(normalize(cfg)).replace(/</g, '\\u003c');
    html = html.replace('<script>', () => `<script>window.CARD_CONFIG = ${json};</script>\n<script>`);
    const slug = (cfg.name || 'friend').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'friend';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `birthday-roast-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ------------------------------------------------------------ events

  function wire() {
    const form = $('form');

    form.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.field) {
        cfg[el.dataset.field] = el.dataset.field === 'age' ? parseInt(el.value, 10) || '' : el.value;
        if (el.dataset.field === 'name') refreshGameNames();
        changed();
      } else if (el.dataset.path) {
        setOverride(el.dataset.path, el.value);
        changed();
      }
    });

    form.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'bday-month' || el.id === 'bday-day') {
        if (el.id === 'bday-month') fillDays();
        const m = +$('bday-month').value, d = +$('bday-day').value;
        cfg.bday = m && d ? String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '';
        if (m && d) { cfg.sign = signFor(m, d); $('sign').value = cfg.sign; refreshGameNames(); }
        changed();
      } else if (el.name === 'pronouns') {
        cfg.pronouns = el.value;
        changed();
      } else if (el.name === 'pack') {
        const edits = Object.keys(cfg.overrides || {}).length;
        if (edits && !window.confirm(`Switching packs clears your ${edits} edited line(s). Continue?`)) {
          el.checked = false;
          document.querySelector(`input[name="pack"][value="${cfg.pack}"]`).checked = true;
          return;
        }
        cfg.pack = el.value;
        cfg.overrides = {};
        buildLabelFields();
        buildEditor();
        refreshGameNames();
        changed();
      } else if (el.closest('#games')) {
        const boxes = [...document.querySelectorAll('#games input')];
        if (!boxes.some(b => b.checked)) { el.checked = true; return; } // a card needs at least one game
        cfg.games = Object.fromEntries(boxes.map(b => [b.value, b.checked]));
        changed();
      }
    });

    form.addEventListener('click', e => {
      const undo = e.target.closest('[data-undo]');
      if (undo) {
        const path = undo.dataset.undo;
        const def = getPath(PACKS[cfg.pack], path);
        document.querySelectorAll(`[data-path="${CSS.escape(path)}"]`).forEach(el => { el.value = def; });
        setOverride(path, def);
        changed();
        return;
      }
      const av = e.target.closest('[data-photo]');
      if (!av) return;
      const kind = av.dataset.photo;
      if (kind === 'upload') return $('photo-file').click();
      cfg.photo = kind === 'none' ? null : kind === 'custom' ? customPhoto : kind;
      syncAvatarState();
      changed();
    });

    $('photo-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        customPhoto = await window.RoastPixelate(file);
        cfg.photo = customPhoto;
        renderAvatars();
        syncAvatarState();
        changed();
      } catch (err) {
        window.alert("Couldn't read that image. Try a JPG or PNG.");
      }
    });

    $('reset').addEventListener('click', () => {
      if (!window.confirm('Start over from the Mochi demo? Your current card will be lost.')) return;
      cfg = fresh();
      customPhoto = null;
      renderAvatars();
      syncForm();
      changed();
    });

    $('copy').addEventListener('click', copyLink);
    $('download').addEventListener('click', () => download().catch(() => {
      window.alert('Download needs the page to be served over http(s), e.g. GitHub Pages or a local server.');
    }));
    $('preview').addEventListener('load', sendPreview);
  }

  buildStatic();
  syncForm();
  wire();
  changed();
})();
