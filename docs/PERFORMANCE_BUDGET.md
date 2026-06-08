# HerbAlly Performance Budget

**Date:** May 11, 2026  
**Target:** Production Excellence  
**Status:** 🎯 Active

---

## Core Web Vitals Targets

We commit to maintaining these performance standards for all users:

| Metric                              | Target  | Threshold | Measurement             |
| ----------------------------------- | ------- | --------- | ----------------------- |
| **LCP** (Largest Contentful Paint)  | < 2.5s  | > 4.0s    | p75 of all page loads   |
| **INP** (Interaction to Next Paint) | < 200ms | > 500ms   | p75 of all interactions |
| **CLS** (Cumulative Layout Shift)   | < 0.1   | > 0.25    | p75 of all page loads   |
| **FCP** (First Contentful Paint)    | < 1.8s  | > 3.0s    | p75 of all page loads   |
| **TTFB** (Time to First Byte)       | < 800ms | > 1.8s    | p75 of all requests     |

---

## Bundle Size Budget

| Resource Type            | Budget   | Current | Status     |
| ------------------------ | -------- | ------- | ---------- |
| **JavaScript (total)**   | < 500 KB | TBD     | ⚠️ Monitor |
| **JavaScript (initial)** | < 200 KB | TBD     | ⚠️ Monitor |
| **CSS (total)**          | < 100 KB | TBD     | ⚠️ Monitor |
| **Images (per page)**    | < 500 KB | TBD     | ⚠️ Monitor |
| **Fonts (total)**        | < 200 KB | TBD     | ⚠️ Monitor |

### Action Triggers

- **Warning (> 80% budget):** Investigate and plan optimization
- **Critical (> 100% budget):** Block deployment until resolved

---

## Performance Monitoring

### Tools

1. **Vercel Analytics** (Primary)
   - Real User Monitoring (RUM)
   - Core Web Vitals tracking
   - Geographic breakdown
   - URL: https://vercel.com/analytics

2. **Lighthouse CI** (CI/CD)
   - Automated performance testing
   - Regression detection
   - PR checks

3. **Web Vitals Debug** (Development)
   - Real-time metrics in dev
   - Component: `src/components/analytics/web-vitals-debug.tsx`

### Dashboards

- **Vercel Analytics:** https://vercel.com/yassers-projects/herbally/analytics
- **Sentry Performance:** https://sentry.io (TODO: Configure)
- **Custom Dashboard:** (TODO: Build with Grafana)

---

## Optimization Strategies

### Images

- ✅ Use Next.js Image component
- ✅ AVIF format (primary)
- ✅ WebP format (fallback)
- ✅ Responsive images (srcset)
- ✅ Lazy loading (below fold)
- ✅ Explicit dimensions (prevent CLS)

### Fonts

- ✅ `next/font` for optimization
- ✅ Subset fonts (Latin only)
- ✅ Font display: swap
- ✅ Preload critical fonts
- ✅ Limit font weights (2-3 max)

### JavaScript

- ✅ Code splitting (route-based)
- ✅ Dynamic imports (heavy components)
- ✅ Tree shaking (ESM imports)
- ✅ Debounce/throttle (user input)
- ✅ Memoization (expensive computations)

### CSS

- ✅ Tailwind purge (production)
- ✅ Critical CSS extraction
- ✅ CSS containment (complex components)
- ✅ Avoid expensive selectors

### Network

- ✅ HTTP/2 (Vercel default)
- ✅ CDN caching (static assets)
- ✅ ISR (Incremental Static Regeneration)
- ✅ Compression (gzip, brotli)
- ✅ Connection reuse

---

## Performance Testing

### Local Development

```bash
# Lighthouse audit
npm install -g lighthouse
lighthouse http://localhost:3000 --view

# Bundle analysis
npm run analyze

# Web Vitals (dev mode)
# Check browser console for [Web Vitals] logs
```

### CI/CD Integration

```yaml
# GitHub Actions (TODO: Add)
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v11
  with:
    urls: |
      http://localhost:3000/
      http://localhost:3000/herbs
      http://localhost:3000/calculator
    uploadArtifacts: true
    temporaryPublicStorage: true
```

### Production Monitoring

```bash
# Check Core Web Vitals
curl https://herbally.app/api/health

# Monitor real user metrics
# Vercel Analytics Dashboard
```

---

## Common Issues & Solutions

### High LCP

**Causes:**

- Slow server response
- Render-blocking resources
- Slow image load
- Large JavaScript bundle

**Solutions:**

- ✅ Enable ISR (revalidate: 3600)
- ✅ Preload critical resources
- ✅ Use next/image with AVIF
- ✅ Code split heavy components

### High INP

**Causes:**

- Long tasks (> 50ms)
- Excessive DOM size
- Complex CSS selectors
- Synchronous operations

**Solutions:**

- ✅ Debounce user input (300ms)
- ✅ Use React.memo for expensive renders
- ✅ Virtualize long lists
- ✅ Web Workers for heavy computations

### High CLS

**Causes:**

- Images without dimensions
- Dynamic content injection
- Late-loading fonts
- Ads/embeds without space

**Solutions:**

- ✅ Always specify width/height
- ✅ Reserve space for dynamic content
- ✅ Use next/font with swap
- ✅ Skeleton loaders

---

## Performance Regression Process

### Detection

1. **Automated:** Lighthouse CI fails on PR
2. **Monitoring:** Vercel Analytics shows degradation
3. **User Reports:** Slow performance complaints

### Response

1. **Immediate:** Identify the regression source
2. **Short-term:** Revert if critical (> 50% degradation)
3. **Long-term:** Optimize and re-deploy

### Prevention

1. **Performance budgets** in CI
2. **Bundle size limits** enforced
3. **Lighthouse scores** as PR gate
4. **Regular audits** (monthly)

---

## Success Criteria

### Phase 1 (Week 1) ✅

- [x] Performance budget documented
- [x] Bundle analyzer configured
- [x] Web Vitals tracking active

### Phase 2 (Week 2)

- [ ] Lighthouse CI integrated
- [ ] Performance regression tests
- [ ] 90+ Lighthouse scores

### Phase 3 (Week 3)

- [ ] All Core Web Vitals in green
- [ ] Bundle size under budget
- [ ] < 3s load time on 3G

---

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Lighthouse CI](https://github.com/treosh/lighthouse-ci-action)

---

_This is a living document. Update budgets as we learn and improve._
