/*
 * [INPUT]: an image File chosen by the card creator
 * [OUTPUT]: window.RoastPixelate(file) -> Promise<sprite> in the { w, h, p, d } format from demo.js
 * [POS]: maker-only. Runs entirely in the browser; the photo is never uploaded anywhere
 * [PROTOCOL]: output must stay within normalizePhoto() limits in engine.js (<= 64px, <= 16 colours)
 *
 * Steps: centre-crop to a square, shrink in halves (keeps detail), then k-means down to 16 colours.
 * 32x32 at 16 colours is about 1 KB, small enough to ride inside a link.
 */
(function () {
  const SIZE = 32;
  const COLORS = 16;

  async function loadImage(file) {
    if (window.createImageBitmap) return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function shrink(img) {
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 3; // nudge the crop up a bit: faces tend to sit above centre
    let cur = document.createElement('canvas');
    let size = Math.max(SIZE, Math.min(512, side));
    cur.width = cur.height = size;
    let g = cur.getContext('2d');
    g.fillStyle = '#1a0e36'; // card panel colour behind any transparent pixels
    g.fillRect(0, 0, size, size);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    while (size > SIZE) {
      const next = Math.max(SIZE, Math.floor(size / 2));
      const c2 = document.createElement('canvas');
      c2.width = c2.height = next;
      const g2 = c2.getContext('2d');
      g2.imageSmoothingQuality = 'high';
      g2.drawImage(cur, 0, 0, next, next);
      cur = c2;
      g = g2;
      size = next;
    }
    return g.getImageData(0, 0, SIZE, SIZE).data;
  }

  function quantize(data) {
    const px = [];
    for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]]);
    const lum = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    const sorted = px.slice().sort((a, b) => lum(a) - lum(b));
    let cents = [];
    for (let k = 0; k < COLORS; k++) cents.push(sorted[Math.floor((k + 0.5) * sorted.length / COLORS)].slice());
    const assign = new Array(px.length).fill(0);
    for (let iter = 0; iter < 10; iter++) {
      px.forEach((c, i) => {
        let best = 0, bestD = Infinity;
        cents.forEach((m, k) => {
          const d = (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2;
          if (d < bestD) { bestD = d; best = k; }
        });
        assign[i] = best;
      });
      const sums = cents.map(() => [0, 0, 0, 0]);
      px.forEach((c, i) => { const s = sums[assign[i]]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; s[3]++; });
      cents = cents.map((m, k) => sums[k][3] ? sums[k].slice(0, 3).map(v => Math.round(v / sums[k][3])) : m);
    }
    const hex = c => c.map(v => v.toString(16).padStart(2, '0')).join('');
    return { w: SIZE, h: SIZE, p: cents.map(hex), d: assign.map(k => k.toString(16)).join('') };
  }

  window.RoastPixelate = async function (file) {
    return quantize(shrink(await loadImage(file)));
  };
})();
