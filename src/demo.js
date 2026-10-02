/*
 * [INPUT]: nothing; plain data
 * [OUTPUT]: window.ROAST_AVATARS (preset pixel portraits), window.ROAST_DEMO (the made-up demo friend)
 * [POS]: defaults layer. The card shows ROAST_DEMO when a link has no config; the maker starts from it
 * [PROTOCOL]: sprite rows must all be the same width; check src/folder.md if you add a file
 *
 * Sprite format used everywhere (presets, uploaded photos):
 *   { w, h, p: ["rrggbb" | "" (transparent), ...up to 16], d: one hex digit per pixel, row by row }
 */
(function () {
  // Draw a sprite from ASCII art. Each letter maps to a colour; "." is transparent.
  function sprite(colors, rows) {
    const keys = ['.'].concat(Object.keys(colors));
    const p = [''].concat(Object.values(colors));
    const d = rows.join('').split('').map(ch => keys.indexOf(ch).toString(16)).join('');
    return { w: rows[0].length, h: rows.length, p, d };
  }

  const AVATARS = {
    mochi: sprite({ o: '000000', w: 'fff4e6', s: 'e8cdb5', p: 'ff8fab' }, [
      '................',
      '.....oooooo.....',
      '...oowwwwwwoo...',
      '..owwwwwwwwwwo..',
      '.owwwwwwwwwwwwo.',
      '.owwwwwwwwwwwwo.',
      'owwwowwwwwwowwwo',
      'owwwowwwwwwowwwo',
      'owppwwwwwwwwppwo',
      'owwwwwwoowwwwwwo',
      'owwwwwwwwwwwwwwo',
      '.owwwwwwwwwwwwo.',
      '.osswwwwwwwwsso.',
      '..osssssssssso..',
      '...oooooooooo...',
      '................',
    ]),
    cat: sprite({ o: '000000', g: 'f2a65a', d: 'c46a2a', e: '7ee081', p: 'ff8fab' }, [
      '................',
      '..o..........o..',
      '..oo........oo..',
      '..ogo......ogo..',
      '..oggooooooggo..',
      '.oggggggggggggo.',
      '.oggggggggggggo.',
      '.oggeoggggeoggo.',
      '.oggeoggggeoggo.',
      '.opggggppggggpo.',
      '.oggggoggoggggo.',
      '.oggggggggggggo.',
      '..oggggggggggo..',
      '...oddddddddo...',
      '....oooooooo....',
      '................',
    ]),
    frog: sprite({ o: '000000', w: 'ffffff', g: '6cc04a', d: '3f8a2c', p: 'ff8fab', r: 'e52521' }, [
      '................',
      '..ooo......ooo..',
      '.owwwo....owwwo.',
      '.owowo....owowo.',
      '.owwwoooooowwwo.',
      '.oggggggggggggo.',
      'oggggggggggggggo',
      'oggggggggggggggo',
      'ogpggggggggggpgo',
      'oggrrrrrrrrrrggo',
      'ogggrrrrrrrrgggo',
      '.oggggggggggggo.',
      '.odggggggggggdo.',
      '..oddddddddddo..',
      '...oooooooooo...',
      '................',
    ]),
    ghost: sprite({ o: '000000', w: 'f4f4ff', s: 'c9c9e8', k: '1a0e36', p: 'ff8fab' }, [
      '................',
      '.....oooooo.....',
      '...oowwwwwwoo...',
      '..owwwwwwwwwwo..',
      '.owwwwwwwwwwwwo.',
      '.owwkkwwwwkkwwo.',
      '.owwkkwwwwkkwwo.',
      '.owpwwwwwwwwpwo.',
      '.owwwwwkkwwwwwo.',
      '.owwwwwkkwwwwwo.',
      '.owwwwwwwwwwwwo.',
      '.owwwwwwwwwwwwo.',
      '.oswwwwwwwwwwso.',
      '.owwo.owwo.owwo.',
      '..oo...oo...oo..',
      '................',
    ]),
  };

  const DEMO = {
    v: 1,
    name: 'Mochi',
    age: 27,
    bday: '04-02',
    sign: 'aries',
    pronouns: 'they',
    pack: 'dating',
    origin: 'OSAKA / LEEDS',
    fuel: 'iced oat latte',
    food: 'dumplings',
    from: 'THE GROUP CHAT',
    year: 2026,
    photo: 'mochi',
    games: { compat: true, quiz: true, excuse: true, drinks: true },
    overrides: {
      'title.sheet.3.v': 'FOUR HOURS OF SLEEP',
    },
  };

  window.ROAST_AVATARS = AVATARS;
  window.ROAST_DEMO = DEMO;
})();
