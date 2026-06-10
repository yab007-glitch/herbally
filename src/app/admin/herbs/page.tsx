import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Manage Herbs",
};

export default async function AdminHerbsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  let herbs: {
    id: string;
    name: string;
    scientific_name: string;
    evidence_level: string | null;
    is_published: boolean;
  }[] = [];
  let totalCount = 0;

  try {
    const supabase = createAdminClient();

    let countQuery = supabase
      .from("herbs")
      .select("id", { count: "exact", head: true });

    let dataQuery = supabase
      .from("herbs")
      .select("id, name, scientific_name, evidence_level, is_published")
      .order("name")
      .range(offset, offset + pageSize - 1);

    if (query) {
      countQuery = countQuery.ilike("name", `%${query}%`);
      dataQuery = dataQuery.ilike("name", `%${query}%`);
    }

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    totalCount = countResult.count ?? 0;
    herbs = (dataResult.data as typeof herbs) ?? [];
  } catch {
    // Service role key not configured
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Manage Herbs
          {totalCount > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount} total)
            </span>
          )}
        </h1>
        <Link href="/admin/herbs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Herb
          </Button>
        </Link>
      </div>

      {/* Search */}
      <form className="mb-6 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <label htmlFor="admin-herb-search" className="sr-only">
            Search herbs by name
          </label>
          <input
            id="admin-herb-search"
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search herbs by name..."
            className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      {/* Herbs Table */}
      {herbs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Scientific Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Evidence
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {herbs.map((herb) => (
                    <tr key={herb.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{herb.name}</td>
                      <td className="px-4 py-3 text-muted-foreground italic">
                        {herb.scientific_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            herb.evidence_level === "A"
                              ? "bg-emerald-100 text-emerald-700"
                              : herb.evidence_level === "B"
                                ? "bg-blue-100 text-blue-700"
                                : herb.evidence_level === "C"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {herb.evidence_level || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            herb.is_published
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {herb.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/herbs/${herb.id}/edit`}
                          className="text-primary hover:underline text-xs"
                        >
                          Edit
                        </Link>
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
            {query ? "No herbs match your search." : "No herbs found."}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/herbs?page=${page - 1}${query ? `&q=${query}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/herbs?page=${page + 1}${query ? `&q=${query}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
