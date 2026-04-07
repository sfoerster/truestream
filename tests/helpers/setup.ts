import { vi } from 'vitest';

function createStorageMock() {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn((keys?: string | string[]) => {
      if (!keys) return Promise.resolve({ ...store });
      if (typeof keys === 'string') return Promise.resolve({ [keys]: store[keys] });
      const result: Record<string, unknown> = {};
      for (const key of (keys as string[])) { if (key in store) result[key] = store[key]; }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => { Object.assign(store, items); return Promise.resolve(); }),
    remove: vi.fn((keys: string | string[]) => {
      const keyList = typeof keys === 'string' ? [keys] : keys;
      for (const key of keyList) delete store[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => { for (const key of Object.keys(store)) delete store[key]; return Promise.resolve(); }),
  };
}

// Mock ResizeObserver and IntersectionObserver for jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

globalThis.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
} as unknown as typeof IntersectionObserver;

Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: { local: createStorageMock(), session: createStorageMock(), onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: {
      sendMessage: vi.fn((_msg: unknown, callback?: () => void) => { if (callback) callback(); }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      lastError: null,
      openOptionsPage: vi.fn(),
    },
    sidePanel: { open: vi.fn(), setOptions: vi.fn() },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    tabs: { query: vi.fn(() => Promise.resolve([])) },
  },
  writable: true,
});
