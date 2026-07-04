/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional build-time default for the Convex HTTP Actions URL (*.convex.site). */
  readonly VITE_CONVEX_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
