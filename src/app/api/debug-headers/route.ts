import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const h = await headers();
  const out: Record<string, string> = {};
  h.forEach((v, k) => { out[k] = v; });
  return NextResponse.json({ headers: out });
}
