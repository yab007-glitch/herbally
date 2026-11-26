import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Leaf,
  Home,
  Users,
  AlertTriangle,
  ShieldCheck,
  FileEdit,
} from "lucide-react";
import { ClipboardCheck } from "lucide-react";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { AdminMfaGate } from "@/components/admin/admin-mfa-gate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Every admin route reads the signed-in user's session, live DB role, and
 * AAL2 TOTP verification. Prerendering them at build time is both useless and
 * harmful.
 */
export const dynamic = "force-dynamic";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/herbs", label: "Herbs", icon: Leaf },
  { href: "/admin/interactions", label: "Interactions", icon: AlertTriangle },
  {
    href: "/admin/pubmed-review",
    label: "PubMed Review",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/edit-requests",
    label: "Edit Requests",
    icon: FileEdit,
  },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/security", label: "Security (2FA)", icon: ShieldCheck },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAdminAccess();

  if (access.status === "unauthenticated" || access.status === "forbidden") {
    redirect("/");
  }

  if (access.status === "mfa_enroll_required") {
    return <AdminMfaGate mode="enroll" />;
  }

  if (access.status === "mfa_required") {
    return <AdminMfaGate mode="verify" factorId={access.factorId} />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-4 hidden md:block">
        <div className="flex items-center gap-2 mb-8 px-2">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">HerbAlly Admin</span>
        </div>
        <nav className="space-y-1">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t pt-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Site
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
