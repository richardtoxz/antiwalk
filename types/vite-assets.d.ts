// Vite resolves this suffix to the URL of a bundled worker script.
declare module "*?worker&url" {
  const url: string;
  export default url;
}
