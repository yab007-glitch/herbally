import {
  OPEN_DATA_RESPONSE_HEADERS,
  serializeOpenDataJson,
} from "@/lib/open-data/builders";
import reportPayload from "@/lib/open-data/source-monitor-latest.json";

export const revalidate = 300;

const GITHUB_API_BASE =
  "https://api.github.com/repos/yab007-glitch/herbally/actions/workflows";

interface WorkflowRunSummary {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  headSha: string;
  htmlUrl: string;
  apiUrl: string;
  updatedAt: string;
}

async function fetchLatestWorkflowRun(
  workflowFile: string
): Promise<WorkflowRunSummary | null> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/${workflowFile}/runs?branch=main&status=completed&per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent":
            "HerbAlly-TrustCenter/1.0 (+https://herbally.app/trust)",
        },
        signal: AbortSignal.timeout(3_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      workflow_runs?: Array<{
        id: number;
        name: string | null;
        status: string | null;
        conclusion: string | null;
        head_sha: string;
        html_url: string;
        url: string;
        updated_at: string;
      }>;
    };
    const run = data.workflow_runs?.[0];
    if (!run) return null;
    return {
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      htmlUrl: run.html_url,
      apiUrl: run.url,
      updatedAt: run.updated_at,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [sourceMonitor, deploy, ci] = await Promise.all([
    fetchLatestWorkflowRun("source-monitor.yml"),
    fetchLatestWorkflowRun("deploy.yml"),
    fetchLatestWorkflowRun("ci.yml"),
  ]);

  const enriched = {
    ...reportPayload,
    liveGitHubWorkflowRuns: {
      fetchedAt: new Date().toISOString(),
      sourceMonitor,
      deploy,
      ci,
    },
  };

  return new Response(serializeOpenDataJson(enriched), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
