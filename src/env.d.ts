/// <reference types="vite/client" />
/// <reference types="wxt/browser/chrome" />

// WXT auto-imports these at build time; declare them globally for tsc --noEmit
declare function defineBackground(main: () => void): void;
declare function defineBackground(definition: {
  main: () => void;
  type?: 'module';
  persistent?: boolean;
}): void;

declare function defineContentScript(definition: {
  matches: string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
  main: (ctx?: unknown) => void;
  allFrames?: boolean;
  matchAboutBlank?: boolean;
  excludeMatches?: string[];
  world?: 'ISOLATED' | 'MAIN';
}): void;

declare function defineUnlistedScript(main: () => void): void;
declare function defineUnlistedScript(definition: {
  main: () => void;
}): void;

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_USE_STUB_BRIDGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
