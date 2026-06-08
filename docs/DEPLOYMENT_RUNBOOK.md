# HerbAlly Deployment Runbook

**Last Updated:** May 11, 2026  
**Owner:** Tech Lead  
**Status:** ✅ Production Ready

---

## Quick Start

```bash
# Development
npm run dev

# Production Build
npm run build
npm run start

# Run All Tests
npm run test:run && npm run test:e2e

# Deploy to Production
git push origin main  # Triggers Vercel deployment
```

---

## Environment Variables

### Required (Production)

| Variable                        | Description               | Source                 |
| ------------------------------- | ------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL      | Supabase Dashboard     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key  | Supabase Dashboard     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key | Supabase Dashboard     |
| `OPENROUTER_API_KEY`            | AI provider API key       | OpenRouter             |
| `STRIPE_SECRET_KEY`             | Stripe secret key         | Stripe Dashboard       |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook secret     | Stripe CLI / Dashboard |
| `SENTRY_ORG`                    | Sentry organization       | Sentry Dashboard       |
| `SENTRY_PROJECT`                | Sentry project            | Sentry Dashboard       |
| `SENTRY_AUTH_TOKEN`             | Sentry auth token         | Sentry Dashboard       |

### Optional

| Variable                   | Description                 | Default                        |
| -------------------------- | --------------------------- | ------------------------------ |
| `NEXT_PUBLIC_APP_URL`      | App URL for meta tags       | `https://herbally.app`         |
| `OPENROUTER_BASE_URL`      | Custom OpenRouter endpoint  | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL`         | AI model to use             | `openrouter/free`              |
| `RATE_LIMIT_BACKEND`       | `memory` or `upstash`       | `memory`                       |
| `UPSTASH_REDIS_REST_URL`   | Redis URL for rate limiting | -                              |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token                 | -                              |
| `OPENFDA_BASE_URL`         | Custom FDA API endpoint     | `https://api.fda.gov`          |

### Setup Instructions

1. **Supabase**

   ```bash
   # Create project at https://supabase.com
   # Run migrations from supabase/migrations/
   # Copy URL and keys from Settings > API
   ```

2. **OpenRouter**

   ```bash
   # Create account at https://openrouter.ai
   # Generate API key from dashboard
   # Recommended model: anthropic/claude-3-haiku
   ```

3. **Stripe**

   ```bash
   # Create account at https://stripe.com
   # Get secret key from Developers > API keys
   # Set up webhook endpoint: https://your-domain.com/api/webhooks/stripe
   # Webhook secret: run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   ```

4. **Sentry**
   ```bash
   # Create project at https://sentry.io
   # Create auth token from Settings > API
   # Install Sentry CLI: npm install -g @sentry/cli
   ```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm run test:run && npm run test:e2e`)
- [ ] Lint clean (`npm run lint`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] Format check passes (`npm run format:check`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables updated in Vercel
- [ ] Database migrations applied
- [ ] No sensitive data in code (`.env.local` not committed)

### Deployment (Vercel)

1. **Push to main**

   ```bash
   git checkout main
   git pull origin main
   git push origin main
   ```

2. **Monitor build**
   - Go to https://vercel.com/dashboard
   - Watch build progress
   - Check for build errors

3. **Verify deployment**
   - [ ] Homepage loads
   - [ ] Search works
   - [ ] Herb detail pages load
   - [ ] Calculator works
   - [ ] AI chat works
   - [ ] No console errors

### Post-Deployment

- [ ] Check Sentry for errors: https://sentry.io
- [ ] Verify Web Vitals in Vercel Analytics
- [ ] Test critical user flows
- [ ] Monitor Stripe webhooks
- [ ] Check Supabase logs for errors

---

## Rollback Procedure

### If Production Has Issues

1. **Identify the problem**

   ```bash
   # Check recent commits
   git log --oneline -10

   # Check Vercel deployments
   vercel ls
   ```

2. **Rollback to previous deployment**

   ```bash
   # Find previous deployment ID
   vercel ls --all

   # Rollback
   vercel rollback <deployment-id>
   ```

3. **Or revert commit**

   ```bash
   git revert HEAD
   git push origin main
   ```

4. **Communicate**
   - Update status page
   - Notify team on Slack
   - Document incident

---

## Monitoring

### Health Checks

```bash
# API health endpoint
curl https://herbally.app/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-05-11T...",
#   "services": {
#     "supabase": "healthy",
#     "openrouter": "healthy",
#     "stripe": "healthy"
#   }
# }
```

### Key Metrics

| Metric            | Target  | Alert Threshold |
| ----------------- | ------- | --------------- |
| LCP               | < 2.5s  | > 4.0s          |
| INP               | < 200ms | > 500ms         |
| CLS               | < 0.1   | > 0.25          |
| Error Rate        | < 1%    | > 5%            |
| API Latency (p95) | < 500ms | > 2000ms        |

### Dashboards

- **Vercel Analytics**: https://vercel.com/analytics
- **Sentry Errors**: https://sentry.io
- **Supabase Logs**: https://supabase.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com

---

## Disaster Recovery

### Database Backup

```bash
# Supabase automatic backups (daily)
# Restore from Dashboard > Database > Backups
```

### Environment Variables Backup

```bash
# Keep secure backup of all env vars
# Use 1Password or similar secrets manager
```

### Emergency Contacts

| Role      | Contact        |
| --------- | -------------- |
| Tech Lead | [Your contact] |
| DevOps    | [Contact]      |
| On-Call   | [Contact]      |

---

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
npm run analyze

# Look for:
# - Large dependencies
# - Duplicate packages
# - Missing code splitting
```

### Image Optimization

- All images should use Next.js Image component
- AVIF format preferred
- Proper dimensions to prevent CLS

### Caching Strategy

| Resource      | Cache Duration |
| ------------- | -------------- |
| Static assets | 1 year         |
| Images        | 30 days        |
| API responses | 1 hour (ISR)   |
| Herb pages    | 1 hour (ISR)   |

---

## Security

### Headers (Configured in middleware.ts)

- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Content-Security-Policy
- ✅ Strict-Transport-Security (production)

### Rate Limiting

- Default: Memory-based (development)
- Production: Upstash Redis recommended
- Limits: 100 requests/minute per IP

### Secrets Management

- ✅ No secrets in code
- ✅ Environment variables only
- ✅ `.env.local` in `.gitignore`
- ✅ Vercel environment variables encrypted

---

## Troubleshooting

### Common Issues

**Build fails with "Module not found"**

```bash
npm install
npm run build
```

**Environment variables not working**

- Check Vercel dashboard > Project Settings > Environment Variables
- Redeploy after adding new variables
- Prefix with `NEXT_PUBLIC_` for client-side access

**Slow database queries**

- Check Supabase dashboard for slow queries
- Verify indexes exist on filtered columns
- Consider adding Redis caching

**AI responses slow or failing**

- Check OpenRouter status
- Verify API key is valid
- Consider fallback model configuration

---

## Continuous Improvement

- [ ] Set up automated performance budgets
- [ ] Add uptime monitoring (UptimeRobot/Pingdom)
- [ ] Implement feature flags
- [ ] Add A/B testing infrastructure
- [ ] Create staging environment
- [ ] Set up automated security scanning

---

_This runbook is a living document. Update after every incident or major change._
