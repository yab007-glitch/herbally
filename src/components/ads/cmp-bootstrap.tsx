import { CONSENT_MODE_DEFAULT_SCRIPT } from "@/lib/ads/cmp";
import { ADS_LAUNCH_GATE } from "@/lib/ads/policy";

/**
 * Emit the Consent Mode v2 default state before any Google tag can run.
 *
 * This is a server component so the script ships in the document's HTML
 * rather than after hydration: an inline default must be in place before the
 * first measurement or ad request, and a client effect is too late for that.
 * Renders nothing while the launch gate is off or the publisher client is not
 * configured, so production stays free of Google-tagged markup until launch.
 */
export function CmpBootstrap() {
  if (!ADS_LAUNCH_GATE) return null;

  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;

  // The body is a fixed constant built in cmp.ts; no visitor input reaches it.
  return (
    <script
      id="googlefc-consent-default"
      dangerouslySetInnerHTML={{ __html: CONSENT_MODE_DEFAULT_SCRIPT }}
    />
  );
}
