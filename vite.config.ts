import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";

/**
 * Serves MapLibre's worker modules untouched in development. Vite's dev transform adds its
 * reload client to any module it serves, and that client needs a `document`, which a worker
 * lacks. Production builds bundle the worker normally.
 */
function maplibreWorkerInDev(): Plugin {
  const dir = path.resolve("node_modules/maplibre-gl/dist");
  return {
    name: "maplibre-worker-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__maplibre", (req, res, next) => {
        const file = path.join(dir, path.basename((req.url ?? "").split("?")[0]));
        if (!file.endsWith(".mjs") || !existsSync(file)) return next();
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [maplibreWorkerInDev(), vinext()],
});
