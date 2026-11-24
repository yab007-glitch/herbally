import {
  getLoadedSentryClient,
  initSentryClient,
} from "./src/lib/sentry/client-deferred";

const MAX_EARLY_ERRORS = 20;
const IDLE_DELAY_MS = 5_000;

let triggered = false;
const earlyErrors: unknown[] = [];

function toCapturedError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === "string" && reason) return new Error(reason);
  return new Error("Uncaught client error");
}

function flushEarlyErrors(
  mod: Awaited<ReturnType<typeof initSentryClient>>
): void {
  if (!mod || earlyErrors.length === 0) return;
  const pending = earlyErrors.splice(0, earlyErrors.length);
  for (const err of pending) {
    mod.captureException(err);
  }
}

let cleanupListeners: (() => void) | null = null;

function triggerInit(): void {
  if (triggered) {
    void initSentryClient().then(flushEarlyErrors);
    return;
  }
  triggered = true;
  if (cleanupListeners) {
    cleanupListeners();
    cleanupListeners = null;
  }
  void initSentryClient().then((mod) => {
    // Detach early handlers as soon as Sentry's own GlobalHandlers are
    // installed, then flush anything queued prior to SDK load.
    if (typeof window !== "undefined") {
      window.removeEventListener("error", onEarlyError);
      window.removeEventListener("unhandledrejection", onEarlyRejection);
    }
    flushEarlyErrors(mod);
  });
}

function queueEarlyError(err: unknown): void {
  if (earlyErrors.length < MAX_EARLY_ERRORS) {
    earlyErrors.push(err);
  }
  triggerInit();
}

function onEarlyError(event: ErrorEvent): void {
  queueEarlyError(event.error ?? toCapturedError(event.message));
}

function onEarlyRejection(event: PromiseRejectionEvent): void {
  queueEarlyError(event.reason);
}

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  window.addEventListener("error", onEarlyError);
  window.addEventListener("unhandledrejection", onEarlyRejection);

  const onInteraction = () => triggerInit();
  const interactionEvents = ["pointerdown", "keydown", "scroll"] as const;
  for (const ev of interactionEvents) {
    window.addEventListener(ev, onInteraction, { once: true, passive: true });
  }

  let delayTimer: number | undefined;
  let idleId: number | undefined;

  const scheduleAfterLoad = () => {
    delayTimer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => triggerInit(), {
          timeout: 2000,
        });
      } else {
        triggerInit();
      }
    }, IDLE_DELAY_MS);
  };

  if (document.readyState === "complete") {
    scheduleAfterLoad();
  } else {
    window.addEventListener("load", scheduleAfterLoad, { once: true });
  }

  cleanupListeners = () => {
    for (const ev of interactionEvents) {
      window.removeEventListener(ev, onInteraction);
    }
    window.removeEventListener("load", scheduleAfterLoad);
    if (delayTimer !== undefined) window.clearTimeout(delayTimer);
    if (idleId !== undefined && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(idleId);
    }
  };
}

// Session Replay was removed from this client bundle (2026-11-15 audit).
// Hook into App Router navigation transitions once Sentry has loaded, or
// trigger deferred loading on navigation.
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
): void {
  const mod = getLoadedSentryClient();
  if (mod) {
    mod.captureRouterTransitionStart(url, navigationType);
  } else if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    triggerInit();
  }
}
