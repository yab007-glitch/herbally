import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Manage Interactions",
};

export default async function AdminInteractionsPage() {
  let interactions: {
    id: string;
    herb_name: string;
    drug_name: string;
    severity: string;
  }[] = [];
  let totalCount = 0;

  try {
    const supabase = createAdminClient();

    const [countResult, dataResult] = await Promise.all([
      supabase
        .from("drug_interactions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("drug_interactions")
        .select("id, drug_name, severity, herbs(name)")
        .order("severity")
        .limit(100),
    ]);

    totalCount = countResult.count ?? 0;

    // Map the joined data to a flat structure
    if (dataResult.data) {
      interactions = dataResult.data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        herb_name: (row.herbs as Record<string, string>)?.name || "Unknown",
        drug_name: row.drug_name as string,
        severity: row.severity as string,
      }));
    }
  } catch {
    // Service role key not configured
  }

  const severityColors: Record<string, string> = {
    contraindicated: "bg-red-100 text-red-700",
    severe: "bg-orange-100 text-orange-700",
    moderate: "bg-amber-100 text-amber-700",
    mild: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Drug Interactions
        {totalCount > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({totalCount} total)
          </span>
        )}
      </h1>

      {interactions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Herb</th>
                    <th className="px-4 py-3 text-left font-medium">Drug</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((interaction) => (
                    <tr key={interaction.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {interaction.herb_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {interaction.drug_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            severityColors[interaction.severity] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {interaction.severity}
                        </span>
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
            <AlertTriangle className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            No drug interactions found. Run the seed script to populate.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
