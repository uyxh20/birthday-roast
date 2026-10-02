/*
 * [INPUT]: the real src/ files, loaded into Node with a tiny fake browser global
 * [OUTPUT]: node:test results. Run with: node --test
 * [POS]: regression net for the content layer (packs + templating + link codec). No dependencies
 * [PROTOCOL]: if you add a pack or a token, these sweeps cover it automatically
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the browser scripts as-is. engine.js only boots when a #app element exists, so a stub document is enough.
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.addEventListener = () => {};
for (const f of ['packs', 'demo', 'codec', 'engine']) {
  vm.runInThisContext(readFileSync(new URL(`../src/${f}.js`, import.meta.url), 'utf8'), { filename: `${f}.js` });
}
const { normalize, buildCtx, fill, resolvePack } = window.RoastCard;

function leaves(obj, path = '', out = []) {
  if (typeof obj === 'string') out.push([path, obj]);
  else if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) leaves(obj[k], path ? `${path}.${k}` : k, out);
  return out;
}

test('every line in every pack fills completely for every pronoun set', () => {
  for (const pack of Object.keys(window.ROAST_PACKS)) {
    for (const pronouns of Object.keys(window.ROAST_PRONOUNS)) {
      const cfg = normalize({ ...window.ROAST_DEMO, pack, pronouns });
      const ctx = buildCtx(cfg);
      for (const [path, line] of leaves(resolvePack(cfg))) {
        assert.doesNotMatch(fill(line, ctx), /[{}]/, `${pack}/${pronouns} ${path} has an unfilled tag`);
      }
    }
  }
});

// Regression: "{They} always know." rendered as "He always know." Found in pre-QA sweep, 2026-10-02.
test('present-tense verbs after {They} carry the {s} agreement tag', () => {
  const safe = /^(will|would|can|could|said|noticed|knew|remembered|told|pretended|\{is\}|\{has\}|\{was\})$/;
  for (const pack of Object.values(window.ROAST_PACKS)) {
    for (const [path, line] of leaves(pack)) {
      for (const m of line.matchAll(/\{They\} (?:always |also |never )?([a-z{}]+)/gi)) {
        const verb = m[1];
        if (safe.test(verb)) continue;
        assert.match(verb, /\{s\}$/i, `${pack.id} ${path}: "${m[0]}" needs {s}`);
      }
    }
  }
});

test('token case follows the tag case', () => {
  const ctx = buildCtx(normalize({ name: 'mochi', pronouns: 'he', sign: 'aries' }));
  assert.equal(fill('{name} {Name} {NAME}', ctx), 'mochi Mochi MOCHI');
  assert.equal(fill('{They} know{s}. {THEY} KNOW{S}.', ctx), 'He knows. HE KNOWS.');
  assert.equal(fill('{asign}, {aelement} sign', ctx), 'an Aries, a fire sign');
  assert.equal(fill('{unknown} stays', ctx), '{unknown} stays');
});

test('normalize rejects junk from a hand-crafted link', () => {
  const cfg = normalize({
    name: 42, age: -5, sign: '__proto__', pronouns: 'xe', pack: 'nope', bday: '13-40',
    photo: { w: 2, h: 2, p: ['zzzzzz'], d: '0000' },
    overrides: { 'title.alerts.0': 'ok', 'constructor.prototype.x': 'nope', 'bad key!': 'x' },
    games: { compat: false, quiz: false, excuse: false, drinks: false },
  });
  assert.equal(cfg.name, 'Birthday Human');
  assert.equal(cfg.age, 30);
  assert.equal(cfg.sign, 'aries');
  assert.equal(cfg.pronouns, 'they');
  assert.equal(cfg.pack, 'dating');
  assert.equal(cfg.bday, '');
  assert.equal(cfg.photo, null);
  assert.ok(Object.values(cfg.games).every(Boolean), 'a card with zero games falls back to all games');
  const pack = resolvePack(cfg);
  assert.equal(pack.title.alerts[0], 'ok');
  assert.equal(({}).x, undefined, 'overrides cannot reach Object.prototype');
});

test('a config survives the link round trip', async () => {
  const cfg = normalize(window.ROAST_DEMO);
  const code = await window.RoastCodec.encode(cfg);
  assert.match(code, /^[zj][A-Za-z0-9_-]+$/, 'link code is URL-safe');
  assert.deepEqual(await window.RoastCodec.decode(code), cfg);
});
