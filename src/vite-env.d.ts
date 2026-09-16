/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_SERVICE_URL?: string;
  readonly VITE_MESSAGING_SERVICE_URL?: string;
  readonly VITE_MEDIA_SERVICE_URL?: string;
  readonly VITE_PRESENCE_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
