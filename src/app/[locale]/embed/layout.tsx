import type { Metadata } from "next";

export const metadata: Metadata = {
  // Embeds must never compete in search — the canonical pair/herb pages do.
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Deliberately bare: no navbar, footer, or chat widget. This layout only
  // serves tiny embeddable tools designed to run inside third-party iframes.
  return <>{children}</>;
}
