import Image from "next/image";
import { HERB_PHOTOS, type HerbPhotoCredit } from "@/lib/herbs/photo-credits";

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
  imageUrl,
  credit,
  creditUrl,
  licence,
  licenceUrl,
  publisher,
}: {
  slug: string;
  name: string;
  className?: string;
  /** Image from the herb record (Commons), preferred over the static map. */
  imageUrl?: string | null;
  credit?: string | null;
  creditUrl?: string | null;
  licence?: string | null;
  licenceUrl?: string | null;
  /** Where the photo came from: Wikimedia Commons, iNaturalist, GBIF. */
  publisher?: string | null;
}) {
  // The record stores "Artist — Licence" and the caption appends the licence, so
  // strip the trailing pair or the line reads "Public domain · Public domain".
  const artist = (credit || "")
    .replace(/\s+—\s+(CC[^—]*|Public domain|GFDL[^—]*)$/i, "")
    .trim();
  const photo: HerbPhotoCredit | null = imageUrl
    ? {
        src: imageUrl,
        licence: licence || "",
        licenceUrl: licenceUrl || null,
        artist: artist || "Wikimedia Commons",
        commonsPage: creditUrl || null,
      }
    : (HERB_PHOTOS[slug] ?? null);
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
        {" · via "}
        {publisher || "Wikimedia Commons"}
      </figcaption>
    </figure>
  );
}
