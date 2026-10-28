import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
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
    expect(JSON.parse(searchInit.body)).toEqual({ q: "insomnia anxiety" });

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
