import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "auth.reset" });
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
