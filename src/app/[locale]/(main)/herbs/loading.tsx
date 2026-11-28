import { HerbsGridSkeleton } from "@/components/herbs/herb-skeleton";

export default function HerbsDirectoryLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading herb directory"
      className="space-y-6 py-4"
    >
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <HerbsGridSkeleton count={6} />
    </div>
  );
}
