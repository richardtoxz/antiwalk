// MapLibre custom layer that draws the procedural 3D buses and stops with three.js.
// Loaded on demand, only when the full (3D) mode is active.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MapLibreMap } from "maplibre-gl";
import { createBus, OPERATORS } from "./models/bus-model.js";
import { createStop, DEFAULT_STOP_TYPE } from "./models/stop-model.js";

export interface Vehicle3D { key: string; lng: number; lat: number; heading: number; color: string; line: string; destination?: string }
export interface Stop3D { key: string; lng: number; lat: number; /** Travel direction of the bus at the stop. */ heading: number; name: string }

export interface Transit3DLayer extends CustomLayerInterface {
  setVehicles(vehicles: Vehicle3D[]): void;
  setStops(stops: Stop3D[]): void;
}

/** Zoom from which the 3D stops appear; below it they would be a few pixels wide. */
export const STOPS_3D_MIN_ZOOM = 15;
const RAD = Math.PI / 180;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** Length of the bus model, in meters. */
const BUS_LENGTH_M = 12.7;
/** Shortest the bus may look on screen, in CSS pixels. */
const BUS_MIN_SCREEN_PX = 52;
/** Scale when zoomed in close: slightly larger than life, like ride-hailing apps draw cars. */
const BUS_MIN_SCALE = 1.6;

type OperatorEntry = { apiColor: string; name: string; area: number };

function operatorFor(color: string): string | undefined {
  const target = color.toLowerCase();
  return Object.entries(OPERATORS as Record<string, OperatorEntry>).find(([, op]) => op.apiColor.toLowerCase() === target)?.[0];
}

/** Merges a model's meshes into one mesh per material, so a bus costs a few draw calls instead of ~150. */
function bake(group: THREE.Object3D): THREE.Group {
  group.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const geometry = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
    const list = buckets.get(mesh.material) ?? [];
    list.push(geometry);
    buckets.set(mesh.material, list);
  });
  const baked = new THREE.Group();
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (merged) baked.add(new THREE.Mesh(merged, material));
  }
  return baked;
}

function disposeTemplate(group: THREE.Group) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
  });
}

export function createTransit3DLayer(id: string): Transit3DLayer {
  let map: MapLibreMap | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const busTemplates = new Map<string, THREE.Group>();
  const stopTemplates = new Map<string, THREE.Group>();
  const buses = new Map<string, { object: THREE.Group; data: Vehicle3D }>();
  const stops = new Map<string, { object: THREE.Group; data: Stop3D }>();
  let stopData: Stop3D[] = [];

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 2.2));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
  sun.position.set(0.4, 1, 0.3);
  scene.add(sun);

  const busTemplate = (vehicle: Vehicle3D) => {
    const key = `${vehicle.color}|${vehicle.line}|${vehicle.destination ?? ""}`;
    let template = busTemplates.get(key);
    if (!template) {
      const operator = operatorFor(vehicle.color);
      template = bake(createBus({
        operator: operator ?? "marechal",
        color: operator ? undefined : vehicle.color,
        name: operator ? undefined : "Ônibus DF",
        line: vehicle.line,
        destination: vehicle.destination ?? "",
      }));
      busTemplates.set(key, template);
    }
    return template;
  };

  const stopTemplate = (stop: Stop3D) => {
    let template = stopTemplates.get(stop.name);
    if (!template) {
      template = bake(createStop({ type: DEFAULT_STOP_TYPE, name: stop.name }));
      stopTemplates.set(stop.name, template);
    }
    return template;
  };

  const syncStops = () => {
    const zoom = map?.getZoom() ?? 0;
    const wanted = zoom >= STOPS_3D_MIN_ZOOM ? stopData : [];
    const keep = new Set(wanted.map((s) => s.key));
    for (const [key, entry] of stops) if (!keep.has(key)) { scene.remove(entry.object); stops.delete(key); }
    for (const stop of wanted) {
      const entry = stops.get(stop.key);
      if (entry) { entry.data = stop; continue; }
      const object = stopTemplate(stop).clone();
      object.matrixAutoUpdate = false;
      scene.add(object);
      stops.set(stop.key, { object, data: stop });
    }
  };

  const place = (object: THREE.Object3D, lng: number, lat: number, origin: MercatorCoordinate, meter: number, rotation: number, scale: number, offset: [number, number] = [0, 0]) => {
    const point = MercatorCoordinate.fromLngLat([lng, lat], 0);
    const east = (point.x - origin.x) / meter + offset[0];
    const south = (point.y - origin.y) / meter + offset[1];
    object.matrix.compose(
      new THREE.Vector3(east, 0, south),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation),
      new THREE.Vector3(scale, scale, scale),
    );
  };

  return {
    id,
    type: "custom",
    renderingMode: "3d",

    onAdd(mapInstance, gl) {
      map = mapInstance;
      renderer = new THREE.WebGLRenderer({ canvas: mapInstance.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      mapInstance.on("zoomend", syncStops);
    },

    onRemove() {
      map?.off("zoomend", syncStops);
      for (const template of [...busTemplates.values(), ...stopTemplates.values()]) disposeTemplate(template);
      busTemplates.clear();
      stopTemplates.clear();
      buses.clear();
      stops.clear();
      scene.clear();
      renderer?.dispose();
      renderer = null;
      map = null;
    },

    setVehicles(vehicles) {
      const keep = new Set(vehicles.map((v) => v.key));
      for (const [key, entry] of buses) if (!keep.has(key)) { scene.remove(entry.object); buses.delete(key); }
      for (const vehicle of vehicles) {
        const entry = buses.get(vehicle.key);
        const template = busTemplate(vehicle);
        if (entry && entry.object.userData.template === template) { entry.data = vehicle; continue; }
        if (entry) scene.remove(entry.object);
        const object = template.clone();
        object.userData.template = template;
        object.matrixAutoUpdate = false;
        scene.add(object);
        buses.set(vehicle.key, { object, data: vehicle });
      }
      map?.triggerRepaint();
    },

    setStops(next) {
      stopData = next;
      syncStops();
      map?.triggerRepaint();
    },

    render(_gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
      if (!map || !renderer) return;
      // A local origin at the map center keeps the coordinates in meters, avoiding float jitter.
      const center = map.getCenter();
      const origin = MercatorCoordinate.fromLngLat(center, 0);
      const meter = origin.meterInMercatorCoordinateUnits();
      const zoom = map.getZoom();
      // A bus is never shorter than BUS_MIN_SCREEN_PX on screen, so it is easy to spot from afar;
      // up close it settles at a little above life size.
      const metersPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos(center.lat * RAD)) / (512 * Math.pow(2, zoom));
      const minScreenPx = Math.min(BUS_MIN_SCREEN_PX, Math.max(36, map.getCanvas().clientWidth * 0.12));
      const exaggeration = Math.max(BUS_MIN_SCALE, (minScreenPx * metersPerPixel) / BUS_LENGTH_M);

      for (const { object, data } of buses.values()) {
        place(object, data.lng, data.lat, origin, meter, (90 - data.heading) * RAD, exaggeration);
      }
      for (const { object, data } of stops.values()) {
        // The shelter sits on the curb to the right of travel and faces the street.
        const right = (data.heading + 90) * RAD;
        const facing = data.heading - 90;
        place(object, data.lng, data.lat, origin, meter, (180 - facing) * RAD, 1.3, [Math.sin(right) * 8, -Math.cos(right) * 8]);
      }

      const local = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(meter, -meter, meter))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(local);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
