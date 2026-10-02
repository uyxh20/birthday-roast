# Folder: /src

## Position
Everything the two pages (index.html = maker, card.html = card) run on. Plain browser scripts, no build step.

## Boundary
In: a card config (link hash, injected CARD_CONFIG, or maker postMessage). Out: rendered card, encoded links, a standalone .html download.
Forbidden: network calls with user data, dependencies, writing anywhere except the maker's own localStorage draft.

## Contract
Load order is packs.js → demo.js → codec.js → engine.js (→ pixelate.js → maker.js on the maker only).
Config shape is owned by normalize() in engine.js; links are untrusted and every string is escaped before rendering.
Every pack keeps the same shape, because edited lines are stored by path (e.g. "excuse.crimes.2.list.1").

## Members
- `packs.js`: Content layer (two joke packs, star signs, pronoun sets)
- `demo.js`: Defaults (preset pixel avatars, Mochi the demo friend)
- `codec.js`: Link codec (config <-> "#z..." text)
- `engine.js`: Card runtime (validation, templating, rendering, games)
- `pixelate.js`: Photo -> 32x32 sprite (maker only)
- `maker.js`: Maker UI (form, preview, send, download)
- `card.css`: Card look
- `maker.css`: Maker look

## Trigger
When files are added or removed, or the load order or config contract changes, rewrite this document immediately.
