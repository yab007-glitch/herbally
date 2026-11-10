import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    done: {
      title: "You're unsubscribed",
      body: "That's done — you won't receive another digest. No hard feelings, and no second email asking you to reconsider.",
    },
    invalid: {
      title: "That link didn't work",
      body: "The unsubscribe link is incomplete. Reply to any digest email and we'll remove you by hand.",
    },
    error: {
      title: "Something went wrong",
      body: "We couldn't process the unsubscribe just now. Reply to any digest email and we'll remove you by hand.",
    },
  },
  fr: {
    done: {
      title: "Vous êtes désabonné",
      body: "C'est fait — vous ne recevrez plus de résumé. Sans rancune, et sans second courriel pour vous faire changer d'avis.",
    },
    invalid: {
      title: "Ce lien n'a pas fonctionné",
      body: "Le lien de désabonnement est incomplet. Répondez à n'importe quel courriel du résumé et nous vous retirerons à la main.",
    },
    error: {
      title: "Une erreur est survenue",
      body: "Nous n'avons pas pu traiter le désabonnement pour le moment. Répondez à n'importe quel courriel du résumé et nous vous retirerons à la main.",
    },
  },
} as const;

export default async function NewsletterUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const { status } = await searchParams;
  const key =
    status === "done" ? "done" : status === "error" ? "error" : "invalid";
  const copy = COPY[locale][key];

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {copy.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {copy.body}
      </p>
      <p className="mt-8 text-sm">
        <Link
          href="/herbs"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr" ? "Parcourir les plantes" : "Browse the herbs"}
        </Link>
      </p>
    </div>
  );
}
