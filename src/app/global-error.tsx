"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// global-error replaces the entire app shell (including the root layout and
// its next-intl provider), so the locale is unknown here and we can't use
// useTranslations. We render a minimal, self-contained English fallback with
// proper document structure (<html lang>, <main>, <h1>) so it remains
// accessible and valid HTML even on a catastrophic render failure.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          role="alert"
          style={{
            display: "flex",
            minHeight: "60vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: "28rem", color: "#555" }}>
            We encountered an unexpected error. Please reload the page or try
            again in a moment.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #ccc",
              borderRadius: "0.375rem",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </main>
      </body>
    </html>
  );
}
