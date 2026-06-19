"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  login,
  register,
  forgotPassword,
  resetPassword,
} from "@/lib/actions/auth";
import type { ActionResponse } from "@/lib/types";

const initialState: ActionResponse = { success: false, error: "" };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResponse, fd: FormData) => {
      const res = await login(fd);
      if (res.success) router.refresh();
      return res;
    },
    initialState
  );

  return (
    <FormCard title={t("login.title")}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("login.emailPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
          />
        </div>
        {!state.success && state.error && <FieldError message={state.error} />}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("login.submitting") : t("login.submit")}
        </Button>
        <div className="flex flex-col gap-1 text-center text-xs text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground">
            {t("login.forgotPassword")}
          </Link>
          <span>
            {t("login.noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("login.register")}
            </Link>
          </span>
        </div>
      </form>
    </FormCard>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResponse, fd: FormData) => register(fd),
    initialState
  );

  return (
    <FormCard title={t("register.title")}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("register.fullName")}</Label>
          <Input
            id="full_name"
            name="full_name"
            required
            autoComplete="name"
            placeholder={t("register.fullNamePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">{t("register.email")}</Label>
          <Input
            id="reg-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("login.emailPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-password">{t("register.password")}</Label>
          <Input
            id="reg-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("register.passwordPlaceholder")}
          />
        </div>
        {state?.success ? (
          <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
            {t("register.checkEmail")}
          </p>
        ) : (
          state?.error && <FieldError message={state.error} />
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("register.submitting") : t("register.submit")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("register.signIn")}
          </Link>
        </p>
      </form>
    </FormCard>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResponse, fd: FormData) => forgotPassword(fd),
    initialState
  );

  return (
    <FormCard title={t("forgot.title")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("forgot.subtitle")}
      </p>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">{t("forgot.email")}</Label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("forgot.emailPlaceholder")}
          />
        </div>
        {state?.success ? (
          <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
            {t("forgot.checkEmail")}
          </p>
        ) : (
          state?.error && <FieldError message={state.error} />
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("forgot.submitting") : t("forgot.submit")}
        </Button>
        <p className="text-center text-xs">
          <Link href="/login" className="text-primary hover:underline">
            {t("forgot.back")}
          </Link>
        </p>
      </form>
    </FormCard>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResponse, fd: FormData) => resetPassword(fd),
    initialState
  );

  return (
    <FormCard title={t("reset.title")}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t("reset.password")}</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("reset.passwordPlaceholder")}
          />
        </div>
        {state?.success ? (
          <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
            {t("reset.success")}
          </p>
        ) : (
          state?.error && <FieldError message={state.error} />
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("reset.submitting") : t("reset.submit")}
        </Button>
        <p className="text-center text-xs">
          <Link href="/login" className="text-primary hover:underline">
            {t("reset.back")}
          </Link>
        </p>
      </form>
    </FormCard>
  );
}
