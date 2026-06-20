"use client";

import { RouteErrorBoundary } from "@/components/shared/route-error-boundary";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      titleKey="failedToLoadHerbs"
      messageKey="failedToLoadHerbsMsg"
    />
  );
}