"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Leaf,
  Menu,
  Calculator,
  MessageCircle,
  Heart,
  Stethoscope,
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
import { MissionModal } from "@/components/donations/mission-modal";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { LanguageDrawer } from "@/components/i18n/language-drawer";
import { useTranslations, useLocale } from "next-intl";
import { LANGUAGES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/symptoms", labelKey: "nav.symptoms", icon: Stethoscope },
  { href: "/herbs", labelKey: "nav.herbs", icon: Leaf },
  { href: "/calculator", labelKey: "nav.calculator", icon: Calculator },
  { href: "/herbalist", labelKey: "nav.herbalist", icon: MessageCircle },
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
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

export function MainNavbar() {
  const [open, setOpen] = useState(false);
  const [showMission, setShowMission] = useState(false);
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
      <header className="sticky top-0 z-50 w-full border-b/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            aria-label="HerbAlly – Home"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-white shadow-sm transition-transform group-hover:scale-105">
              <Leaf className="size-5" />
            </div>
            <span className="text-lg font-bold text-foreground">
              Herb<span className="gradient-text">Ally</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSelector />
            <ThemeToggle />
            <button
              onClick={() => setShowMission(true)}
              className="group relative flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/30 hover:scale-105"
            >
              <Heart className="size-4 fill-white group-hover:animate-pulse" />
              <span>{t("nav.support")}</span>
            </button>
          </div>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">{t("common.menu")}</span>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 border-l border-border/50"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-white">
                    <Leaf className="size-4" />
                  </div>
                  HerbAlly
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pt-6">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="size-4" />
                      {t(link.labelKey)}
                    </Link>
                  );
                })}
                {/* Mobile utilities */}
                <div className="mt-4 space-y-2 border-t pt-4">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowLangDrawer(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Globe className="size-4" />
                    <span className="flex-1 text-left">
                      {t("common.language")}
                    </span>
                    {currentLang && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true">{currentLang.flag}</span>
                        <span className="uppercase">{currentLang.code}</span>
                      </span>
                    )}
                  </button>

                  {/* Mobile theme toggle */}
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-sm text-muted-foreground">
                      {t("common.theme")}
                    </span>
                    <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
                      {(["light", "dark", "system"] as Theme[]).map((th) => {
                        const Icon = getMobileThemeIcon(th);
                        return (
                          <button
                            key={th}
                            onClick={() => handleMobileThemeChange(th)}
                            className={cn(
                              "inline-flex size-9 items-center justify-center rounded-md transition-colors",
                              mobileTheme === th
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                            aria-label={t(`common.${th}`)}
                          >
                            <Icon className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowMission(true);
                    }}
                    className="group flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"
                  >
                    <Heart className="size-4 fill-white" />
                    {t("donate.title")}
                  </button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Mission Modal */}
      <MissionModal open={showMission} onOpenChange={setShowMission} />

      {/* Language Drawer */}
      <LanguageDrawer
        open={showLangDrawer}
        onOpenChange={setShowLangDrawer}
        hideTrigger
      />
    </>
  );
}
