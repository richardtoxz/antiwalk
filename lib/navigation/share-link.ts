// What a link opens: a bus line (with its direction) or a metro station.
// Kept in the query string so the app stays a single page and old links keep working.

export interface LinkTarget {
  line?: string;
  direction?: number;
  station?: string;
}

const LINE_PATTERN = /^[0-9A-Za-z.]{1,10}$/;
const STATION_PATTERN = /^[0-9A-Za-z]{2,4}$/;

export function readLinkTarget(search: string): LinkTarget {
  const params = new URLSearchParams(search);
  const target: LinkTarget = {};
  const line = params.get("linha")?.trim();
  if (line && LINE_PATTERN.test(line)) {
    target.line = line;
    const raw = params.get("sentido");
    if (raw === "0" || raw === "1") target.direction = Number(raw);
  }
  const station = params.get("estacao")?.trim().toUpperCase();
  if (!target.line && station && STATION_PATTERN.test(station)) target.station = station;
  return target;
}

/** Query string for the current view, or an empty string for the home view. */
export function writeLinkTarget(target: LinkTarget): string {
  const params = new URLSearchParams();
  if (target.line) {
    params.set("linha", target.line);
    if (target.direction) params.set("sentido", String(target.direction));
  } else if (target.station) {
    params.set("estacao", target.station);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
