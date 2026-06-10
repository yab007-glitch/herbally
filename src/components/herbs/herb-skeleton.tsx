import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HerbSkeleton() {
  return (
    <Card className="relative h-full overflow-hidden border-border/50">
      <div className="absolute inset-x-0 top-0 h-1 bg-muted" />
      <CardContent className="p-5">
        <Skeleton className="mb-3 h-5 w-20" />
        <Skeleton className="mb-2 h-6 w-3/4" />
        <Skeleton className="mb-4 h-4 w-1/2" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-4 h-4 w-2/3" />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export function HerbsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <HerbSkeleton key={i} />
      ))}
    </div>
  );
}
