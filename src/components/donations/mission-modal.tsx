"use client";

import { useLocalizedRouter as useRouter } from "@/components/i18n/use-localized-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Leaf, Sparkles, Globe, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface MissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionModal({ open, onOpenChange }: MissionModalProps) {
  const t = useTranslations();
  const router = useRouter();

  const handleDonate = () => {
    onOpenChange(false);
    router.push("/donate");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600">
              <Heart className="h-5 w-5 text-white fill-white" />
            </div>
            {t("mission.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("mission.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Mission Statement */}
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">
              {t("mission.description")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("mission.freeAccess")}
            </p>
          </div>

          {/* What We Provide */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">
                {t("mission.herbsCount")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">
                {t("mission.aiHerbalist")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
              <Globe className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">
                {t("mission.freeForever")}
              </span>
            </div>
          </div>

          {/* How Donations Help */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">
              {t("mission.howDonationsHelp")}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("mission.donationHostings")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("mission.donationAi")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("mission.donationDb")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("mission.donationFeatures")}</span>
              </li>
            </ul>
          </div>

          {/* Promise */}
          <div className="rounded-lg bg-gradient-to-br from-primary/10 to-transparent p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("mission.promise")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("mission.sustained")}
            </p>
          </div>

          {/* CTA */}
          <Button
            onClick={handleDonate}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90"
          >
            <Heart className="h-4 w-4 mr-2 fill-white" />
            {t("mission.cta")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
