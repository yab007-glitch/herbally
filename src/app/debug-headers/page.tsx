import { headers } from "next/headers";

export default async function DebugHeadersPage() {
  const h = await headers();
  const lines: string[] = [];
  h.forEach((value, key) => {
    lines.push(`${key}: ${value}`);
  });
  const filtered = lines.filter(l =>
    l.includes("locale") || l.includes("path") || l.includes("invoke") || l.includes("forward") || l.includes("matched")
  );
  return <pre style={{ whiteSpace: "pre-wrap" }}>{filtered.join("\n")}</pre>;
}
