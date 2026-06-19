import Link from "next/link";
import { Sun, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getDailyHerb } from "@/lib/actions/herbs";

/**
 * Server-rendered "Herb of the Day" banner. The pick is deterministic per UTC
 * day (see getDailyHerb) so every visitor sees the same herb and it rotates
 * daily. This replaces the old client-side localStorage version, which read a
 * value that was never written and therefore never displayed anything.
 */
export async function DailyHerbBanner() {
  const result = await getDailyHerb();
  if (!result.success || !result.data) return null;

  const { slug, name, benefit } = result.data;
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "herbs" });

  return (
    <div className="w-full">
      <Link
        href={`/herbs/${slug}`}
        className="group flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.03] to-teal-500/[0.03] p-4 transition-all hover:shadow-md hover:border-primary/25"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sun className="size-6" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary">
            {t("herbOfTheDay")}
          </p>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {benefit}
          </p>
        </div>
        <Sparkles
          className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 shrink-0"
          aria-hidden
        />
      </Link>
    </div>
  );
}
