// Builds the Marchelo Logistics illustration family into public/images/illustrations.
//
//   node scripts/illustrations/build.mjs
//
// Every illustration is composed from the shared primitives below (palette,
// people, parcels, vehicles, organic backgrounds), so proportions, colours and
// line weights stay identical across the set. Edit a primitive here and rebuild
// rather than editing the generated SVG files by hand.
//
// The artwork is original. It borrows only the general flat-vector approach
// (rounded shapes, simple figures, soft backgrounds), not any other company's
// characters, artwork or brand colours.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../public/images/illustrations");

// --- Palette: the site's tokens (ink, logo blue, deeper blue) plus warm neutrals.
const C = {
  ink: "#172030",
  deep: "#1d5fa8", // --primary family (buttons)
  blue: "#1495dc", // the logo blue
  sky: "#7cc4ee",
  pale: "#dcedf9",
  paler: "#eef6fc",
  white: "#ffffff",
  grey: "#c9d4df",
  greyD: "#8796a8",
  card: "#d9a467",
  cardTop: "#e9c290",
  cardSide: "#bd8748",
  tape: "#f4e4c4",
  amber: "#f4b13e",
  green: "#4f9e7b",
  floor: "#c6e0f3",
};
const SKIN = ["#6b4226", "#8d5a3b", "#b97c55", "#efc39d"];
const HAIR = ["#1b1b22", "#3f2a20"];

// --- Helpers
const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${typeof v === "number" ? r1(v) : v}"`)
    .join(" ");
