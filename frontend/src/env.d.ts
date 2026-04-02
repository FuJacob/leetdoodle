/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COLLAB_WS_URL: string;
  readonly VITE_LEETCODE_SERVICE_URL: string;
  readonly VITE_SUBMISSIONS_SERVICE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

