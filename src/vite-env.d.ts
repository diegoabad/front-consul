/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Opcional. Default: America/Argentina/Buenos_Aires */
  readonly VITE_APP_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
