/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Set to 'true' to enable researcher-controlled Discovery runs */
  readonly VITE_ENABLE_RESEARCHER_CONTROLLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
