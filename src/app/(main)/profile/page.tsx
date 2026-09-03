import { buildPageMetadata } from "@/lib/i18n/metadata";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "profileTitle",
    descKey: "profileSubtitle",
    path: "/profile",
    robots: { index: false, follow: false },
  });

export default async function ProfilePage() {
  const locale = await getLocaleFromRequest();
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
  );
}
