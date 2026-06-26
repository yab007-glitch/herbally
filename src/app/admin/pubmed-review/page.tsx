import { createAdminClient } from "@/lib/supabase/admin";
import { markSheetReviewedAction } from "@/lib/actions/pubmed-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "PubMed Sheet Review" };

export const dynamic = "force-dynamic";

const DEFAULT_REVIEWER = "Dr. Dawn Wong";
const PAGE_SIZE = 30;

export default async function AdminPubmedReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams).page ?? "1") || 1;
  const from = (page - 1) * PAGE_SIZE;

  let rows: {
    slug: string;
    article_count: number;
    model: string;
    generated_at: string;
    content: { summary?: string };
  }[] = [];
  let total = 0;

  try {
    const supabase = createAdminClient();
    const [countRes, dataRes] = await Promise.all([
      supabase
        .from("herb_pubmed_monographs")
        .select("id", { count: "exact", head: true })
        .eq("status", "compiled"),
      supabase
        .from("herb_pubmed_monographs")
        .select("slug,article_count,model,generated_at,content")
        .eq("status", "compiled")
        .order("generated_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ]);
    total = countRes.count ?? 0;
    rows = (dataRes.data ?? []) as typeof rows;
  } catch {
    // service role not configured
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PubMed Sheet Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} sheet{total === 1 ? "" : "s"} awaiting review · showing{" "}
          {rows.length} · page {page}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No sheets awaiting review. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.slug}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    <a
                      href={`/herbs/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {r.slug}
                    </a>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {r.article_count} articles · {r.model}
                    </Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {r.content?.summary ?? "—"}
                </p>
                <form
                  action={markSheetReviewedAction}
                  className="flex items-end gap-2"
                >
                  <input type="hidden" name="slug" value={r.slug} />
                  <div className="flex-1 max-w-xs">
                    <Label htmlFor={`rev-${r.slug}`} className="sr-only">
                      Reviewer
                    </Label>
                    <Input
                      id={`rev-${r.slug}`}
                      name="reviewer"
                      defaultValue={DEFAULT_REVIEWER}
                      className="h-9"
                    />
                  </div>
                  <Button type="submit" size="sm">
                    <CheckCircle2 className="mr-1 size-4" />
                    Mark reviewed
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a href={`/admin/pubmed-review?page=${page - 1}`}>
              <Button variant="outline" size="sm">
                ← Prev
              </Button>
            </a>
          )}
          <span className="text-sm text-muted-foreground self-center">
            page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          {from + PAGE_SIZE < total && (
            <a href={`/admin/pubmed-review?page=${page + 1}`}>
              <Button variant="outline" size="sm">
                Next →
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
