"use client";

import {
  LocalizedLink as Link,
  isActivePath,
} from "@/components/i18n/localized-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Leaf,
  Menu,
  MessageCircle,
  Compass,
  Sprout,
  ShieldAlert,
  Calculator,
  Pill,
  ShieldCheck,
  CalendarClock,
  Stethoscope,
  Scale,
  BookOpen,
  FileEdit,
  ChevronDown,
  Globe,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme, type Theme } from "@/components/theme/use-theme";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { LanguageDrawer } from "@/components/i18n/language-drawer";
import { AccountMenu } from "@/components/auth/account-menu";
import { FirstVisitBanner } from "@/components/i18n/first-visit-banner";
import { LanguageAnnouncement } from "@/components/i18n/language-announcement";
import { useTranslations, useLocale } from "next-intl";
import { LANGUAGES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { stripLocalePrefix } from "@/lib/i18n/routing";

const primaryNavLinks = [
  {
    href: "/herb-drug-interactions",
    labelKey: "nav.interactions",
    icon: ShieldAlert,
  },
  { href: "/herbs", labelKey: "nav.explore", icon: Compass },
  { href: "/herbalist", labelKey: "nav.herbalist", icon: MessageCircle },
  { href: "/garden", labelKey: "nav.garden", icon: Sprout },
];

type ToolNavGroup = {
  id: "explore" | "safety" | "reference" | "governance";
  titleEn: string;
  titleFr: string;
  items: Array<{
    href: string;
    labelKey?: string;
    labelEn?: string;
    labelFr?: string;
    icon: typeof Calculator;
  }>;
};

const toolGroups: ToolNavGroup[] = [
  {
    id: "explore",
    titleEn: "Explore",
    titleFr: "Explorer",
    items: [
      { href: "/herbs", labelKey: "nav.explore", icon: Compass },
      { href: "/symptoms", labelKey: "nav.symptoms", icon: Stethoscope },
      {
        href: "/compare",
        labelEn: "Compare Herbs",
        labelFr: "Comparer deux plantes",
        icon: Scale,
      },
    ],
  },
  {
    id: "safety",
    titleEn: "Medication Safety",
    titleFr: "Sécurité médicamenteuse",
    items: [
      {
        href: "/herb-drug-interactions",
        labelKey: "nav.interactions",
        icon: ShieldAlert,
      },
      { href: "/medications", labelKey: "nav.medications", icon: Pill },
      { href: "/npn-checker", labelKey: "nav.npnChecker", icon: ShieldCheck },
    ],
  },
  {
    id: "reference",
    titleEn: "Reference Tools",
    titleFr: "Outils de référence",
    items: [
      { href: "/calculator", labelKey: "nav.calculator", icon: Calculator },
      {
        href: "/surgery-planner",
        labelKey: "nav.surgeryPlanner",
        icon: CalendarClock,
      },
    ],
  },
  {
    id: "governance",
    titleEn: "Governance & Review",
    titleFr: "Gouvernance & Révision",
    items: [
      {
        href: "/methodology",
        labelEn: "Methodology & Coverage",
        labelFr: "Méthodologie & Couverture",
        icon: BookOpen,
      },
      {
        href: "/editorial-policy",
        labelEn: "Editorial Policy",
        labelFr: "Politique éditoriale",
        icon: ShieldCheck,
      },
      {
        href: "/clinical-review",
        labelEn: "Clinician Sign-Off & Edits",
        labelFr: "Validation clinique & édits",
        icon: FileEdit,
      },
    ],
  },
];

const toolLinks = toolGroups.flatMap((g) => g.items);

function isPrimaryActive(pathname: string, href: string): boolean {
  const clean = stripLocalePrefix(pathname);
  if (href === "/herb-drug-interactions") {
    return (
      clean === "/herb-drug-interactions" || clean.startsWith("/interactions")
    );
  }
  return isActivePath(pathname, href, false);
}

function isToolsActive(pathname: string): boolean {
  const clean = stripLocalePrefix(pathname);
  return toolLinks.some(
    (item) => clean === item.href || clean.startsWith(`${item.href}/`)
  );
}

function getMobileThemeIcon(theme: Theme) {
  if (theme === "dark") return Moon;
  if (theme === "light") return Sun;
  return Monitor;
}

export function UnifiedNavbar() {
  const [open, setOpen] = useState(false);
  const [showLangDrawer, setShowLangDrawer] = useState(false);
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

  const currentLang = LANGUAGES.find((l) => l.code === locale);
  // M17 (audit 2026-06-22): read the persisted theme via useSyncExternalStore
  // (see use-theme.ts). The server snapshot is deterministic ("system") so the
  // first client render matches the server (no hydration mismatch), and the
  // real localStorage value is read after hydration without a setState-in-effect.
  const { theme: mobileTheme, setTheme: handleMobileThemeChange } = useTheme();

  return (
    <>
      <LanguageAnnouncement />
      <FirstVisitBanner />
      <header className="paper-surface sticky top-0 z-50 w-full border-b border-border">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="HerbAlly home"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="size-3.5" />
            </div>
            <span className="font-display text-[1.05rem] font-semibold tracking-tight text-foreground">
              Herb<span className="gradient-text">Ally</span>
            </span>
          </Link>

          {/* Desktop links */}
          <nav
            className="hidden items-center gap-4 md:flex lg:gap-6"
            aria-label={t("common.navPrimary")}
          >
            {primaryNavLinks.map((link) => {
              const isActive = isPrimaryActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center px-1.5 py-2 text-sm transition-colors",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex min-h-10 items-center gap-1 rounded-md px-1.5 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isToolsActive(pathname)
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("nav.tools")}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {toolGroups.map((group, idx) => (
                  <div key={group.id}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {locale === "fr" ? group.titleFr : group.titleEn}
                    </DropdownMenuLabel>
                    {group.items.map((tool) => {
                      const Icon = tool.icon;
                      const active = isActivePath(pathname, tool.href, false);
                      return (
                        <DropdownMenuItem
                          key={tool.href}
                          render={<Link href={tool.href} />}
                          className={cn(
                            "min-h-9 cursor-pointer gap-2.5 px-2.5 py-1.5",
                            active &&
                              "bg-accent font-medium text-accent-foreground"
                          )}
                        >
                          <Icon
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {tool.labelKey
                              ? t(tool.labelKey)
                              : locale === "fr"
                                ? tool.labelFr
                                : tool.labelEn}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-3 md:flex">
            <AccountMenu />
            <LanguageSelector />
            <ThemeToggle />
          </div>

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">{t("common.menu")}</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Leaf className="size-3.5" />
                  </div>
                  HerbAlly
                </SheetTitle>
              </SheetHeader>
              <nav
                className="flex flex-col gap-1 px-2 pt-6"
                aria-label={t("common.navMobile")}
              >
                {primaryNavLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = isPrimaryActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {t(link.labelKey)}
                    </Link>
                  );
                })}

                <div className="mt-2 border-t pt-2">
                  <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("nav.tools")}
                  </p>
                  {toolLinks.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = isActivePath(pathname, tool.href, false);
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {tool.labelKey
                          ? t(tool.labelKey)
                          : locale === "fr"
                            ? tool.labelFr
                            : tool.labelEn}
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="px-3 py-1">
                    <AccountMenu compact />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShowLangDrawer(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Globe className="size-4" />
                    <span className="flex-1 text-left">
                      {t("common.language")}
                    </span>
                    {currentLang && (
                      <span className="text-xs text-muted-foreground">
                        {currentLang.flag} {currentLang.code.toUpperCase()}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      {t("common.theme")}
                    </span>
                    <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
                      {(["light", "dark", "system"] as Theme[]).map((th) => {
                        const Icon = getMobileThemeIcon(th);
                        return (
                          <button
                            key={th}
                            type="button"
                            onClick={() => handleMobileThemeChange(th)}
                            className={cn(
                              "inline-flex size-8 items-center justify-center rounded-sm transition-colors",
                              mobileTheme === th
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                            aria-label={t(`common.${th}`)}
                          >
                            <Icon className="size-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <LanguageDrawer
        open={showLangDrawer}
        onOpenChange={setShowLangDrawer}
        hideTrigger
      />
    </>
  );
}
