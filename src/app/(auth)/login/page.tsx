import { LoginForm } from "@/components/auth/auth-forms";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "auth.login" });
  // Auth-gated utility page: keep out of the index (it already draws
  // impressions in GSC) but follow links. robots.ts must ALLOW /login so
  // crawlers can see this tag — disallow would hide it.
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function LoginPage() {
  return <LoginForm />;
}
