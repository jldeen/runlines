/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public client ID of the RunLines GitHub App. Enables "Sign in with GitHub". */
  readonly VITE_GITHUB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
