import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () =>
    Object.assign((key: string) => key, {
      raw: (key: string) =>
        key === "symptomsPage.exampleSymptoms" ? ["Example symptom query"] : [],
    }),
}));

vi.mock("next/link", () => ({
  default: ({
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

import { SymptomSearchClient } from "./symptom-search-client";

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

async function submitQuery(query: string) {
  const { container } = render(<SymptomSearchClient />);
  fireEvent.change(
    screen.getByPlaceholderText("symptomsPage.searchPlaceholder"),
    { target: { value: query } }
  );
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form as HTMLFormElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SymptomSearchClient request privacy", () => {
  it("POSTs inferred keywords in the body and keeps them out of the URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ keywords: ["insomnia", "anxiety"] })
      )
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await submitQuery("I cannot sleep at all");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [aiUrl, aiInit] = fetchMock.mock.calls[0];
    expect(aiUrl).toBe("/api/interpret-search");
    expect(aiInit).toMatchObject({ method: "POST" });
    expect(JSON.parse(aiInit.body)).toEqual({
      query: "I cannot sleep at all",
    });

    const [searchUrl, searchInit] = fetchMock.mock.calls[1];
    expect(searchUrl).toBe("/api/herbs/search");
    expect(searchUrl).not.toContain("?");
    expect(searchUrl).not.toContain("insomnia");
    expect(searchInit).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    // AI keywords are unioned with the user's own words, not a replacement.
    expect(JSON.parse(searchInit.body)).toEqual({
      q: "i cannot sleep at all insomnia anxiety",
    });

    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe("POST");
    }
  });

  it("POSTs the raw query when keyword extraction fails, still without a URL query", async () => {
    const query = "joint pain in the morning";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await submitQuery(query);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [searchUrl, searchInit] = fetchMock.mock.calls[1];
    expect(searchUrl).toBe("/api/herbs/search");
    expect(searchUrl).not.toContain("?");
    expect(searchUrl).not.toContain("joint");
    expect(searchInit.method).toBe("POST");
    expect(JSON.parse(searchInit.body)).toEqual({ q: query });
  });
});

describe("SymptomSearchClient match reasons and de-duplication", () => {
  it("shows one card per plant with its matched symptoms, merging duplicates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ keywords: ["sleep", "anxiety"] }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "a",
            name: "Stachys Betonica",
            slug: "stachys-betonica",
            scientific_name: "Stachys betonica",
            evidence_level: "C",
            matchedBy: "symptom",
            matchedKeywords: ["sleep"],
            matchedInputs: ["sleep"],
          },
          {
            id: "b",
            name: "Lamiaceae Betony",
            slug: "lamiaceae-betony",
            scientific_name: "Stachys betonica",
            evidence_level: "C",
            matchedBy: "symptom",
            matchedKeywords: ["anxiety"],
            matchedInputs: ["anxiety"],
          },
          {
            id: "c",
            name: "Valerian",
            slug: "valerian",
            scientific_name: "Valeriana officinalis",
            evidence_level: "B",
            matchedBy: "symptom",
            matchedKeywords: ["sleep"],
            matchedInputs: ["sleep"],
          },
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SymptomSearchClient />);
    fireEvent.change(
      screen.getByPlaceholderText("symptomsPage.searchPlaceholder"),
      { target: { value: "I have trouble sleeping and feel anxious" } }
    );
    const form = container.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(container.querySelectorAll('a[href^="/herbs/"]').length).toBe(2)
    );
    // The merged plant keeps the first row's link and shows the alias.
    expect(
      container.querySelector('a[href="/herbs/stachys-betonica"]')
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/herbs/lamiaceae-betony"]')
    ).toBeNull();
    // One reason line per card (merged plant + valerian).
    expect(screen.getAllByText("symptomsPage.matchReasonSymptom")).toHaveLength(
      2
    );
    expect(screen.getByText("symptomsPage.alsoListedAs")).toBeTruthy();
    expect(screen.getByText("symptomsPage.orderingNote")).toBeTruthy();
  });
});

describe("SymptomSearchClient AI keyword union", () => {
  it("keeps a user-typed sleep term when the AI returns only insomnia", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ keywords: ["insomnia"] }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await submitQuery("I need sleep help");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, searchInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(searchInit.body)).toEqual({
      q: "i need sleep help insomnia",
    });
  });
});
