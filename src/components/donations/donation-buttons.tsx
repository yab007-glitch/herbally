"use client";

import { useState } from "react";
import { Heart, Coffee, Gift, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { logger } from "@/lib/utils/logger";

export function DonationButtons() {
  const t = useTranslations();
  const [customAmount, setCustomAmount] = useState(20);
  const [loading, setLoading] = useState<number | null>(null);

  const suggestedAmounts = [
    {
      amount: 5,
      icon: Coffee,
      labelKey: "donateButtons.coffee",
      descKey: "donateButtons.coffeeDesc",
      color: "from-amber-500 to-orange-500",
    },
    {
      amount: 15,
      icon: Gift,
      labelKey: "donateButtons.supporter",
      descKey: "donateButtons.supporterDesc",
      color: "from-primary to-teal-600",
    },
    {
      amount: 50,
      icon: Crown,
      labelKey: "donateButtons.champion",
      descKey: "donateButtons.championDesc",
      color: "from-pink-500 to-rose-600",
    },
  ];

  const handleDonate = async (amount: number) => {
    setLoading(amount);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount * 100 }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      logger.error("donation_button_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      alert(t("donateButtons.errorMessage"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      {/* Preset Amounts */}
      <div className="grid gap-4 sm:grid-cols-3">
        {suggestedAmounts.map((tier) => {
          const Icon = tier.icon;
          const isLoading = loading === tier.amount;
          return (
            <Card
              key={tier.amount}
              className="group relative cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
              onClick={() => {
                trackEvent("donation_clicked", { amount: tier.amount });
                handleDonate(tier.amount);
              }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${tier.color} opacity-0 transition-opacity group-hover:opacity-10`}
              />
              <CardContent className="flex flex-col items-center py-8 text-center relative">
                {isLoading ? (
                  <Loader2 className="h-10 w-10 text-primary mb-3 animate-spin" />
                ) : (
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${tier.color} mb-3 transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                )}
                <p className="text-3xl font-bold text-foreground">
                  ${tier.amount}
                </p>
                <p className="font-medium text-foreground mt-1">
                  {t(tier.labelKey)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(tier.descKey)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Amount */}
      <Card className="border-primary/20 bg-gradient-to-br from-muted/50 to-transparent">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <p className="text-sm text-muted-foreground">
              {t("donateButtons.customAmount")}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-muted-foreground">$</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) =>
                  setCustomAmount(
                    Math.max(1, Math.min(1000, Number(e.target.value)))
                  )
                }
                min={1}
                max={1000}
                step={1}
                className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90 shadow-lg shadow-pink-500/20"
              onClick={() => {
                trackEvent("donation_clicked", { amount: customAmount });
                handleDonate(customAmount);
              }}
              disabled={loading === customAmount}
            >
              {loading === customAmount ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Heart className="size-5 fill-white" />
              )}
              {t("donateButtons.donate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trust Indicators */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg
            className="size-5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>{t("donateButtons.secureViaStripe")}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="size-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <span>{t("donateButtons.allCardsAccepted")}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="size-5 text-purple-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>{t("donateButtons.noCardDataStored")}</span>
        </div>
      </div>
    </>
  );
}
