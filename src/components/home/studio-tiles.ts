import * as THREE from "three";

/*
 * The room is clad in large-format dark stone panels: every surface uses the
 * same procedural cladding, worked out per pixel from world position. Nothing
 * here adds light. Recessed joints, eased arrises, a slight crown and tilt per
 * panel and a faint stone grain only change the normal, roughness and albedo,
 * and the cladding barely takes the ambient fill, so the wall stays in the
 * dark until the bulb or the cursor light rakes across it.
 */

/**
 * The setting-out, on a 600 mm module. Courses run up from the floor (and out
 * from the wall across the floor, so joints carry on round the corner); each
 * course is cut into its own run of panels and shifted, so no joint lines up
 * with a near miss in the course next to it, and the pattern repeats only
 * every 16.8 m across and 8.4 m up, wider and taller than any view of it.
 */
const COURSES = [1.5, 1.2, 1.65, 1.35, 1.5, 1.2];
const RUNS: { shift: number; widths: number[] }[] = [
  { shift: 7.8, widths: [3.6, 3.0, 2.4, 3.6, 4.2] },
  { shift: 1.8, widths: [4.2, 3.6, 4.2, 4.8] },
  { shift: 6.6, widths: [4.8, 3.6, 4.8, 3.6] },
  { shift: 10.2, widths: [3.0, 4.2, 3.0, 1.8, 4.8] },
  { shift: 15.0, widths: [4.2, 4.8, 4.2, 3.6] },
  { shift: 1.2, widths: [2.4, 4.8, 1.8, 3.0, 4.8] },
];
const RUN = 16.8;
const MAX = 5;

const glslFloats = (v: number[]) => v.map((x) => x.toFixed(2)).join(", ");
const LAYOUT = /* glsl */ `
const float PANEL_RUN = ${RUN.toFixed(2)};
const float PANEL_RISE = ${COURSES.reduce((a, b) => a + b, 0).toFixed(2)};
const float COURSE_H[${COURSES.length}] = float[](${glslFloats(COURSES)});
const float COURSE_SHIFT[${COURSES.length}] = float[](${glslFloats(RUNS.map((r) => r.shift))});
const int COURSE_N[${COURSES.length}] = int[](${RUNS.map((r) => r.widths.length).join(", ")});
const float PANEL_W[${COURSES.length * MAX}] = float[](${glslFloats(
  RUNS.flatMap((r) => [...r.widths, ...Array(MAX - r.widths.length).fill(0)]),
)});
`;

