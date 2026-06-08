# HerbAlly Improvement Roadmap

**Owner:** AI Tech Lead  
**Date:** May 11, 2026  
**Mission:** Transform HerbAlly into a bulletproof, scalable, revenue-generating SaaS

---

## Phase 1: Foundation (Week 1) ✅

### 1.1 Test Coverage - CRITICAL

- [ ] Add E2E tests with Playwright (critical user flows)
- [ ] Add component tests (React Testing Library)
- [ ] Add API route tests
- [ ] Target: 70%+ coverage on src/lib and src/components

### 1.2 Dependency Health

- [ ] Update safe dependencies (minor/patch)
- [ ] Test and update major dependencies
- [ ] Add dependency update automation (Dependabot/Renovate)

### 1.3 Documentation

- [ ] API documentation (OpenAPI spec)
- [ ] Deployment runbook
- [ ] Onboarding guide for new developers
- [ ] Architecture decision records (ADRs)

---

## Phase 2: Reliability (Week 2)

### 2.1 Observability

- [ ] Structured logging (pino/winston)
- [ ] Log aggregation setup
- [ ] Performance dashboards
- [ ] Alert configuration (PagerDuty/Slack)

### 2.2 Resilience

- [ ] Rate limiting improvements (Redis)
- [ ] Circuit breaker for AI provider
- [ ] Fallback AI provider configuration
- [ ] Database connection pooling optimization

### 2.3 Security Hardening

- [ ] Automated security scanning (Snyk/Dependabot)
- [ ] Penetration testing checklist
- [ ] Secrets management (Vercel Environment Variables)
- [ ] CSP report-only mode for monitoring

---

## Phase 3: Performance (Week 3)

### 3.1 Core Web Vitals

- [ ] LCP < 2.5s (optimize hero images, fonts)
- [ ] INP < 200ms (code splitting, debouncing)
- [ ] CLS < 0.1 (image dimensions, font loading)

### 3.2 Bundle Optimization

- [ ] Bundle analyzer integration
- [ ] Lazy loading for heavy components
- [ ] Tree shaking verification
- [ ] Image optimization (AVIF, responsive)

### 3.3 Database Performance

- [ ] Query performance monitoring
- [ ] Index optimization
- [ ] Caching layer (Redis for frequent queries)
- [ ] Connection pooling tuning

---

## Phase 4: Growth (Week 4)

### 4.1 Monetization

- [ ] Multiple payment providers (PayPal, crypto)
- [ ] Premium features (advanced analytics, exports)
- [ ] Subscription tiers
- [ ] Affiliate program infrastructure

### 4.2 User Experience

- [ ] Personalization (user accounts, saved herbs)
- [ ] Mobile app (PWA improvements)
- [ ] Offline mode enhancement
- [ ] Accessibility audit (WCAG 2.1 AA)

### 4.3 Marketing Infrastructure

- [ ] SEO optimization (schema markup, sitemaps)
- [ ] Email marketing integration
- [ ] Analytics dashboards (Mixpanel/Amplitude)
- [ ] A/B testing framework

---

## Quick Wins (Do First)

1. ✅ Fix ESLint errors (DONE)
2. ✅ Format code (DONE)
3. ✅ Deploy fixes (DONE)
4. [ ] Add Playwright E2E tests
5. [ ] Add bundle analyzer
6. [ ] Set up Dependabot
7. [ ] Add API documentation
8. [ ] Create deployment runbook

---

## Success Metrics

| Metric                   | Current    | Target  | Timeline |
| ------------------------ | ---------- | ------- | -------- |
| Test Coverage            | ~30%       | 70%+    | 2 weeks  |
| LCP                      | TBD        | < 2.5s  | 1 week   |
| INP                      | TBD        | < 200ms | 1 week   |
| CLS                      | TBD        | < 0.1   | 1 week   |
| Dependencies Outdated    | 23         | < 5     | 1 week   |
| Security Vulnerabilities | 2 moderate | 0       | 1 week   |
| Documentation Pages      | 3          | 10+     | 2 weeks  |

---

## Principles

1. **Evidence Before Claims** - Never say it works without proof
2. **Automate Everything** - If done twice, script it
3. **Observability First** - You can't fix what you can't see
4. **Security by Default** - No shortcuts on user safety
5. **Performance is a Feature** - Fast = usable = revenue
6. **Documentation is Code** - Undocumented = doesn't exist
7. **Tests are Insurance** - Pay the premium or risk everything

---

_This is a living document. Update as we learn and ship._
