"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Compass, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const tabs = [
  { labelKey: "mobileTabs.chat", href: "/", icon: MessageCircle, exact: true },
  { labelKey: "mobileTabs.explore", href: "/herbs", icon: Compass, exact: false },
  { labelKey: "mobileTabs.garden", href: "/garden", icon: Sprout, exact: true },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/herbs") {
    return pathname === "/herbs" || pathname.startsWith("/herbs/") || pathname.startsWith("/symptoms") || pathname.startsWith("/calculator") || pathname.startsWith("/compare");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function UnifiedMobileBar() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-background/90 backdrop-blur-xl border-t",
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
                  active
                    ? "bg-primary/10 size-10"
                    : "size-9"
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
