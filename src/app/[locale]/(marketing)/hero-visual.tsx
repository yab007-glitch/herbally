import Image from "next/image";

/**
 * Decorative hero band: one still frame with a slow Ken Burns drift, CSS only.
 *
 * History: this started as a generated 4 s clip. Measured frame-to-frame it was
 * a near-still (mean luma delta 0.38/255) that weighed 1.4 MB — all of the load
 * cost, none of the motion. The other take did move, but a malformed AI hand
 * slid into frame at ~2.4 s. A single still plus a 28 s CSS pan gives smoother
 * movement than the clip did, ships at a fraction of the weight, costs no video
 * decode on mobile, and cannot grow a bad hand.
 *
 * `aria-hidden` and placed below the LCP headline: this is atmosphere, not
 * content, so it must never delay the text the page is ranked for.
 *
 * Reduced-motion visitors get the plain still. That swap is pure CSS, so it
 * works without JavaScript and without a hydration mismatch.
 */
export function HeroVisual() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-3xl border bg-muted"
      >
        <div className="hero-kenburns">
          <Image
            src="/media/herbally-hero-still.webp"
            alt=""
            width={1280}
            height={720}
            sizes="(max-width: 768px) 100vw, 768px"
            className="aspect-video w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