const el = (tag, o, inner) => (inner === undefined ? `<${tag} ${attrs(o)}/>` : `<${tag} ${attrs(o)}>${inner}</${tag}>`);
const rect = (x, y, w, h, fill, extra = {}) => el("rect", { x, y, width: w, height: h, fill, ...extra });
const circle = (cx, cy, r, fill, extra = {}) => el("circle", { cx, cy, r, fill, ...extra });
const ellipse = (cx, cy, rx, ry, fill, extra = {}) => el("ellipse", { cx, cy, rx, ry, fill, ...extra });
const path = (d, fill, extra = {}) => el("path", { d, fill, ...extra });
const poly = (list, fill, extra = {}) => el("polygon", { points: pts(list), fill, ...extra });
const line = (list, stroke, width, extra = {}) =>
  el("polyline", { points: pts(list), fill: "none", stroke, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round", ...extra });
const g = (inner, transform) => (transform ? `<g transform="${transform}">${inner}</g>` : `<g>${inner}</g>`);

// Deterministic pseudo-random numbers, so rebuilding gives identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Soft organic background shape: a jittered ellipse smoothed with Catmull-Rom curves. */
function blob(cx, cy, rx, ry, fill, seed = 1, n = 9, jitter = 0.13) {
  const rand = rng(seed);
  const p = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter + rand() * jitter * 2;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  let d = `M${r1(p[0][0])},${r1(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return path(d + "Z", fill);
}

const shadow = (cx, y, rx) => ellipse(cx, y, rx, rx * 0.07 + 3, C.floor);

// --- People. Local coordinates: feet on y=0, body centred on x=0, ~150 units tall.
const SH_L = [-17, -112];
const SH_R = [17, -112];

function hairBack(style, color) {
  if (style === "afro") return circle(0, -151, 21, color);
  if (style === "long") return rect(-19, -164, 38, 50, color, { rx: 18 });
  if (style === "puffs") return circle(-15, -161, 9, color) + circle(15, -161, 9, color);
  return "";
}
function hairFront(style, color, accent) {
  switch (style) {
    case "short":
    case "long":
    case "puffs":
      return path("M-17,-148 C-17,-169 17,-169 17,-148 C11,-157 -5,-160 -17,-148Z", color);
    case "afro":
      return path("M-17,-150 C-15,-162 15,-162 17,-150 C8,-155 -8,-155 -17,-150Z", color);
    case "bun":
      return circle(0, -166, 8, color) + path("M-17,-148 C-17,-169 17,-169 17,-148 C11,-157 -5,-160 -17,-148Z", color);
    case "wrap":
      return path("M-19,-145 C-21,-170 21,-170 19,-145 C10,-151 -10,-151 -19,-145Z", accent) + circle(11, -168, 7, accent) + path("M-15,-152 C-5,-157 6,-157 16,-152", "none", { stroke: C.white, strokeWidth: 2, strokeLinecap: "round", opacity: 0.6 });
    case "cap":
      return path("M-17,-149 C-17,-170 17,-170 17,-149Z", accent) + rect(4, -152, 22, 5, accent, { rx: 2.5 });
    case "crop":
      return path("M-16.5,-150 C-16,-165 16,-165 16.5,-150 C9,-155 -9,-155 -16.5,-150Z", color);
    default:
      return "";
  }
}

/**
 * person({ skin, hair, hairColor, top, bottom, legs, armL, armR, vest, headset, accent })
 * armL / armR: [elbow, hand] in local coordinates; legs: "stand" | "walk" | "sit" | "hidden".
 */
function person(o) {
  const skin = o.skin ?? SKIN[1];
  const top = o.top ?? C.deep;
  const bottom = o.bottom ?? C.ink;
  const hairColor = o.hairColor ?? HAIR[0];
  const accent = o.accent ?? C.amber;
  const armL = o.armL ?? [[-24, -88], [-24, -64]];
  const armR = o.armR ?? [[24, -88], [24, -64]];
  let s = "";
  // legs
  const legW = 15;
  if (o.legs === "sit") {
    s += line([[-7, -60], [24, -60], [26, -6]], bottom, legW) + line([[7, -60], [36, -60], [38, -6]], bottom, legW);
    s += ellipse(30, -3, 11, 5, C.ink) + ellipse(43, -3, 11, 5, C.ink);
  } else if (o.legs !== "hidden") {
    const feet = o.legs === "walk" ? [[-20, -6], [20, -6]] : [[-10, -6], [10, -6]];
    s += line([[-8, -62], feet[0]], bottom, legW) + line([[8, -62], feet[1]], bottom, legW);
    s += ellipse(feet[0][0] - 2, -3, 11, 5, C.ink) + ellipse(feet[1][0] + 2, -3, 11, 5, C.ink);
  }
  // arm drawn behind the body
  const arm = ([el1, hand], sh) => line([sh, el1, hand], top, 12) + circle(hand[0], hand[1], 6.5, skin);
  if (o.backArm === "L") s += arm(armL, SH_L);
  if (o.backArm === "R") s += arm(armR, SH_R);
  // head behind-hair, neck, torso
  s += hairBack(o.hair, hairColor);
  s += rect(-6, -134, 12, 14, skin, { rx: 4 });
  s += rect(-22, -124, 44, 68, top, { rx: 17 });
  if (o.vest) {
    s += path("M-22,-107 C-22,-118 -16,-124 -8,-124 L-8,-92 L8,-92 L8,-124 C16,-124 22,-118 22,-107 L22,-62 C22,-58 19,-56 15,-56 L-15,-56 C-19,-56 -22,-58 -22,-62Z", C.amber);
    s += rect(-22, -84, 44, 6, C.white, { opacity: 0.85 });
  }
  if (o.collar) s += path("M-8,-124 L0,-114 L8,-124Z", C.white);
  s += circle(0, -147, 16, skin);
  s += hairFront(o.hair, hairColor, accent);
  if (o.headset) {
    s += path("M-17,-146 C-17,-170 17,-170 17,-146", "none", { stroke: C.ink, strokeWidth: 3, strokeLinecap: "round" });
    s += rect(-21, -152, 7, 12, C.ink, { rx: 3 }) + line([[-17, -142], [-12, -132], [-3, -131]], C.ink, 2.5);
  }
  // front arms
  if (o.backArm !== "L") s += arm(armL, SH_L);
  if (o.backArm !== "R") s += arm(armR, SH_R);
  return g(s, `translate(${o.x},${o.y})${o.scale ? ` scale(${o.scale})` : ""}${o.flip ? " scale(-1,1)" : ""}`);
}

// --- Objects
/** Cardboard box, front face at (x, y-h) .. (x+w, y), drawn with a top and a side. */
function box(x, y, w, h, o = {}) {
  const d = o.depth ?? w * 0.28;
  const dy = d * 0.55;
  let s = "";
  s += poly([[x, y - h], [x + d, y - h - dy], [x + w + d, y - h - dy], [x + w, y - h]], o.top ?? C.cardTop);
  s += poly([[x + w, y - h], [x + w + d, y - h - dy], [x + w + d, y - dy], [x + w, y]], o.side ?? C.cardSide);
  s += rect(x, y - h, w, h, o.front ?? C.card);
  if (o.tape !== false) {
    s += poly([[x + w * 0.42, y - h], [x + w * 0.42 + d, y - h - dy], [x + w * 0.58 + d, y - h - dy], [x + w * 0.58, y - h]], C.tape);
    s += rect(x + w * 0.42, y - h, w * 0.16, h * 0.32, C.tape);
  }
  if (o.label) {
    s += rect(x + w * 0.12, y - h * 0.5, w * 0.36, h * 0.3, C.white, { rx: 2 });
    s += rect(x + w * 0.17, y - h * 0.43, w * 0.24, 2.4, C.greyD, { rx: 1.2 }) + rect(x + w * 0.17, y - h * 0.34, w * 0.16, 2.4, C.sky, { rx: 1.2 });
  }
  if (o.arrows) {
    // "this way up" arrows: universal handling mark
    for (const ax of [x + w * 0.72, x + w * 0.84]) s += path(`M${r1(ax)},${r1(y - h * 0.55)} l-3.5,5 h2.2 v6 h2.6 v-6 h2.2Z`, C.ink, { opacity: 0.55 });
  }
  return s;
}

function barrel(x, y, w, h, fill, rib = C.ink) {
  return (
    rect(x, y - h, w, h, fill, { rx: w * 0.14 }) +
    rect(x, y - h * 0.72, w, h * 0.06, rib, { opacity: 0.25 }) +
    rect(x, y - h * 0.32, w, h * 0.06, rib, { opacity: 0.25 }) +
    ellipse(x + w / 2, y - h + 3, w * 0.42, 3.5, C.white, { opacity: 0.35 })
  );
}

/** Shipping container side, with corrugation. */
function container(x, y, w, h, fill, o = {}) {
  let s = rect(x, y - h, w, h, fill, { rx: 3 });
  for (let cx = x + 9; cx < x + w - 4; cx += 9) s += rect(cx, y - h + 5, 2.4, h - 10, C.ink, { opacity: 0.16, rx: 1 });
  s += rect(x, y - h, w, 5, C.ink, { opacity: 0.2 }) + rect(x, y - 5, w, 5, C.ink, { opacity: 0.2 });
  if (o.doors) {
    s += line([[x + w * 0.5, y - h + 5], [x + w * 0.5, y - 5]], C.ink, 2, { opacity: 0.35 });
    for (const dx of [0.4, 0.6]) s += line([[x + w * dx, y - h + 10], [x + w * dx, y - 10]], C.white, 2.2, { opacity: 0.55 });
  }
  return s;
}

function ship(x, y, scale = 1) {
  let s = "";
  s += path("M-6,-26 L206,-26 L188,0 L8,0Z", C.ink);
  s += path("M2,-7 L194,-7 L188,0 L8,0Z", C.deep);
  s += rect(6, -62, 26, 36, C.white, { rx: 2 }) + rect(9, -55, 20, 5, C.ink) + rect(14, -73, 10, 11, C.deep, { rx: 1.5 });
  const cols = [C.blue, C.amber, C.sky, C.deep, C.white, C.blue, C.greyD, C.sky, C.amber, C.deep];
  let i = 0;
  for (let cx = 40; cx < 180; cx += 17.5) {
    const tiers = cx > 160 ? 1 : 2;
    for (let t = 0; t < tiers; t++) {
      s += rect(cx, -38 - t * 12, 16, 11, cols[i++ % cols.length], { rx: 1 });
    }
  }
  return g(s, `translate(${x},${y}) scale(${scale})`);
}

function waves(x, y, w, color = C.sky, width = 3) {
  let d = `M${x},${y}`;
  for (let i = 0; i < w; i += 24) d += ` q6,-5 12,0 t12,0`;
  return path(d, "none", { stroke: color, strokeWidth: width, strokeLinecap: "round" });
}

function plane(x, y, scale = 1) {
  let s = "";
  s += path("M4,-11 L28,-11 L13,-42 L1,-42Z", C.deep); // tail fin
  s += path("M10,-12 L130,-12 C148,-12 162,-6 164,0 C162,6 148,12 130,12 L14,12 C4,12 0,6 0,0 C0,-6 4,-12 10,-12Z", C.white, { stroke: C.grey, strokeWidth: 1.5 });
  s += rect(8, 1, 140, 4, C.blue, { rx: 2 });
  s += path("M140,-7 L152,-7 C156,-6 158,-4 159,-2 L140,-2Z", C.ink);
  for (let wx = 38; wx < 130; wx += 10) s += circle(wx, -4, 2, C.sky);
  s += path("M58,4 L100,4 L74,30 L60,30Z", C.greyD); // wing
  s += rect(68, 14, 26, 11, C.grey, { rx: 5.5 }) + rect(88, 15.5, 6, 8, C.ink, { rx: 3, opacity: 0.4 });
  return g(s, `translate(${x},${y}) scale(${scale})`);
}

/** Air cargo unit load device on a dolly. */
function uld(x, y, w = 48, h = 40, fill = C.grey) {
  let s = path(`M${x},${y - 8} L${x},${y - 8 - h} L${x + w - 14},${y - 8 - h} L${x + w},${y - 8 - h + 14} L${x + w},${y - 8}Z`, fill);
  for (let i = 1; i < 4; i++) s += rect(x + (w / 4) * i - 1, y - 8 - h + 6, 2, h - 10, C.ink, { opacity: 0.12 });
  s += rect(x - 4, y - 10, w + 8, 4, C.ink) + circle(x + 4, y - 3, 3.5, C.ink) + circle(x + w - 4, y - 3, 3.5, C.ink);
  return s;
}

function car(x, y, fill = C.blue, scale = 1) {
  let s = path("M0,-12 C0,-22 6,-26 16,-27 L34,-28 L50,-44 L84,-44 L100,-28 L106,-27 C112,-26 114,-20 114,-12 L114,-8 L0,-8Z", fill);
  s += path("M38,-29 L52,-40 L65,-40 L65,-29Z", C.paler) + path("M70,-29 L70,-40 L82,-40 L95,-29Z", C.paler);
  s += circle(25, -8, 11, C.ink) + circle(25, -8, 4.5, C.grey) + circle(90, -8, 11, C.ink) + circle(90, -8, 4.5, C.grey);
  s += rect(106, -22, 6, 4, C.amber, { rx: 2 });
  return g(s, `translate(${x},${y}) scale(${scale})`);
}

function phone(x, y, w = 22, h = 38, fill = C.ink, screen = C.sky) {
  return rect(x, y, w, h, fill, { rx: 4 }) + rect(x + 2.5, y + 4, w - 5, h - 9, screen, { rx: 2 });
}

/** White "paper" card with soft offset shadow. */
function card(x, y, w, h, inner = "", o = {}) {
  return (
    rect(x + 5, y + 6, w, h, o.shadow ?? C.sky, { rx: 10, opacity: 0.35 }) +
    rect(x, y, w, h, C.white, { rx: 10 }) +
    (o.header ? path(`M${x},${y + 10} a10,10 0 0 1 10,-10 h${w - 20} a10,10 0 0 1 10,10 v${o.header - 10} h-${w}Z`, o.headerFill ?? C.deep) : "") +
    inner
  );
}
const bar = (x, y, w, fill = C.grey, h = 6) => rect(x, y, w, h, fill, { rx: h / 2 });

function tick(cx, cy, r, fill = C.deep) {
  return circle(cx, cy, r, fill) + line([[cx - r * 0.42, cy + 0.5], [cx - r * 0.1, cy + r * 0.35], [cx + r * 0.45, cy - r * 0.35]], C.white, Math.max(1.8, r * 0.28));
}

/** Map pin with its tip at (x, y). */
function pin(x, y, r, fill = C.deep) {
  return (
    path(`M${x},${y} C${r1(x - r * 0.35)},${r1(y - r * 0.9)} ${r1(x - r)},${r1(y - r * 1.25)} ${r1(x - r)},${r1(y - r * 2)} A${r},${r} 0 1 1 ${r1(x + r)},${r1(y - r * 2)} C${r1(x + r)},${r1(y - r * 1.25)} ${r1(x + r * 0.35)},${r1(y - r * 0.9)} ${x},${y}Z`, fill) +
    circle(x, y - r * 2, r * 0.42, C.white)
  );
}

function plant(x, y, s = 1) {
  return g(
    path("M-12,-26 L12,-26 L9,0 L-9,0Z", C.deep) +
      ellipse(-9, -42, 7, 17, C.green, { transform: "rotate(-25 -9 -42)" }) +
      ellipse(9, -44, 7, 18, C.green, { transform: "rotate(22 9 -44)" }) +
      ellipse(0, -52, 7, 20, C.green, { opacity: 0.85 }),
    `translate(${x},${y}) scale(${s})`,
  );
}

/** Small circular flag badge (vertical tricolour). */
function flag(cx, cy, r, colours, star) {
  const id = `f${Math.round(cx)}${Math.round(cy)}`;
  const w = (r * 2) / 3;
  return (
    `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
    g(colours.map((c, i) => rect(cx - r + w * i, cy - r, w + 0.5, r * 2, c)).join("") + (star ? path(star, colours[2] === "#fcd116" ? "#fcd116" : C.white) : ""), undefined).replace("<g>", `<g clip-path="url(#${id})">`) +
    circle(cx, cy, r, "none", { stroke: C.white, strokeWidth: 2.5 })
  );
}
function starPath(cx, cy, R) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.42 : R;
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return "M" + pts(p).replace(/ /g, " L") + "Z";
}

