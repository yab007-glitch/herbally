import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound mail, sent through the owner's Zoho Mail mailbox.
 *
 * Zoho is already paid for and already owns `herbally.app`'s sending
 * reputation, so there is no third-party ESP in the loop: the `From:` address
 * is a real mailbox a person can reply to, which is also what CASL wants.
 *
 * Configuration (Vercel environment variables — never committed):
 *   ZOHO_SMTP_USER      full mailbox address, e.g. info@herbally.app
 *   ZOHO_SMTP_PASSWORD  Zoho *app-specific* password, not the account password
 *   ZOHO_SMTP_HOST      optional; defaults to smtp.zoho.com
 *   ZOHO_SMTP_PORT      optional; defaults to 465 (implicit TLS)
 *
 * Region matters: a mailbox hosted on zoho.ca uses smtp.zoho.ca, zoho.eu uses
 * smtp.zoho.eu. Wrong host fails with ETIMEDOUT or a certificate error, not a
 * friendly message, so the host is configurable rather than assumed.
 *
 * When the credentials are absent the transport is simply not created and
 * `sendMail` returns `{ sent: false, reason: "not-configured" }`. Callers must
 * surface that rather than pretending a message went out — a subscribe form
 * that silently swallows mail is worse than one that says it is not ready.
 */

export const SMTP_DNS_TIMEOUT_MS = 10_000;
export const SMTP_CONNECTION_TIMEOUT_MS = 15_000;
export const SMTP_GREETING_TIMEOUT_MS = 15_000;
export const SMTP_SOCKET_TIMEOUT_MS = 20_000;
export const SMTP_SOCKET_CLOSE_TIMEOUT_MS = 2_000;
export const SMTP_SEND_DEADLINE_MS = 45_000;

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type MailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "not-configured" | "error"; detail?: string };

type BoundedTransportOptions = NonNullable<
  Parameters<typeof nodemailer.createTransport>[0]
> & {
  dnsTimeout?: number;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  socketCloseTimeout?: number;
};

type AbortableMailOptions = Parameters<Transporter["sendMail"]>[0] & {
  signal?: AbortSignal;
};

let cached: Transporter | null = null;

function fromAddress(): string {
  const user = process.env.ZOHO_SMTP_USER ?? "";
  return process.env.NEWSLETTER_FROM ?? `HerbAlly <${user}>`;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASSWORD);
}

function transport(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cached) return cached;

  const port = Number(process.env.ZOHO_SMTP_PORT ?? 465);
  const options: BoundedTransportOptions = {
    host: process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
    dnsTimeout: SMTP_DNS_TIMEOUT_MS,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    socketCloseTimeout: SMTP_SOCKET_CLOSE_TIMEOUT_MS,
  };
  cached = nodemailer.createTransport(options);
  return cached;
}

function abortReasonMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason.length > 0) return reason;
  return fallback;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const tx = transport();
  if (!tx) return { sent: false, reason: "not-configured" };

  if (input.signal?.aborted) {
    return {
      sent: false,
      reason: "error",
      detail: abortReasonMessage(input.signal.reason, "SMTP send aborted"),
    };
  }

  const deadlineMs =
    typeof input.timeoutMs === "number" &&
    Number.isFinite(input.timeoutMs) &&
    input.timeoutMs > 0
      ? Math.min(input.timeoutMs, SMTP_SEND_DEADLINE_MS)
      : SMTP_SEND_DEADLINE_MS;

  const controller = new AbortController();
  const onExternalAbort = () => {
    controller.abort(
      input.signal?.reason ?? new Error("SMTP send aborted by caller")
    );
  };
  input.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new Error(`SMTP send timed out after ${deadlineMs}ms`));
  }, deadlineMs);

  try {
    const mailOptions: AbortableMailOptions = {
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      // A newsletter must always be reply-able; deliverability also suffers
      // without it.
      replyTo: process.env.ZOHO_SMTP_USER,
      signal: controller.signal,
    };
    const info = await tx.sendMail(mailOptions);
    if (controller.signal.aborted) {
      return {
        sent: false,
        reason: "error",
        detail: abortReasonMessage(
          controller.signal.reason,
          "SMTP send aborted"
        ),
      };
    }
    return { sent: true, id: info.messageId };
  } catch (error) {
    return {
      sent: false,
      reason: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Test seam: drop the cached transport (used by unit tests). */
export function resetMailTransport() {
  cached = null;
}
