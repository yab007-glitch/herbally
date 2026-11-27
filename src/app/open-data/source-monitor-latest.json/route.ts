import reportPayload from "@/lib/open-data/source-monitor-latest.json";

export const revalidate = 3600;

export async function GET() {
  return new Response(JSON.stringify(reportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
