import Image from "next/image";
import { HERB_PHOTOS } from "@/lib/herbs/photo-credits";

/**
 * Botanical photograph for a herb page, with the attribution its licence
 * requires.
 *
 * Only twelve herbs have a photo so far, so the component returns null for the
 * other 2,687 rather than reserving space — an empty frame on every herb page
 * is worse than no frame at all.
 *
 * The licence line is not optional. Every image here is CC BY or CC BY-SA,
 * which permits commercial use *on condition* of naming the author and the
 * licence; rendering the photo without it would put the site in breach.
 */
export function HerbPhoto({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const photo = HERB_PHOTOS[slug];
  if (!photo) return null;

  return (
    <figure className={className}>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl border bg-muted/30">
        <Image
          src={photo.src}
          alt={`${name} — botanical photograph`}
          fill
          sizes="(max-width: 768px) 100vw, 448px"
          className="object-cover"
          priority={false}
        />
      </div>
      <figcaption className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground">
        {photo.commonsPage ? (
          <a
            href={photo.commonsPage}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline hover:text-foreground"
          >
            {photo.artist}
          </a>
        ) : (
          photo.artist
        )}
        {" · "}
        {photo.licenceUrl ? (
          <a
            href={photo.licenceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline hover:text-foreground"
          >
            {photo.licence}
          </a>
        ) : (
          photo.licence
        )}
        {" · via Wikimedia Commons"}
      </figcaption>
    </figure>
  );
}
