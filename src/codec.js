/*
 * [INPUT]: a card config object (encode) or the text after "#" in a card link (decode)
 * [OUTPUT]: window.RoastCodec = { encode, decode }
 * [POS]: shared by the card (reads links) and the maker (writes links)
 * [PROTOCOL]: never change the meaning of an existing prefix; old links must keep working
 *
 * Format: one prefix letter + base64url.
 *   "z" = deflate-raw compressed JSON (normal case)
 *   "j" = plain JSON (fallback for browsers without CompressionStream)
 * The config lives in the URL hash, so it is never sent to any server.
 */
(function () {
  const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  function toB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64url(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function pipe(bytes, transform) {
    const stream = new Blob([bytes]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encode(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (canZip) return 'z' + toB64url(await pipe(raw, new CompressionStream('deflate-raw')));
    return 'j' + toB64url(raw);
  }

  async function decode(str) {
    const kind = str.charAt(0);
    const bytes = fromB64url(str.slice(1));
    let raw;
    if (kind === 'z') {
      if (!canZip) throw new Error('This browser is too old to open compressed cards.');
      raw = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind === 'j') {
      raw = bytes;
    } else {
      throw new Error('Unknown card link format.');
    }
    return JSON.parse(new TextDecoder().decode(raw));
  }

  window.RoastCodec = { encode, decode };
})();
