import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Leaf,
  AlertTriangle,
  Users,
  ClipboardCheck,
  Activity,
  MessageSquare,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";

export const metadata = {
  title: "Admin Overview",
};

export default async function AdminOverviewPage() {
  let stats: {
    label: string;
    value: number;
    icon: typeof Leaf;
    gradient: string;
    description: string;
  }[] = [];

  try {
    const supabase = createAdminClient();

    const [herbs, interactions, users, checks, chatSessions] =
      await Promise.all([
        supabase.from("herbs").select("id", { count: "exact", head: true }),
        supabase
          .from("drug_interactions")
          .select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("interaction_checks")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("chat_sessions")
          .select("id", { count: "exact", head: true }),
      ]);

    // Get herb with evidence breakdown
    const { data: evidenceStats } = await supabase
      .from("herbs")
      .select("evidence_level");

    const evidenceCounts: Record<string, number> = {};
    if (evidenceStats) {
      for (const h of evidenceStats) {
        const level = h.evidence_level || "none";
        evidenceCounts[level] = (evidenceCounts[level] || 0) + 1;
      }
    }

    stats = [
      {
        label: "Total Herbs",
        value: herbs.count ?? 0,
        icon: Leaf,
        gradient: "from-emerald-500 to-teal-500",
        description: "Published in database",
      },
      {
        label: "Drug Interactions",
        value: interactions.count ?? 0,
        icon: AlertTriangle,
        gradient: "from-amber-500 to-orange-500",
        description: "Known interactions",
      },
      {
        label: "Registered Users",
        value: users.count ?? 0,
        icon: Users,
        gradient: "from-blue-500 to-cyan-500",
        description: "Total accounts",
      },
      {
        label: "Interaction Checks",
        value: checks.count ?? 0,
        icon: ClipboardCheck,
        gradient: "from-purple-500 to-indigo-500",
        description: "Checks performed",
      },
      {
        label: "Chat Sessions",
        value: chatSessions.count ?? 0,
        icon: MessageSquare,
        gradient: "from-pink-500 to-rose-500",
        description: "Persisted conversations",
      },
    ];
  } catch (error) {
    logger.error("admin_stats_error", { error: error instanceof Error ? error.message : String(error) });
    // Show zeros if service role key not configured
    stats = [
      {
        label: "Total Herbs",
        value: 0,
        icon: Leaf,
        gradient: "from-emerald-500 to-teal-500",
        description: "Set SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        label: "Drug Interactions",
        value: 0,
        icon: AlertTriangle,
        gradient: "from-amber-500 to-orange-500",
        description: "Set SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        label: "Registered Users",
        value: 0,
        icon: Users,
        gradient: "from-blue-500 to-cyan-500",
        description: "Set SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        label: "Interaction Checks",
        value: 0,
        icon: ClipboardCheck,
        gradient: "from-purple-500 to-indigo-500",
        description: "Set SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        label: "Chat Sessions",
        value: 0,
        icon: MessageSquare,
        gradient: "from-pink-500 to-rose-500",
        description: "Set SUPABASE_SERVICE_ROLE_KEY",
      },
    ];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-white shadow-lg">
          <Activity className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Admin Overview
          </h1>
          <p className="text-muted-foreground">
            Monitor platform activity and statistics
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="relative overflow-hidden border-border/50"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.gradient}`}
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} text-white`}
                  >
                    <Icon className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {stat.value.toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
