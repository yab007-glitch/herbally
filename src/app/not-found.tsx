import type { Metadata } from "next";
import { Leaf, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HerbAlly - Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Leaf className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" render={<Link href="/" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Home
        </Button>
        <Button render={<Link href="/herbs" />}>Browse Herbs</Button>
      </div>
    </div>
  );
}
