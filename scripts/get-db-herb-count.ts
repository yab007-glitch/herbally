import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("❌ Error: Supabase credentials are not configured in environment variables.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("📡 Connecting to Supabase...");
  
  // 1. Total herbs count
  const { count: totalCount, error: totalError } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true });

  if (totalError) {
    console.error("❌ Error fetching total count:", totalError);
    process.exit(1);
  }

  // 2. Published herbs count
  const { count: publishedCount } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  // 3. Unpublished herbs count
  const { count: unpublishedCount } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", false);

  // 4. Breakdown by Evidence Level
  const { data: evidenceData } = await supabase
    .from("herbs")
    .select("evidence_level");

  const evidenceBreakdown: Record<string, number> = {};
  if (evidenceData) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    evidenceData.forEach((h: any) => {
      const level = h.evidence_level || "None/Traditional";
      evidenceBreakdown[level] = (evidenceBreakdown[level] || 0) + 1;
    });
  }

  // 5. Breakdown by Categories
  const { data: categoryData } = await supabase
    .from("herb_categories")
    .select("id, name, slug");

  const categoryMap: Record<string, string> = {};
  if (categoryData) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoryData.forEach((c: any) => {
      categoryMap[c.id] = c.name;
    });
  }

  const { data: herbsWithCat } = await supabase
    .from("herbs")
    .select("category_id");

  const categoryBreakdown: Record<string, number> = {};
  if (herbsWithCat) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    herbsWithCat.forEach((h: any) => {
      const catName = h.category_id ? (categoryMap[h.category_id] || "Unknown Category") : "No Category";
      categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + 1;
    });
  }

  console.log("\n🌿 --- HerbAlly Supabase Database Dig Report --- 🌿");
  console.log(`📊 Total Herbs in Database:  ${totalCount}`);
  console.log(`✅ Published Herbs:          ${publishedCount}`);
  console.log(`❌ Unpublished/Draft Herbs:  ${unpublishedCount}`);
  
  console.log("\n📈 Evidence Level Breakdown:");
  Object.entries(evidenceBreakdown).sort((a, b) => b[1] - a[1]).forEach(([level, cnt]) => {
    console.log(`   - Level ${level}: ${cnt} herbs`);
  });

  console.log("\n📁 Category Breakdown:");
  Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
    console.log(`   - ${cat}: ${cnt} herbs`);
  });
}

main();
