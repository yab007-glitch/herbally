import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/00097_admin_aal2_rls.sql"
);

describe("00097_admin_aal2_rls migration", () => {
  it("defines is_admin_aal2() enforcing aal2 JWT claim and profiles.role = 'admin'", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_admin_aal2\(\)/i
    );
    expect(sql).toMatch(/auth\.jwt\(\)\s*->>\s*'aal'.*=\s*'aal2'/i);
    expect(sql).toMatch(/role\s*=\s*'admin'/i);
    expect(sql).toMatch(/SET search_path\s*=\s*public,\s*pg_temp/i);
  });

  it("upgrades admin policies across herbs, chats, interaction_checks, monographs, and donations without removing own-profile access", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    for (const table of [
      "public.herbs",
      "public.chat_sessions",
      "public.chat_messages",
      "public.interaction_checks",
      "public.profiles",
      "public.herb_categories",
      "public.drug_interactions",
      "public.herb_faqs",
      "public.donations",
      "public.herb_monographs",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("public.is_admin_aal2()");
    expect(sql).not.toMatch(/DROP POLICY.*"Users can view own profile"/i);
  });
});
