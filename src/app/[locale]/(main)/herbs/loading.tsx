import { Skeleton } from "@/components/ui/skeleton";
import { HerbsGridSkeleton } from "@/components/herbs/herb-skeleton";

export default function HerbsLoading() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="text-center sm:text-left">
        <Skeleton className="mx-auto h-9 w-80 sm:mx-0 sm:h-10 sm:w-96" />
        <Skeleton className="mx-auto mt-2 h-5 w-full max-w-md sm:mx-0" />
      </div>

      {/* Search Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-full sm:w-40" />
      </div>

      {/* Categories Skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>

      {/* Grid Skeleton */}
      <HerbsGridSkeleton count={6} />
    </div>
  );
}
