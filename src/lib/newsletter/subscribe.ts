import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import {
  SMTP_SEND_DEADLINE_MS,
  sendMail,
  isMailConfigured,
} from "@/lib/email/mailer";
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

  // Disallow subscriptions to our own domain. Submitting non-existent
  // mailboxes generates 550 MTA bounces in Zoho Mail, hurting domain reputation.
  const domain = email.split("@")[1];
  if (domain === "herbally.app" || domain.endsWith(".herbally.app")) {
    return null;
  }

  return email;
}

export const RESEND_COOLDOWN_MS = 15 * 60_000;
export const SEND_LEASE_MS = 2 * 60_000;
export const SEND_DEADLINE_MS = Math.min(
  SMTP_SEND_DEADLINE_MS,
  SEND_LEASE_MS - 15_000
);
const MAX_LOCAL_LEASES = 10_000;

interface LocalSendLease {
  id: string;
  expiresAt: number;
  rowId: string | null;
  confirmToken: string | null;
  leaseUntilIso: string;
}

const activeLeases = new Map<string, LocalSendLease>();

/** Test seam: clear in-memory per-address send leases (simulates restart/other replica). */
export function resetNewsletterSendLeases() {
  activeLeases.clear();
}

export interface LocalLeaseInvalidationMatch {
  email: string;
  rowId?: string | null;
  confirmToken?: string | null;
  leaseId?: string | null;
}

/**
 * Invalidate an in-memory send lease after a lifecycle transition (confirm /
 * unsubscribe), guarded by row/token/lease-ID identity so an older request
 * cannot delete a newer lifecycle cycle's lease.
 */
export function invalidateNewsletterSendLease(
  match: LocalLeaseInvalidationMatch
): boolean {
  const email = match.email.trim().toLowerCase();
  if (!email) return false;

  const current = activeLeases.get(email);
  if (!current) return false;

  const hasGuard =
    Boolean(match.leaseId) ||
    Boolean(match.confirmToken) ||
    Boolean(match.rowId);
  if (!hasGuard) return false;

  if (match.leaseId != null && current.id !== match.leaseId) return false;
  if (match.rowId != null && current.rowId !== match.rowId) return false;
  if (
    match.confirmToken != null &&
    current.confirmToken !== match.confirmToken
  ) {
    return false;
  }

  if (activeLeases.get(email)?.id !== current.id) return false;
  activeLeases.delete(email);
  return true;
}

function evictExpiredOrOldestLeases(now: number) {
  if (activeLeases.size < MAX_LOCAL_LEASES) return;
  for (const [k, lease] of activeLeases) {
    if (lease.expiresAt <= now) activeLeases.delete(k);
  }
  if (activeLeases.size >= MAX_LOCAL_LEASES) {
    const oldestKey = activeLeases.keys().next().value;
    if (oldestKey !== undefined) activeLeases.delete(oldestKey);
  }
}

interface LocalLeaseMeta {
  rowId: string | null;
  confirmToken: string | null;
  leaseUntilIso: string;
}

function claimLocalLease(
  email: string,
  now: number,
  meta: LocalLeaseMeta
): LocalSendLease | null {
  const existing = activeLeases.get(email);
  if (existing) {
    if (existing.expiresAt > now) {
      const supersededToken =
        existing.confirmToken !== null &&
        meta.confirmToken !== null &&
        existing.confirmToken !== meta.confirmToken;
      if (!supersededToken) {
        return null;
      }
    }
    activeLeases.delete(email);
  }

  evictExpiredOrOldestLeases(now);

  const lease: LocalSendLease = {
    id: crypto.randomUUID(),
    expiresAt: now + SEND_LEASE_MS,
    rowId: meta.rowId,
    confirmToken: meta.confirmToken,
    leaseUntilIso: meta.leaseUntilIso,
  };
  activeLeases.set(email, lease);
  return lease;
}

function installLocalLease(
  email: string,
  now: number,
  meta: LocalLeaseMeta
): LocalSendLease {
  activeLeases.delete(email);
  evictExpiredOrOldestLeases(now);

  const lease: LocalSendLease = {
    id: crypto.randomUUID(),
    expiresAt: now + SEND_LEASE_MS,
    rowId: meta.rowId,
    confirmToken: meta.confirmToken,
    leaseUntilIso: meta.leaseUntilIso,
  };
  activeLeases.set(email, lease);
  return lease;
}

