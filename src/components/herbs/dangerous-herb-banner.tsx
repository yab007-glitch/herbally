import { AlertOctagon } from "lucide-react";
import {
  getDangerousHerb,
  type DangerousHerb,
} from "@/lib/data/dangerous-herbs";

/**
 * Non-dismissible, server-rendered high-contrast "not a supplement" warning for
 * lethal or severely toxic plants. Rendered above the fold on herb, comparison,
 * and calculator pages whose slug is in the dangerous registry so both visitors
 * and non-JS crawlers see the hazard warning immediately.
 */
export function DangerousHerbBanner({
  slug,
  locale = "en",
}: {
  slug: string;
  locale?: "en" | "fr";
}) {
  const info: DangerousHerb | undefined = getDangerousHerb(slug);
  if (!info) return null;

  return (
    <div
      role="alert"
      className="relative flex items-start gap-3 rounded-2xl border-2 border-red-600/70 bg-red-50 p-4 dark:border-red-500/60 dark:bg-red-950/40"
    >
      <AlertOctagon
        className="size-6 shrink-0 text-red-600 dark:text-red-400"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-red-900 dark:text-red-200">
          {locale === "fr"
            ? "Danger — plante toxique — ne pas utiliser"
            : "Danger — poisonous plant — do not use"}
        </p>
        <p className="mt-1 text-sm text-red-800 dark:text-red-300">
          {locale === "fr" ? info.reasonFr : info.reason}
        </p>
        <p className="mt-1 text-xs font-medium text-red-900 dark:text-red-200">
          {locale === "fr"
            ? `Parties concernées : ${info.parts}. En cas d'exposition : Centre antipoison / 911.`
            : `Affected parts: ${info.parts}. If exposed: Poison Control / 911.`}
        </p>
      </div>
    </div>
  );
}
