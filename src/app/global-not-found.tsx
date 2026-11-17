import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * The 404 for a URL that matches no route at all.
 *
 * The app's only root layout lives under `app/[locale]`, so an unmatched
 * top-level path had no layout to compose a 404 from: Next returned a bare
 * error shell with an empty body and the homepage title. In the live audit
 * that read as a broken page, not a 404. `global-not-found` bypasses normal
 * rendering, so the styles are imported here directly and the copy is
 * bilingual — there is no locale segment to decide which language to use.
 */
export const metadata: Metadata = {
  title: "Page not found | Page introuvable — HerbAlly",
  description:
    "The page you requested does not exist. La page demandée n'existe pas.",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        {/* The copy is bilingual because there is no locale segment to read on
            the server here, but the URL still carries one. Set the document
            language before paint so /fr/... does not claim to be English to a
            screen reader or a crawler. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname==='/fr'||location.pathname.indexOf('/fr/')===0)document.documentElement.lang='fr'}catch(e){}",
          }}
        />
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-medium tracking-wide text-muted-foreground">
            404
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you requested does not exist. · La page demandée
            n&apos;existe pas.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Home
            </Link>
            <Link
              href="/herbs"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Browse herbs
            </Link>
            <Link
              href="/fr"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Accueil
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