const dashed = (d, color = C.deep, w = 2.5) => path(d, "none", { stroke: color, strokeWidth: w, strokeDasharray: "2 7", strokeLinecap: "round" });

// --- Canvas
function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none">${body}</svg>\n`;
}
const scene = (body) => svg(400, 300, body);
const spot = (body) => svg(240, 180, body);
const G = 262; // scene ground line

// =========================================================================
// Scenes (400 x 300)
// =========================================================================
const SCENES = {};

// Customer describing a shipment on a laptop: the quote request.
SCENES["request-quote"] = scene(
  blob(200, 150, 178, 124, C.pale, 3) +
    circle(338, 58, 20, C.sky, { opacity: 0.45 }) +
    shadow(200, G, 150) +
    // chair
    rect(96, 136, 9, 76, C.deep, { rx: 4.5 }) +
    rect(96, 200, 64, 9, C.deep, { rx: 4.5 }) +
    line([[104, 209], [104, G - 2]], C.ink, 4) +
    line([[152, 209], [152, G - 2]], C.ink, 4) +
    // desk
    rect(178, 182, 150, 9, C.ink, { rx: 4.5 }) +
    line([[190, 191], [190, G - 2]], C.ink, 5) +
    line([[316, 191], [316, G - 2]], C.ink, 5) +
    // laptop (profile)
    rect(196, 177, 56, 5, C.greyD, { rx: 2.5 }) +
    path("M246,177 L262,136 L267,138 L252,177Z", C.ink) +
    person({ x: 130, y: G, legs: "sit", skin: SKIN[0], hair: "puffs", top: C.blue, bottom: C.ink, armL: [[30, -86], [58, -86]], armR: [[34, -84], [64, -84]], backArm: "L" }) +
    // floating form
    card(214, 32, 128, 104, bar(230, 66, 70) + bar(230, 82, 96, C.paler, 12) + bar(230, 102, 96, C.paler, 12) + bar(292, 118, 38, C.deep, 10), { header: 22 }) +
    circle(228, 43, 4, C.white, { opacity: 0.8 }) +
    bar(238, 40, 40, C.white, 6) +
    // parcel waiting by the desk
    box(332, G, 38, 30, { label: true }),
);