const TILE_CHUNK = /* glsl */ `
varying vec3 vRoomPos;
varying vec3 vRoomNormal;
uniform vec2 uRoomOrigin; // x: wall plane z, y: floor height
${LAYOUT}

float tl_hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// value noise with its analytic gradient: x value, yz derivative
vec3 tl_noised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = tl_hash(i), b = tl_hash(i + vec2(1, 0)), c = tl_hash(i + vec2(0, 1)), d = tl_hash(i + vec2(1, 1));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}

// the panel under p: its size, p from its lower-left corner, and an id for its own cut of stone
void panelAt(vec2 p, out vec2 size, out vec2 l, out vec2 id) {
  float rise = floor(p.y / PANEL_RISE);
  float y = p.y - rise * PANEL_RISE;
  int k = 0;
  float y0 = 0.0;
  for (int i = 0; i < ${COURSES.length - 1}; i++) {
    if (y < y0 + COURSE_H[k]) break;
    y0 += COURSE_H[k];
    k++;
  }
  float xs = p.x - COURSE_SHIFT[k];
  float run = floor(xs / PANEL_RUN);
  float x = xs - run * PANEL_RUN;
  int j = 0;
  float x0 = 0.0;
  for (int i = 0; i < ${MAX - 1}; i++) {
    if (j == COURSE_N[k] - 1 || x < x0 + PANEL_W[k * ${MAX} + j]) break;
    x0 += PANEL_W[k * ${MAX} + j];
    j++;
  }
  size = vec2(PANEL_W[k * ${MAX} + j], COURSE_H[k]);
  l = clamp(vec2(x - x0, y - y0), vec2(0.0), size);
  id = vec2(run * 8.0 + float(j), rise * 8.0 + float(k));
}

struct Tile {
  vec2 grad;   // height gradient along the surface (u, v)
  float joint; // 1 in the recessed joint
  float bevel; // 1 on the eased edge
  float wear;  // chipped, polished-off arrises
  float tone;  // albedo multiplier
  float rough; // roughness offset
};

Tile tileSurface(vec2 p) {
  Tile t;
  vec2 size, l, id;
  panelAt(p, size, l, id);
  vec2 d = min(l, size - l);                    // distance to the nearest joint, per axis
  vec2 inward = sign(size * 0.5 - l);           // the face rises moving away from the joint
  vec2 fw = max(fwidth(p), vec2(1e-5));

  // every panel is cut from a different part of the slab
  float h1 = tl_hash(id + 0.37);
  float h2 = tl_hash(id * 1.71 + 5.1);
  float h3 = tl_hash(id * 2.93 + 1.7);
  vec2 off = vec2(h1, h2) * 97.0;

  // hand-set joints run a hair wider or tighter; the arris is eased just enough to catch light
  float J = 0.0038 + 0.0014 * h3; // half joint (7.6 to 10.4 mm)
  const float B = 0.009;          // bevel run
  const float H = 0.0027;         // bevel drop
  // joints and bevels are prefiltered: under a pixel they fade instead of sparkling
  vec2 jm = 1.0 - smoothstep(J - fw * 0.5, J + fw * 0.5, d);
  vec2 run = max(vec2(B), fw * 1.6);
  vec2 s = clamp((d - J) / run, 0.0, 1.0);
  vec2 slope = 6.0 * s * (1.0 - s) * H / run;
  t.joint = max(jm.x, jm.y);
  t.bevel = max(4.0 * s.x * (1.0 - s.x) * step(J, d.x), 4.0 * s.y * (1.0 - s.y) * step(J, d.y)) * (1.0 - t.joint);
  t.grad = inward * slope * (1.0 - t.joint);

  // a large panel is never dead flat: a faint crown (about 2 mm) and a slight tilt, so raking
  // light shades each one on its own and the wall reads as separate slabs, not a drawn grid
  vec2 c = (l - size * 0.5) / (size * 0.5);
  t.grad += (-c * 0.0036 / (size * 0.5) + (vec2(h2, h3) - 0.5) * 0.009) * (1.0 - t.joint);

  // stone grain, only as surface relief: two octaves, faded once they fall under a pixel
  float lod = max(fw.x, fw.y);
  vec3 g1 = tl_noised(p * 5.0 + off);
  vec3 g2 = tl_noised(p * 23.0 + off.yx);
  float a1 = 1.0 - smoothstep(0.08, 0.35, lod * 5.0);
  float a2 = 1.0 - smoothstep(0.08, 0.35, lod * 23.0);
  t.grad += (g1.yz * 5.0 * 0.0024 * a1 + g2.yz * 23.0 * 0.0005 * a2) * (1.0 - t.joint);

  // broad clouding in tone and polish: invisible in the dark, it breaks up a passing highlight
  float cloud = tl_noised(p * 0.7 + off * 0.31).x;
  t.tone = 0.94 + 0.08 * h1 + 0.07 * (cloud - 0.5);
  t.rough = (h3 - 0.5) * 0.05 + (cloud - 0.5) * 0.12 + (g1.x - 0.5) * 0.06 * a1;

  // edge wear: short worn runs along the arrises
  float along = (d.x < d.y) ? l.y : l.x;
  float chip = smoothstep(0.62, 0.8, tl_noised(vec2(along * 9.0, h1 * 13.0)).x);
  t.wear = chip * t.bevel;
  return t;
}

// which way the surface runs: floor (x, depth), side of a pilaster (z, height) or wall (x, height)
vec2 roomUV(vec3 pos, vec3 n0, out vec3 T, out vec3 Bt) {
  if (abs(n0.y) > 0.5) { T = vec3(1, 0, 0); Bt = vec3(0, 0, 1); return vec2(pos.x, pos.z - uRoomOrigin.x); }
  if (abs(n0.x) > 0.5) { T = vec3(0, 0, 1); Bt = vec3(0, 1, 0); return vec2(pos.z - uRoomOrigin.x, pos.y - uRoomOrigin.y); }
  T = vec3(1, 0, 0); Bt = vec3(0, 1, 0);
  return vec2(pos.x, pos.y - uRoomOrigin.y);
}
`;

/** Peak wall irradiance (as from the bulb at its closest) above which bulb and cursor light only add a shoulder. */
const KNEE = { start: 1.6, span: 0.9 };
/** How much of the ambient fill the cladding takes: the room stays dark until a light finds it. */
const INDIRECT = 0.4;

type Kind = "wall" | "floor";
export type TileUniforms = { uBulb: { value: THREE.Vector3 }; uBulbLevel: { value: number } };

