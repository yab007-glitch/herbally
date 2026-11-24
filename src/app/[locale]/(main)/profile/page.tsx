import { buildPageMetadata } from "@/lib/i18n/metadata";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";

export const generateMetadata = async () => {
  const meta = await buildPageMetadata({
    titleKey: "profileTitle",
    descKey: "profileSubtitle",
    path: "/profile",
  });
  return {
    ...meta,
    robots: { index: false, follow: false },
  };
};

export default async function ProfilePage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("profile.notLoggedIn")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("profile.signInForProfile")}
        </p>
        {/* The wall had no way through it: the page told people to sign in and
            then offered no link. */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("auth.login.submit")}
          </Link>
          <Link
            href="/register"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("auth.register.submit")}
          </Link>
        </div>
      </div>
    );
  }

  // Get user's email for display
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <ToolsMessagesProvider locale={locale}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("profile.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("profile.subtitle")}</p>
          {profile?.email && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.full_name} · {profile.email}
            </p>
          )}
        </div>
        <ProfileClient />
      </div>
    </ToolsMessagesProvider>
  );
}
