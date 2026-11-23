"use client";

import { ExternalLink, Landmark } from "lucide-react";

export interface GovSourceViewItem {
  id: string;
  url: string;
  label: string;
  kindLabel: string;
}

export function GovSourcesView({
  title,
  noMonographNotice,
  items,
}: {
  title: string;
  noMonographNotice: string | null;
  items: GovSourceViewItem[];
}) {
  return (
    <section className="rounded-lg border bg-muted/30 p-4 text-sm">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <Landmark className="size-4 text-primary" aria-hidden="true" />
        {title}
      </h3>

      {noMonographNotice && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {noMonographNotice}
        </p>
      )}

      <ul className="space-y-1.5">
        {items.map((s) => (
          <li key={s.id + s.url} className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {s.label}
            </a>
            <span className="text-xs text-muted-foreground">{s.kindLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