// A member of the team reviewing the request at a desk.
SCENES["team-review"] = scene(
  blob(205, 150, 176, 122, C.pale, 7) +
    circle(64, 70, 16, C.amber, { opacity: 0.35 }) +
    shadow(205, G, 150) +
    person({ x: 205, y: G, legs: "hidden", skin: SKIN[2], hair: "short", hairColor: HAIR[1], top: C.deep, collar: true, headset: true, armL: [[-30, -84], [-16, -94]], armR: [[30, -84], [16, -94]] }) +
    // document held up
    g(rect(180, 150, 50, 36, C.white, { rx: 3 }) + bar(187, 158, 30, C.greyD, 4) + bar(187, 167, 36, C.grey, 4) + bar(187, 176, 22, C.grey, 4), "rotate(-4 205 168)") +
    circle(189, 170, 6.5, SKIN[2]) +
    circle(221, 170, 6.5, SKIN[2]) +
    // desk
    rect(88, 206, 236, 10, C.ink, { rx: 5 }) +
    rect(104, 216, 204, G - 216, C.white) +
    rect(104, 216, 204, 6, C.grey) +
    // monitor
    rect(262, 150, 54, 38, C.ink, { rx: 4 }) +
    rect(266, 154, 46, 28, C.sky) +
    bar(271, 160, 26, C.white, 4) +
    bar(271, 168, 34, C.white, 4) +
    rect(285, 188, 8, 18, C.ink) +
    plant(116, 206, 0.7) +
    // checklist card
    card(30, 104, 74, 92, tick(46, 124, 7) + bar(58, 121, 34) + tick(46, 148, 7) + bar(58, 145, 28) + circle(46, 172, 7, "none", { stroke: C.grey, strokeWidth: 2.5 }) + bar(58, 169, 32)),
);

