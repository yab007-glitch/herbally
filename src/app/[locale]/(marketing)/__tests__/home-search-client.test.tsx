import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("@/components/i18n/use-localized-router", () => ({
  useLocalizedRouter: () => ({
    push: pushMock,
  }),
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

import { HomeSearchClient } from "../home-search-client";

const LABELS = {
  herbLabel: "Herb",
  medLabel: "Medication",
  herbPlaceholder: "e.g. Turmeric",
  medPlaceholder: "e.g. Warfarin",
  checkButton: "Check interactions",
  suggestionsTitle: "Common checks",
  suggestion1: "St. John's Wort + SSRIs",
  suggestion2: "Turmeric + warfarin",
  suggestion3: "Ginkgo + aspirin",
  suggestion4: "Echinacea + immunosuppressants",
  trustLine: "Evidence-based database",
  symptomsLink: "Browse by symptom",
  emptyCheckError: "Enter an herb or medication.",
  sameCheckError: "Enter two different items.",
  checking: "Checking...",
  checkerFoundTitle: "Interaction found",
  checkerAskHerbalist: "Ask herbalist",
  checkerAskPrompt: "Tell me about {herb} and {drug}",
  checkerViewPair: "View details",
  checkerViewHerb: "View herb",
  checkerDisclaimer: "Educational only.",
  checkerNotFoundTitle: "No interaction found",
  checkerNotFoundBody: "No record for {herb} and {drug}.",
  checkerAiNote: "Ask the AI herbalist.",
  checkerError: "Could not check interaction right now.",
  checkerSource: "Source",
  checkerEvidence: "Evidence",
  checkerMechanism: "Mechanism",
  severityMild: "Mild",
  severityModerate: "Moderate",
  severitySevere: "Severe",
  severityContraindicated: "Contraindicated",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makePairResponse(
  herbName: string,
  drugName: string,
  description: string
) {
  return {
    found: true,
    herb: {
      slug: herbName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: herbName,
    },
    pair: {
      id: `pair-${drugName.toLowerCase()}`,
      drugName,
      severity: "severe" as const,
      description,
      mechanism: "CYP induction",
      evidenceLevel: "A",
      source: "NIH",
      sourceUrl: null,
      pairUrl: `/interactions/${herbName.toLowerCase()}/${drugName.toLowerCase()}`,
    },
  };
}

function makeCollisionResponse(herbName: string) {
  return {
    found: true,
    ambiguous: true,
    conflict: true,
    herb: {
      slug: herbName.toLowerCase(),
      name: herbName,
    },
    pair: null,
    conflictingPairs: [
      {
        id: "c1",
        drugName: "Anticonvulsants",
        severity: "moderate" as const,
        description: "Moderate anticonvulsant warning.",
        mechanism: null,
        evidenceLevel: "B",
        source: "NIH",
        sourceUrl: null,
        pairUrl: "/interactions/sage/anticonvulsants",
      },
      {
        id: "c2",
        drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
        severity: "severe" as const,
        description: "Severe anticonvulsant warning.",
        mechanism: null,
        evidenceLevel: "A",
        source: "NIH",
        sourceUrl: null,
        pairUrl: "/interactions/sage/anticonvulsants",
      },
    ],
  };
}

describe("HomeSearchClient stale-result & race-condition protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("clears completed normal and collision results on herb, medication, and autocomplete edits", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/api/herbs/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "h-ginger",
              name: "Ginger",
              slug: "ginger",
              scientific_name: "Zingiber officinale",
            },
          ],
        });
      }
      if (url.includes("herb=Sage")) {
        return Promise.resolve({
          ok: true,
          json: async () => makeCollisionResponse("Sage"),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () =>
          makePairResponse("Turmeric", "Warfarin", "Increases bleeding risk."),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeSearchClient labels={LABELS} />);

    const herbInput = screen.getByLabelText("Herb");
    const medInput = screen.getByLabelText("Medication");

    // 1. Normal interaction result -> edit herb clears it
    fireEvent.change(herbInput, { target: { value: "Turmeric" } });
    fireEvent.change(medInput, { target: { value: "Warfarin" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Increases bleeding risk.")).toBeInTheDocument();

    fireEvent.change(herbInput, { target: { value: "Turmeric root" } });
    expect(
      screen.queryByText("Increases bleeding risk.")
    ).not.toBeInTheDocument();

    // 2. Collision alert -> edit medication clears it
    fireEvent.change(herbInput, { target: { value: "Sage" } });
    fireEvent.change(medInput, { target: { value: "anticonvulsants" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Multiple interaction records match/i
    );
    expect(
      screen.getByText("Moderate anticonvulsant warning.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Severe anticonvulsant warning.")
    ).toBeInTheDocument();

    fireEvent.change(medInput, { target: { value: "aspirin" } });
    expect(
      screen.queryByText(/Multiple interaction records match/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Severe anticonvulsant warning.")
    ).not.toBeInTheDocument();

    // 3. Re-run check, then select an autocomplete herb -> clears stale result
    fireEvent.change(herbInput, { target: { value: "Turmeric" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Increases bleeding risk.")).toBeInTheDocument();

    fireEvent.focus(herbInput);
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const option = screen.getByRole("button", { name: /Ginger/i });
    fireEvent.click(option);
    expect(
      screen.queryByText("Increases bleeding risk.")
    ).not.toBeInTheDocument();
  });

  it("aborts and ignores in-flight checks (normal, collision, and rejection) when editing herb or medication while pending", async () => {
    const signals: AbortSignal[] = [];
    const req1 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const req2 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const req3 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    let checkCall = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.startsWith("/api/herbs/search")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (init?.signal) signals.push(init.signal);
        checkCall += 1;
        if (checkCall === 1) return req1.promise;
        if (checkCall === 2) return req2.promise;
        return req3.promise;
      })
    );

    render(<HomeSearchClient labels={LABELS} />);
    const herbInput = screen.getByLabelText("Herb");
    const medInput = screen.getByLabelText("Medication");

    // Case A: Edit herb while pending -> aborts signal, re-enables button, ignores late normal result
    fireEvent.change(herbInput, { target: { value: "Turmeric" } });
    fireEvent.change(medInput, { target: { value: "Warfarin" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();
    expect(signals[0]?.aborted).toBe(false);

    fireEvent.change(herbInput, { target: { value: "Ginger" } });
    expect(signals[0]?.aborted).toBe(true);
    expect(
      screen.getByRole("button", { name: "Check interactions" })
    ).toBeEnabled();

    await act(async () => {
      req1.resolve({
        ok: true,
        json: async () =>
          makePairResponse("Turmeric", "Warfarin", "Stale turmeric result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByText("Stale turmeric result.")
    ).not.toBeInTheDocument();

    // Case B: Edit medication while pending -> aborts signal, ignores late collision result
    fireEvent.change(herbInput, { target: { value: "Sage" } });
    fireEvent.change(medInput, { target: { value: "anticonvulsants" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(signals[1]?.aborted).toBe(false);

    fireEvent.change(medInput, { target: { value: "ibuprofen" } });
    expect(signals[1]?.aborted).toBe(true);

    await act(async () => {
      req2.resolve({
        ok: true,
        json: async () => makeCollisionResponse("Sage"),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByText(/Multiple interaction records match/i)
    ).not.toBeInTheDocument();

    // Case C: Edit medication while pending -> ignores late rejection error
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    fireEvent.change(medInput, { target: { value: "acetaminophen" } });

    await act(async () => {
      req3.reject(new Error("Network error"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByText("Could not check interaction right now.")
    ).not.toBeInTheDocument();
  });

  it("ignores older out-of-order responses (including collisions and errors) and gates loading/catch/finally on current generation", async () => {
    const signals: AbortSignal[] = [];
    const reqA = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqB = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqC = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqD = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqE = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const reqF = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const queue = [reqA, reqB, reqC, reqD, reqE, reqF];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.startsWith("/api/herbs/search")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (init?.signal) signals.push(init.signal);
        return queue.shift()!.promise;
      })
    );

    render(<HomeSearchClient labels={LABELS} />);
    const herbInput = screen.getByLabelText("Herb");
    const medInput = screen.getByLabelText("Medication");

    // Case 1: Start A (collision), edit & start B (normal); B finishes first, A finishes later
    fireEvent.change(herbInput, { target: { value: "Sage" } });
    fireEvent.change(medInput, { target: { value: "anticonvulsants" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));

    fireEvent.change(medInput, { target: { value: "warfarin" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => {
      reqB.resolve({
        ok: true,
        json: async () =>
          makePairResponse("Sage", "Warfarin", "Fresh warfarin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Fresh warfarin result.")).toBeInTheDocument();

    await act(async () => {
      reqA.resolve({
        ok: true,
        json: async () => makeCollisionResponse("Sage"),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Fresh warfarin result.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Multiple interaction records match/i)
    ).not.toBeInTheDocument();

    // Case 2: Start C (normal), edit & start D (collision); C finishes while D is still pending -> D stays loading!
    fireEvent.change(medInput, { target: { value: "aspirin" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));

    fireEvent.change(medInput, { target: { value: "anticonvulsants" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();

    await act(async () => {
      reqC.resolve({
        ok: true,
        json: async () =>
          makePairResponse("Sage", "Aspirin", "Stale aspirin result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("Stale aspirin result.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();

    await act(async () => {
      reqD.resolve({
        ok: true,
        json: async () => makeCollisionResponse("Sage"),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByText("Severe anticonvulsant warning.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check interactions" })
    ).toBeEnabled();

    // Case 3: Start E, edit & start F; E rejects while F is pending -> no error & still loading until F finishes
    fireEvent.change(medInput, { target: { value: "digoxin" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    fireEvent.change(medInput, { target: { value: "lisinopril" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));

    await act(async () => {
      reqE.reject(new Error("Stale timeout"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByText("Could not check interaction right now.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();

    await act(async () => {
      reqF.resolve({
        ok: true,
        json: async () =>
          makePairResponse("Sage", "Lisinopril", "Final lisinopril result."),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Final lisinopril result.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check interactions" })
    ).toBeEnabled();
  });

  it("preserves single-field router navigation and aborts any prior in-flight check", async () => {
    const signals: AbortSignal[] = [];
    const req = deferred<{ ok: boolean; json: () => Promise<unknown> }>();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/herbs/search")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (init?.signal) signals.push(init.signal);
      return req.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeSearchClient labels={LABELS} />);
    const herbInput = screen.getByLabelText("Herb");
    const medInput = screen.getByLabelText("Medication");

    // 1. Single-field submit navigates to /herbalist without calling /api/interactions/check
    fireEvent.change(herbInput, { target: { value: "Turmeric" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(pushMock).toHaveBeenCalledWith(
      "/herbalist?q=Tell%20me%20about%20Turmeric"
    );
    expect(signals).toHaveLength(0);

    // 2. Pending two-field check aborted when clearing medication and submitting one field
    fireEvent.change(medInput, { target: { value: "Warfarin" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);

    fireEvent.change(medInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Check interactions" }));
    expect(signals[0]?.aborted).toBe(true);
    expect(pushMock).toHaveBeenCalledTimes(2);
  });

  it("renders truthful publication-status badges and filters for single and conflicting pairs", async () => {
    const mixedConflicts = {
      found: true,
      ambiguous: true,
      conflict: true,
      herb: { slug: "sage", name: "Sage" },
      pair: null,
      conflictingPairs: [
        {
          id: "c-pub",
          drugName: "Anticonvulsants",
          severity: "severe" as const,
          description: "Clinician-reviewed conflict record.",
          mechanism: null,
          evidenceLevel: "A",
          source: "NIH",
          sourceUrl: null,
          pairUrl: "/interactions/sage/anticonvulsants",
          publicationStatus: "published",
        },
        {
          id: "c-leg",
          drugName: "Anticonvulsants (Phenytoin)",
          severity: "moderate" as const,
          description: "Legacy unreviewed conflict record.",
          mechanism: null,
          evidenceLevel: "B",
          source: "Legacy",
          sourceUrl: null,
          pairUrl: "/interactions/sage/anticonvulsants",
          publicationStatus: "legacy_unreviewed",
        },
      ],
    };

    const singleLegacy = {
      ...makePairResponse("Turmeric", "Warfarin", "May increase bleeding."),
      pair: {
        ...makePairResponse("Turmeric", "Warfarin", "May increase bleeding.")
          .pair,
        publicationStatus: "legacy_unreviewed",
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mixedConflicts })
      .mockResolvedValueOnce({ ok: true, json: async () => singleLegacy });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeSearchClient labels={LABELS} />);
    fireEvent.change(screen.getByLabelText("Herb"), {
      target: { value: "Sage" },
    });
    fireEvent.change(screen.getByLabelText("Medication"), {
      target: { value: "Anticonvulsants" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Published · Clinician-reviewed")
    ).toBeInTheDocument();
    expect(screen.getByText("Unreviewed legacy")).toBeInTheDocument();
    expect(screen.getByText(/Mixed publication status:/i)).toBeInTheDocument();

    // Filter to clinician-reviewed only -> hides legacy conflict card
    fireEvent.click(
      screen.getByRole("button", { name: /Clinician-reviewed \(1\)/i })
    );
    expect(
      screen.getByText("Clinician-reviewed conflict record.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Legacy unreviewed conflict record.")
    ).not.toBeInTheDocument();

    // Now test a single legacy pair (filter resets on new check)
    fireEvent.change(screen.getByLabelText("Herb"), {
      target: { value: "Turmeric" },
    });
    fireEvent.change(screen.getByLabelText("Medication"), {
      target: { value: "Warfarin" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Unreviewed legacy")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Unreviewed legacy interaction records without clinician/i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Clinician-reviewed \(0\)/i })
    );
    expect(
      screen.queryByText("May increase bleeding.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/No matches for the selected status filter/i)
    ).toBeInTheDocument();
  });

  it("distinguishes quarantined_collision from unreviewed legacy filters and renders withheld alert for retracted_hold", async () => {
    const quarantinedAndUnreviewed = {
      found: true,
      ambiguous: true,
      conflict: true,
      herb: { slug: "sage", name: "Sage" },
      pair: null,
      conflictingPairs: [
        {
          id: "c-quar",
          drugName: "Anticonvulsants",
          severity: "severe" as const,
          description: "Quarantined collision record.",
          mechanism: null,
          evidenceLevel: "A",
          source: "NIH",
          sourceUrl: null,
          pairUrl: "/interactions/sage/anticonvulsants",
          publicationStatus: "quarantined_collision",
        },
        {
          id: "c-unrev",
          drugName: "Anticonvulsants (Phenytoin)",
          severity: "moderate" as const,
          description: "Unreviewed legacy record.",
          mechanism: null,
          evidenceLevel: "B",
          source: "Legacy",
          sourceUrl: null,
          pairUrl: "/interactions/sage/anticonvulsants",
          publicationStatus: "legacy_unreviewed",
        },
      ],
    };

    const withheldResponse = {
      found: false,
      withheld: true,
      status: "withheld",
      reason: "retracted_hold",
      herb: { slug: "sage", name: "Sage" },
      pair: null,
      message:
        "A matching interaction record for this combination is currently withheld due to a retracted citation and is under clinical review.",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => quarantinedAndUnreviewed,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => withheldResponse,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeSearchClient labels={LABELS} />);
    fireEvent.change(screen.getByLabelText("Herb"), {
      target: { value: "Sage" },
    });
    fireEvent.change(screen.getByLabelText("Medication"), {
      target: { value: "Anticonvulsants" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
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
      screen.getByText("Quarantined collision record.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unreviewed legacy record.")
    ).not.toBeInTheDocument();

    fireEvent.click(unrevBtn);
    expect(
      screen.queryByText("Quarantined collision record.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Unreviewed legacy record.")).toBeInTheDocument();

    // Withheld response renders distinct withheld alert, NOT "No interaction found"
    fireEvent.change(screen.getByLabelText("Medication"), {
      target: { value: "Warfarin" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Check interactions" })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText(/Interaction record withheld \(retracted citation\)/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("No interaction found")).not.toBeInTheDocument();
  });
});
