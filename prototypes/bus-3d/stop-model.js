// Procedural low-poly models of Distrito Federal bus stops.
// Every stop faces +Z (the street) and is centered on the origin, standing on y = 0.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { RoundedBoxGeometry } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js";

export const STOP_TYPES = {
  concrete: { label: "Concreto" }, // precast "Tipo C": the most common shelter in the DF
  glass: { label: "Metal e vidro" },
  reduced: { label: "Reduzido" }, // narrow metal and glass shelter for tight sidewalks
  pole: { label: "Sem abrigo" },
};

// Used for every stop until per-stop shelter data exists.
export const DEFAULT_STOP_TYPE = "concrete";

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

const busSignTexture = () => canvasTexture(256, 256, (ctx) => {
  ctx.fillStyle = "#1668c4";
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 256, 28);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(58, 44, 140, 150, 22); // bus body
  ctx.fill();
  ctx.fillStyle = "#1668c4";
  ctx.beginPath();
  ctx.roundRect(74, 62, 108, 62, 8); // windshield
  ctx.fill();
  for (const x of [86, 170]) {
    ctx.beginPath();
    ctx.arc(x, 160, 11, 0, Math.PI * 2); // headlights
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  for (const x of [70, 158]) ctx.fillRect(x, 190, 28, 24); // wheels
});

const nameTexture = (name) => canvasTexture(768, 160, (ctx, w, h) => {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 16);
  ctx.fill();
  ctx.fillStyle = "#1b2630";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 64px Arial, sans-serif";
  const measured = ctx.measureText(name).width;
  ctx.translate(w / 2, h / 2);
  if (measured > w * 0.92) ctx.scale((w * 0.92) / measured, 1);
  ctx.fillText(name, 0, 0);
});

/**
 * @param {{ type?: keyof typeof STOP_TYPES, name?: string }} options
 * @returns {THREE.Group}
 */
