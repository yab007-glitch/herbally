"use client";

import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

// Core Web Vitals tracking component.
//
// Each metric used to be its own POST to /api/analytics/vitals, and that route
// INSERTs into Supabase. A single pageview therefore cost five function
// invocations and five database writes — on a Free-tier database that is
// already the site's bottleneck. The metrics are now collected in memory and
// sent once, when the page is hidden and the values are final (web-vitals
// reports CLS/LCP/INP on visibilitychange), so one pageview costs one request
// and one insert statement.
//
// Sampling keeps the remaining cost bounded without losing signal: this site
// sees thousands of pageviews a day, and a quarter of them is still thousands
// of samples per metric per day.

const VITALS_ENDPOINT = "/api/analytics/vitals";
const SAMPLE_RATE = 0.25;
const MAX_METRICS = 10;

interface VitalsSample {
  name: string;
  value: number;
  rating: Metric["rating"];
  delta: number;
  id: string;
  pathname: string;
  effectiveType?: string;
  deviceMemory?: number;
  timestamp: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
  };
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function toSample(metric: Metric): VitalsSample {
  const navigatorWithConnection = navigator as NavigatorWithConnection;
  const navigatorWithMemory = navigator as NavigatorWithMemory;

  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    pathname: window.location.pathname,
    effectiveType: navigatorWithConnection.connection?.effectiveType,
    deviceMemory: navigatorWithMemory.deviceMemory,
    timestamp: Date.now(),
  };
}

export function WebVitals() {
  useEffect(() => {
    // Only send in production
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    // Decide once per pageview, not once per metric.
    if (Math.random() > SAMPLE_RATE) {
      return;
    }

    // Keyed by metric name: web-vitals can report the same metric more than
    // once, and the last value before the page is hidden is the final one.
    const collected = new Map<string, VitalsSample>();
    const record = (metric: Metric) => {
      collected.set(metric.name, toSample(metric));
    };

    onCLS(record);
    onFCP(record);
    onINP(record);
    onLCP(record);
    onTTFB(record);

    let sent = false;
    const flush = () => {
      if (sent || collected.size === 0) {
        return;
      }
      sent = true;

      const body = JSON.stringify({
        metrics: Array.from(collected.values()).slice(0, MAX_METRICS),
      });

      // sendBeacon survives the page being torn down; keepalive fetch is the
      // fallback for browsers without it.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          VITALS_ENDPOINT,
          new Blob([body], { type: "application/json" })
        );
      } else {
        fetch(VITALS_ENDPOINT, {
          method: "POST",
          body,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {
          // Silent fail - don't break user experience
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    // visibilitychange fires on tab switch and navigation; pagehide is the
    // reliable last chance on iOS Safari. flush() is idempotent.
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null; // This component doesn't render anything
}