// The customer receives a prepared quote on their phone.
SCENES["quote-received"] = scene(
  blob(195, 152, 176, 122, C.pale, 11) +
    circle(80, 64, 14, C.sky, { opacity: 0.45 }) +
    shadow(150, G, 70) +
    person({ x: 145, y: G, legs: "stand", skin: SKIN[1], hair: "wrap", accent: C.blue, top: C.amber, bottom: C.deep, armL: [[-30, -92], [-40, -132]], armR: [[30, -86], [20, -102]] }) +
    phone(158, 136, 20, 34) +
    dashed("M180,140 C210,120 214,96 236,86") +
    card(238, 40, 120, 150, bar(254, 76, 46) + bar(254, 94, 88, C.paler, 10) + bar(254, 110, 72, C.paler, 10) + bar(254, 126, 80, C.paler, 10) + rect(254, 146, 88, 2, C.grey) + bar(254, 158, 34, C.ink, 8) + bar(306, 158, 36, C.deep, 8), { header: 22 }) +
    bar(252, 48, 44, C.white, 6) +
    tick(352, 46, 15, C.blue),
);

// The customer hands a parcel to a team member at the container.
SCENES["handover"] = scene(
  blob(200, 150, 180, 120, C.pale, 5) +
    shadow(205, G, 160) +
    container(286, G, 140, 136, C.deep, { doors: true }) +
    rect(286, G - 136, 6, 136, C.ink, { opacity: 0.25 }) +
    person({ x: 130, y: G, legs: "walk", skin: SKIN[0], hair: "afro", top: C.blue, bottom: C.ink, armL: [[30, -102], [56, -108]], armR: [[34, -96], [58, -100]], backArm: "L" }) +
    box(176, 172, 40, 34, { label: true, arrows: true }) +
    person({ x: 262, y: G, legs: "stand", skin: SKIN[2], hair: "cap", accent: C.deep, top: C.ink, bottom: C.deep, vest: true, armL: [[-30, -100], [-44, -110]], armR: [[-22, -94], [-42, -100]], backArm: "R" }),
);

// Loading barrels and boxes into a container with a hand truck.
SCENES["container-loading"] = scene(
  blob(200, 152, 182, 120, C.pale, 21) +
    shadow(220, G, 170) +
    // open container: interior and goods
    rect(214, G - 150, 172, 150, C.deep, { rx: 3 }) +
    rect(226, G - 140, 160, 132, C.ink, { opacity: 0.85 }) +
    box(300, G - 8, 34, 30, { tape: false }) +
    box(338, G - 8, 34, 44, { tape: false }) +
    box(312, G - 38, 28, 24, { tape: false }) +
    barrel(244, G - 8, 28, 44, C.blue) +
    rect(214, G - 150, 172, 8, C.ink, { opacity: 0.3 }) +
    // hand truck
    line([[176, 150], [184, 150], [196, G - 8], [222, G - 8]], C.ink, 4.5) +
    circle(192, G - 6, 8, C.ink) +
    circle(192, G - 6, 3, C.grey) +
    barrel(198, G - 12, 26, 46, C.deep) +
    box(196, G - 60, 30, 24, { label: true }) +
    person({ x: 140, y: G, legs: "walk", skin: SKIN[3], hair: "bun", hairColor: HAIR[1], top: C.ink, bottom: C.deep, vest: true, armL: [[22, -100], [40, -112]], armR: [[26, -94], [42, -108]], backArm: "L" }),
);

