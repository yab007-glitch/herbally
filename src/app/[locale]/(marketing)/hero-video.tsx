import Image from "next/image";

/**
 * Decorative hero clip (Craze / veo-3.1-lite, 4 s, 1280×720, no audio, 1.8 MB).
 *
 * Overhead flat-lay rather than a tabletop scene: the first take grew a
 * malformed hand at the 3 s mark, and a top-down composition keeps hands out
 * of frame entirely. Verified frame-by-frame before shipping.
 *
 * Deliberately below the LCP headline and `aria-hidden`: it is atmosphere, not
 * content, so it must never delay the text the page is ranked for.
 *
 * Reduced-motion visitors get the still poster instead of a looping video; the
 * swap is pure CSS, so it works without JavaScript and without a hydration
 * mismatch.
 */
export function HeroVideo() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-3xl border bg-muted"
      >
        <video
          className="aspect-video w-full object-cover motion-reduce:hidden"
          src="/media/herbally-hero.mp4"
          poster="/media/herbally-hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          disablePictureInPicture
        />
        <Image
          src="/media/herbally-hero-poster.jpg"
          alt=""
          width={1280}
          height={720}
          sizes="(max-width: 768px) 100vw, 768px"
          className="hidden aspect-video w-full object-cover motion-reduce:block"
        />
      </div>
    </section>
  );
}
