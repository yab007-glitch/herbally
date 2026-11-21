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
