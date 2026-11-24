import { buildPageMetadata } from "@/lib/i18n/metadata";
import { getLocale } from "@/lib/i18n/page-locale";
import { IntlMessagesScope } from "@/components/i18n/intl-messages-scope";
import { GardenClient } from "./garden-client";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "gardenPageTitle",
    descKey: "gardenSubtitle",
    path: "/garden",
    // Personal collection: signed out it renders an empty state, so there is
    // nothing here for a search result and no reason to spend crawl budget.
    noindex: true,
  });

export default async function GardenPage() {
  const locale = await getLocale();
  return (
    <IntlMessagesScope locale={locale} scope="garden">
      <div className="space-y-8">
        <GardenClient />
      </div>
    </IntlMessagesScope>
  );
}
