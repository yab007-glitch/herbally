import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "../src/lib/ai/ollama-cloud-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/test-single-faq.ts"
  );
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: herb } = await supabase
    .from("herbs")
    .select(
      "id, slug, name, scientific_name, description, traditional_uses, modern_uses, active_compounds, dosage_adult, pregnancy_safe, nursing_safe, contraindications, side_effects, evidence_level"
    )
    .eq("slug", "turmeric")
    .single();

  console.log("Processing:", herb?.name);

  const response = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a medical herbalist. Generate 2 FAQ pairs. Output STRICT JSON only.",
      },
      {
        role: "user",
        content: `Generate FAQ pairs for ${herb?.name}. Uses: anti-inflammatory. Output JSON: {"faqs":[{"question":"...","answer":"...","category":"general"}]}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  console.log("Response:", response.slice(0, 200));
}

test().catch(console.error);
