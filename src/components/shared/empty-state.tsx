import Link from "next/link";
import { Leaf, Search, MessageCircle, Pill } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IllustrationVariant =
  "herbs" | "search" | "chat" | "medications" | "default";

const illustrationConfig: Record<
  IllustrationVariant,
  { icon: LucideIcon; gradient: string }
> = {
  herbs: { icon: Leaf, gradient: "from-emerald-500/20 to-teal-500/20" },
  search: { icon: Search, gradient: "from-blue-500/20 to-cyan-500/20" },
  chat: {
    icon: MessageCircle,
    gradient: "from-purple-500/20 to-indigo-500/20",
  },
  medications: { icon: Pill, gradient: "from-amber-500/20 to-orange-500/20" },
  default: { icon: Leaf, gradient: "from-muted to-muted" },
};

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  variant?: IllustrationVariant;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  variant = "default",
  action,
  className,
}: EmptyStateProps) {
  const config = illustrationConfig[variant];
  const Icon = icon || config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 py-14 text-center",
        className
      )}
    >
      {/* Illustration */}
      <div className="relative mb-6">
        <div
          className={cn(
            "absolute -inset-4 rounded-full bg-gradient-to-br blur-xl opacity-60",
            config.gradient
          )}
        />
        <div className="relative flex size-16 items-center justify-center rounded-full bg-muted/80 text-muted-foreground ring-1 ring-border/50">
          <Icon className="size-7" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {action &&
        (action.href ? (
          <Button
            className="mt-5"
            size="sm"
            render={<Link href={action.href} />}
          >
            {action.label}
          </Button>
        ) : (
          <Button onClick={action.onClick} className="mt-5" size="sm">
            {action.label}
          </Button>
        ))}
    </div>
  );
}
