// Vite resolves this suffix to the URL of a bundled worker script.
declare module "*?worker&url" {
  const url: string;
  export default url;
}

declare module "*?url" {
  const url: string;
  export default url;
}

interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean; readonly [key: string]: string | boolean | undefined };
}
