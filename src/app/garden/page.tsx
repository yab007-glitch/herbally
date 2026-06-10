import type { Metadata } from "next";
import { GardenClient } from "./garden-client";

export const metadata: Metadata = {
  title: "My Garden — HerbAlly",
  description: "Your personal collection of medicinal herbs. Track what you've explored and build your herbal knowledge.",
};

export default function GardenPage() {
  return (
    <div className="space-y-8">
      <GardenClient />
    </div>
  );
}
