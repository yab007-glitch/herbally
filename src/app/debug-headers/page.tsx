import { headers } from "next/headers";

export default async function DebugHeadersPage() {
  const h = await headers();
  const entries: Record<string, string> = {};
  h.forEach((value, key) => {
    entries[key] = value;
  });
  const keys = Object.keys(entries).filter(k =>
    k.includes("locale") || k.includes("path") || k.includes("invoke") || k.includes("forward") || k.includes("matched")
  ).sort();
  return (
    <pre>
      {keys.map(k => (
        <div key={k}>{k}: {entries[k]}</div>
      ))}
    </pre>
  );
}
