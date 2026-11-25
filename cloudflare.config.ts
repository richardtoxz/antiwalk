import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "3a7c359f12ed928e14672d0dee4df91b",
  worker: defineWorker({
    name: "app",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-24",
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
