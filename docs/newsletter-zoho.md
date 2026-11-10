# Newsletter — Zoho Mail setup

The signup box on herb pages uses the owner's existing **Zoho Mail** mailbox as
the sender. No third-party email service, no new subscription: the `From:`
address is a real mailbox someone can reply to, which is both better for
deliverability and what CASL expects.

## Why it is built this way

Canada's Anti-Spam Legislation requires three things a form alone does not give
you:

1. **Express consent you can prove.** The exact sentence the person agreed to is
   stored on their row (`consent_text`) with the timestamp (`consented_at`).
   "They typed an address" is not evidence of consent.
2. **Double opt-in.** A new row is `pending`. It becomes `confirmed` only when
   the confirmation link is opened from that mailbox — so nobody can subscribe
   someone else, and a typo cannot add a stranger to the list.
3. **An unsubscribe that works.** Every digest must carry a one-click link.
   The row is marked `unsubscribed`, never deleted — deleting it would destroy
   the record that consent was withdrawn.

A consequence worth stating plainly: **the form refuses to accept an address
while the mailbox is not configured.** It returns `503 not-configured` and
stores nothing. A form that silently collects consent it can never honour is
worse than one that says it is not ready.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable             | Value                          | Notes                                                                                                                |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ZOHO_SMTP_USER`     | `info@herbally.app`            | The full mailbox address. Must match the domain actually sending.                                                    |
| `ZOHO_SMTP_PASSWORD` | _(app-specific password)_      | **Not** the account password. See below.                                                                             |
| `ZOHO_SMTP_HOST`     | `smtp.zoho.com`                | Use `smtp.zoho.ca` for a zoho.ca mailbox, `smtp.zoho.eu` for EU. Wrong host fails as a timeout or certificate error. |
| `ZOHO_SMTP_PORT`     | `465`                          | 465 = implicit TLS. Use 587 for STARTTLS.                                                                            |
| `NEWSLETTER_FROM`    | `HerbAlly <info@herbally.app>` | Optional; defaults to `HerbAlly <ZOHO_SMTP_USER>`.                                                                   |

### Getting the app-specific password

1. Zoho Mail → Settings → **Security** → **App Passwords** → Generate.
2. Name it `herbally-web`, scope it to Mail.
3. Paste the generated value into Vercel as `ZOHO_SMTP_PASSWORD`.

Do this in the Zoho and Vercel dashboards. **Never send the password through
chat, and never commit it.** If it is ever pasted somewhere it should not be,
revoke that app password and generate a new one — they are cheap to rotate.

## Verifying

```bash
# 1. the route should answer 503 while unconfigured, and store nothing
curl -s -X POST https://herbally.app/api/newsletter \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","locale":"en"}' -w '\n%{http_code}\n'

# 2. after setting the env vars and redeploying, the same call returns
#    {"ok":true,"status":"pending"} and a confirmation email arrives
```

Then check the row: `select email, status, consent_text, consented_at from
newsletter_subscribers;` — it should be `pending`, and the stored consent text
should match what the form displayed.

## Sending the actual digest

Capture and sending are deliberately separate. Until a digest is deliberately
composed, `last_sent_at` stays null and nobody receives anything. When sending:

- mail only `status = 'confirmed'`
- include the unsubscribe link built from `unsubscribe_token` on every message
- identify the sender and the purpose in the body
- respect `unsubscribed_at` immediately, including unsubscribes that arrive
  after a batch has been queued

## Migration

`supabase/migrations/00066_newsletter_consent.sql` extends the existing
`newsletter_subscribers` table (created in 00034) rather than creating a second
one. Its permissive INSERT policy was already dropped in 00045; all writes here
go through the service role on the server.
