/**
 * Product analytics event tracking
 * Uses Vercel Analytics custom events when available, falls back silently.
 */
export type EventName =
  | "chat_message_sent"
  | "herb_viewed"
  | "dosage_calculated"
  | "interaction_checked"
  | "search_performed"
  | "donation_clicked"
  | "language_changed";

type VercelAnalyticsWindow = Window & {
  va?: {
    track?: (
      event: EventName,
      properties?: Record<string, string | number | boolean>
    ) => void;
  };
};

export function trackEvent(
  event: EventName,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    // Vercel Analytics custom events
    const va = (window as VercelAnalyticsWindow).va;
    if (va?.track) {
      va.track(event, properties);
    }
  } catch {
    // Silently fail in production if analytics unavailable
  }
}
