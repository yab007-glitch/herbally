# HerbAlly Security Policy, Safe Harbor & Zero-Cost Community Penetration Testing Program

HerbAlly welcomes good-faith security research, independent penetration testing, and responsible vulnerability disclosure from independent security researchers, OWASP chapters, academic cybersecurity teams, and clinical IT reviewers.

## 1. Safe Harbor (Authorized Good-Faith Testing)

If you conduct security research against HerbAlly in good faith and follow the scope and rules below:

- We authorize your testing under this policy and will **not** pursue legal action or initiate law-enforcement complaints for good-faith compliance with these guidelines.
- If you accidentally encounter unintended data, stop testing that vector immediately, do not copy or exfiltrate data, and report it to us promptly.

## 2. Scope

### In Scope

- Production web application: `https://herbally.app` (EN & `/fr` routes)
- Public APIs & Open Data endpoints: `/api/*`, `/open-data/*`
- Embedded widgets & Web Component loader: `/embed/*`, `/embed.js`
- Authentication & reviewer intake flows: `/clinical-review`, `/api/auth/linkedin/*`, `/api/clinical-edits`
- HTTP security headers, Content-Security-Policy (CSP), clickjacking isolation, CORS, and cookie flags
- Open-source application code and PostgreSQL RLS/trigger migrations in `yab007-glitch/herbally`

### Out of Scope (Strictly Prohibited)

- Denial-of-service (DoS / DDoS), volumetric traffic flooding, or automated scanning exceeding ~2 requests/second
- Testing against other users' accounts, credential stuffing, phishing, or social engineering
- Testing third-party infrastructure outside HerbAlly's control (Cloudflare edge internals, GitHub, Stripe, LinkedIn, Health Canada LNHPD, NCBI)
- Submitting automated scanner output without reproducible proof of impact

## 3. How to Report & Triage SLAs

Email **privacy@herbally.app** (or **info@herbally.app**) with:

1. Affected URL / route / migration file
2. Clear reproduction steps or minimal proof-of-concept
3. Potential clinical, privacy, or security impact

**Target Response & Remediation SLAs:**

- **Critical** (RCE, auth bypass, RLS bypass, clinical data tampering, stored XSS): **24 hours**
- **High** (reflected XSS, CSRF, SSRF, open redirect, sensitive data exposure): **72 hours**
- **Medium** (header bypass, logic flaw, rate-limit bypass): **7 days**
- **Low** (hardening suggestions, minor info disclosure): **30 days**

## 4. Zero-Cost Researcher Recognition (Hall of Fame & Attestation)

HerbAlly is a free, donation-supported public-interest educational project with a **$0 security-bounty budget**. In lieu of cash bounties, verified good-faith researchers receive:

1. **Permanent Public Credit** (name, handle, affiliation, and link) in the **HerbAlly Security Researchers Hall of Fame** at `https://herbally.app/trust#security-hall-of-fame` (opt-in).
2. **CVE / GitHub Security Advisory Co-Authorship** for valid high/critical vulnerabilities.
3. **Signed Academic / Professional Verification Letter** confirming independent security audit contribution (useful for university capstone projects, cybersecurity portfolios, and LinkedIn).

## 5. Automated Zero-Cost OWASP Top 10 / ASVS Verification Suite

Anyone can reproduce our automated black-box security test suite locally or against production at zero cost:

```bash
npx tsx scripts/pentest-suite.ts --base-url https://herbally.app
```

This harness also executes continuously in GitHub Actions against a live migrated PostgreSQL 16 + Next.js server (`ci.yml`) and on a scheduled weekly production audit (`security-pentest.yml`).
