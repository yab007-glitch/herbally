import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin Security (2FA)",
};

export default async function AdminSecurityPage() {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    redirect("/");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Security &amp; 2FA
        </h1>
        <p className="text-sm text-muted-foreground">
          All admin routes and database edits require a verified authenticator
          app session (AAL2).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Active Authenticator Factors ({access.factors.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {access.factors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {factor.friendlyName || "TOTP Authenticator"}
                </p>
                {factor.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    Enrolled {new Date(factor.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                Verified
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
