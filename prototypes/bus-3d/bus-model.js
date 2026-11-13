// Procedural low-poly model of a Distrito Federal city bus (STPC/DF livery).
// One geometry for every operator: only colors and texts change.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { RoundedBoxGeometry } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js";

// Colors estimated from fleet photos; apiColor is what the transit API reports.
export const OPERATORS = {
  piracicabana: { name: "Piracicabana", area: 1, color: "#3fa535", body: "#f4f5f5", apiColor: "#449612" },
  pioneira: { name: "Pioneira", area: 2, color: "#ffd400", body: "#f4f5f5", apiColor: "#ffd200" },
  urbi: { name: "Urbi", area: 3, color: "#1e9de3", body: "#f4f5f5", apiColor: "#007eff" },
  marechal: { name: "Marechal", area: 4, color: "#f47c20", body: "#cfd2d4", apiColor: "#ff8200" },
  bsbus: { name: "BsBus", area: 5, color: "#a6ce39", body: "#f4f5f5", apiColor: "#bbff00" },
};

const L = 12.7; // length (m)
const W = 2.5; // width
const FLOOR = 0.32; // ground clearance
const BELT = 1.5; // bottom of the windows
const GLASS_TOP = 2.6;
const ROOF_TOP = 2.96;

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function textTexture(lines, { width = 512, height = 256, color = "#2b2f33", background = null, font = "600 96px Arial, sans-serif", glow = null } = {}) {
  return canvasTexture(width, height, (ctx) => {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rows = Array.isArray(lines) ? lines : [lines];
    rows.forEach((row, index) => {
      const text = typeof row === "string" ? row : row.text;
      ctx.font = (typeof row === "object" && row.font) || font;
      // Shrink long texts so they never overflow the panel.
      const max = width * 0.92;
      const measured = ctx.measureText(text).width;
      ctx.save();
      ctx.translate(width / 2, (height * (index + 0.5)) / rows.length);
      if (measured > max) ctx.scale(max / measured, 1);
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;
      }
      ctx.fillStyle = (typeof row === "object" && row.color) || color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
  });
}

const accessibilityTexture = () => canvasTexture(128, 128, (ctx) => {
  ctx.fillStyle = "#1668c4";
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 14);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(58, 30, 9, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 44);
  ctx.lineTo(58, 72);
  ctx.lineTo(84, 72);
  ctx.lineTo(94, 100);
  ctx.moveTo(58, 56);
  ctx.lineTo(80, 56);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(54, 82, 22, Math.PI * 0.25, Math.PI * 1.45); // wheel
  ctx.stroke();
});

// Door arrow: up = boarding, down = alighting.
const arrowTexture = (up) => canvasTexture(96, 128, (ctx, w, h) => {
  ctx.translate(w / 2, h / 2);
  if (!up) ctx.rotate(Math.PI);
  ctx.fillStyle = "#e3262b";
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.lineTo(40, -6);
  ctx.lineTo(16, -6);
  ctx.lineTo(16, 54);
  ctx.lineTo(-16, 54);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-40, -6);
  ctx.closePath();
  ctx.fill();
});