// Following a shipment on a phone: route, ship and milestone progress.
SCENES["tracking"] = scene(
  blob(200, 150, 180, 122, C.pale, 13) +
    shadow(118, G, 64) +
    person({ x: 116, y: G, legs: "stand", skin: SKIN[1], hair: "crop", top: C.deep, bottom: C.ink, armL: [[-26, -88], [-16, -66]], armR: [[34, -92], [26, -114]] }) +
    phone(132, 126, 22, 36) +
    dashed("M156,128 C176,108 186,96 196,94") +
    card(196, 36, 168, 172,
      rect(208, 50, 144, 104, C.paler, { rx: 8 }) +
        blob(244, 84, 26, 18, C.pale, 2, 7) +
        blob(320, 124, 30, 20, C.pale, 9, 7) +
        dashed("M236,92 C262,70 300,100 322,124", C.deep, 2.5) +
        pin(236, 94, 8, C.blue) +
        pin(322, 128, 8, C.deep) +
        g(path("M-14,-5 L14,-5 L10,3 L-10,3Z", C.ink) + rect(-8, -11, 6, 6, C.amber) + rect(-1, -11, 6, 6, C.blue) + rect(6, -11, 5, 6, C.sky), "translate(282,104)") +
        // milestone progress
        rect(216, 178, 128, 4, C.grey, { rx: 2 }) +
        rect(216, 178, 76, 4, C.deep, { rx: 2 }) +
        circle(218, 180, 7, C.deep) + circle(255, 180, 7, C.deep) + circle(292, 180, 7, C.deep) + circle(342, 180, 7, C.white, { stroke: C.grey, strokeWidth: 3 }) +
        circle(292, 180, 3, C.white),
    ),
);

// Collecting or receiving the parcel at the destination.
SCENES["receive-parcel"] = scene(
  blob(196, 150, 178, 122, C.pale, 17) +
    circle(92, 60, 18, C.amber, { opacity: 0.35 }) +
    shadow(220, G, 140) +
    // doorway
    rect(244, 84, 92, G - 84, C.white, { rx: 4 }) +
    rect(254, 94, 72, G - 94, C.deep, { rx: 3 }) +
    rect(262, 104, 56, 56, C.blue, { rx: 3, opacity: 0.5 }) +
    circle(312, 186, 4, C.amber) +
    rect(236, G - 6, 108, 6, C.grey, { rx: 3 }) +
    plant(360, G, 0.9) +
    person({ x: 180, y: G, legs: "stand", skin: SKIN[0], hair: "long", top: C.amber, bottom: C.deep, armL: [[-30, -96], [-20, -80]], armR: [[30, -96], [20, -80]] }) +
    box(157, 196, 44, 40, { label: true }) +
    circle(161, 184, 6.5, SKIN[0]) +
    circle(199, 184, 6.5, SKIN[0]) +
    line([[136, 134], [126, 126]], C.blue, 3) + line([[132, 150], [120, 148]], C.blue, 3) + line([[228, 130], [238, 122]], C.blue, 3),
);

// A customer talking to a member of the team (in English and French).
SCENES["support-chat"] = scene(
  blob(200, 152, 182, 120, C.pale, 23) +
    shadow(200, G, 150) +
    person({ x: 128, y: G, legs: "stand", skin: SKIN[2], hair: "bun", top: C.blue, bottom: C.ink, armL: [[-26, -88], [-22, -64]], armR: [[30, -96], [44, -110]] }) +
    person({ x: 276, y: G, legs: "stand", skin: SKIN[0], hair: "short", top: C.deep, bottom: C.ink, collar: true, headset: true, armL: [[-30, -92], [-24, -104]], armR: [[24, -88], [22, -64]] }) +
    rect(234, 138, 30, 40, C.ink, { rx: 3 }) +
    rect(237, 141, 24, 34, C.sky, { rx: 2 }) +
    circle(252, 158, 6.5, SKIN[0]) +
    // speech bubbles
    path("M60,40 h96 a12,12 0 0 1 12,12 v34 a12,12 0 0 1 -12,12 h-56 l-14,14 v-14 h-26 a12,12 0 0 1 -12,-12 v-34 a12,12 0 0 1 12,-12Z", C.white) +
    bar(74, 58, 64, C.grey) + bar(74, 74, 44, C.grey) +
    path("M236,26 h104 a12,12 0 0 1 12,12 v34 a12,12 0 0 1 -12,12 h-24 v14 l-14,-14 h-66 a12,12 0 0 1 -12,-12 v-34 a12,12 0 0 1 12,-12Z", C.deep) +
    bar(250, 44, 72, C.sky) + bar(250, 60, 52, C.sky),
);

