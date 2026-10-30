"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ANALYTICS_OPT_OUT_KEY } from "@/lib/analytics";

type Labels = {
  label: string;
  statusOn: string;
  statusOff: string;
  actionOn: string;
  actionOff: string;
  note: string;
};

type State = { optedOut: boolean; available: boolean };

/**
 * Three frozen snapshots. `useSyncExternalStore` compares them by reference,
 * so they must never be rebuilt on read.
 *
 * `BROKEN` is the fail-closed state: storage cannot be read or written, which
 * means the gate in `analyticsAllowed()` is also refusing to send anything, so
 * the honest label is "off" and the control is disabled rather than pretending
 * a preference was saved.
 */
const ON: State = { optedOut: false, available: true };
const OFF: State = { optedOut: true, available: true };
const BROKEN: State = { optedOut: true, available: false };

/** Set when a write fails, so the UI stops claiming the choice was stored. */
let writeFailed = false;

const listeners = new Set<() => void>();

function readSnapshot(): State {
  if (writeFailed) return BROKEN;
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1"
      ? OFF
      : ON;
  } catch {
    return BROKEN;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changing the preference should update this one too.
  const onStorage = () => onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * The visitor-facing half of the analytics consent gate.
 *
 * `analyticsAllowed()` has always honoured `localStorage["herbally:analytics-opt-out"]`,
 * but nothing in the UI could set it — the only ways to opt out were Global
 * Privacy Control or Do Not Track. This control makes the stored preference
 * reachable by an ordinary visitor, without a cookie banner: the default stays
 * measured (cookieless, first-party) and one click switches the browser off for
 * page views and custom events alike.
 */
export function AnalyticsOptOut({ labels }: { labels: Labels }) {
  const state = useSyncExternalStore(subscribe, readSnapshot, () => ON);

  function toggle() {
    const next = !state.optedOut;
    try {
      if (next) {
        window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
      } else {
        window.localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
      }
    } catch {
      writeFailed = true;
    }
    notify();
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="font-medium text-foreground">{labels.label}</p>
      <p className="mt-1" aria-live="polite">
        {state.optedOut ? labels.statusOff : labels.statusOn}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={toggle}
        disabled={!state.available}
      >
        {state.optedOut ? labels.actionOn : labels.actionOff}
      </Button>
      <p className="mt-2 text-xs">{labels.note}</p>
    </div>
  );
}
