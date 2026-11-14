// Top view of a bus, drawn once per operator color and registered as a map image.
// The front points up, so the icon rotates with the vehicle heading (0 = north).

export const BUS_ICON_PREFIX = "bus-top:";
const PIXEL_RATIO = 2;

export function busIconId(color: string): string {
  return `${BUS_ICON_PREFIX}${color}`;
}

export function drawBusIcon(color: string): { width: number; height: number; data: Uint8ClampedArray; pixelRatio: number } | null {
  if (typeof document === "undefined") return null;
  const width = 22 * PIXEL_RATIO;
  const height = 46 * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };

  // Dark outline keeps the bus visible on light and dark maps.
  round(1, 1, 20, 44, 5);
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fill();
  // Body in the operator color.
  round(2.5, 2.5, 17, 41, 4);
  ctx.fillStyle = color;
  ctx.fill();
  // Windshield at the front.
  round(4, 3.5, 14, 5, 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fill();
  // Roof air-conditioning unit.
  round(6, 17, 10, 11, 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fill();
  // Rear window.
  round(5, 39.5, 12, 2.5, 1);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill();

  const image = ctx.getImageData(0, 0, width, height);
  return { width, height, data: image.data, pixelRatio: PIXEL_RATIO };
}