// Packing a parcel at home.
SCENES["pack-parcel"] = scene(
  blob(200, 150, 180, 122, C.pale, 29) +
    circle(330, 62, 16, C.sky, { opacity: 0.45 }) +
    shadow(200, G, 150) +
    person({ x: 152, y: G, legs: "hidden", skin: SKIN[1], hair: "afro", hairColor: HAIR[0], top: C.amber, armL: [[-24, -84], [8, -66]], armR: [[40, -100], [52, -118]] }) +
    // table
    rect(92, 206, 236, 10, C.ink, { rx: 5 }) +
    line([[108, 216], [108, G - 2]], C.ink, 6) +
    line([[312, 216], [312, G - 2]], C.ink, 6) +
    // open box with flaps
    poly([[190, 146], [176, 126], [206, 126], [214, 146]], C.cardTop) +
    poly([[262, 146], [282, 124], [292, 132], [270, 150]], C.cardSide) +
    box(190, 206, 72, 60, { tape: false }) +
    poly([[190, 146], [262, 146], [254, 138], [198, 138]], C.cardSide) +
    // folded clothes going in
    rect(206, 136, 38, 10, C.blue, { rx: 3 }) +
    rect(210, 128, 32, 9, C.sky, { rx: 3 }) +
    // tape roll in hand
    circle(212, 136, 9, "none", { stroke: C.ink, strokeWidth: 5 }) +
    line([[220, 140], [234, 146]], C.tape, 5) +
    // items waiting on the table
    rect(280, 178, 30, 28, C.deep, { rx: 4 }) + rect(286, 172, 18, 8, C.blue, { rx: 2 }) +
    rect(118, 186, 40, 20, C.green, { rx: 4, opacity: 0.85 }) + rect(122, 180, 32, 8, C.white, { rx: 3 }),
);

// The two-way route: Ireland and Cameroon, by sea and by air.
SCENES["route-map"] = scene(
  blob(200, 150, 186, 132, C.pale, 31) +
    waves(150, 214, 96, C.sky, 2.5) +
    waves(60, 252, 96, C.sky, 2.5) +
    // stylised land masses
    blob(96, 82, 46, 34, C.white, 41, 8, 0.18) +
    blob(306, 214, 56, 42, C.white, 43, 8, 0.18) +
    // routes
    dashed("M112,84 C210,20 300,90 300,196", C.deep, 3) +
    dashed("M290,206 C210,250 110,200 98,96", C.blue, 3) +
    path("M296,180 l4,16 l8,-14Z", C.deep) +
    path("M92,116 l6,-20 l8,18Z", C.blue) +
    plane(176, 30, 0.6) +
    ship(150, 222, 0.38) +
    pin(98, 92, 11, C.deep) +
    pin(304, 210, 11, C.deep) +
    flag(74, 54, 13, ["#169b62", "#ffffff", "#ff883e"]) +
    flag(338, 176, 13, ["#007a5e", "#ce1126", "#fcd116"], starPath(338, 176, 5)),
);

// Sender in one country, family in the other: the people behind every shipment.
SCENES["connections"] = scene(
  blob(200, 156, 184, 118, C.pale, 37) +
    shadow(92, G, 54) +
    shadow(308, G, 54) +
    dashed("M120,120 C170,40 230,40 280,120", C.deep, 3) +
    box(186, 70, 30, 24, { label: true }) +
    person({ x: 92, y: G, legs: "stand", skin: SKIN[1], hair: "short", top: C.deep, bottom: C.ink, armL: [[-26, -88], [-22, -64]], armR: [[30, -100], [40, -126]] }) +
    person({ x: 308, y: G, legs: "stand", skin: SKIN[0], hair: "wrap", accent: C.amber, top: C.blue, bottom: C.deep, armL: [[-30, -100], [-40, -126]], armR: [[26, -88], [22, -64]] }) +
    pin(92, 64, 9, C.blue) +
    pin(308, 64, 9, C.deep),
);

// =========================================================================
// Spot illustrations (240 x 180): services and the shipping guide
// =========================================================================
const SPOTS = {};
const SG = 150; // spot ground line
const spotBg = (seed) => blob(120, 92, 104, 74, C.pale, seed) + shadow(120, SG, 86);

