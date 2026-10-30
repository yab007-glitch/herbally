"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildHerbListUrl } from "@/lib/search/herb-list-url";
import { useTranslations } from "next-intl";

interface HerbPaginationProps {
  page: number;
  totalPages: number;
  query?: string;
  category?: string;
  sort?: string;
}

/**
 * Pagination for the herb list. After any page change the results list is
 * scrolled into view: previously a soft navigation left the viewport at
 * the bottom of the page, forcing a manual "Back to top". The scroll runs
 * in an effect on `page` (skipping the first render) rather than relying
 * on Link's default scroll, so it also fires for the page-jump form.
 */
export function HerbPagination({
  page,
  totalPages,
  query,
  category,
  sort,
}: HerbPaginationProps) {
  const t = useTranslations();
  const router = useRouter();
  const [jump, setJump] = useState(String(page));
  const firstRender = useRef(true);

  useEffect(() => {
    setJump(String(page));
  }, [page]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document
      .getElementById("herb-results")
      ?.scrollIntoView({ block: "start" });
  }, [page]);

  const urlFor = (target: number) =>
    buildHerbListUrl({ q: query, category, sort, page: target });

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.floor(Number(jump));
    if (!Number.isFinite(parsed)) return;
    const target = Math.min(Math.max(parsed, 1), totalPages);
    if (target === page) {
      document
        .getElementById("herb-results")
        ?.scrollIntoView({ block: "start" });
      return;
    }
    router.push(urlFor(target));
  };

  return (
    <nav
      aria-label={t("herbs.pagination.page")}
      className="mt-8 flex flex-wrap items-center justify-center gap-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        render={
          page > 1 ? <Link href={urlFor(1)} scroll={false} /> : undefined
        }
      >
        {t("herbs.pagination.first")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        render={
          page > 1 ? (
            <Link href={urlFor(page - 1)} scroll={false} />
          ) : undefined
        }
      >
        {t("herbs.pagination.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} {t("herbs.pagination.of")} {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        render={
          page < totalPages ? (
            <Link href={urlFor(page + 1)} scroll={false} />
          ) : undefined
        }
      >
        {t("herbs.pagination.next")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        render={
          page < totalPages ? (
            <Link href={urlFor(totalPages)} scroll={false} />
          ) : undefined
        }
      >
        {t("herbs.pagination.last")}
      </Button>
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
          className="h-8 w-20"
        />
        <Button type="submit" variant="outline" size="sm">
          {t("herbs.pagination.goToPage")}
        </Button>
      </form>
    </nav>
  );
}
