import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class LocalStorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return key in this.store ? this.store[key] : null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  key(index: number) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Ensure in-memory localStorage/sessionStorage is used to avoid issues in Node 22+ & JSDOM
const mockLocalStorage = new LocalStorageMock();
const mockSessionStorage = new LocalStorageMock();

// @ts-ignore
delete globalThis.localStorage;
// @ts-ignore
delete globalThis.sessionStorage;

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  // @ts-ignore
  delete window.localStorage;
  // @ts-ignore
  delete window.sessionStorage;

  Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "sessionStorage", {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock @sentry/nextjs globally in tests. Importing the real module registers
// OpenTelemetry instrumentation (module.register) whose @sentry/server-utils
// orchestrion loader chokes in the vitest transform pipeline with
// "TypeError: The URL must be of scheme file" when it encounters vitest's
// virtual/data module URLs. No test asserts on Sentry calls; the stub keeps
// captureException/captureMessage/captureEvent no-ops.
vi.mock("@sentry/nextjs", () => ({
  captureException: () => "stub-event-id",
  captureMessage: () => "stub-event-id",
  captureEvent: () => "stub-event-id",
  withScope: (cb: (scope: unknown) => void) => cb({}),
  getCurrentScope: () => ({}),
  configureScope: () => undefined,
  addBreadcrumb: () => undefined,
  setContext: () => undefined,
  setTag: () => undefined,
  setTags: () => undefined,
  setUser: () => undefined,
  setExtra: () => undefined,
  setExtras: () => undefined,
  flush: async () => true,
  close: async () => true,
  init: () => undefined,
}));
