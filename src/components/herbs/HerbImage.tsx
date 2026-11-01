import Image from "next/image";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

interface HerbImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  priority?: boolean;
}

/**
 * First letter of the herb name, used as a specimen-label monogram. Returns
 * null for a missing/blank/non-string name so the caller can fall back to a
 * botanical mark instead of rendering an empty tile (Sentry 2f94280a was a
 * garden entry with a missing name crashing the old initials helper).
 */
function getMonogram(name: string): string | null {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) return null;
  const first = safe.match(/[a-zà-ÿ0-9]/i)?.[0];
  return first ? first.toUpperCase() : null;
}

/**
 * Herbs without a photo used to render a saturated coloured gradient tile with
 * a letter in it — on a paper-coloured page that read as a broken image. The
 * fallback is now a printed specimen label: warm paper wash, a hairline ring
 * and a serif monogram, in the same palette as the rest of the site.
 *
 * The monogram is drawn in SVG with a 100×100 viewBox so it scales with the
 * tile at every size the site uses (48 px cards, 112 px hero) instead of
 * needing a per-size font size.
 */
export function HerbImage({
  name,
  imageUrl,
  className,
  priority,
}: HerbImageProps) {
  const monogram = getMonogram(name ?? "");
  const altName = typeof name === "string" && name ? name : "herb";

  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={imageUrl}
          alt={altName}
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
      {monogram ? (
        <svg
          viewBox="0 0 100 100"
          className="size-full"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.22"
          />
          <text
            x="50"
            y="52"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display), Georgia, serif"
            fontSize="46"
            fill="currentColor"
            fillOpacity="0.85"
          >
            {monogram}
          </text>
        </svg>
      ) : (
        <Leaf className="h-1/3 w-1/3 opacity-60" aria-hidden="true" />
      )}
    </div>
  );
}
