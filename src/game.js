// ---------- palette ----------
const C = {
  black: '#100c09', outline: '#1a0e08', chalk: '#ece6d6', chalkDim: '#97a59c', yellow: '#f2d34b', cyan: '#5fd3e0', red: '#d8443a',
  bannerBg: '#100c09', panel: '#141a26', panelEdge: '#3a4a66', panelLine: '#26324a', p1: '#f2d34b', p2: '#5fd3e0',
  pinWhite: '#f6f3ec', pinShade: '#b8b2a8', pinRed: '#c8302a', pinRedLight: '#e85a4a',
  shoeA: '#c03a2a', shoeB: '#e8e2d0', sole: '#2a1a14',
};

// ---------- 3x5 pixel font ----------
const FONT = {
'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001',
'5':'111100111001111','6':'111100111101111','7':'111001001010010','8':'111101111101111','9':'111101111001111',
'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111',
'F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010',
'K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010',
'P':'110101110100100','Q':'010101101110011','R':'110101110101101','S':'011100010001110','T':'111010010010010',
'U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010',
'Z':'111001010100111',' ':'000000000000000','-':'000000111000000','!':'010010010000010','.':'000000000000010',
':':'000010000010000','/':'001001010100100','?':'110001010000010',"'":'010010000000000','>':'100010001010100',
'+':'000010111010000','%':'101001010100101','<':'001010100010001'
};
function textWidth(s, sc = 1) { return s.length ? (s.length * 4 - 1) * sc : 0; }
function drawTextOn(c2, s, x, y, color, sc = 1, align = 'left') {
  s = String(s).toUpperCase();
  const w = textWidth(s, sc);
  if (align === 'center') x -= Math.floor(w / 2);
  if (align === 'right') x -= w;
  c2.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
      if (g[r * 3 + c] === '1') c2.fillRect(x + (i * 4 + c) * sc, y + r * sc, sc, sc);
  }
}
const drawText = (s, x, y, color, sc, align) => drawTextOn(ctx, s, x, y, color, sc, align);
const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
function fillCircle(c2, cx, cy, r, col) {
  c2.fillStyle = col;
  if (r < 0.8) { c2.fillRect(Math.round(cx), Math.round(cy), 1, 1); return; }
  const y0 = Math.round(cy - r), y1 = Math.round(cy + r);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, h = r * r - dy * dy; if (h < 0) continue;
    const w = Math.sqrt(h), x0 = Math.round(cx - w), x1 = Math.round(cx + w);
    if (x1 > x0) c2.fillRect(x0, y, x1 - x0, 1); else c2.fillRect(Math.round(cx), y, 1, 1);
  }
}
const hex3 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shadeHex = (h, k) => { const [r, g, b] = hex3(h); const f = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };

// ---------- portraits (the caricatures as 48 x 48 pixel art) ----------
const portraits = [], silhouettes = [];
BOWLERS.forEach((o, i) => {
  const img = new Image();
  img.onload = () => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 48; c.height = 48; return c; };
    const c = mk(); c.getContext('2d').drawImage(img, 0, 0); portraits[i] = c;
    const s = mk(), q = s.getContext('2d'); q.drawImage(img, 0, 0);
    const d = q.getImageData(0, 0, 48, 48);
    for (let k = 0; k < d.data.length; k += 4) if (d.data[k + 3]) { d.data[k] = 46; d.data[k + 1] = 38; d.data[k + 2] = 32; }
    q.putImageData(d, 0, 0); silhouettes[i] = s;
  };
  img.src = PORTRAIT_DATA[o.id];
});

