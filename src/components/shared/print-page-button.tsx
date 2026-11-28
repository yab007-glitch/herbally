"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintPageButton({
  locale,
  labelEn = "Print consultation reference",
  labelFr = "Imprimer la fiche de consultation",
}: {
  locale: "en" | "fr";
  labelEn?: string;
  labelFr?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="no-print min-h-10 gap-1.5"
    >
      <Printer className="size-4" aria-hidden="true" />
      <span>{locale === "fr" ? labelFr : labelEn}</span>
    </Button>
  );
}
