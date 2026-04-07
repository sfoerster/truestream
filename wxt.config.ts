import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  manifest: {
    name: 'TrueStream',
    version: '0.1.0',
    description: 'Real-time deepfake detection for video calls',
    permissions: ['storage', 'sidePanel', 'scripting', 'tabs', 'activeTab'],
    host_permissions: [
      'https://meet.google.com/*',
      'https://teams.microsoft.com/*',
      'https://zoom.us/*',
      'https://*.whereby.com/*',
    ],
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ['models/assets/*.onnx', 'audio-processor.worklet.js'],
        matches: [
          'https://meet.google.com/*',
          'https://teams.microsoft.com/*',
          'https://zoom.us/*',
          'https://*.whereby.com/*',
        ],
      },
    ],
  },
  vite: () =>
    ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [preact() as any],
      resolve: {
        alias: {
          '@': '/src',
        },
      },
    }) as Record<string, unknown>,
});