export type SubscribeOutcome =
  | { ok: true; status: "accepted" }
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
  hp?: string | null;
}): Promise<SubscribeOutcome> {
  // Silent drop for automated bots filling the honeypot field
  if (input.hp && input.hp.trim().length > 0) {
    logger.warn("newsletter: honeypot triggered; silently ignoring submit");
    return { ok: true, status: "accepted" };
  }

  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: "invalid-email" };

  // Refuse up front if we cannot actually send. A form that accepts addresses
  // while the mailbox is unconfigured collects consent that can never be
  // honoured — and an unconfirmed row is not a subscriber anyway.
  if (!isMailConfigured()) {
    logger.error("newsletter: Zoho SMTP is not configured; refusing subscribe");
    return { ok: false, reason: "mail-not-configured" };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const leaseUntilIso = new Date(now + SEND_LEASE_MS).toISOString();
  let localLease: LocalSendLease | null = null;
  let releaseLocalLease = true;
  let dbLeaseAcquired = false;
  let rowId: string | null = null;

  try {
    const supabase = createAdminClient();

    const { data: existing, error: selectError } = await supabase
      .from("newsletter_subscribers")
      .select(
        "id, status, confirm_token, consented_at, last_confirmation_sent_at, confirmation_send_lease_until"
      )
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      logger.error("newsletter: lookup failed", { error: selectError.message });
      return { ok: false, reason: "error" };
    }

    let token: string;

    if (existing) {
      if (existing.status === "confirmed") {
        // Uniform external outcome prevents subscription enumeration.
        return { ok: true, status: "accepted" };
      }

      rowId = existing.id as string;

      if (existing.status === "pending") {
        // Cooldown and active send lease apply only to already-pending rows
        // and never extend windows or write DB state on suppressed hits.
        const lastSentMs = existing.last_confirmation_sent_at
          ? Date.parse(String(existing.last_confirmation_sent_at))
          : NaN;
        if (
          Number.isFinite(lastSentMs) &&
          now - lastSentMs < RESEND_COOLDOWN_MS
        ) {
          return { ok: true, status: "accepted" };
        }

        const leaseUntilMs = existing.confirmation_send_lease_until
          ? Date.parse(String(existing.confirmation_send_lease_until))
          : NaN;
        if (Number.isFinite(leaseUntilMs) && leaseUntilMs > now) {
          return { ok: true, status: "accepted" };
        }

        localLease = claimLocalLease(email, now, {
          rowId,
          confirmToken: existing.confirm_token as string,
          leaseUntilIso,
        });
        if (!localLease) {
          return { ok: true, status: "accepted" };
        }

        // Atomically claim the DB send lease BEFORE invoking sendMail so
        // concurrent requests across instances and post-send stamp failures
        // cannot permit a second immediate email.
        let leaseQuery = supabase
          .from("newsletter_subscribers")
          .update({ confirmation_send_lease_until: leaseUntilIso })
          .eq("id", existing.id)
          .eq("status", "pending")
          .or(
            `confirmation_send_lease_until.is.null,confirmation_send_lease_until.lte.${nowIso}`
          );
        leaseQuery = existing.last_confirmation_sent_at
          ? leaseQuery.eq(
              "last_confirmation_sent_at",
              existing.last_confirmation_sent_at
            )
          : leaseQuery.is("last_confirmation_sent_at", null);

        const { data: claimed, error: leaseError } = await leaseQuery
          .select("id")
          .maybeSingle();

        if (leaseError) {
          logger.error("newsletter: lease acquisition failed", {
            error: leaseError.message,
          });
          return { ok: false, reason: "error" };
        }
        if (!claimed) {
          return { ok: true, status: "accepted" };
        }
        dbLeaseAcquired = true;
        token = existing.confirm_token as string;
      } else {
        // status === "unsubscribed": re-subscribing after opt-out requires
        // fresh express consent and a fresh confirmation token, overriding any
        // prior cooldown window or stale local pending lease while acquiring an
        // atomic send lease.
        token = crypto.randomUUID();
        const { data: resubscribed, error: updateError } = await supabase
          .from("newsletter_subscribers")
          .update({
            status: "pending",
            subscribed: false,
            consent_text: CONSENT_TEXT[input.locale],
            consented_at: nowIso,
            unsubscribed_at: null,
            confirmed_at: null,
            confirm_token: token,
            last_confirmation_sent_at: null,
            confirmation_send_lease_until: leaseUntilIso,
            locale: input.locale,
            source_path: input.sourcePath ?? null,
          })
          .eq("id", existing.id)
          .eq("status", "unsubscribed")
          .select("id")
          .maybeSingle();

        if (updateError) {
          logger.error("newsletter: resubscribe update failed", {
            error: updateError.message,
          });
          return { ok: false, reason: "error" };
        }
        if (!resubscribed) {
          return { ok: true, status: "accepted" };
        }
        dbLeaseAcquired = true;
        localLease = installLocalLease(email, now, {
          rowId,
          confirmToken: token,
          leaseUntilIso,
        });
      }
    } else {
      localLease = claimLocalLease(email, now, {
        rowId: null,
        confirmToken: null,
        leaseUntilIso,
      });
      if (!localLease) {
        return { ok: true, status: "accepted" };
      }

      const { data: inserted, error } = await supabase
        .from("newsletter_subscribers")
        .insert({
          email,
          locale: input.locale,
          source_path: input.sourcePath ?? null,
          consent_text: CONSENT_TEXT[input.locale],
          consented_at: nowIso,
          status: "pending",
          subscribed: false,
          last_confirmation_sent_at: null,
          confirmation_send_lease_until: leaseUntilIso,
        })
        .select("id, confirm_token")
        .single();

      if (error || !inserted) {
        if (error?.code === "23505") {
          return { ok: true, status: "accepted" };
        }
        logger.error("newsletter: insert failed", { error: error?.message });
        return { ok: false, reason: "error" };
      }
      dbLeaseAcquired = true;
      rowId = (inserted as { id?: string }).id ?? null;
      token = inserted.confirm_token as string;
      localLease.rowId = rowId;
      localLease.confirmToken = token;
    }

    const releaseDbLease = async () => {
      if (!dbLeaseAcquired) return;
      try {
        const base = supabase
          .from("newsletter_subscribers")
          .update({ confirmation_send_lease_until: null })
          .eq("status", "pending")
          .eq("confirm_token", token)
          .eq("confirmation_send_lease_until", leaseUntilIso);
        const { error: releaseError } = rowId
          ? await base.eq("id", rowId)
          : await base.eq("email", email);
        if (releaseError) {
          logger.error("newsletter: failed to release send lease", {
            error: releaseError.message,
          });
        }
      } catch (releaseErr) {
        logger.error("newsletter: exception releasing send lease", {
          detail:
            releaseErr instanceof Error
              ? releaseErr.message
              : String(releaseErr),
        });
      }
    };

    const mail = confirmationEmail(input.locale, token);
    const sendController = new AbortController();
    const sendTimer = setTimeout(() => {
      sendController.abort(
        new Error(`newsletter send timed out after ${SEND_DEADLINE_MS}ms`)
      );
    }, SEND_DEADLINE_MS);

    let result: Awaited<ReturnType<typeof sendMail>>;
    try {
      result = await sendMail({
        to: email,
        ...mail,
        signal: sendController.signal,
        timeoutMs: SEND_DEADLINE_MS,
      });
    } catch (mailErr) {
      logger.error("newsletter: sendMail threw", {
        detail: mailErr instanceof Error ? mailErr.message : String(mailErr),
      });
      await releaseDbLease();
      return { ok: true, status: "accepted" };
    } finally {
      clearTimeout(sendTimer);
    }

    if (sendController.signal.aborted || !result.sent) {
      logger.error("newsletter: confirmation send failed", {
        reason: sendController.signal.aborted
          ? "timeout"
          : !result.sent
            ? result.reason
            : "error",
      });
      // Release the pre-send lease on SMTP failure/timeout without recording
      // last_confirmation_sent_at, keeping the external outcome uniform.
      await releaseDbLease();
      return { ok: true, status: "accepted" };
    }

    const sentIso = new Date().toISOString();
    try {
      const stampQuery = supabase
        .from("newsletter_subscribers")
        .update({
          last_confirmation_sent_at: sentIso,
          confirmation_send_lease_until: null,
        })
        .eq("status", "pending")
        .eq("confirm_token", token)
        .eq("confirmation_send_lease_until", leaseUntilIso);
      const { error: stampError } = rowId
        ? await stampQuery.eq("id", rowId)
        : await stampQuery.eq("email", email);
      if (stampError) {
        // Mail was already sent; keep both DB and local send leases active until
        // expiry so immediate retries cannot fire a duplicate email.
        releaseLocalLease = false;
        logger.error("newsletter: failed to record last_confirmation_sent_at", {
          error: stampError.message,
        });
      }
    } catch (stampErr) {
      releaseLocalLease = false;
      logger.error(
        "newsletter: exception recording last_confirmation_sent_at",
        {
          detail:
            stampErr instanceof Error ? stampErr.message : String(stampErr),
        }
      );
    }

    return {
      ok: true,
      status: "accepted",
    };
  } catch (error) {
    logger.error("newsletter: unexpected failure", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "error" };
  } finally {
    if (
      releaseLocalLease &&
      localLease &&
      activeLeases.get(email)?.id === localLease.id
    ) {
      activeLeases.delete(email);
    }
  }
}
