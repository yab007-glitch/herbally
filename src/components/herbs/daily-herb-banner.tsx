"use client";

import Link from "next/link";
import { Sun, Sparkles } from "lucide-react";
import { useState } from "react";
import { getDailyHerb } from "@/lib/garden/daily-herb";

export function DailyHerbBanner() {
  const [dailyHerb] = useState<{
    slug: string;
    name: string;
    benefit: string;
  } | null>(() => getDailyHerb());

  if (!dailyHerb) return null;

  return (
    <div className="w-full">
      <Link
        href={`/herbs/${dailyHerb.slug}`}
        className="group flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.03] to-teal-500/[0.03] p-4 transition-all hover:shadow-md hover:border-primary/25"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sun className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary">Herb of the Day</p>
          <p className="font-semibold text-foreground">{dailyHerb.name}</p>
          <p className="text-xs text-muted-foreground">{dailyHerb.benefit}</p>
        </div>
        <Sparkles className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 shrink-0" />
      </Link>
    </div>
  );
}
