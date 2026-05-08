/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

interface ImportMetaEnv {
  readonly RESEND_API_KEY: string;
  readonly RESEND_FROM_ADDRESS: string;
  readonly RESEND_NOTIFY_TO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
