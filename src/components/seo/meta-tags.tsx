import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo/site-url";

interface MetaTagsProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string[];
}

export function generateMetaTags({
  title,
  description,
  url,
  image = `${siteUrl()}/opengraph-image.png`,
  type = "website",
  publishedTime,
  modifiedTime,
  author = "HerbAlly Editorial Team",
  keywords,
}: MetaTagsProps): Metadata {
  const meta: Metadata = {
    title: `${title} | HerbAlly`,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | HerbAlly`,
      description,
      url,
      siteName: "HerbAlly",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | HerbAlly`,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };

  return meta;
}
