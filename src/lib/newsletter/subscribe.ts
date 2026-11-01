import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { sendMail, isMailConfigured } from "@/lib/email/mailer";
import { siteUrl } from "@/lib/seo/site-url";

/**
 * Newsletter subscription, built to survive a CASL audit.
 *
 * Canada's Anti-Spam Legislation asks for express consent that you can prove,
 * an identification of who is writing, and an unsubscribe that works on every
 * message. Typing an address into a box is not consent unless the person was
 * told what they were agreeing to — so the exact sentence they agreed to is
 * stored on the row, with the timestamp, and the row is only `confirmed` after
 * they click the link we mail them. Nobody can be subscribed by someone else.
 */

export type NewsletterLocale = "en" | "fr";

/** Stored verbatim on the subscriber row. Do not reword without a migration. */
export const CONSENT_TEXT: Record<NewsletterLocale, string> = {
  en: "Send me HerbAlly's occasional safety digest — new herb-drug interactions worth knowing. I can unsubscribe at any time with one click.",
  fr: "Envoyez-moi le résumé de sécurité occasionnel de HerbAlly — les nouvelles interactions plante-médicament à connaître. Je peux me désabonner en tout temps en un clic.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export type SubscribeOutcome =
  | { ok: true; status: "pending" | "already-pending" | "already-confirmed" }
  | { ok: false; reason: "invalid-email" | "mail-not-configured" | "error" };

function confirmationEmail(locale: NewsletterLocale, token: string) {
  const link = `${siteUrl()}/api/newsletter/confirm?token=${token}`;
  if (locale === "fr") {
    return {
      subject: "Confirmez votre abonnement à HerbAlly",
      text: `Presque terminé.\n\nConfirmez votre abonnement en ouvrant ce lien :\n${link}\n\nSi vous n'avez pas demandé ceci, ignorez ce courriel — personne ne sera abonné.\n\n— HerbAlly, herbally.app`,
      html: `<p>Presque terminé.</p><p><a href="${link}">Confirmer mon abonnement</a></p><p>Si vous n'avez pas demandé ceci, ignorez ce courriel — personne ne sera abonné.</p><p>— HerbAlly, herbally.app</p>`,
    };
  }
  return {
    subject: "Confirm your HerbAlly subscription",
    text: `Almost done.\n\nConfirm your subscription by opening this link:\n${link}\n\nIf you didn't ask for this, ignore this email — nobody will be subscribed.\n\n— HerbAlly, herbally.app`,
    html: `<p>Almost done.</p><p><a href="${link}">Confirm my subscription</a></p><p>If you didn't ask for this, ignore this email — nobody will be subscribed.</p><p>— HerbAlly, herbally.app</p>`,
  };
}

export async function subscribe(input: {
  email: string;
  locale: NewsletterLocale;
  sourcePath?: string | null;
}): Promise<SubscribeOutcome> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: "invalid-email" };

  // Refuse up front if we cannot actually send. A form that accepts addresses
  // while the mailbox is unconfigured collects consent that can never be
  // honoured — and an unconfirmed row is not a subscriber anyway.
  if (!isMailConfigured()) {
    logger.error("newsletter: Zoho SMTP is not configured; refusing subscribe");
    return { ok: false, reason: "mail-not-configured" };
  }

  try {
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, status, confirm_token")
      .eq("email", email)
      .maybeSingle();

    let token: string;

    if (existing) {
      if (existing.status === "confirmed") {
        return { ok: true, status: "already-confirmed" };
      }
      token = existing.confirm_token as string;
      if (existing.status === "unsubscribed") {
        // Re-subscribing after an opt-out needs fresh express consent, which
        // this submit is; reset the row rather than silently flipping it back.
        await supabase
          .from("newsletter_subscribers")
          .update({
            status: "pending",
            consent_text: CONSENT_TEXT[input.locale],
            consented_at: new Date().toISOString(),
            unsubscribed_at: null,
            locale: input.locale,
            source_path: input.sourcePath ?? null,
          })
          .eq("id", existing.id);
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("newsletter_subscribers")
        .insert({
          email,
          locale: input.locale,
          source_path: input.sourcePath ?? null,
          consent_text: CONSENT_TEXT[input.locale],
          status: "pending",
        })
        .select("confirm_token")
        .single();

      if (error || !inserted) {
        logger.error("newsletter: insert failed", { error: error?.message });
        return { ok: false, reason: "error" };
      }
      token = inserted.confirm_token as string;
    }

    const mail = confirmationEmail(input.locale, token);
    const result = await sendMail({ to: email, ...mail });

    if (!result.sent) {
      logger.error("newsletter: confirmation send failed", {
        reason: result.reason,
      });
      return { ok: false, reason: "error" };
    }

    return {
      ok: true,
      status: existing ? "already-pending" : "pending",
    };
  } catch (error) {
    logger.error("newsletter: unexpected failure", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "error" };
  }
}
