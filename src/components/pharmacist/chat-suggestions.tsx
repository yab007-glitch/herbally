"use client";

import { Moon, Shield, Heart, Sparkles } from "lucide-react";

interface Suggestion {
  icon: typeof Sparkles;
  text: string;
  gradient: string;
}

interface ChatSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (text: string) => void;
  stats: { value: string; label: string }[];
}

export function ChatSuggestions({
  suggestions,
  onSelect,
  stats,
}: ChatSuggestionsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          AI-Powered Herbalist
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Ask Our Virtual Herbalist
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
          Get evidence-based answers about medicinal herbs, drug interactions,
          and dosages.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelect(s.text)}
              className={`group flex items-start gap-3 rounded-xl border bg-gradient-to-br ${s.gradient} p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
                <s.icon className="size-5 text-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {s.text}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 flex justify-center gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
