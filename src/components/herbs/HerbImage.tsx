import Image from "next/image";
import { cn } from "@/lib/utils";

interface HerbImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  priority?: boolean;
}

/**
 * A stable 0–4 from the herb's name, so a herb always gets the same motif.
 * Deterministic on purpose: a random motif would change on every render and
 * make the catalogue look unstable between page loads.
 */
function motifIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BOTANICAL_MOTIFS.length;
}

/**
 * Five engraved botanical marks: leaf, sprig, root, flower, seed.
 *
 * These are drawn rather than photographed because most of the 2,700 herbs
 * have no photograph, and a generated picture of "turmeric" is worse than no
 * picture at all — it would be a confident drawing of the wrong plant on a
 * medical reference. A generic engraving is decorative and honest: it makes no
 * claim about the species.
 *
 * All paths live in a 100×100 viewBox and are stroked with currentColor, so a
 * single definition scales from the 48 px catalogue thumb to the 112 px hero
 * mark and follows the theme in light and dark.
 */
const BOTANICAL_MOTIFS = [
  // Leaf with midrib
  "M50 88 C50 66 50 46 50 26 M50 30 C36 30 24 40 22 54 C36 56 46 46 50 30 Z M50 30 C64 30 76 40 78 54 C64 56 54 46 50 30 Z",
  // Sprig: stem with opposed pairs
  "M50 90 L50 22 M50 70 C38 68 30 60 28 50 C40 50 48 58 50 70 Z M50 70 C62 68 70 60 72 50 C60 50 52 58 50 70 Z M50 50 C40 48 34 42 32 34 C42 34 48 40 50 50 Z M50 50 C60 48 66 42 68 34 C58 34 52 40 50 50 Z",
  // Fern frond: a rachis with paired leaflets, unmistakable at 44 px
  "M50 90 L50 18 M50 78 C45 77 41 73 40 67 M50 78 C55 77 59 73 60 67 M50 66 C45 65 41 61 40 55 M50 66 C55 65 59 61 60 55 M50 54 C45 53 41 49 40 43 M50 54 C55 53 59 49 60 43 M50 42 C46 41 43 38 42 33 M50 42 C54 41 57 38 58 33 M50 30 C47 29 45 27 44 23 M50 30 C53 29 55 27 56 23",
  // Closed bud with two flanking petals
  "M50 88 C50 64 50 44 50 26 C58 34 62 46 62 58 C62 74 56 84 50 88 Z M50 88 C44 84 38 74 38 58 C38 46 42 34 50 26 M38 58 C32 50 22 46 16 44 C22 54 28 62 38 66 M62 58 C68 50 78 46 84 44 C78 54 72 62 62 66",
  // Seed capsule trio
  "M50 84 C38 84 28 74 28 60 C28 46 38 34 50 26 C62 34 72 46 72 60 C72 74 62 84 50 84 Z M38 62 C44 66 56 66 62 62 M50 34 L50 78",
];

/**
 * Herbs without a photo used to render a saturated coloured gradient tile with
 * a letter in it — on a paper-coloured page that read as a broken image.
 *
 * The fallback is now a printed specimen mark: a warm paper wash, a hairline
 * inset rule and an engraved botanical motif chosen deterministically from the
 * name. The motif replaces the letter as the focal element because a lone
 * capital in a box still reads "the photo failed to load"; a drawing reads as
 * a deliberate label.
 */
export function HerbImage({
  name,
  imageUrl,
  className,
  priority,
}: HerbImageProps) {
  const safeName = typeof name === "string" && name ? name : "herb";
  const motif = BOTANICAL_MOTIFS[motifIndex(safeName)];

  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={imageUrl}
          alt={safeName}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-border bg-accent text-primary",
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full"
        aria-hidden="true"
        focusable="false"
      >
        {/* Specimen rule, inset like a plate border */}
        <rect
          x="6"
          y="6"
          width="88"
          height="88"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="0.8"
        />
        {/* Fill as well as stroke: at a 44 px card the stroke alone is under
            a pixel wide and the mark disappears; the translucent fill carries
            the silhouette at small sizes while the stroke keeps it crisp at
            the 112 px hero size. */}
        <g
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeOpacity="0.95"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(11 9) scale(0.78)"
        >
          <path d={motif} />
        </g>
      </svg>
    </div>
  );
}