/**
 * Wall: an opaque stone material. Floor: a transparent layer over the
 * reflector that only draws the joints and bevels (plus the shadow by the
 * wall and the warm light the lit wall throws back down), so the polished
 * floor and its reflections show through between them.
 */
export function tileMaterial(kind: Kind, origin: { wallZ: number; floorY: number }) {
  const wall = kind === "wall";
  const uniforms = {
    uRoomOrigin: { value: new THREE.Vector2(origin.wallZ, origin.floorY) },
    uBulb: { value: new THREE.Vector3(0, 0, 0) },
    uBulbLevel: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({
    color: wall ? "#171513" : "#121110",
    roughness: wall ? 0.68 : 0.7,
    metalness: 0,
    // the environment map is for reflections on brass and glass, not to light the room
    envMapIntensity: 0.03,
    transparent: !wall,
    premultipliedAlpha: !wall,
    depthWrite: wall,
    polygonOffset: !wall,
    polygonOffsetFactor: -2,
  });
  mat.userData.uniforms = uniforms satisfies TileUniforms;

  const color = wall
    ? /* glsl */ `
      diffuseColor.rgb *= tile.tone * mix(1.0, 0.5, tile.joint) * mix(1.0, 1.2, tile.wear);
      // the corner where wall meets floor collects shadow
      diffuseColor.rgb *= mix(0.28, 1.0, smoothstep(0.0, 1.8, vRoomPos.y - uRoomOrigin.y));`
    : /* glsl */ `
      diffuseColor.rgb *= mix(1.0, 0.3, tile.joint) * mix(1.0, 1.25, tile.wear);
      float ao = 1.0 - smoothstep(0.0, 2.2, vRoomPos.z - uRoomOrigin.x);
      // the polished floor shows through everywhere but the joints, the bevels and the shadow by the wall
      diffuseColor.a = max(max(tile.joint * 0.8, tile.bevel * 0.55), ao * 0.65);`;

  // wall: ambient held back, and a soft shoulder so bulb + cursor together never make it bright
  const light = wall
    ? /* glsl */ `
      reflectedLight.indirectDiffuse *= ${INDIRECT.toFixed(2)};
      {
        const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
        float e = dot(reflectedLight.directDiffuse, LUMA) * PI / max(dot(diffuseColor.rgb, LUMA), 1e-5);
        float over = max(e - ${KNEE.start.toFixed(2)}, 0.0);
        float k = over > 0.0 ? (${KNEE.start.toFixed(2)} + over / (1.0 + over / ${KNEE.span.toFixed(2)})) / e : 1.0;
        reflectedLight.directDiffuse *= k;
        reflectedLight.directSpecular *= k;
      }`
    : "";

  // floor: the bulb's pool on the lower wall, thrown back onto the floor in front of it
  const bounce = wall
    ? ""
    : /* glsl */ `
      {
        vec3 w = vec3(vRoomPos.x, uRoomOrigin.y + 0.9, uRoomOrigin.x);
        vec3 toBulb = uBulb - w;
        float r = length(toBulb);
        float onWall = max(toBulb.z, 0.0) / (r * r * r);
        float away = (vRoomPos.z - uRoomOrigin.x) / 1.1;
        // the corner itself stays occluded, so the bounce gathers a little way out from the wall
        vec3 b = vec3(1.0, 0.62, 0.34) * uBulbLevel * onWall * 0.08 * (1.0 - 0.7 * ao) / (1.0 + away * away);
        #ifdef USE_FOG
          b *= 1.0 - fogFactor;
        #endif
        gl_FragColor.rgb += sRGBTransferOETF(vec4(b, 1.0)).rgb;
      }`;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoomPos;\nvarying vec3 vRoomNormal;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vRoomPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRoomNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${TILE_CHUNK}\nuniform vec3 uBulb;\nuniform float uBulbLevel;`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 roomN = normalize(vRoomNormal);
        vec3 roomT, roomB;
        Tile tile = tileSurface(roomUV(vRoomPos, roomN, roomT, roomB));
        ${color}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // the eased arrises are a touch more polished than the face, so they glint as a light passes
        roughnessFactor = clamp(roughnessFactor + tile.rough + tile.joint * 0.25 - tile.bevel * 0.14 + tile.wear * 0.08, 0.3, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(normalize(roomN - roomT * tile.grad.x - roomB * tile.grad.y), 0.0)).xyz);`,
      )
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${light}`)
      .replace("#include <premultiplied_alpha_fragment>", `#include <premultiplied_alpha_fragment>\n${bounce}`);
  };
  return mat;
}
