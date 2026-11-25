import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
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

import { RegisterForm, ResetPasswordForm } from "../auth-forms";

describe("auth forms password minimum aligns with GoTrue 12-char requirement", () => {
  it("sets minLength=12 on RegisterForm password input", () => {
    render(<RegisterForm />);
    const input = screen.getByLabelText("register.password");
    expect(input).toHaveAttribute("minLength", "12");
  });

  it("sets minLength=12 on ResetPasswordForm password input", () => {
    render(<ResetPasswordForm />);
    const input = screen.getByLabelText("reset.password");
    expect(input).toHaveAttribute("minLength", "12");
  });
});
