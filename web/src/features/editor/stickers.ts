/**
 * Built-in sticker & font catalogue for the Gallery editor.
 *
 * Two sticker kinds, both rendered by the SAME canvas code paths in
 * render.ts (so what you see in the editor is what exports):
 *   • emoji  — system emoji glyphs (consistent across categories)
 *   • vector — hand-authored path art (hearts, stars, arrows, shapes,
 *              decorations, frames, labels) tinted with the layer colour
 *
 * Animated stickers (video) pulse/spin at draw time via the layer's anim flag.
 */

export type StickerKind = 'emoji' | 'vector';

export interface StickerDef {
  id: string;
  kind: StickerKind;
  glyph?: string;                 // emoji kind
  /** vector art drawn into a unit box (-0.5..0.5) — scaled by the renderer */
  draw?: (ctx: CanvasRenderingContext2D, color: string) => void;
  label: string;
  animated?: boolean;             // supports the video "animated sticker" toggle
}

export interface StickerCategory { id: string; label: string; icon: string; stickers: StickerDef[] }

/* ── vector art helpers (unit box, centred at 0,0, size 1) ────────────── */

function heart(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, 0.36);
  ctx.bezierCurveTo(-0.55, -0.05, -0.36, -0.45, 0, -0.2);
  ctx.bezierCurveTo(0.36, -0.45, 0.55, -0.05, 0, 0.36);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 0.48 : 0.48 * inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function arrow(ctx: CanvasRenderingContext2D, dir: 'right' | 'left' | 'up' | 'down' | 'curve') {
  ctx.save();
  if (dir === 'left') ctx.rotate(Math.PI);
  if (dir === 'up') ctx.rotate(-Math.PI / 2);
  if (dir === 'down') ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  if (dir === 'curve') {
    ctx.moveTo(-0.45, 0.2);
    ctx.quadraticCurveTo(-0.1, -0.35, 0.3, -0.05);
    ctx.lineWidth = 0.09;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.45, -0.12);
    ctx.lineTo(0.22, -0.28);
    ctx.lineTo(0.28, 0.02);
    ctx.closePath();
  } else {
    ctx.moveTo(-0.45, 0);
    ctx.lineTo(0.2, 0);
    ctx.lineWidth = 0.09;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.48, 0);
    ctx.lineTo(0.16, -0.2);
    ctx.lineTo(0.16, 0.2);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

function burst(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? 0.48 : 0.24;
    const a = (Math.PI / 6) * i;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sparkle4(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -0.5);
  ctx.quadraticCurveTo(0.06, -0.06, 0.5, 0);
  ctx.quadraticCurveTo(0.06, 0.06, 0, 0.5);
  ctx.quadraticCurveTo(-0.06, 0.06, -0.5, 0);
  ctx.quadraticCurveTo(-0.06, -0.06, 0, -0.5);
  ctx.closePath();
}

function ring(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
  ctx.lineWidth = 0.09;
  ctx.stroke();
}

function tri(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -0.45);
  ctx.lineTo(0.42, 0.32);
  ctx.lineTo(-0.42, 0.32);
  ctx.closePath();
}

function diamond(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -0.48);
  ctx.lineTo(0.32, 0);
  ctx.lineTo(0, 0.48);
  ctx.lineTo(-0.32, 0);
  ctx.closePath();
}

function speech(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-0.45, -0.3);
  ctx.quadraticCurveTo(-0.45, -0.42, -0.3, -0.42);
  ctx.lineTo(0.3, -0.42);
  ctx.quadraticCurveTo(0.45, -0.42, 0.45, -0.3);
  ctx.lineTo(0.45, 0.12);
  ctx.quadraticCurveTo(0.45, 0.24, 0.3, 0.24);
  ctx.lineTo(-0.05, 0.24);
  ctx.lineTo(-0.2, 0.46);
  ctx.lineTo(-0.18, 0.24);
  ctx.lineTo(-0.3, 0.24);
  ctx.quadraticCurveTo(-0.45, 0.24, -0.45, 0.12);
  ctx.closePath();
}

function leaf(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-0.42, 0.42);
  ctx.quadraticCurveTo(-0.5, -0.35, 0.42, -0.42);
  ctx.quadraticCurveTo(0.5, 0.35, -0.42, 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.36, 0.36);
  ctx.lineTo(0.3, -0.3);
  ctx.lineWidth = 0.045;
  ctx.stroke();
}

