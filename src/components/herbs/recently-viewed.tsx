"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { getExploredHerbs } from "@/lib/garden/streaks";

export function RecentlyViewed() {
  const [herbs, setHerbs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(() => {
    setMounted(true);
    setHerbs(getExploredHerbs().slice(0, 4));
  }, []);

  useEffect(() => {
    // Use requestAnimationFrame to defer state updates
    const id = requestAnimationFrame(load);
    return () => cancelAnimationFrame(id);
  }, [load]);

  if (!mounted || herbs.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Recently viewed
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {herbs.map((slug) => (
          <Link
            key={slug}
            href={`/herbs/${slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
          >
            {slug.charAt(0).toUpperCase() + slug.slice(1)}
            <ArrowRight className="size-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
