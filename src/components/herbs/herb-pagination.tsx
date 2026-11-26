"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocalizedRouter as useRouter } from "@/components/i18n/use-localized-router";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildHerbListUrl } from "@/lib/search/herb-list-url";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface HerbPaginationProps {
  page: number;
  totalPages: number;
  query?: string;
  category?: string;
  sort?: string;
  evidence?: string;
}

/**
 * Pagination for the herb list. After any page change the results list is
 * scrolled into view: previously a soft navigation left the viewport at
 * the bottom of the page, forcing a manual "Back to top". The scroll runs
 * in an effect on `page` (skipping the first render) rather than relying
 * on Link's default scroll, so it also fires for the page-jump form.
 *
 * Navigation now runs inside a transition (previously plain Link clicks
 * and a bare router.push for the jump form, neither giving any feedback
 * while the next page resolved). While pending, all controls are
 * disabled, the nav reports aria-busy, and the page indicator shows a
 * spinner with the shared "Loading..." label.
 */
export function HerbPagination({
  page,
  totalPages,
  query,
  category,
  sort,
  evidence,
}: HerbPaginationProps) {
  const t = useTranslations();
  const router = useRouter();
  const [jump, setJump] = useState(String(page));
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);

  // Keep the jump field in step with the current page. This is React's
  // documented "adjust some state when a prop changes" pattern: the old
  // version did it in an effect, which painted one frame with the stale page
  // number and then re-rendered (react-hooks/set-state-in-effect).
  const [syncedPage, setSyncedPage] = useState(page);
  if (page !== syncedPage) {
    setSyncedPage(page);
    setJump(String(page));
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById("herb-results")?.scrollIntoView({ block: "start" });
  }, [page]);

  const urlFor = (target: number) =>
    buildHerbListUrl({ q: query, category, sort, evidence, page: target });

  const navigate = (target: number) => {
    if (target === page) {
      document
        .getElementById("herb-results")
        ?.scrollIntoView({ block: "start" });
      return;
    }
    startTransition(() => {
      router.push(urlFor(target), { scroll: false });
    });
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.floor(Number(jump));
    if (!Number.isFinite(parsed)) return;
    const target = Math.min(Math.max(parsed, 1), totalPages);
    navigate(target);
  };

  /**
   * Real anchors, not buttons.
   *
   * These controls used to be <Button onClick={router.push}>, so the served
   * HTML contained no link to page 2 of 158 — and a crawler saw exactly the 21
   * herbs on page 1 of a 3,155-page library. The link is also the accessible
   * control: it works with middle-click, "copy link", and without JavaScript.
   */
  const pageLink = (target: number, disabled: boolean, label: string) => {
    const className = buttonVariants({ variant: "outline", size: "sm" });
    if (disabled || isPending) {
      return (
        <span
          aria-disabled="true"
          className={cn(className, "pointer-events-none opacity-50")}
        >
          {label}
        </span>
      );
    }
    return (
      <Link href={urlFor(target)} scroll={false} className={className}>
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("herbs.pagination.page")}
      aria-busy={isPending}
      className="mt-8 flex flex-wrap items-center justify-center gap-3"
    >
      {pageLink(1, page <= 1, t("herbs.pagination.first"))}
      {pageLink(page - 1, page <= 1, t("herbs.pagination.previous"))}
      {isPending ? (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("common.loading")}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          {page} {t("herbs.pagination.of")} {totalPages}
        </span>
      )}
      {pageLink(page + 1, page >= totalPages, t("herbs.pagination.next"))}
      {pageLink(totalPages, page >= totalPages, t("herbs.pagination.last"))}
      <form
        onSubmit={handleJump}
        className="flex items-center gap-2"
        aria-label={t("herbs.pagination.goToPage")}
      >
        <label htmlFor="herb-page-jump" className="sr-only">
          {t("herbs.pagination.pageInputLabel")}
        </label>
        <Input
          id="herb-page-jump"
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          disabled={isPending}
          className="h-8 w-20"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {t("herbs.pagination.goToPage")}
        </Button>
      </form>
    </nav>
  );
}