function banner(text: string, base: string): (c: CanvasRenderingContext2D, color: string) => void {
  return (c, color) => {
    const fill = color && color !== '#ffffff' ? color : base;
    c.beginPath();
    const w = 0.5, h = 0.19;
    c.moveTo(-w, -h);
    c.lineTo(w, -h);
    c.lineTo(w - 0.08, 0);
    c.lineTo(w, h);
    c.lineTo(-w, h);
    c.lineTo(-w + 0.08, 0);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.fillStyle = '#fff';
    c.font = `700 ${h * 0.9}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, 0.012);
  };
}

function corners(ctx: CanvasRenderingContext2D) {
  const s = 0.46, l = 0.16;
  ctx.lineWidth = 0.05;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx * s, sy * s - sy * l);
    ctx.lineTo(sx * s, sy * s);
    ctx.lineTo(sx * s - sx * l, sy * s);
    ctx.stroke();
  }
}

function confetti(ctx: CanvasRenderingContext2D, color: string) {
  const bits: Array<[number, number, number, string]> = [
    [-0.3, -0.3, 0.35, color],
    [0.25, -0.35, -0.5, '#ffcc4d'],
    [0.35, 0.15, 0.8, '#4dc9ff'],
    [-0.35, 0.25, -0.2, '#ff7d97'],
    [0.02, 0.35, 0.45, '#7dff9b'],
    [-0.05, -0.05, 0.1, '#ffffff'],
  ];
  for (const [x, y, r, c] of bits) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    ctx.fillStyle = c;
    ctx.fillRect(-0.055, -0.028, 0.11, 0.056);
    ctx.restore();
  }
  ctx.fillStyle = color;
}

const v = (id: string, label: string, draw: (ctx: CanvasRenderingContext2D, color: string) => void, animated = false): StickerDef => ({
  id, kind: 'vector', label, draw, animated,
});
const e = (id: string, glyph: string, label: string, animated = false): StickerDef => ({
  id, kind: 'emoji', glyph, label, animated,
});

/* ── the catalogue ────────────────────────────────────────────────────── */

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: 'emojis', label: 'Emojis', icon: 'sticker',
    stickers: [
      e('e-laugh', '😂', 'Laughing', true), e('e-love', '😍', 'Love'), e('e-cool', '😎', 'Cool'),
      e('e-party', '🥳', 'Party', true), e('e-wink', '😉', 'Wink'), e('e-think', '🤔', 'Thinking'),
      e('e-wow', '😮', 'Wow'), e('e-sleep', '😴', 'Sleepy'), e('e-angel', '🥹', 'Touched'),
      e('e-devil', '😈', 'Devil'), e('e-clown', '🤡', 'Clown'), e('e-robot', '🤖', 'Robot'),
    ],
  },
  {
    id: 'cute', label: 'Cute', icon: 'heart',
    stickers: [
      e('c-cat', '🐱', 'Cat'), e('c-dog', '🐶', 'Puppy'), e('c-bunny', '🐰', 'Bunny'),
      e('c-fox', '🦊', 'Fox'), e('c-panda', '🐼', 'Panda'), e('c-uni', '🦄', 'Unicorn', true),
      e('c-chick', '🐥', 'Chick'), e('c-frog', '🐸', 'Frog'), e('c-koala', '🐨', 'Koala'),
      e('c-bear', '🧸', 'Teddy'),
    ],
  },
  {
    id: 'hearts', label: 'Hearts', icon: 'heart',
    stickers: [
      v('h-red', 'Heart', (c, col) => { c.fillStyle = col || '#ff3b5c'; heart(c); c.fill(); }, true),
      e('h-spark', '💖', 'Sparkling heart', true), e('h-fire', '❤️‍🔥', 'Fire heart', true),
      e('h-blue', '💙', 'Blue heart'), e('h-green', '💚', 'Green heart'), e('h-purple', '💜', 'Purple heart'),
      e('h-broken', '💔', 'Broken heart'), e('h-two', '💕', 'Two hearts', true), e('h-gift', '💝', 'Heart gift'),
    ],
  },
  {
    id: 'stars', label: 'Stars', icon: 'star',
    stickers: [
      v('s-gold', 'Star', (c, col) => { c.fillStyle = col || '#ffcc4d'; star(c); c.fill(); }, true),
      v('s-spark', 'Sparkle', (c, col) => { c.fillStyle = col || '#ffffff'; sparkle4(c); c.fill(); }, true),
      v('s-burst', 'Burst', (c, col) => { c.fillStyle = col || '#ff9f43'; burst(c); c.fill(); }, true),
      e('s-glow', '🌟', 'Glowing star', true), e('s-dizzy', '💫', 'Dizzy', true), e('s-shoot', '🌠', 'Shooting star', true),
      e('s-crescent', '🌙', 'Moon'),
    ],
  },
  {
    id: 'nature', label: 'Nature', icon: 'location',
    stickers: [
      v('n-leaf', 'Leaf', (c, col) => { c.fillStyle = col || '#4caf6d'; c.strokeStyle = col || '#2f7a49'; leaf(c); }, true),
      e('n-sun', '☀️', 'Sun', true), e('n-rainbow', '🌈', 'Rainbow'), e('n-flower', '🌸', 'Blossom'),
      e('n-rose', '🌹', 'Rose'), e('n-sunflower', '🌻', 'Sunflower'), e('n-cactus', '🌵', 'Cactus'),
      e('n-wave', '🌊', 'Wave', true), e('n-mountain', '⛰️', 'Mountain'), e('n-tree', '🌳', 'Tree'),
    ],
  },
  {
    id: 'travel', label: 'Travel', icon: 'mapPin',
    stickers: [
      e('t-plane', '✈️', 'Plane', true), e('t-car', '🚗', 'Car'), e('t-train', '🚆', 'Train'),
      e('t-rocket', '🚀', 'Rocket', true), e('t-beach', '🏖️', 'Beach'), e('t-map', '🗺️', 'Map'),
      e('t-compass', '🧭', 'Compass'), e('t-camera', '📷', 'Camera'), e('t-luggage', '🧳', 'Luggage'),
      e('t-pin', '📍', 'Pin'),
    ],
  },
  {
    id: 'food', label: 'Food', icon: 'image',
    stickers: [
      e('f-pizza', '🍕', 'Pizza'), e('f-burger', '🍔', 'Burger'), e('f-cake', '🎂', 'Cake'),
      e('f-icecream', '🍦', 'Ice cream'), e('f-coffee', '☕', 'Coffee', true), e('f-cheers', '🥂', 'Cheers', true),
      e('f-watermelon', '🍉', 'Watermelon'), e('f-avocado', '🥑', 'Avocado'), e('f-sushi', '🍣', 'Sushi'),
      e('f-donut', '🍩', 'Donut'),
    ],
  },
  {
    id: 'celebration', label: 'Celebration', icon: 'sparkle',
    stickers: [
      e('p-party', '🎉', 'Party popper', true), e('p-balloon', '🎈', 'Balloon', true), e('p-gift', '🎁', 'Gift'),
      e('p-crown', '👑', 'Crown', true), e('p-trophy', '🏆', 'Trophy'), e('p-medal', '🥇', 'Gold medal'),
      e('p-fireworks', '🎆', 'Fireworks', true), e('p-candle', '🕯️', 'Candle'),
      v('p-confetti', 'Confetti', confetti, true),
    ],
  },
  {
    id: 'arrows', label: 'Arrows', icon: 'send',
    stickers: [
      v('a-right', 'Arrow →', (c, col) => { c.fillStyle = col || '#ffffff'; c.strokeStyle = col || '#ffffff'; arrow(c, 'right'); }),
      v('a-left', 'Arrow ←', (c, col) => { c.fillStyle = col || '#ffffff'; c.strokeStyle = col || '#ffffff'; arrow(c, 'left'); }),
      v('a-up', 'Arrow ↑', (c, col) => { c.fillStyle = col || '#ffffff'; c.strokeStyle = col || '#ffffff'; arrow(c, 'up'); }),
      v('a-down', 'Arrow ↓', (c, col) => { c.fillStyle = col || '#ffffff'; c.strokeStyle = col || '#ffffff'; arrow(c, 'down'); }),
      v('a-curve', 'Curved', (c, col) => { c.fillStyle = col || '#ffcc4d'; c.strokeStyle = col || '#ffcc4d'; arrow(c, 'curve'); }),
    ],
  },
  {
    id: 'shapes', label: 'Shapes', icon: 'shapes',
    stickers: [
      v('sh-circle', 'Ring', (c, col) => { c.strokeStyle = col || '#ffffff'; ring(c); }),
      v('sh-tri', 'Triangle', (c, col) => { c.fillStyle = col || '#ffffff'; tri(c); c.fill(); }),
      v('sh-diamond', 'Diamond', (c, col) => { c.fillStyle = col || '#4dc9ff'; diamond(c); c.fill(); }),
      v('sh-square', 'Square', (c, col) => { c.fillStyle = col || '#ffffff'; c.fillRect(-0.38, -0.38, 0.76, 0.76); }),
      v('sh-bubble', 'Bubble', (c, col) => { c.fillStyle = col || '#ffffff'; speech(c); c.fill(); }),
    ],
  },
  {
    id: 'decorations', label: 'Decor', icon: 'wand',
    stickers: [
      v('d-sparkle-w', 'Sparkle', (c) => { c.fillStyle = '#ffffff'; sparkle4(c); c.fill(); }, true),
      v('d-sparkle-g', 'Gold sparkle', (c) => { c.fillStyle = '#ffd76a'; sparkle4(c); c.fill(); }, true),
      v('d-ring-g', 'Gold ring', (c) => { c.strokeStyle = '#ffd76a'; ring(c); }),
      v('d-heart-s', 'Mini hearts', (c) => {
        c.fillStyle = '#ff7d97';
        for (const [x, y, s] of [[-0.25, -0.2, 0.5], [0.2, 0.05, 0.7], [-0.05, 0.3, 0.45]] as const) {
          c.save(); c.translate(x, y); c.scale(s, s); heart(c); c.fill(); c.restore();
        }
      }, true),
      e('d-butterfly', '🦋', 'Butterfly', true), e('d-glitter', '✨', 'Glitter', true),
    ],
  },
  {
    id: 'frames', label: 'Frames', icon: 'crop',
    stickers: [
      v('fr-corners', 'Corners', (c, col) => { c.strokeStyle = col || '#ffffff'; corners(c); }),
      v('fr-corners-g', 'Gold corners', (c) => { c.strokeStyle = '#ffd76a'; corners(c); }),
      v('fr-box', 'Box', (c, col) => { c.strokeStyle = col || '#ffffff'; c.lineWidth = 0.045; c.strokeRect(-0.46, -0.46, 0.92, 0.92); }),
      v('fr-circle', 'Circle frame', (c, col) => { c.strokeStyle = col || '#ffffff'; c.lineWidth = 0.045; c.beginPath(); c.arc(0, 0, 0.46, 0, Math.PI * 2); c.stroke(); }),
    ],
  },
  {
    id: 'labels', label: 'Labels', icon: 'tag',
    stickers: [
      v('l-new', 'NEW', banner('NEW', '#ff3b5c')),
      v('l-hot', 'HOT', banner('HOT', '#ff9f43')),
      v('l-love', 'LOVE', banner('LOVE', '#ff5c8a')),
      v('l-wow', 'WOW', banner('WOW', '#4dc9ff')),
      v('l-yay', 'YAY', banner('YAY', '#4caf6d')),
      v('l-top', 'TOP', banner('TOP', '#af52de')),
    ],
  },
];

export const ALL_STICKERS: Map<string, StickerDef> = new Map(
  STICKER_CATEGORIES.flatMap((c) => c.stickers).map((s) => [s.id, s]),
);

export const getSticker = (id: string): StickerDef | undefined => ALL_STICKERS.get(id);

/* ── fonts ────────────────────────────────────────────────────────────── */

export interface FontDef { id: string; label: string; stack: string; weight: number; sample: string }

/**
 * Built-in fonts. Canvas can only render fonts the platform actually has, so
 * each entry is a stack with generic fallbacks — every id renders distinctly
 * on Android, iOS, Windows and macOS without shipping font binaries.
 */
export const FONTS: FontDef[] = [
  { id: 'sans', label: 'Gallery Sans', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', weight: 700, sample: 'Aa' },
  { id: 'serif', label: 'Editorial', stack: 'Georgia, "Times New Roman", serif', weight: 700, sample: 'Aa' },
  { id: 'mono', label: 'Typewriter', stack: '"Courier New", ui-monospace, monospace', weight: 700, sample: 'Aa' },
  { id: 'script', label: 'Handwritten', stack: '"Segoe Script", "Brush Script MT", "Apple Chancery", cursive', weight: 500, sample: 'Aa' },
  { id: 'display', label: 'Poster', stack: 'Impact, "Arial Black", "Haettenschweiler", fantasy', weight: 400, sample: 'Aa' },
  { id: 'round', label: 'Rounded', stack: '"Trebuchet MS", "Comic Sans MS", ui-rounded, sans-serif', weight: 700, sample: 'Aa' },
];

export const getFont = (id: string): FontDef => FONTS.find((f) => f.id === id) ?? FONTS[0];

/* ── sticker colour palette ───────────────────────────────────────────── */

export const STICKER_COLORS = ['#ffffff', '#ff3b5c', '#ff9f43', '#ffcc4d', '#4caf6d', '#4dc9ff', '#af52de', '#ff5c8a', '#111111'];
