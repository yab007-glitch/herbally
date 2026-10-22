import { PageSkeleton } from "@/components/shared/loading-skeleton";

/**
 * Suspense boundary for the auth pages.
 *
 * These pages render client components that call `useSearchParams()` (e.g. the
 * `?next=` redirect target), which requires an ancestor Suspense boundary
 * during prerendering. The boundary used to be inherited from
 * `app/[locale]/loading.tsx`; that file is gone because a Suspense fallback
 * flushes the response shell as a 200 before a `notFound()` can set the status,
 * which turned every unknown URL into a soft 404. Scoping the boundary to the
 * auth segment keeps the requirement satisfied without covering routes that
 * need a real 404.
 */
export default function AuthLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageSkeleton />
    </div>
  );
}
