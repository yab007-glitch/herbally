"use client";

const STREAK_KEY = "herbally-streak";
const LAST_VISIT_KEY = "herbally-last-visit";
const EXPLORED_COUNT_KEY = "herbally-explored-count";
const EXPLORED_HERBS_KEY = "herbally-explored-herbs";

interface StreakData {
  current: number;
  longest: number;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function recordVisit(): StreakData {
  if (typeof window === "undefined") return { current: 0, longest: 0 };

  const today = getToday();
  const last = localStorage.getItem(LAST_VISIT_KEY);

  let streak: StreakData;
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    streak = raw ? (JSON.parse(raw) as StreakData) : { current: 0, longest: 0 };
  } catch {
    streak = { current: 0, longest: 0 };
  }

  if (last === today) {
    return streak;
  }

  if (last === getYesterday()) {
    streak.current += 1;
  } else if (last !== today) {
    streak.current = 1;
  }

  if (streak.current > streak.longest) {
    streak.longest = streak.current;
  }

  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  localStorage.setItem(LAST_VISIT_KEY, today);
  return streak;
}

export function getStreak(): StreakData {
  if (typeof window === "undefined") return { current: 0, longest: 0 };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as StreakData) : { current: 0, longest: 0 };
  } catch {
    return { current: 0, longest: 0 };
  }
}

export function recordHerbExplored(slug: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(EXPLORED_HERBS_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(slug);
    const arr = Array.from(set);
    localStorage.setItem(EXPLORED_HERBS_KEY, JSON.stringify(arr));
    localStorage.setItem(EXPLORED_COUNT_KEY, String(arr.length));
    return arr.length;
  } catch {
    return 0;
  }
}

export function getExploredCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(EXPLORED_COUNT_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export function getExploredHerbs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXPLORED_HERBS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
