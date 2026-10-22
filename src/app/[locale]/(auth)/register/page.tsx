import { RegisterForm } from "@/components/auth/auth-forms";
import { getLocale } from "@/lib/i18n/page-locale";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth.register" });
  return { title: t("title") };
}

export default async function RegisterPage() {
  return <RegisterForm />;
}
