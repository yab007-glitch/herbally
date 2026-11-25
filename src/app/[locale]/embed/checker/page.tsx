import { EmbedChecker } from "@/components/embed/embed-checker";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { getLocale } from "@/lib/i18n/page-locale";

// Intentionally dynamic (no prerender): ?theme= is read per request and the
// page is a tiny tool shell, not indexable content (robots noindex in layout).
export default function EmbedCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  return <EmbedCheckerShell searchParams={searchParams} />;
}

async function EmbedCheckerShell({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const [{ theme }, locale] = await Promise.all([searchParams, getLocale()]);
  // ?theme=dark renders dark surfaces inside the iframe regardless of the
  // host page (Tailwind dark: variant is class-based).
  const dark = theme === "dark";
  return (
    <ToolsMessagesProvider locale={locale}>
      <div className={dark ? "dark" : undefined}>
        <main
          id="main-content"
          aria-labelledby="embed-checker-heading"
          className="min-h-dvh bg-background p-3 dark:bg-zinc-950"
        >
          <EmbedChecker />
        </main>
      </div>
    </ToolsMessagesProvider>
  );
}
