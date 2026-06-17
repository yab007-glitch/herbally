import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "../src/lib/ai/ollama-cloud-client";

const supabase = createClient(
  "https://pnvltmyixympgammxvoo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBudmx0bXlpeHltcGdhbW14dm9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1ODQyMywiZXhwIjoyMDkwMTM0NDIzfQ.-OFR0ZcHQ0Pdvpqxf_x_yHnQuRrHYbUeZwjSYU96FsI"
);

async function test() {
  const { data: herb } = await supabase
    .from("herbs")
    .select("id, slug, name, scientific_name, description, traditional_uses, modern_uses, active_compounds, dosage_adult, pregnancy_safe, nursing_safe, contraindications, side_effects, evidence_level")
    .eq("slug", "turmeric")
    .single();
  
  console.log("Processing:", herb?.name);
  
  const response = await chatCompletion({
    messages: [
      { role: "system", content: "You are a medical herbalist. Generate 2 FAQ pairs. Output STRICT JSON only." },
      { role: "user", content: `Generate FAQ pairs for ${herb?.name}. Uses: anti-inflammatory. Output JSON: {"faqs":[{"question":"...","answer":"...","category":"general"}]}` }
    ],
    temperature: 0.4,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });
  
  console.log("Response:", response.slice(0, 200));
}

test().catch(console.error);