// Maintenance hatch outline, optionally with ventilation slats.
const hatchTexture = (ratio, vent) => canvasTexture(Math.round(256 * ratio), 256, (ctx, w, h) => {
  ctx.strokeStyle = "rgba(60,66,72,0.55)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 14);
  ctx.stroke();
  if (vent) {
    ctx.fillStyle = "rgba(25,28,32,0.9)";
    for (let y = 34; y < h - 30; y += 26) ctx.fillRect(28, y, w - 56, 12);
  } else {
    ctx.fillStyle = "rgba(60,66,72,0.7)";
    for (const x of [w * 0.25, w * 0.75]) {
      ctx.beginPath();
      ctx.arc(x, h - 30, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// Front air intake: perforated center with slats on both sides.
const grilleTexture = () => canvasTexture(768, 160, (ctx, w, h) => {
  ctx.fillStyle = "#1d2024";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#040505";
  for (let y = 22; y < h - 14; y += 24) {
    ctx.fillRect(18, y, 190, 11);
    ctx.fillRect(w - 208, y, 190, 11);
  }
  let row = 0;
  for (let y = 22; y < h - 10; y += 20, row++) {
    for (let x = 236 + (row % 2) * 10; x < w - 230; x += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// Fictional Mercosul-style plate.
const plateTexture = (text) => canvasTexture(400, 130, (ctx, w, h) => {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 12);
  ctx.fill();
  ctx.fillStyle = "#1b3fa0";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 34, [12, 12, 0, 0]);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("BRASIL", w / 2, 18);
  ctx.fillStyle = "#111";
  ctx.font = "700 84px Arial, sans-serif";
  ctx.fillText(text, w / 2, 84);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 12);
  ctx.stroke();
});

function decal(texture, width, height, { emissive = false } = {}) {
  const material = emissive
    ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

// side: "right" (+z, door side), "left" (-z), "front" (+x), "rear" (-x)
function place(mesh, side, x, y, z) {
  mesh.position.set(x, y, z);
  if (side === "left") mesh.rotation.y = Math.PI;
  if (side === "front") mesh.rotation.y = Math.PI / 2;
  if (side === "rear") mesh.rotation.y = -Math.PI / 2;
  return mesh;
}

/**
 * @param {{ operator?: keyof typeof OPERATORS, line?: string, destination?: string, prefix?: string, plate?: string, leftDoors?: boolean, windows?: "framed" | "flush" }} options
 * windows: "framed" = separate panes with columns and rubber gaskets (older bodies);
 *          "flush" = continuous dark glazing (newer and electric bodies).
 * leftDoors: buses that also serve median platforms (doors on both sides).
 * @returns {THREE.Group} bus facing +X, wheels resting on y = 0, origin at its center.
 */
export function createBus({ operator = "marechal", line = "0.110", destination = "Rodoviária do Plano Piloto", prefix = "444031", plate = "ANT1W26", leftDoors = false, windows = "framed" } = {}) {
  const op = OPERATORS[operator] ?? OPERATORS.marechal;
  const bus = new THREE.Group();
  bus.name = `bus-${operator}`;

  const paint = new THREE.MeshStandardMaterial({ color: op.body, roughness: 0.45, metalness: 0.15 });
  const accent = new THREE.MeshStandardMaterial({ color: op.color, roughness: 0.4, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: "#11161b", roughness: 0.12, metalness: 0.7 });
  const windshield = new THREE.MeshStandardMaterial({ color: "#3d4f5e", roughness: 0.06, metalness: 0.85 });
  const signBlack = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1b1e22", roughness: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#131313", roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: "#c9ccd0", roughness: 0.3, metalness: 0.8 });
  const yellow = new THREE.MeshStandardMaterial({ color: "#f2c200", roughness: 0.6 });

  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bus.add(mesh);
    return mesh;
  };
  const stick = (texture, width, height, side, x, y, z, options) => bus.add(place(decal(texture, width, height, options), side, x, y, z));

  // --- Body: lower panels, glass band, roof ---
  add(new RoundedBoxGeometry(L, BELT - FLOOR, W, 4, 0.1), paint, 0, (BELT + FLOOR) / 2, 0);
  const framed = windows === "framed";
  add(new THREE.BoxGeometry(L - 0.06, GLASS_TOP - BELT + 0.1, W - 0.03), framed ? paint : glass, 0, (GLASS_TOP + BELT) / 2, 0);
  add(new RoundedBoxGeometry(L, ROOF_TOP - GLASS_TOP + 0.08, W, 4, 0.13), accent, 0, (ROOF_TOP + GLASS_TOP) / 2 - 0.02, 0);
  add(new RoundedBoxGeometry(L - 1.0, 0.08, W - 0.5, 2, 0.03), paint, -0.2, ROOF_TOP + 0.01, 0);
  add(new RoundedBoxGeometry(2.7, 0.24, 1.75, 3, 0.08), new THREE.MeshStandardMaterial({ color: "#e3e5e7", roughness: 0.6 }), -0.6, ROOF_TOP + 0.15, 0);

  // Roof emergency exits, one near the front and one near the rear
  for (const x of [3.7, -4.0]) {
    add(new THREE.BoxGeometry(1.0, 0.05, 1.0), dark, x, ROOF_TOP + 0.06, 0);
    add(new RoundedBoxGeometry(0.88, 0.07, 0.88, 2, 0.03), new THREE.MeshStandardMaterial({ color: "#dfe2e4", roughness: 0.55 }), x, ROOF_TOP + 0.1, 0);
    add(new THREE.BoxGeometry(0.16, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: "#d31616", roughness: 0.6 }), x, ROOF_TOP + 0.15, 0); // release handle
  }

  // --- Side windows ---
  // Free stretches of the window band on each side: [from, to] along the length.
  const doorHalf = 0.61;
  const rightDoors = [L / 2 - 1.15, 0.35, -L / 2 + 1.55];
  const leftDoorXs = leftDoors ? [1.15] : [];
  const bays = (doors, from, to) => {
    const sorted = [...doors].sort((a, b) => a - b);
    const result = [];
    let start = from;
    for (const x of sorted) {
      if (x - doorHalf - start > 0.55) result.push([start, x - doorHalf]);
      start = x + doorHalf;
    }
    if (to - start > 0.55) result.push([start, to]);
    return result;
  };
  const windowH = GLASS_TOP - BELT - 0.14;
  const windowY = (GLASS_TOP + BELT) / 2;
  for (const [sign, doors, from, to] of [[1, rightDoors, -L / 2 + 0.22, L / 2 - 0.25], [-1, leftDoorXs, -L / 2 + 0.22, L / 2 - 0.16]]) {
    for (const [a, b] of bays(doors, from, to)) {
      if (!framed) {
        // Flush glazing: continuous glass with thin dark dividers.
        for (let x = a + 1.3; x < b - 0.4; x += 1.3) add(new THREE.BoxGeometry(0.07, GLASS_TOP - BELT, 0.03), dark, x, windowY, sign * (W / 2 - 0.005));
        continue;
      }
      // Framed glazing: separate panes with a body-colored column and a rubber gasket around each one.
      const gap = 0.13;
      const count = Math.max(1, Math.round((b - a) / 1.45));
      const edge = count === 1 ? 0.08 : gap; // short stretches (behind the rear door) keep a thin frame
      const width = (b - a - gap * (count - 1) - edge * 2) / count;
      for (let i = 0; i < count; i++) {
        const x = a + edge + width / 2 + i * (width + gap);
        const z = sign * (W / 2 - 0.004);
        add(new RoundedBoxGeometry(width + 0.07, windowH + 0.07, 0.03, 2, 0.012), rubber, x, windowY, z); // gasket
        add(new THREE.BoxGeometry(width, windowH, 0.03), glass, x, windowY, z + sign * 0.006);
        add(new THREE.BoxGeometry(width, 0.035, 0.03), rubber, x, windowY + windowH * 0.18, z + sign * 0.012); // sliding pane rail
        add(new THREE.BoxGeometry(0.03, windowH * 0.32, 0.03), rubber, x, windowY + windowH * 0.34, z + sign * 0.012);
      }
    }
  }

  // --- Front ---
  const fx = L / 2;
  const led = { color: "#ffb21e", background: "#0b0b0b", glow: "#ff9a00" };
  add(new RoundedBoxGeometry(0.2, 1.0, W + 0.02, 3, 0.08), accent, fx - 0.02, FLOOR + 0.62, 0); // colored mask
  add(new RoundedBoxGeometry(0.22, 0.3, W - 0.1, 2, 0.06), dark, fx + 0.03, FLOOR + 0.2, 0); // bumper
  add(new THREE.BoxGeometry(0.06, 0.3, 1.5), dark, fx + 0.09, FLOOR + 0.78, 0); // air intake housing
  stick(grilleTexture(), 1.44, 0.26, "front", fx + 0.123, FLOOR + 0.78, 0);
  stick(plateTexture(plate), 0.4, 0.13, "front", fx + 0.143, FLOOR + 0.2, 0);
  for (const z of [0.98, -0.98]) {
    add(new THREE.BoxGeometry(0.05, 0.2, 0.36), new THREE.MeshStandardMaterial({ color: "#f6f8ff", emissive: "#fff6d6", emissiveIntensity: 0.9 }), fx + 0.09, FLOOR + 0.78, z);
    add(new THREE.BoxGeometry(0.14, GLASS_TOP - BELT + 0.1, 0.14), accent, fx - 0.05, (GLASS_TOP + BELT) / 2, z * 1.21); // colored A-pillars
  }
  add(new THREE.BoxGeometry(0.05, GLASS_TOP - BELT - 0.1, W - 0.34), windshield, fx + 0.008, (GLASS_TOP + BELT) / 2 - 0.03, 0);
  add(new THREE.BoxGeometry(0.07, 0.06, W - 0.3), accent, fx + 0.01, GLASS_TOP - 0.03, 0); // strip between windshield and sign
  for (const z of [0.35, -0.45]) add(new THREE.BoxGeometry(0.03, 0.03, 0.75), dark, fx + 0.045, BELT + 0.12, z); // wipers
  // Destination sign
  add(new THREE.BoxGeometry(0.1, 0.36, W - 0.36), signBlack, fx + 0.02, GLASS_TOP + 0.17, 0);
  stick(textTexture(`${line}  ${destination.toUpperCase()}`, { width: 1024, height: 160, font: "700 96px 'Courier New', monospace", ...led }), W - 0.5, 0.3, "front", fx + 0.075, GLASS_TOP + 0.17, 0, { emissive: true });
  // Mirrors
  for (const z of [1, -1]) {
    add(new THREE.BoxGeometry(0.35, 0.05, 0.05), dark, fx + 0.12, 2.42, z * (W / 2 + 0.08));
    add(new RoundedBoxGeometry(0.1, 0.5, 0.24, 2, 0.04), accent, fx + 0.3, 2.2, z * (W / 2 + 0.16));
  }

  // --- Rear ---
  const rx = -L / 2;
  add(new RoundedBoxGeometry(0.18, ROOF_TOP - FLOOR - 0.25, W + 0.02, 3, 0.08), accent, rx + 0.02, (ROOF_TOP + FLOOR) / 2 + 0.05, 0);
  add(new RoundedBoxGeometry(0.06, 1.85, W - 0.5, 2, 0.03), paint, rx - 0.07, 1.78, 0);
  add(new RoundedBoxGeometry(0.2, 0.28, W - 0.1, 2, 0.06), dark, rx - 0.03, FLOOR + 0.18, 0);
  for (const z of [1.13, -1.13]) add(new THREE.BoxGeometry(0.05, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: "#d31616", emissive: "#a00000", emissiveIntensity: 0.7 }), rx - 0.08, 1.35, z);
  stick(textTexture(op.name, { width: 512, height: 128, font: "600 84px Arial, sans-serif" }), 0.95, 0.24, "rear", rx - 0.105, 1.75, 0.55);
  stick(accessibilityTexture(), 0.24, 0.24, "rear", rx - 0.105, 1.42, 0.85);
  stick(textTexture(line, { width: 256, height: 128, font: "700 92px 'Courier New', monospace", ...led }), 0.55, 0.27, "rear", rx - 0.105, 1.42, -0.62, { emissive: true });
  stick(hatchTexture(1.9 / 0.5, true), 1.9, 0.5, "rear", rx - 0.105, 0.98, 0); // engine cover
  stick(plateTexture(plate), 0.4, 0.13, "rear", rx - 0.133, FLOOR + 0.18, 0);

  // --- Doors: the front one boards, the two rear ones alight ---
  const addDoor = (x, side, boarding) => {
    const sign = side === "right" ? 1 : -1;
    const dz = sign * (W / 2 + 0.012);
    add(new THREE.BoxGeometry(1.22, GLASS_TOP - FLOOR - 0.12, 0.05), dark, x, (GLASS_TOP + FLOOR) / 2, dz);
    add(new THREE.BoxGeometry(1.22, 0.07, 0.07), yellow, x, FLOOR + 0.08, dz + sign * 0.01);
    for (const dx of [-0.29, 0.29]) {
      add(new THREE.BoxGeometry(0.5, 1.45, 0.02), glass, x + dx, 1.62, dz + sign * 0.02);
      stick(arrowTexture(boarding), 0.2, 0.27, side, x + dx, 0.62, dz + sign * 0.03);
    }
    const label = textTexture(boarding ? "ENTRADA" : "SAÍDA", { width: 256, height: 64, font: "700 44px Arial, sans-serif", color: "#f1f1f1" });
    stick(label, 0.6, 0.15, side, x, GLASS_TOP + 0.02, dz + sign * 0.03);
  };
  [fx - 1.15, 0.35, rx + 1.55].forEach((x, index) => addDoor(x, "right", index === 0));
  // Median-platform buses: a single extra door on the driver side, behind the front axle.
  if (leftDoors) addDoor(1.15, "left", false);

  // --- Wheels ---
  for (const x of [fx - 2.75, rx + 3.35]) {
    for (const z of [1, -1]) {
      // Wheel arch: flat half disc on the body side, above the wheel.
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.66, 28, 0, Math.PI), dark);
      bus.add(place(arch, z > 0 ? "right" : "left", x, 0.5, z * (W / 2 + 0.004)));
      const tire = add(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 28), rubber, x, 0.5, z * (W / 2 - 0.16));
      tire.rotation.x = Math.PI / 2;
      const hub = add(new THREE.CylinderGeometry(0.27, 0.27, 0.36, 20), steel, x, 0.5, z * (W / 2 - 0.155));
      hub.rotation.x = Math.PI / 2;
    }
  }

  // --- Side lettering ---
  const sideText = () => textTexture([{ text: `Área ${op.area}`, font: "500 92px Arial, sans-serif" }, { text: op.name, font: "600 92px Arial, sans-serif" }], { width: 512, height: 256 });
  const prefixText = () => textTexture(prefix, { width: 512, height: 128, font: "700 88px Arial, sans-serif" });
  const z = W / 2 + 0.006;
  const infoY = 1.2;
  stick(sideText(), 1.05, 0.52, "right", 2.2, infoY, z);
  stick(accessibilityTexture(), 0.28, 0.28, "right", -0.75, infoY, z);
  stick(prefixText(), 0.8, 0.2, "right", -1.7, infoY, z);
  stick(sideText(), 1.05, 0.52, "left", leftDoors ? 4.9 : 1.7, infoY, -z);
  stick(accessibilityTexture(), 0.28, 0.28, "left", leftDoors ? -0.05 : -1.5, infoY, -z);
  stick(prefixText(), 0.8, 0.2, "left", -4.9, infoY, -z);
  // Side LED sign next to the front door
  stick(textTexture(line, { width: 384, height: 128, font: "700 92px 'Courier New', monospace", ...led }), 0.95, 0.3, "right", fx - 2.55, 2.36, z + 0.036, { emissive: true }); // in front of the window gaskets and rails

  // --- Maintenance hatches and vents on the lower panels: [side, x, width, vent] ---
  const hatches = [
    ["right", 1.5, 0.9, false], ["right", 2.5, 0.6, true], ["right", -1.3, 1.6, false],
    ["left", 5.1, 1.2, false], ["left", -4.9, 1.7, true],
    ...(leftDoors ? [["left", 2.38, 0.9, false], ["left", -1.2, 1.9, false]] : [["left", 2.1, 1.3, false], ["left", 0.4, 1.6, false], ["left", -1.4, 1.5, false]]),
  ];
  for (const [side, x, width, vent] of hatches) stick(hatchTexture(width / 0.46, vent), width, 0.46, side, x, 0.6, (side === "right" ? 1 : -1) * z);

  bus.userData = { operator, leftDoors, length: L, width: W, height: ROOF_TOP + 0.27 };
  return bus;
}
