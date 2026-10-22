import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
  let users: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
  }[] = [];
  let totalCount = 0;

  try {
    const supabase = createAdminClient();

    const [countResult, dataResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    totalCount = countResult.count ?? 0;
    users = (dataResult.data as typeof users) ?? [];
  } catch {
    // Service role key not configured
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Registered Users
        {totalCount > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({totalCount} total)
          </span>
        )}
      </h1>

      {users.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            No registered users yet. HerbAlly is a public app — users are
            optional.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
