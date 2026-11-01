"use client";

import { useState } from "react";

const COPY = {
  en: {
    heading: "The safety digest",
    body: "One short email when a herb-drug interaction worth knowing about changes. No newsletter theatre, no daily drip. Unsubscribe in one click.",
    placeholder: "you@example.com",
    button: "Subscribe",
    working: "Sending…",
    consent:
      "By subscribing you agree to receive HerbAlly's occasional safety digest. You can unsubscribe at any time.",
    success: "Check your inbox — there's a confirmation link waiting.",
    already: "You're already on the list. Nothing else to do.",
    invalid: "That address doesn't look right.",
    unavailable: "Signup isn't available right now. Please try again later.",
    failed: "Something went wrong. Please try again.",
  },
  fr: {
    heading: "Le résumé de sécurité",
    body: "Un court courriel lorsqu'une interaction plante-médicament digne d'intérêt change. Pas de théâtre d'infolettre, pas d'envoi quotidien. Désabonnement en un clic.",
    placeholder: "vous@exemple.com",
    button: "S'abonner",
    working: "Envoi…",
    consent:
      "En vous abonnant, vous acceptez de recevoir le résumé de sécurité occasionnel de HerbAlly. Vous pouvez vous désabonner en tout temps.",
    success:
      "Vérifiez votre boîte de réception — un lien de confirmation vous attend.",
    already: "Vous êtes déjà sur la liste. Rien d'autre à faire.",
    invalid: "Cette adresse ne semble pas valide.",
    unavailable:
      "L'inscription n'est pas disponible pour le moment. Réessayez plus tard.",
    failed: "Une erreur est survenue. Veuillez réessayer.",
  },
} as const;

type Status =
  | "idle"
  | "working"
  | "done"
  | "already"
  | "invalid"
  | "unavailable"
  | "failed";

export function NewsletterSignup({ locale }: { locale: "en" | "fr" }) {
  const c = COPY[locale];
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          sourcePath:
            typeof window !== "undefined" ? window.location.pathname : null,
          hp: hp || undefined,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { status?: string };
        setStatus(data.status === "already-confirmed" ? "already" : "done");
        setEmail("");
        return;
      }
      if (response.status === 400) return setStatus("invalid");
      if (response.status === 503) return setStatus("unavailable");
      return setStatus("failed");
    } catch {
      setStatus("failed");
    }
  }

  const message =
    status === "done"
      ? c.success
      : status === "already"
        ? c.already
        : status === "invalid"
          ? c.invalid
          : status === "unavailable"
            ? c.unavailable
            : status === "failed"
              ? c.failed
              : null;

  return (
    <section
      aria-labelledby="newsletter-heading"
      className="rounded-sm border border-border bg-accent/40 p-5 sm:p-6"
    >
      <h2
        id="newsletter-heading"
        className="text-base font-medium text-foreground"
      >
        {c.heading}
      </h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {c.body}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        {/* Honeypot field for bot protection — hidden from humans */}
        <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
          <label htmlFor="newsletter-hp">Company</label>
          <input
            id="newsletter-hp"
            type="text"
            name="hp"
            tabIndex={-1}
            value={hp}
            onChange={(event) => setHp(event.target.value)}
            autoComplete="off"
          />
        </div>
        <label htmlFor="newsletter-email" className="sr-only">
          {c.placeholder}
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={c.placeholder}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={status === "working"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "working" ? c.working : c.button}
        </button>
      </form>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {c.consent}
      </p>

      {message && (
        <p role="status" className="mt-2 text-sm font-medium text-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