export function createStop({ type = DEFAULT_STOP_TYPE, name = "Parada" } = {}) {
  const stop = new THREE.Group();
  stop.name = `stop-${type}`;

  const concrete = new THREE.MeshStandardMaterial({ color: "#c4c2bb", roughness: 0.95 });
  const concreteDark = new THREE.MeshStandardMaterial({ color: "#a9a79f", roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: "#4a5158", roughness: 0.45, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: "#a8d8ea", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const roofSheet = new THREE.MeshStandardMaterial({ color: "#dfe7ec", roughness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const wood = new THREE.MeshStandardMaterial({ color: "#8a6a48", roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: "#c8372d", roughness: 0.9 });
  const blue = new THREE.MeshStandardMaterial({ color: "#2a6fd0", roughness: 0.9 });

  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    stop.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);

  // Sidewalk pad with the tactile boarding strip seen on the newer stops.
  const pad = (width, depth) => {
    box(width, 0.1, depth, concreteDark, 0, 0.05, 0);
    box(width - 0.6, 0.012, 0.35, red, 0, 0.107, depth / 2 - 0.3);
    box(0.5, 0.014, 0.5, blue, width / 2 - 0.9, 0.108, depth / 2 - 0.3);
  };

  // Stop sign: pole, bus pictogram and the stop name.
  const sign = (x, z) => {
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 12), metal, x, 1.45, z);
    for (const side of [1, -1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: busSignTexture(), roughness: 0.5 }));
      plate.position.set(x, 2.6, z + side * 0.045);
      if (side < 0) plate.rotation.y = Math.PI;
      stop.add(plate);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.2), new THREE.MeshStandardMaterial({ map: nameTexture(name), roughness: 0.6 }));
      label.position.set(x, 2.2, z + side * 0.045);
      if (side < 0) label.rotation.y = Math.PI;
      stop.add(label);
    }
    box(0.52, 0.52, 0.03, metal, x, 2.6, z);
    box(0.97, 0.22, 0.03, metal, x, 2.2, z);
  };

  if (type === "concrete") {
    // Precast shelter: solid back wall, two side walls, cantilevered roof slab, concrete bench.
    const w = 4.0;
    pad(6.6, 2.6);
    box(w, 2.27, 0.14, concrete, 0, 0.1 + 1.135, -0.85); // solid back wall
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) {
      box(0.14, 2.25, 1.5, concrete, x, 0.1 + 1.125, -0.17);
    }
    add(new RoundedBoxGeometry(w + 0.7, 0.16, 2.5, 2, 0.04), concrete, 0, 2.45, 0.05); // roof slab
    box(w + 0.7, 0.1, 0.06, concreteDark, 0, 2.36, 1.27); // drip edge
    box(w - 0.6, 0.1, 0.45, concrete, 0, 0.55, -0.5); // bench
    for (const x of [-1.2, 1.2]) box(0.14, 0.45, 0.4, concrete, x, 0.325, -0.5);
    sign(w / 2 + 1.0, 0.75); // clear of the roof overhang
  } else if (type === "glass") {
    // Metal frame, glass back and side panels, translucent roof, slatted bench.
    const w = 4.0;
    pad(6.6, 2.4);
    for (const x of [-w / 2, w / 2]) for (const z of [-0.8, 0.45]) box(0.08, 2.45, 0.08, metal, x, 0.1 + 1.225, z);
    box(0.08, 2.45, 0.08, metal, 0, 0.1 + 1.225, -0.8);
    for (const x of [-w / 4, w / 4]) box(w / 2 - 0.14, 1.9, 0.02, glass, x, 1.25, -0.8); // back glass
    box(w, 0.06, 0.06, metal, 0, 0.3, -0.8);
    box(w, 0.06, 0.06, metal, 0, 2.2, -0.8);
    box(0.02, 1.9, 1.15, glass, -w / 2, 1.25, -0.17); // side glass
    // Advertising panel on the other side
    box(0.1, 1.9, 1.2, metal, w / 2, 1.25, -0.17);
    box(0.02, 1.7, 1.05, new THREE.MeshStandardMaterial({ color: "#f3d37a", emissive: "#5a4a10", emissiveIntensity: 0.4 }), w / 2 - 0.06, 1.25, -0.17);
    const roof = box(w + 0.5, 0.05, 2.1, roofSheet, 0, 2.6, -0.05);
    roof.rotation.x = 0.07; // slight fall to the back
    for (const x of [-w / 2, 0, w / 2]) {
      const rafter = box(0.07, 0.07, 2.1, metal, x, 2.56, -0.05);
      rafter.rotation.x = 0.07;
    }
    for (const z of [-0.62, -0.5, -0.38]) box(w - 1.0, 0.04, 0.09, wood, 0, 0.58, z); // bench slats
    for (const x of [-1.3, 1.3]) box(0.06, 0.48, 0.4, metal, x, 0.34, -0.5);
    sign(w / 2 + 1.0, 0.7);
  } else if (type === "reduced") {
    // Narrow shelter: two rear posts, glass back, short cantilevered roof and a leaning rail.
    const w = 2.2;
    pad(4.6, 1.8);
    for (const x of [-w / 2, w / 2]) {
      box(0.09, 2.5, 0.09, metal, x, 0.1 + 1.25, -0.5);
      const arm = box(0.07, 0.07, 1.2, metal, x, 2.56, 0.02);
      arm.rotation.x = 0.1;
    }
    box(w - 0.1, 1.8, 0.02, glass, 0, 1.3, -0.5);
    box(w, 0.06, 0.06, metal, 0, 0.4, -0.5);
    box(w, 0.06, 0.06, metal, 0, 2.2, -0.5);
    const roof = box(w + 0.4, 0.05, 1.3, roofSheet, 0, 2.62, 0.02);
    roof.rotation.x = 0.1;
    box(w - 0.3, 0.07, 0.18, metal, 0, 0.85, -0.32); // leaning rail
    for (const x of [-0.8, 0.8]) box(0.05, 0.05, 0.2, metal, x, 0.85, -0.42);
    sign(w / 2 + 0.95, 0.45);
  } else {
    // No shelter: only the sign on a small pad.
    pad(2.4, 1.6);
    sign(0, 0);
  }

  stop.userData = { type };
  return stop;
}