SPOTS["service-parcels"] = spot(
  spotBg(51) + box(64, SG, 54, 44, { label: true }) + box(124, SG, 46, 36, { arrows: true }) + box(78, SG - 44, 40, 30, {}) +
    rect(172, 92, 40, 28, C.white, { rx: 3, transform: "rotate(8 192 106)" }) + path("M172,92 L192,108 L212,92", "none", { stroke: C.grey, strokeWidth: 2, transform: "rotate(8 192 106)" }),
);
SPOTS["service-barrels"] = spot(
  spotBg(53) + barrel(62, SG, 40, 66, C.deep) + barrel(106, SG, 40, 66, C.blue) + box(150, SG, 42, 40, { label: true }) + barrel(84, SG - 66, 36, 42, C.sky),
);
SPOTS["service-air"] = spot(
  spotBg(55) + circle(196, 40, 10, C.amber, { opacity: 0.5 }) + plane(36, 76, 0.95) + uld(34, SG, 46, 34) + uld(88, SG, 46, 34, C.sky) + line([[22, SG - 2], [218, SG - 2]], C.grey, 3),
);
SPOTS["service-sea"] = spot(spotBg(57) + circle(54, 44, 12, C.amber, { opacity: 0.5 }) + ship(22, 128, 0.95) + waves(16, 136, 200, C.blue, 3) + waves(40, 148, 160, C.sky, 3));
SPOTS["service-vehicle"] = spot(
  spotBg(59) +
    container(150, SG, 72, 76, C.deep) + poly([[150, SG - 2], [114, SG - 2], [150, SG - 22]], C.greyD) + car(26, SG - 2, C.blue, 0.95),
);
SPOTS["service-commercial"] = spot(
  spotBg(61) +
    // pallet with wrapped goods
    rect(118, SG - 10, 84, 10, C.cardSide) + rect(124, SG - 6, 10, 6, C.ink, { opacity: 0.3 }) + rect(186, SG - 6, 10, 6, C.ink, { opacity: 0.3 }) +
    box(120, SG - 10, 38, 34, { tape: false }) + box(160, SG - 10, 38, 34, { tape: false }) + box(130, SG - 44, 38, 30, { tape: false }) +
    rect(118, SG - 78, 82, 68, C.white, { opacity: 0.35, rx: 4 }) +
    // forklift
    rect(36, SG - 46, 52, 30, C.amber, { rx: 5 }) + line([[44, SG - 46], [50, SG - 84], [80, SG - 84], [84, SG - 46]], C.ink, 3.5) +
    rect(92, SG - 92, 6, 82, C.ink) + line([[98, SG - 14], [116, SG - 14]], C.ink, 4) +
    circle(50, SG - 10, 10, C.ink) + circle(50, SG - 10, 4, C.grey) + circle(80, SG - 10, 8, C.ink) + circle(80, SG - 10, 3, C.grey),
);

SPOTS["guide-packing"] = spot(
  spotBg(63) +
    poly([[70, 80], [52, 60], [92, 58], [102, 80]], C.cardTop) +
    poly([[160, 80], [182, 58], [192, 66], [170, 86]], C.cardSide) +
    box(70, SG, 90, 70, { tape: false, depth: 22 }) +
    poly([[70, 80], [160, 80], [152, 74], [78, 74]], C.cardSide) +
    rect(86, 64, 44, 12, C.blue, { rx: 3 }) + rect(92, 56, 36, 10, C.sky, { rx: 3 }) +
    // padding
    [176, 196, 186].map((x, i) => circle(x, SG - 8 - i * 14, 8, C.white, { stroke: C.grey, strokeWidth: 2 })).join("") +
    circle(46, SG - 10, 9, C.white, { stroke: C.grey, strokeWidth: 2 }) + circle(40, SG - 28, 7, C.white, { stroke: C.grey, strokeWidth: 2 }),
);
SPOTS["guide-labelling"] = spot(
  spotBg(65) + box(54, SG, 104, 82, { tape: true, arrows: true }) +
    rect(68, SG - 56, 56, 40, C.white, { rx: 3 }) + bar(74, SG - 48, 34, C.ink, 4) + bar(74, SG - 39, 42, C.greyD, 4) + bar(74, SG - 30, 28, C.greyD, 4) +
    [0, 4, 6, 10, 12, 16, 20, 22].map((dx) => rect(110 + dx * 0.6, SG - 30, 1.6, 10, C.ink)).join("") +
    g(rect(-4, -34, 8, 40, C.deep, { rx: 3 }) + path("M-4,6 L4,6 L0,14Z", C.ink) + rect(-4, -40, 8, 8, C.ink, { rx: 2 }), "translate(186,96) rotate(28)"),
);
SPOTS["guide-list"] = spot(
  spotBg(67) + box(132, SG, 70, 56, { label: true }) +
    rect(42, 34, 76, 104, C.deep, { rx: 6 }) + rect(48, 42, 64, 90, C.white, { rx: 3 }) + rect(66, 30, 28, 12, C.ink, { rx: 4 }) +
    tick(60, 60, 6) + bar(70, 57, 34) + tick(60, 82, 6) + bar(70, 79, 28) + tick(60, 104, 6) + bar(70, 101, 32) +
    circle(60, 124, 6, "none", { stroke: C.grey, strokeWidth: 2 }) + bar(70, 121, 24),
);

// --- Write
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, content] of Object.entries({ ...SCENES, ...SPOTS })) {
  writeFileSync(join(OUT, `${name}.svg`), content);
  total += content.length;
  console.log(`${name}.svg ${(content.length / 1024).toFixed(1)} KB`);
}
console.log(`${Object.keys(SCENES).length + Object.keys(SPOTS).length} illustrations, ${(total / 1024).toFixed(1)} KB total`);
