"use client";

import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { analyticsAllowed } from "@/lib/analytics";

// Core Web Vitals tracking component
// Sends real user metrics to analytics endpoint

const VITALS_ENDPOINT = "/api/analytics/vitals";

function sendToAnalytics(metric: Metric) {
  // Only send in production
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Same consent decision as page views and custom events: a browser that has
  // signalled Do Not Track / Global Privacy Control is not measured at all.
  if (!analyticsAllowed()) {
    return;
  }

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    // Add page context
    pathname: window.location.pathname,
    // Add device info
    effectiveType: (navigator as NavigatorWithConnection).connection
      ?.effectiveType,
    deviceMemory: (navigator as NavigatorWithMemory).deviceMemory,
    // Add timestamp
    timestamp: Date.now(),
  });

  // Use navigator.sendBeacon for reliable delivery on page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon(VITALS_ENDPOINT, body);
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
}

// TypeScript extensions for Navigator
interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
  };
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export function WebVitals() {
  useEffect(() => {
    // Report all Core Web Vitals
    onCLS(sendToAnalytics); // Cumulative Layout Shift
    onINP(sendToAnalytics); // Interaction to Next Paint (replaces FID)
    onLCP(sendToAnalytics); // Largest Contentful Paint
    onFCP(sendToAnalytics); // First Contentful Paint
    onTTFB(sendToAnalytics); // Time to First Byte
  }, []);

  return null; // This component doesn't render anything
}

// Hook for manual reporting
export function useReportWebVitals() {
  useEffect(() => {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  }, []);
}
