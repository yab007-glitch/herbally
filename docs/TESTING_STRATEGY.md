# HerbAlly Testing Strategy

**Date:** May 11, 2026  
**Status:** ✅ Active  
**Coverage Goal:** 70%+

---

## Testing Pyramid

```
        /\
       /  \
      / E2E \        ← 28 tests (Playwright)
     /--------\
    /          \
   / Components \    ← 35 tests (Testing Library)
  /--------------\
 /                \
/    Utilities     \  ← 21 tests (Vitest)
--------------------
```

**Total: 66 tests** and growing

---

## Test Types

### 1. Unit Tests (Utilities)

**Location:** `src/lib/utils/__tests__/`  
**Framework:** Vitest  
**Purpose:** Test pure functions, calculations, utilities

**Current Coverage:**

- ✅ `dosage-calculations.test.ts` (19 tests)
- ✅ `rate-limit.test.ts` (3 tests)

**Examples:**

```typescript
// dosage-calculations.test.ts
test("calculates adult dose based on weight", () => {
  expect(calculateDose(70, "adult")).toBe(expected);
});

// rate-limit.test.ts
test("allows requests under limit", () => {
  expect(rateLimiter.check()).toBe(true);
});
```

### 2. Component Tests

**Location:** `src/components/__tests__/`  
**Framework:** React Testing Library + Vitest  
**Purpose:** Test component rendering, props, events

**Current Coverage:**

- ✅ `button.test.tsx` (9 tests)
- ✅ `badge.test.tsx` (6 tests)
- ✅ `input.test.tsx` (12 tests)
- ✅ `card.test.tsx` (10 tests)
- ✅ `skeleton.test.tsx` (7 tests)

**Examples:**

```typescript
// button.test.tsx
test('renders children correctly', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});

test('handles click events', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click</Button>);
  screen.getByRole('button').click();
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### 3. E2E Tests

**Location:** `e2e/`  
**Framework:** Playwright  
**Purpose:** Test complete user flows across browsers

**Current Coverage:**

- ✅ `homepage.spec.ts` (10 tests)
- ✅ `herbs.spec.ts` (10 tests)
- ✅ `calculator.spec.ts` (8 tests)

**Examples:**

```typescript
// homepage.spec.ts
test("should load homepage successfully", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HerbAlly/);
});

// herbs.spec.ts
test("should search for herbs", async ({ page }) => {
  await page.goto("/herbs");
  const searchInput = page.locator('input[type="text"]');
  await searchInput.fill("ginger");
  await page.waitForTimeout(1000);
  const results = page.locator('[data-testid="herb-card"]');
  await expect(results.first()).toBeVisible();
});
```

---

## Coverage Targets

| Component Type         | Current | Target | Priority |
| ---------------------- | ------- | ------ | -------- |
| **Utilities**          | ~80%    | 90%+   | High ✅  |
| **UI Components**      | ~40%    | 80%+   | High     |
| **Feature Components** | ~20%    | 70%+   | Medium   |
| **Pages**              | ~10%    | 50%+   | Medium   |
| **API Routes**         | ~0%     | 80%+   | High     |
| **E2E Flows**          | ~30%    | 80%+   | High     |

**Overall Goal:** 70%+ by end of Phase 2

---

## Test Planning

### Priority Components to Test

#### Critical Path (Test First)

- [ ] `smart-search.tsx` - Main search functionality
- [ ] `chat-interface.tsx` - AI chat component
- [ ] `dose-calculator-form.tsx` - Dosage calculations
- [ ] `interactions-table.tsx` - Drug interaction display
- [ ] `language-selector.tsx` - i18n switching

#### High Priority

- [ ] `herb-card.tsx` - Main herb display
- [ ] `herb-image.tsx` - Image loading/optimization
- [ ] `theme-toggle.tsx` - Theme switching
- [ ] `main-navbar.tsx` - Navigation
- [ ] `mobile-tab-bar.tsx` - Mobile navigation

#### Medium Priority

- [ ] `recent-searches.tsx` - Search history
- [ ] `evidence-grade.tsx` - Evidence display
- [ ] `safety-alert.tsx` - Safety warnings
- [ ] `citations.tsx` - Source citations
- [ ] `footer components` - Various footers

### Priority API Routes to Test

- [ ] `/api/chat` - AI chat endpoint
- [ ] `/api/herbs/search` - Herb search
- [ ] `/api/interpret-search` - Interaction checking
- [ ] `/api/donate` - Donation processing
- [ ] `/api/webhooks/stripe` - Webhook handling

### Priority E2E Flows

- [ ] User searches for herb → views details → checks interactions
- [ ] User calculates dosage → saves result
- [ ] User chats with AI herbalist
- [ ] User makes donation
- [ ] User switches language
- [ ] User switches theme

---

## Testing Best Practices

### Unit Tests

1. **Test pure functions** - No side effects
2. **Test edge cases** - Empty, null, undefined, extremes
3. **Test error handling** - Invalid inputs
4. **Use descriptive names** - `test('calculates child dose for 20kg weight')`
5. **Keep tests independent** - No shared state

### Component Tests

1. **Test user interactions** - Clicks, typing, submissions
2. **Test props** - Different prop combinations
3. **Test accessibility** - ARIA attributes, keyboard navigation
4. **Mock external dependencies** - API calls, context
5. **Use user-event** - More realistic than fireEvent

### E2E Tests

1. **Test critical paths** - Main user journeys
2. **Test across browsers** - Chrome, Firefox, Safari
3. **Test mobile** - Different viewports
4. **Use real data** - staging environment
5. **Handle flakiness** - Proper waits, retries

---

## Running Tests

### Local Development

```bash
# All tests
npm run test:run

# Watch mode
npm run test

# With coverage
npm run test:coverage

# E2E tests (headless)
npm run test:e2e

# E2E tests (UI mode)
npm run test:e2e:ui

# E2E tests (headed)
npm run test:e2e:headed
```

### CI/CD

```yaml
# GitHub Actions (ci.yml)
- run: npm run test:run # Unit + Component
- run: npm run test:e2e # E2E tests
```

---

## Coverage Reporting

### Generate Report

```bash
npm run test:coverage
```

### View Report

```bash
# Open in browser
open coverage/index.html
```

### Coverage Thresholds (TODO: Enforce in CI)

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70
  }
}
```

---

## Mocking Strategy

### API Calls

```typescript
// Mock fetch
vi.mock("@/lib/api", () => ({
  fetchHerbs: vi.fn().mockResolvedValue({ data: [] }),
}));
```

### Context

```typescript
// Mock i18n context
const renderWithContext = (component) => {
  return render(
    <I18nProvider value={mockI18n}>
      {component}
    </I18nProvider>
  );
};
```

### External Services

```typescript
// Mock Supabase
vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
  }),
}));
```

---

## Continuous Improvement

### Weekly Goals

- Add 10+ new tests per week
- Increase coverage by 5% per week
- Fix flaky tests immediately
- Review test quality in PRs

### Monthly Goals

- Reach 70%+ coverage
- Test all critical paths
- Automate coverage reporting
- Integrate with code review process

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/testing-best-practices)

---

_Living document - update as we learn and grow_
