/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VENDOR_MAPPING_API_URL?: string;
  readonly VITE_CLASSIFY_REASON_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
