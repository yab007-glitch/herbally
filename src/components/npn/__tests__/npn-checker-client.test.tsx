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

import { NpnCheckerClient } from "../npn-checker-client";

describe("NpnCheckerClient partial failure UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("displays a partial-record warning and explicit risks-unavailable alert when Health Canada risks fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          npn: "80000001",
          lnhpdId: 123,
          locale: "en",
          productName: "Flax Oil",
          companyName: "Test Co",
          dosageForm: "Capsule",
          submissionType: null,
          licenceDate: null,
          revisedDate: null,
          status: { active: true, label: "Active" },
          ingredients: [],
          purposes: [],
          risks: [],
          doses: [],
          sourceUrl:
            "https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=80000001",
          partial: true,
          unavailableSections: ["risks"],
          sectionStatus: {
            ingredients: "ok",
            purposes: "ok",
            risks: "unavailable",
            doses: "ok",
          },
          herbMatchingUnavailable: false,
        }),
      })
    );

    render(<NpnCheckerClient />);
    fireEvent.change(screen.getByLabelText("inputLabel"), {
      target: { value: "80000001" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "searchButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Official Health Canada cautions and risk statements/i)
    ).toBeInTheDocument();
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

function makeNpnPayload(
  npn: string,
  productName: string,
  matchedHerbName?: string
) {
  return {
    npn,
    lnhpdId: Number(npn),
    locale: "en" as const,
    productName,
    companyName: "Test Co",
    dosageForm: "Capsule",
    submissionType: null,
    licenceDate: null,
    revisedDate: null,
    status: { active: true, label: "Active" },
    ingredients: matchedHerbName
      ? [
          {
            name: matchedHerbName,
            cleanedName: matchedHerbName,
            quantity: 500,
            unit: "mg",
            potencyAmount: null,
            potencyConstituent: null,
            potencyUnit: null,
            dhe: null,
            dheUnit: null,
            extractType: null,
            sourceMaterial: null,
            matchedHerb: {
              slug: matchedHerbName.toLowerCase(),
              name: matchedHerbName,
              scientificName: "Testus plantus",
              interactionCount: 1,
            },
          },
        ]
      : [],
    purposes: [],
    risks: [],
    doses: [],
    sourceUrl: `https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=${npn}`,
    partial: false,
    unavailableSections: [],
    sectionStatus: {
      ingredients: "ok" as const,
      purposes: "ok" as const,
      risks: "ok" as const,
      doses: "ok" as const,
    },
    herbMatchingUnavailable: false,
  };
}

describe("NpnCheckerClient stale-state and race-condition protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears prior product data when a second lookup fails (network throw)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeNpnPayload("80000001", "First Flax Product"),
      })
      .mockRejectedValueOnce(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<NpnCheckerClient />);
    fireEvent.change(screen.getByLabelText("inputLabel"), {
      target: { value: "80000001" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "searchButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("First Flax Product")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("inputLabel"), {
      target: { value: "80010538" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "searchButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("First Flax Product")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("ignores older out-of-order NPN lookup responses", async () => {
    const req1 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const req2 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<NpnCheckerClient />);

    // Start lookup 1 via sample button
    fireEvent.click(screen.getByRole("button", { name: /80000001/ }));
    // Start lookup 2 via sample button before lookup 1 resolves
    fireEvent.click(screen.getByRole("button", { name: /80010538/ }));

    // Lookup 2 resolves first
    await act(async () => {
      req2.resolve({
        ok: true,
        json: async () => makeNpnPayload("80010538", "Newer Greens Product"),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Newer Greens Product")).toBeInTheDocument();

    // Lookup 1 resolves late -> must NOT overwrite Newer Greens Product
    await act(async () => {
      req1.resolve({
        ok: true,
        json: async () => makeNpnPayload("80000001", "Older Flax Product"),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Newer Greens Product")).toBeInTheDocument();
    expect(screen.queryByText("Older Flax Product")).not.toBeInTheDocument();
  });

  it("clears stale medication matches immediately on medication edit and ignores late in-flight med checks", async () => {
    const medDeferred = deferred<{
      ok: boolean;
      json: () => Promise<unknown>;
    }>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeNpnPayload("80000001", "Flax Product", "Flaxseed"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matches: [
            {
              herbName: "Flaxseed",
              herbSlug: "flaxseed",
              drugName: "Warfarin",
              severity: "moderate",
              description: "Old warfarin match.",
              pairUrl: "/interactions/flaxseed/warfarin",
            },
          ],
          unrecorded: [],
        }),
      })
      .mockReturnValueOnce(medDeferred.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<NpnCheckerClient />);
    fireEvent.click(screen.getByRole("button", { name: /80000001/ }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const medInput = screen.getByPlaceholderText("medCheckPlaceholder");
    fireEvent.change(medInput, { target: { value: "warfarin" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "checkMedButton" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Old warfarin match.")).toBeInTheDocument();

    // Editing medication clears stale match immediately
    fireEvent.change(medInput, { target: { value: "aspirin" } });
    expect(screen.queryByText("Old warfarin match.")).not.toBeInTheDocument();

    // Start second med check, then edit medInput while pending
    fireEvent.click(screen.getByRole("button", { name: "checkMedButton" }));
    fireEvent.change(medInput, { target: { value: "ibuprofen" } });

    await act(async () => {
      medDeferred.resolve({
        ok: true,
        json: async () => ({
          matches: [
            {
              herbName: "Flaxseed",
              herbSlug: "flaxseed",
              drugName: "Aspirin",
              severity: "moderate",
              description: "Stale aspirin match.",
              pairUrl: "/interactions/flaxseed/aspirin",
            },
          ],
          unrecorded: [],
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("Stale aspirin match.")).not.toBeInTheDocument();
  });
});
