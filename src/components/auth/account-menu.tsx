"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { currentUser, logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type SessionUser = { id: string; email?: string | null } | null;

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("auth.login");
  const [user, setUser] = useState<SessionUser | undefined>(undefined);

  useEffect(() => {
    let active = true;
    currentUser()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, []);

  // Not yet resolved: render a neutral placeholder (matches SSR logged-out shell).
  if (user === undefined) {
    return compact ? (
      <span
        className="inline-flex h-8 w-8 items-center justify-center"
        aria-hidden
      />
    ) : (
      <span className="inline-flex h-8 w-20" aria-hidden />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label={t("submit")}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <LogIn className="size-4" />
        {!compact && <span className="hidden sm:inline">{t("submit")}</span>}
      </Link>
    );
  }

  return (
    <form action={logout} className="inline-flex">
      <Button type="submit" variant="ghost" size="sm" aria-label={t("logout")}>
        {compact ? <LogOut className="size-4" /> : <User className="size-4" />}
        {!compact && (
          <span className="ml-1.5 hidden sm:inline">{t("logout")}</span>
        )}
      </Button>
    </form>
  );
}