// ---------- bowler sprites, seen from behind (40 x 72, feet at the bottom centre) ----------
const SPR_W = 40, SPR_H = 72, FOOT = 71;
const POSES = ['ready', 'push', 'back', 'slide', 'follow', 'cheer', 'slump'];
function buildSprite(o, pose) {
  const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
  const g = c.getContext('2d');
  const parts = [];   // [kind, ...] drawn in order: everything gets an outline pass first
  const R = (x, y, w, h, col) => parts.push(['r', x, y, w, h, col]);
  const B = (x, y, r, col, col2) => parts.push(['c', x, y, r, col, col2]);
  const L = (x0, y0, x1, y1, t, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) R(Math.round(x0 + (x1 - x0) * i / n - t / 2), Math.round(y0 + (y1 - y0) * i / n), t, 1, col); };
  const low = pose === 'slide' || pose === 'follow' ? 5 : 0;
  const sleeve = o.extra === 'suit' ? o.shirt : o.shirt, cuff = o.extra === 'stripes' ? o.trim : null;
  const arm = (x0, y0, x1, y1) => {   // upper arm in sleeve, forearm in skin (suits keep the sleeve)
    const mx = Math.round(x0 + (x1 - x0) * 0.45), my = Math.round(y0 + (y1 - y0) * 0.45);
    L(x0, y0, mx, my, 4, sleeve);
    L(mx, my, x1, y1, 3, o.extra === 'suit' ? sleeve : o.skin);
    if (o.extra === 'suit') R(x1 - 1, y1, 3, 2, o.skin);
  };
  const ballBehind = pose === 'ready' || pose === 'push';
  // ---- ball held in front (behind the body from our view)
  if (pose === 'ready') B(28, 33, 5, o.ball, o.ball2);
  if (pose === 'push') B(29, 41, 5, o.ball, o.ball2);
  // ---- legs
  const ly = 42 + low;
  if (pose === 'slide' || pose === 'follow') {
    R(13, ly, 7, 16, o.legs); R(14, ly + 16, 6, 6, o.legs);                 // left leg, bent and sliding ahead
    R(12, ly + 21, 9, 3, C.shoeB); R(12, ly + 24, 9, 1, C.sole); R(17, ly + 21, 4, 3, C.shoeA);
    L(24, ly + 2, 7, 67, 6, o.legs);                                          // right leg swept behind to the left
    R(3, 66, 8, 3, C.shoeB); R(3, 69, 8, 1, C.sole); R(3, 66, 3, 3, C.shoeA);
  } else {
    const stepL = pose === 'back' ? 4 : 0, stepR = pose === 'push' ? 4 : 0;
    R(13, ly, 7, 24 - stepL, o.legs); R(21, ly, 7, 24 - stepR, o.legs);
    R(12, 66 - stepL, 8, 4, C.shoeB); R(12, 70 - stepL, 8, 1, C.sole); R(12, 66 - stepL, 3, 4, C.shoeA);
    R(21, 66 - stepR, 8, 4, C.shoeB); R(21, 70 - stepR, 8, 1, C.sole); R(26, 66 - stepR, 3, 4, C.shoeA);
  }
  // ---- arms that are behind or beside the body
  const ty = 18 + low;
  if (pose === 'ready') { arm(10, ty + 2, 12, ty + 15); arm(30, ty + 2, 29, ty + 14); }
  if (pose === 'push') { arm(10, ty + 2, 7, ty + 17); arm(30, ty + 2, 30, ty + 20); }
  if (pose === 'back') { arm(10, ty + 2, 5, ty + 14); }
  if (pose === 'slide') { arm(10, ty + 2, 1, ty + 4); arm(30, ty + 2, 30, ty + 22); }
  if (pose === 'follow') { arm(10, ty + 2, 1, ty + 5); }
  if (pose === 'cheer') { arm(10, ty + 2, 4, ty - 15); arm(30, ty + 2, 36, ty - 15); }
  if (pose === 'slump') { arm(10, ty + 2, 10, ty + 19); arm(30, ty + 2, 30, ty + 19); }
  // ---- torso
  R(10, ty, 21, 6, o.shirt); R(11, ty + 6, 19, 12, o.shirt); R(12, ty + 18, 17, 6, o.shirt);
  R(12, ty + 24, 17, 2, o.legs);
  // ---- head
  const hy = 3 + low + (pose === 'slump' ? 2 : 0);
  R(18, hy + 12, 5, 4, o.skin);                        // neck
  R(15, hy + 1, 11, 12, o.skin); R(16, hy, 9, 1, o.skin); R(16, hy + 13, 9, 1, o.skin);
  R(14, hy + 6, 1, 3, o.skin); R(26, hy + 6, 1, 3, o.skin);   // ears
  // ---- arms in front of the body
  if (pose === 'back') { arm(30, ty + 2, 33, ty + 16); B(33, ty + 20, 6, o.ball, o.ball2); }
  if (pose === 'follow') { arm(30, ty + 2, 33, hy - 3); }
  if (pose === 'slide') B(31, 64, 5, o.ball, o.ball2);
  // outline pass, then fill pass
  for (const p of parts) {
    g.fillStyle = C.outline;
    if (p[0] === 'r') g.fillRect(p[1] - 1, p[2] - 1, p[3] + 2, p[4] + 2); else fillCircle(g, p[1], p[2], p[3] + 1, C.outline);
  }
  for (const p of parts) {
    if (p[0] === 'r') { g.fillStyle = p[5]; g.fillRect(p[1], p[2], p[3], p[4]); }
    else { fillCircle(g, p[1], p[2], p[3], p[5]); fillCircle(g, p[1] + 1, p[2] + 1, p[3] - 1.5, p[5]); fillCircle(g, p[1] + 1.5, p[2] + 1.5, p[3] * 0.55, p[4]); fillCircle(g, p[1] - p[3] * 0.4, p[2] - p[3] * 0.4, 1, '#ffffff'); }
  }
  // ---- details (no outline)
  const D = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // shirt shading and seams
  D(11, ty + 6, 2, 12, o.shirt2); D(28, ty + 6, 2, 12, o.shirt2); D(12, ty + 18, 17, 1, o.shirt2);
  D(12, ty + 23, 17, 1, o.shirt2);
  // collar
  if (o.extra !== 'suit') { D(16, ty - 1, 9, 2, o.shirt2); }
  if (o.extra === 'suit') { D(17, ty - 1, 7, 2, o.trim); D(20, ty + 14, 1, 10, o.shirt2); D(10, ty, 21, 1, o.shirt2); }
  if (o.extra === 'stripes') { D(16, ty - 1, 9, 1, o.trim); }
  if (o.extra === 'lanyard') { D(16, ty - 1, 9, 1, '#c04a8a'); D(15, ty, 1, 1, '#c04a8a'); D(25, ty, 1, 1, '#c04a8a'); }
  if (o.trim && o.id === 'fergus') { D(11, ty + 1, 1, 22, o.trim); D(29, ty + 1, 1, 22, o.trim); }
  if (o.trim && o.id === 'bhups') { /* name badge is on the front */ }
  if (cuff) {
    // the navy bands round the sleeves of the polo
    const bands = { ready: [[8, ty + 7], [30, ty + 7]], push: [[7, ty + 8], [29, ty + 8]], back: [[6, ty + 7], [30, ty + 8]], slide: [[5, ty + 3], [29, ty + 10]], follow: [[5, ty + 3], [30, ty - 2]], cheer: [[6, ty - 6], [32, ty - 6]], slump: [[9, ty + 9], [29, ty + 9]] }[pose];
    bands.forEach(([x, y]) => D(x, y, 4, 1, cuff));
  }
  // hair and head details
  const hs = o.hairStyle, hc = o.hair, hl = hc ? shadeHex(hc, 1.35) : null;
  if (hs === 'short' || hs === 'neat') { D(15, hy, 11, hs === 'neat' ? 9 : 10, hc); D(16, hy - 1, 9, 1, hc); D(14, hy + 2, 1, 4, hc); D(26, hy + 2, 1, 4, hc); D(18, hy + 1, 4, 1, hl); if (hs === 'short') { D(16, hy + 10, 2, 1, hc); D(23, hy + 10, 2, 1, hc); } }
  if (hs === 'mop') { D(14, hy - 1, 13, 11, hc); D(15, hy - 2, 11, 1, hc); D(14, hy + 10, 2, 2, hc); D(17, hy + 10, 2, 1, hc); D(21, hy + 10, 3, 2, hc); D(25, hy + 10, 2, 2, hc); D(17, hy, 5, 1, hl); D(23, hy + 2, 2, 1, hl); }
  if (hs === 'slick') { D(15, hy - 1, 11, 9, hc); D(14, hy + 2, 1, 5, hc); D(26, hy + 2, 1, 5, hc); D(16, hy + 8, 9, 2, shadeHex(hc, 0.75)); D(16, hy + 1, 4, 1, hl); D(21, hy + 2, 3, 1, hl); D(17, hy + 4, 5, 1, hl); D(19, hy + 6, 3, 1, shadeHex(hc, 0.85)); }
  if (hs === 'curly') {
    D(12, hy - 2, 17, 13, hc); D(13, hy - 3, 15, 1, hc); D(11, hy + 1, 1, 8, hc); D(29, hy + 1, 1, 8, hc); D(13, hy + 11, 4, 1, hc); D(19, hy + 11, 3, 1, hc); D(24, hy + 11, 4, 1, hc);
    [[14, hy], [18, hy - 1], [22, hy], [26, hy + 2], [15, hy + 5], [20, hy + 4], [24, hy + 6], [17, hy + 8], [22, hy + 9]].forEach(([x, y]) => D(x, y, 2, 1, '#3a3028'));
  }
  if (hs === 'bald') { D(18, hy + 2, 3, 1, shadeHex(o.skin, 1.5)); D(19, hy + 3, 1, 1, shadeHex(o.skin, 1.5)); D(16, hy + 10, 9, 1, shadeHex(o.skin, 0.8)); }
  if (hs === 'baldtop') { D(14, hy + 5, 13, 5, hc); D(15, hy + 10, 11, 1, hc); D(18, hy + 1, 3, 1, shadeHex(o.skin, 1.2)); }
  if (o.specs) { D(14, hy + 5, 2, 1, '#151515'); D(25, hy + 5, 2, 1, '#151515'); }
  D(17, hy + 13, 7, 1, shadeHex(o.skin, 0.8));   // neck shadow
  return c;
}
const sprites = BOWLERS.map(o => Object.fromEntries(POSES.map(p => [p, buildSprite(o, p)])));
// where the ball sits in each pose, relative to the sprite's top left
const BALL_IN_POSE = { ready: [28, 33], push: [29, 41], back: [33, 38], slide: [31, 64] };
