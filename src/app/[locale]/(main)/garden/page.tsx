import { buildPageMetadata } from "@/lib/i18n/metadata";
import { GardenClient } from "./garden-client";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "gardenPageTitle",
    descKey: "gardenSubtitle",
    path: "/garden",
  });

export default function GardenPage() {
  return (
    <div className="space-y-8">
      <GardenClient />
    </div>
  );
}
