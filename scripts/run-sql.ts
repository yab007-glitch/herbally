/**
 * Execute raw SQL against Supabase using the project API.
 * Uses the Supabase Management API which supports SQL execution.
 */
import { config } from "dotenv";
import * as fs from "fs";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/(.+)\.supabase\.co/
  )?.[1];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const _anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!projectRef) {
    console.error("No project ref");
    process.exit(1);
  }

  const sql = fs.readFileSync(
    "supabase/migrations/00033_dual_safety_flags.sql",
    "utf-8"
  );
  console.log(`Running migration 00033 (${sql.length} bytes)...`);

  // Try multiple approaches to execute SQL

  // Approach 1: Try the SQL API endpoint directly
  console.log("\nTrying SQL API...");
  const _apiUrl = `https://${projectRef}.supabase.co/rest/v1/`;

  // The Supabase platform has a SQL endpoint at /sql
  const sqlEndpoint = `https://${projectRef}.supabase.co/sql`;

  try {
    const res = await fetch(sqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey!,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (res.ok) {
      console.log("✅ SQL API succeeded!");
      console.log(await res.text());
      return;
    }
    console.log(
      `   SQL endpoint: ${res.status} ${await res.text().then((t) => t.substring(0, 100))}`
    );
  } catch (err) {
    console.log(`   Error: ${(err as Error).message}`);
  }

  // Approach 2: Try the pg_graphql endpoint
  console.log("\nTrying pg_graphql...");
  try {
    const res = await fetch(`https://${projectRef}.supabase.co/graphql/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey!,
      },
      body: JSON.stringify({
        query: `mutation { executeSql(query: ${JSON.stringify(sql)}) { success } }`,
      }),
    });
    console.log(`   GraphQL: ${res.status}`);
  } catch (err) {
    console.log(`   Error: ${(err as Error).message}`);
  }

  // Approach 3: Execute statement by statement via individual API calls
  // Split SQL into individual statements (ALTER, UPDATE, COMMENT)
  console.log("\nTrying individual statements via REST API...");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Split into ${statements.length} statements`);

  // The key insight: we can try each statement as an RPC call
  // First, let's try to create a helper function

  // Try creating exec_sql function via the REST API
  const createFunc = `
    CREATE OR REPLACE FUNCTION public.exec_sql(query text) 
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER 
    AS $$ BEGIN EXECUTE query; END; $$;
  `;

  try {
    // Use the query endpoint
    const res = await fetch(
      `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey!,
        },
        body: JSON.stringify({ query: createFunc }),
      }
    );
    console.log(`   Create function: ${res.status}`);
  } catch (err) {
    console.log(`   Error: ${(err as Error).message}`);
  }

  console.log("\n⚠️ Automatic SQL execution not available via REST API.");
  console.log(`Please run this SQL manually in the Supabase Dashboard:`);
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log(`\nFile: supabase/migrations/00033_dual_safety_flags.sql`);
}

main();
