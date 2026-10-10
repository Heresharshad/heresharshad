import * as THREE from "three";

/* Small procedural textures, computed or drawn once on a canvas. No image downloads. */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/*
 * The noise, the braid and the glow are computed into pixel arrays rather than
 * drawn on a canvas: Safari's fingerprinting protection adds random colour
 * noise to canvas pixels a page reads back (a texture upload is a read), which
 * showed on iPhones as red and green specks in the bulb's glow.
 */

/** Pixels from a function of (x, y), in canvas orientation: row 0 is the top, as a CanvasTexture would show it. */
function pixelTexture(w: number, h: number, pixel: (x: number, y: number, out: Uint8Array, i: number) => void) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(x, y, data, ((h - 1 - y) * w + x) * 4);
  const tex = new THREE.DataTexture(data, w, h);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Soft grey noise, for roughness variation (fingerprints, uneven polish, concrete). */
export function noiseTexture(size = 128, repeat = 1) {
  // a few broad smudges over fine grain
  const smudges = Array.from({ length: 18 }, () => ({
    x: Math.random() * size,
    y: Math.random() * size,
    r: size * (0.08 + Math.random() * 0.2),
    tone: Math.random() < 0.5 ? 0 : 255,
  }));
  const tex = pixelTexture(size, size, (x, y, out, i) => {
    let v = 150 + Math.random() * 70;
    for (const s of smudges) {
      const a = 0.12 * clamp01(1 - Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) / s.r);
      v = v * (1 - a) + s.tone * a;
    }
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Diagonal weave for the braided fabric cord (u runs along the cord): light strands every 8 px, a dark seam between. */
export function braidTexture() {
  // perpendicular distance per horizontal pixel for the strands' slope (16 across, 32 down)
  const across = 32 / Math.hypot(16, 32);
  const strand = (s: number, width: number) => {
    const m = ((s % 8) + 8) % 8;
    return clamp01(width / 2 + 0.5 - Math.min(m, 8 - m) * across);
  };
  const tex = pixelTexture(64, 32, (x, y, out, i) => {
    const s = x + 0.5 - (y + 0.5) / 2;
    let v = 0x77;
    const light = strand(s, 3);
    v = v * (1 - light) + 0xcf * light;
    const dark = strand(s - 4, 1);
    v = v * (1 - dark) + 0x3a * dark;
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Radial falloff used for the bulb's glare and haze sprites. */
export function glowTexture() {
  const stops: [number, number][] = [[0, 1], [0.12, 0.55], [0.35, 0.14], [0.7, 0.03], [1, 0]];
  const alpha = (r: number) => {
    for (let k = 1; k < stops.length; k++) {
      const [r1, a1] = stops[k];
      const [r0, a0] = stops[k - 1];
      if (r <= r1) return a0 + ((a1 - a0) * (r - r0)) / (r1 - r0);
    }
    return 0;
  };
  const tex = pixelTexture(128, 128, (x, y, out, i) => {
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = Math.round(255 * alpha(Math.hypot(x + 0.5 - 64, y + 0.5 - 64) / 64));
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A technical annotation drawn like a drafting label: text, optionally with a
 * dimension line and end ticks. Returns the texture and its world aspect.
 */
export function labelTexture(text: string, font: string, opts: { dimension?: boolean } = {}) {
  const px = 44;
  const [probe, pg] = canvas(8, 8);
  void probe;
  pg.font = `500 ${px}px ${font}`;
  const textW = Math.ceil(pg.measureText(text).width);
  const w = opts.dimension ? Math.max(textW + 160, 900) : textW + 24;
  const h = opts.dimension ? 120 : 64;
  const [c, g] = canvas(w, h);
  g.font = `500 ${px}px ${font}`;
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  g.textBaseline = "middle";
  if (opts.dimension) {
    const y = 84;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(4, y);
    g.lineTo(w - 4, y);
    g.moveTo(4, y - 18);
    g.lineTo(4, y + 18);
    g.moveTo(w - 4, y - 18);
    g.lineTo(w - 4, y + 18);
    g.stroke();
    g.textAlign = "center";
    g.fillText(text, w / 2, 34);
  } else {
    g.fillText(text, 12, h / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

/** A small rigging tag: hazard stripes over a load rating block, worn and dim. */
export function tagTexture() {
  const [c, g] = canvas(64, 32);
  g.fillStyle = "#6b5a2c";
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = "#1b1814";
  for (let x = -32; x < 64; x += 10) {
    g.beginPath();
    g.moveTo(x, 12);
    g.lineTo(x + 5, 12);
    g.lineTo(x + 17, 0);
    g.lineTo(x + 12, 0);
    g.fill();
  }
  g.fillRect(0, 12, 64, 2);
  // "SWL" block: three short bars standing in for type at this size
  g.fillStyle = "#2a241b";
  g.fillRect(6, 18, 14, 6);
  g.fillRect(24, 18, 22, 6);
  g.fillRect(6, 26, 30, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A ruler strip for the underside of the beam: long ticks every 4, short ticks between (u runs along the beam). */
export function rulerTexture() {
  const [c, g] = canvas(128, 16);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 16);
  g.fillStyle = "#fff";
  for (let i = 0; i < 16; i++) g.fillRect(i * 8, 0, 1, i % 4 === 0 ? 12 : 5);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
