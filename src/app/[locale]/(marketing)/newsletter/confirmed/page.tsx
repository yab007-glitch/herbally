import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    confirmed: {
      title: "You're confirmed",
      body: "That's it — you're on the list. You'll hear from us when an interaction is worth flagging, and never more often than that.",
    },
    already: {
      title: "Already confirmed",
      body: "This link has already been used, so there's nothing left to do.",
    },
    invalid: {
      title: "That link didn't work",
      body: "The confirmation link is incomplete or has expired. Enter your address again and we'll send a fresh one.",
    },
    error: {
      title: "Something went wrong",
      body: "We couldn't confirm your address just now. Please try again in a few minutes.",
    },
  },
  fr: {
    confirmed: {
      title: "C'est confirmé",
      body: "Voilà — vous êtes sur la liste. Vous aurez de nos nouvelles lorsqu'une interaction vaut la peine d'être signalée, et jamais plus souvent.",
    },
    already: {
      title: "Déjà confirmé",
      body: "Ce lien a déjà été utilisé, il n'y a rien d'autre à faire.",
    },
    invalid: {
      title: "Ce lien n'a pas fonctionné",
      body: "Le lien de confirmation est incomplet ou expiré. Entrez de nouveau votre adresse et nous en enverrons un nouveau.",
    },
    error: {
      title: "Une erreur est survenue",
      body: "Nous n'avons pas pu confirmer votre adresse pour le moment. Réessayez dans quelques minutes.",
    },
  },
} as const;

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const { status } = await searchParams;
  const key =
    status === "confirmed"
      ? "confirmed"
      : status === "already"
        ? "already"
        : status === "error"
          ? "error"
          : "invalid";
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
