"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FlaskConical, Beaker, Leaf, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export type EvidenceLevel = "A" | "B" | "C" | "D" | "trad";

interface EvidenceGradeProps {
  level: EvidenceLevel;
  className?: string;
  showLabel?: boolean;
}

const evidenceConfig: Record<
  EvidenceLevel,
  {
    labelKey: string;
    shortDescKey: string;
    fullDescKey: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
  }
> = {
  A: {
    labelKey: "evidence.A.label",
    shortDescKey: "evidence.A.shortDesc",
    fullDescKey: "evidence.A.fullDesc",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: <FlaskConical className="size-3" />,
  },
  B: {
    labelKey: "evidence.B.label",
    shortDescKey: "evidence.B.shortDesc",
    fullDescKey: "evidence.B.fullDesc",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: <Beaker className="size-3" />,
  },
  C: {
    labelKey: "evidence.C.label",
    shortDescKey: "evidence.C.shortDesc",
    fullDescKey: "evidence.C.fullDesc",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: <Leaf className="size-3" />,
  },
  D: {
    labelKey: "evidence.D.label",
    shortDescKey: "evidence.D.shortDesc",
    fullDescKey: "evidence.D.fullDesc",
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
    icon: <HelpCircle className="size-3" />,
  },
  trad: {
    labelKey: "evidence.trad.label",
    shortDescKey: "evidence.trad.shortDesc",
    fullDescKey: "evidence.trad.fullDesc",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: <Leaf className="size-3" />,
  },
};

export function EvidenceGrade({
  level,
  className,
  showLabel = true,
}: EvidenceGradeProps) {
  const t = useTranslations();
  const config = evidenceConfig[level] || evidenceConfig.C;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-help",
              config.bgColor,
              config.color,
              className
            )}
          >
            {config.icon}
            <span>
              {t("evidence.prefix")} {level}
            </span>
            {showLabel && (
              <span className="hidden sm:inline">
                - {t(config.shortDescKey)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{t(config.labelKey)}</p>
            <p className="text-xs text-muted-foreground">
              {t(config.fullDescKey)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EvidenceGradeBadge({ level }: { level: EvidenceLevel }) {
  const t = useTranslations();
  const config = evidenceConfig[level] || evidenceConfig.C;

  return (
    <Badge
      variant="outline"
      title={`${t("evidence.prefix")} ${t(config.labelKey)}`}
      className={cn("gap-1 font-medium", config.bgColor, config.color)}
    >
      {config.icon}
      {level}
      {/* The bare letter is all a screen reader used to get ("C", "trad").
          Spell out the grade so the chip means something out of context. */}
      <span className="sr-only"> — {t(config.labelKey)}</span>
    </Badge>
  );
}
