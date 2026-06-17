import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const h = await headers();
  const entries: Record<string, string> = {};
  h.forEach((value, key) => {
    entries[key] = value;
  });
  return NextResponse.json({ headers: entries });
}
