import * as THREE from "three";

/* Small procedural textures, drawn once on a canvas. No image downloads. */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Soft grey noise, for roughness variation (fingerprints, uneven polish, concrete). */
export function noiseTexture(size = 128, repeat = 1) {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + Math.random() * 70;
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  // a few broad smudges on top
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.08 + Math.random() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() < 0.5 ? "0,0,0" : "255,255,255";
    grad.addColorStop(0, `rgba(${tone},0.12)`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Diagonal weave for the braided fabric cord (u runs along the cord). */
export function braidTexture() {
  const [c, g] = canvas(64, 32);
  g.fillStyle = "#777";
  g.fillRect(0, 0, 64, 32);
  for (let x = -32; x < 96; x += 8) {
    g.strokeStyle = "#cfcfcf";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 16, 32);
    g.stroke();
    g.strokeStyle = "#3a3a3a";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + 4, 0);
    g.lineTo(x + 20, 32);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Radial falloff used for the bulb's glare and haze sprites. */
export function glowTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.12, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.14)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.03)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
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
