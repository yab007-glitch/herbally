"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Leaf,
  Shield,
  AlertTriangle,
  Calculator,
  MessageCircle,
  Stethoscope,
} from "lucide-react";

const categoryIcons: Record<string, typeof Leaf> = {
  aboutHerbAlly: Leaf,
  herbSafety: Shield,
  drugInteractions: AlertTriangle,
  dosageUsage: Calculator,
  virtualHerbalist: MessageCircle,
  sourcesEvidence: Stethoscope,
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  title: string;
  catKey: string;
  questions: FAQItem[];
}

export function FaqSearch({ categories }: { categories: FAQCategory[] }) {
  const [query, setQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (item) =>
            item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.questions.length > 0);
  }, [query, categories]);

  const totalResults = filteredCategories.reduce(
    (sum, cat) => sum + cat.questions.length,
    0
  );

  return (
    <>
      {/* Search bar */}
      <div className="relative mx-auto mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQ..."
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {query && (
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {totalResults} result{totalResults !== 1 ? "s" : ""}
        </p>
      )}

      {filteredCategories.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No results found. Try a different search term.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredCategories.map((category) => {
            const CategoryIcon = categoryIcons[category.catKey] || Leaf;
            return (
              <section key={category.catKey}>
                <div className="mb-4 flex items-center gap-3">
                  <CategoryIcon className="size-6 text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">
                    {category.title}
                  </h2>
                </div>
                <div className="space-y-4">
                  {category.questions.map((faq, i) => (
                    <Card key={i}>
                      <CardContent className="p-5">
                        <h3 className="font-semibold text-foreground">
                          {faq.q}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {faq.a}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
