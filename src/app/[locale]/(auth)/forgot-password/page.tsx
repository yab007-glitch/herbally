import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "auth.forgot" });
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
