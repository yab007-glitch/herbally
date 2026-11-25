import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { StackChecker } from "../stack-checker";

const KEY = "herbally-my-stack-v1";

describe("StackChecker storage hardening", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("migrates legacy localStorage stack to sessionStorage and scrubs localStorage", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ herbs: ["Ginger"], drugs: ["Warfarin"] })
    );

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBe(
      JSON.stringify({ herbs: ["Ginger"], drugs: ["Warfarin"] })
    );
    expect(screen.getByText("Ginger")).toBeInTheDocument();
    expect(screen.getByText("Warfarin")).toBeInTheDocument();
  });

  it("persists stack updates in sessionStorage and clears both storages on clearAll", () => {
    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toContain("warfarin");

    fireEvent.click(screen.getByRole("button", { name: "clearAll" }));

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe("StackChecker edit-after-result invalidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function renderAndRunSample() {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkedAt: "2026-11-24T12:00:00.000Z",
          locale: "en",
          herbs: [
            {
              input: "St. John's Wort",
              found: true,
              slug: "st-johns-wort",
              name: "St. John's Wort",
              scientificName: "Hypericum perforatum",
              pairCount: 1,
            },
          ],
          drugs: ["warfarin"],
          summary: {
            totalCombinations: 1,
            matchedCount: 1,
            unrecordedCount: 0,
            highestSeverity: "severe",
            unresolvedHerbs: [],
          },
          matches: [
            {
              herbInput: "St. John's Wort",
              herbSlug: "st-johns-wort",
              herbName: "St. John's Wort",
              drugInput: "warfarin",
              drugName: "Warfarin (Coumadin)",
              drugSlug: "warfarin",
              severity: "severe",
              description: "Reduces warfarin efficacy.",
              mechanism: null,
              evidenceLevel: "well-documented",
              source: "NIH",
              sourceUrl: null,
              pairUrl: "/interactions/st-johns-wort/warfarin",
            },
          ],
          unrecorded: [],
          stackAlerts: [],
        }),
      })
    );

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Reduces warfarin efficacy.")).toBeInTheDocument();
  }

  it("invalidates stale results and wallet card when removing an herb or medication", async () => {
    await renderAndRunSample();

    // Open wallet card
    fireEvent.click(
      screen.getByRole("button", { name: /Foldable Wallet Card/i })
    );
    expect(screen.getByText(/Flagged pairs:/i)).toBeInTheDocument();

    // Remove Garlic -> stale result and wallet card must disappear immediately
    fireEvent.click(screen.getByRole("button", { name: "remove Garlic" }));
    expect(
      screen.queryByText("Reduces warfarin efficacy.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Flagged pairs:/i)).not.toBeInTheDocument();
  });

  it("invalidates stale results when adding a term, typing draft, or loading sample", async () => {
    await renderAndRunSample();

    fireEvent.change(screen.getByPlaceholderText("herbPlaceholder"), {
      target: { value: "Turmeric" },
    });
    expect(
      screen.queryByText("Reduces warfarin efficacy.")
    ).not.toBeInTheDocument();

    // Re-check
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Reduces warfarin efficacy.")).toBeInTheDocument();

    // Removing a drug invalidates again
    fireEvent.click(screen.getByRole("button", { name: "remove warfarin" }));
    expect(
      screen.queryByText("Reduces warfarin efficacy.")
    ).not.toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeStackResponse(drug: string, description: string) {
  return {
    checkedAt: "2026-11-24T12:00:00.000Z",
    locale: "en" as const,
    herbs: [
      {
        input: "St. John's Wort",
        found: true,
        slug: "st-johns-wort",
        name: "St. John's Wort",
        scientificName: "Hypericum perforatum",
        pairCount: 1,
      },
    ],
    drugs: [drug],
    summary: {
      totalCombinations: 1,
      matchedCount: 1,
      unrecordedCount: 0,
      highestSeverity: "severe" as const,
      unresolvedHerbs: [],
    },
    matches: [
      {
        herbInput: "St. John's Wort",
        herbSlug: "st-johns-wort",
        herbName: "St. John's Wort",
        drugInput: drug,
        drugName: drug,
        drugSlug: drug.toLowerCase(),
        severity: "severe" as const,
        description,
        mechanism: null,
        evidenceLevel: "well-documented",
        source: "NIH",
        sourceUrl: null,
        pairUrl: `/interactions/st-johns-wort/${drug.toLowerCase()}`,
      },
    ],
    unrecorded: [],
    stackAlerts: [],
  };
}

describe("StackChecker in-flight request generation & ordering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ignores an older in-flight check when the user edits, removes, clears, or loads a sample before it resolves", async () => {
    const req1 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchMock = vi.fn().mockReturnValueOnce(req1.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(
      screen.getByRole("button", { name: "checkingButton" })
    ).toBeDisabled();

    // User edits draft while request is in flight -> invalidates and stops loading
    fireEvent.change(screen.getByPlaceholderText("herbPlaceholder"), {
      target: { value: "Turmeric" },
    });
    expect(screen.getByRole("button", { name: "checkButton" })).toBeEnabled();

    // Now the stale request resolves -> must NOT resurrect stale results
    await act(async () => {
      req1.resolve({
        ok: true,
        json: async () =>
          makeStackResponse("warfarin", "Stale warfarin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.queryByText("Stale warfarin result.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "checkButton" })).toBeEnabled();

    // Also test clearAll while in flight
    const req2 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetchMock.mockReturnValueOnce(req2.promise);
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(
      screen.getByRole("button", { name: "checkingButton" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "clearAll" }));

    await act(async () => {
      req2.resolve({
        ok: true,
        json: async () =>
          makeStackResponse("warfarin", "Cleared stale result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("Cleared stale result.")).not.toBeInTheDocument();
  });

  it("ignores older out-of-order responses both when B finishes before A and when A finishes while B is pending", async () => {
    const reqA = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqB = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(reqA.promise)
      .mockReturnValueOnce(reqB.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    // Request A
    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));

    // Edit input -> invalidates A -> start Request B
    fireEvent.change(screen.getByPlaceholderText("drugPlaceholder"), {
      target: { value: "aspirin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Case 1: B resolves first, then A resolves later
    await act(async () => {
      reqB.resolve({
        ok: true,
        json: async () => makeStackResponse("aspirin", "Fresh aspirin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Fresh aspirin result.")).toBeInTheDocument();

    await act(async () => {
      reqA.resolve({
        ok: true,
        json: async () =>
          makeStackResponse("warfarin", "Older warfarin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Fresh aspirin result.")).toBeInTheDocument();
    expect(
      screen.queryByText("Older warfarin result.")
    ).not.toBeInTheDocument();

    // Case 2: Request C followed by Request D; C resolves while D is still pending
    const reqC = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqD = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetchMock
      .mockReturnValueOnce(reqC.promise)
      .mockReturnValueOnce(reqD.promise);

    fireEvent.change(screen.getByPlaceholderText("drugPlaceholder"), {
      target: { value: "digoxin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));

    fireEvent.change(screen.getByPlaceholderText("drugPlaceholder"), {
      target: { value: "cyclosporine" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(
      screen.getByRole("button", { name: "checkingButton" })
    ).toBeDisabled();

    // C resolves while D is still pending -> C ignored AND loading stays true
    await act(async () => {
      reqC.resolve({
        ok: true,
        json: async () => makeStackResponse("digoxin", "Stale digoxin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("Stale digoxin result.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "checkingButton" })
    ).toBeDisabled();

    // D resolves -> D renders and loading finishes
    await act(async () => {
      reqD.resolve({
        ok: true,
        json: async () =>
          makeStackResponse("cyclosporine", "Final cyclosporine result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Final cyclosporine result.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "checkButton" })).toBeEnabled();
  });

  it("renders a neutral info indicator (not green check) when no interactions match and puts PrintSafetyFooter inside .print-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkedAt: "2026-11-25T12:00:00.000Z",
          locale: "en",
          herbs: [
            {
              input: "Chamomile",
              found: true,
              slug: "chamomile",
              name: "Chamomile",
              scientificName: "Matricaria chamomilla",
              pairCount: 0,
            },
          ],
          drugs: ["Metformin"],
          summary: {
            totalCombinations: 1,
            matchedCount: 0,
            unrecordedCount: 1,
            conflictCount: 0,
            hasConflicts: false,
            highestSeverity: null,
          },
          herbsWithNoRecords: ["Chamomile"],
          stackAlerts: [],
          matches: [],
          conflicts: [],
          unrecorded: [
            {
              herbInput: "Chamomile",
              herbSlug: "chamomile",
              herbName: "Chamomile",
              drugInput: "Metformin",
            },
          ],
        }),
      })
    );

    const { container } = render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="stack-empty-info-icon"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector(".lucide-circle-check-big")
    ).not.toBeInTheDocument();

    const footerAside = screen.getByLabelText("Printed safety notice");
    expect(footerAside.closest(".print-only")).toBeInTheDocument();
    expect(footerAside.textContent).toMatch(/adults aged 18\+/i);

    vi.unstubAllGlobals();
  });

  it("renders publication-status badges, summary banner, and status filter on stack results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkedAt: "2026-11-25T12:00:00.000Z",
          locale: "en",
          herbs: [
            {
              input: "St. John's Wort",
              found: true,
              slug: "st-johns-wort",
              name: "St. John's Wort",
              scientificName: "Hypericum perforatum",
              pairCount: 2,
            },
          ],
          drugs: ["warfarin", "sertraline"],
          summary: {
            totalCombinations: 2,
            matchedCount: 2,
            unrecordedCount: 0,
            conflictCount: 0,
            hasConflicts: false,
            highestSeverity: "contraindicated",
            unresolvedHerbs: [],
          },
          matches: [
            {
              herbInput: "St. John's Wort",
              herbSlug: "st-johns-wort",
              herbName: "St. John's Wort",
              drugInput: "warfarin",
              drugName: "Warfarin",
              drugSlug: "warfarin",
              severity: "severe",
              description: "Published warfarin interaction.",
              mechanism: null,
              evidenceLevel: "well-documented",
              source: "NIH",
              sourceUrl: null,
              pairUrl: "/interactions/st-johns-wort/warfarin",
              publicationStatus: "published",
            },
            {
              herbInput: "St. John's Wort",
              herbSlug: "st-johns-wort",
              herbName: "St. John's Wort",
              drugInput: "sertraline",
              drugName: "Sertraline",
              drugSlug: "sertraline",
              severity: "contraindicated",
              description: "Legacy sertraline interaction.",
              mechanism: null,
              evidenceLevel: "moderate-evidence",
              source: "Legacy",
              sourceUrl: null,
              pairUrl: "/interactions/st-johns-wort/sertraline",
              publicationStatus: "legacy_unreviewed",
            },
          ],
          conflicts: [],
          unrecorded: [],
          stackAlerts: [],
        }),
      })
    );

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Published · Clinician-reviewed")
    ).toBeInTheDocument();
    expect(screen.getByText("Unreviewed legacy")).toBeInTheDocument();
    expect(screen.getByText(/Mixed publication status:/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Clinician-reviewed \(1\)/i })
    );
    expect(
      screen.getByText("Published warfarin interaction.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Legacy sertraline interaction.")
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Unreviewed legacy \(1\)/i })
    );
    expect(
      screen.queryByText("Published warfarin interaction.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Legacy sertraline interaction.")
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("distinguishes quarantined_collision from unreviewed legacy filters and renders withheld retracted_hold section", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkedAt: "2026-11-25T12:00:00.000Z",
          locale: "en",
          herbs: [
            {
              input: "Sage",
              found: true,
              slug: "sage",
              name: "Sage",
              scientificName: "Salvia officinalis",
              pairCount: 2,
            },
          ],
          drugs: ["anticonvulsants", "warfarin"],
          summary: {
            totalCombinations: 2,
            matchedCount: 0,
            unrecordedCount: 0,
            withheldCount: 1,
            conflictCount: 1,
            hasConflicts: true,
            highestSeverity: null,
            unresolvedHerbs: [],
          },
          matches: [],
          conflicts: [
            {
              herbInput: "Sage",
              herbSlug: "sage",
              herbName: "Sage",
              drugInput: "anticonvulsants",
              drugSlug: "anticonvulsants",
              pairUrl: "/interactions/sage/anticonvulsants",
              records: [
                {
                  herbInput: "Sage",
                  herbSlug: "sage",
                  herbName: "Sage",
                  drugInput: "anticonvulsants",
                  drugName: "Anticonvulsants",
                  drugSlug: "anticonvulsants",
                  severity: "severe",
                  description: "Quarantined collision stack record.",
                  mechanism: null,
                  evidenceLevel: "A",
                  source: "NIH",
                  sourceUrl: null,
                  pairUrl: "/interactions/sage/anticonvulsants",
                  publicationStatus: "quarantined_collision",
                },
                {
                  herbInput: "Sage",
                  herbSlug: "sage",
                  herbName: "Sage",
                  drugInput: "anticonvulsants",
                  drugName: "Anticonvulsants (Phenytoin)",
                  drugSlug: "anticonvulsants",
                  severity: "moderate",
                  description: "Legacy unreviewed stack record.",
                  mechanism: null,
                  evidenceLevel: "B",
                  source: "Legacy",
                  sourceUrl: null,
                  pairUrl: "/interactions/sage/anticonvulsants",
                  publicationStatus: "legacy_unreviewed",
                },
              ],
            },
          ],
          withheld: [
            {
              herbInput: "Sage",
              herbSlug: "sage",
              herbName: "Sage",
              drugInput: "warfarin",
              status: "withheld",
              reason: "retracted_hold",
            },
          ],
          unrecorded: [],
          stackAlerts: [],
        }),
      })
    );

    render(<StackChecker />);
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole("button", { name: "loadSample" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const quarBtn = screen.getByRole("button", {
      name: /Quarantined collision \(1\)/i,
    });
    const unrevBtn = screen.getByRole("button", {
      name: /Unreviewed legacy \(1\)/i,
    });
    expect(quarBtn).toBeInTheDocument();
    expect(unrevBtn).toBeInTheDocument();

    fireEvent.click(quarBtn);
    expect(
      screen.getByText("Quarantined collision stack record.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Legacy unreviewed stack record.")
    ).not.toBeInTheDocument();

    fireEvent.click(unrevBtn);
    expect(
      screen.queryByText("Quarantined collision stack record.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Legacy unreviewed stack record.")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Withheld interaction records \(retracted citation\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Sage + warfarin")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
