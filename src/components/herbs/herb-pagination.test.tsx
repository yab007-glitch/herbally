import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { HerbPagination } from "./herb-pagination";

describe("HerbPagination navigation feedback", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("disables First/Previous on page 1 and navigates Next without scrolling", () => {
    render(<HerbPagination page={1} totalPages={10} />);
    expect(
      screen.getByRole("button", { name: "herbs.pagination.first" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "herbs.pagination.previous" })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "herbs.pagination.next" })
    );
    expect(pushMock).toHaveBeenCalledTimes(1);
    const [url, options] = pushMock.mock.calls[0];
    expect(url as string).toContain("page=2");
    expect(options).toEqual({ scroll: false });
  });

  it("reports aria-busy on the nav region", () => {
    const { container } = render(<HerbPagination page={3} totalPages={10} />);
    expect(container.querySelector("nav")).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  it("clamps the page-jump form to the last page", () => {
    const { container } = render(<HerbPagination page={3} totalPages={10} />);
    fireEvent.change(screen.getByLabelText("herbs.pagination.pageInputLabel"), {
      target: { value: "99" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0] as string).toContain("page=10");
  });

  it("resets the page-jump field when the page prop changes", () => {
    // Guards the jump field against drifting from the current page: it is
    // adjusted during render now, not resynced from an effect.
    const { rerender } = render(<HerbPagination page={3} totalPages={10} />);
    const input = screen.getByLabelText(
      "herbs.pagination.pageInputLabel"
    ) as HTMLInputElement;
    expect(input.value).toBe("3");

    fireEvent.change(input, { target: { value: "7" } });
    expect(input.value).toBe("7");

    rerender(<HerbPagination page={4} totalPages={10} />);
    expect(input.value).toBe("4");
  });
});
