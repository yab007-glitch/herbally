"use client";

import {
  LocalizedLink as Link,
  isActivePath,
} from "@/components/i18n/localized-link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  Compass,
  MessageCircle,
  Calculator,
  Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const tabs = [
  {
    labelKey: "mobileTabs.interactions",
    href: "/herb-drug-interactions",
    icon: ShieldAlert,
    exact: false,
  },
  {
    labelKey: "mobileTabs.explore",
    href: "/herbs",
    icon: Compass,
    exact: false,
  },
  {
    labelKey: "mobileTabs.herbalist",
    href: "/herbalist",
    icon: MessageCircle,
    exact: false,
  },
  {
    labelKey: "mobileTabs.calc",
    href: "/calculator",
    icon: Calculator,
    exact: false,
  },
  {
    labelKey: "mobileTabs.garden",
    href: "/garden",
    icon: Sprout,
    exact: true,
  },
] as const;

import { stripLocalePrefix } from "@/lib/i18n/routing";

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return isActivePath(pathname, href, true);
  const canonical = stripLocalePrefix(pathname);
  if (href === "/herb-drug-interactions") {
    return (
      canonical === "/herb-drug-interactions" ||
      canonical.startsWith("/interactions") ||
      canonical.startsWith("/medications")
    );
  }
  if (href === "/herbs") {
    return (
      canonical === "/herbs" ||
      canonical.startsWith("/herbs/") ||
      canonical.startsWith("/symptoms") ||
      canonical.startsWith("/compare") ||
      canonical.startsWith("/npn-checker") ||
      canonical.startsWith("/surgery-planner")
    );
  }
  return isActivePath(pathname, href);
}

export function UnifiedMobileBar() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav
      aria-label={t("common.navQuick")}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "paper-surface border-t",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="flex items-center justify-around px-2 h-16">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href, tab.exact);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.labelKey}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                "transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl transition-all duration-200",
                  active ? "bg-primary/10 size-10" : "size-9"
                )}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">
                {t(tab.labelKey)}
              </span>
              <span
                className={cn(
                  "h-1 rounded-full bg-primary transition-all duration-300",
                  active ? "w-4 opacity-100" : "w-0 opacity-0"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
