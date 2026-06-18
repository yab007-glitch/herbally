"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Leaf,
  Menu,
  MessageCircle,
  Compass,
  Sprout,
  Globe,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { LanguageDrawer } from "@/components/i18n/language-drawer";
import { FirstVisitBanner } from "@/components/i18n/first-visit-banner";
import { LanguageAnnouncement } from "@/components/i18n/language-announcement";
import { useTranslations, useLocale } from "next-intl";
import { LANGUAGES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", labelKey: "nav.chat", icon: MessageCircle },
  { href: "/herbs", labelKey: "nav.explore", icon: Compass },
  { href: "/garden", labelKey: "nav.garden", icon: Sprout },
];

type Theme = "light" | "dark" | "system";

function getMobileThemeIcon(theme: Theme) {
  if (theme === "dark") return Moon;
  if (theme === "light") return Sun;
  return Monitor;
}

function applyMobileTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

export function UnifiedNavbar() {
  const [open, setOpen] = useState(false);
  const [showLangDrawer, setShowLangDrawer] = useState(false);
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

  const currentLang = LANGUAGES.find((l) => l.code === locale);
  const [mobileTheme, setMobileTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  function handleMobileThemeChange(newTheme: Theme) {
    setMobileTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyMobileTheme(newTheme);
  }

  return (
    <>
      <LanguageAnnouncement />
      <FirstVisitBanner />
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="HerbAlly home">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="size-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Herb<span className="gradient-text">Ally</span>
            </span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-sm transition-colors",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSelector />
            <ThemeToggle />
          </div>

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden">
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
              <nav className="flex flex-col gap-1 px-2 pt-6">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      {t(link.labelKey)}
                    </Link>
                  );
                })}

                <div className="mt-4 space-y-2 border-t pt-4">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowLangDrawer(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Globe className="size-4" />
                    <span className="flex-1 text-left">{t("common.language")}</span>
                    {currentLang && (
                      <span className="text-xs text-muted-foreground">
                        {currentLang.flag} {currentLang.code.toUpperCase()}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm text-muted-foreground">{t("common.theme")}</span>
                    <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
                      {(["light", "dark", "system"] as Theme[]).map((th) => {
                        const Icon = getMobileThemeIcon(th);
                        return (
                          <button
                            key={th}
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

      <LanguageDrawer open={showLangDrawer} onOpenChange={setShowLangDrawer} hideTrigger />
    </>
  );
}
