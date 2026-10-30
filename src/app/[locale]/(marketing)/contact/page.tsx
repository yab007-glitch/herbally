import { buildPageMetadata } from "@/lib/i18n/metadata";
import Link from "next/link";
import { Mail, Shield, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "contact",
    descKey: "contactDesc",
    path: "/contact",
  });

// No backend form and no email sending: HerbAlly has no contact-form
// endpoint today, so this page displays the addresses already published on
// the Sponsorship, Privacy, and Terms pages, with what each one is for.
export default async function ContactPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  const entries = [
    {
      icon: Mail,
      title: t("contact.generalTitle"),
      text: t("contact.generalText"),
      email: "info@herbally.app",
    },
    {
      icon: Shield,
      title: t("contact.privacyTitle"),
      text: t("contact.privacyText"),
      email: "privacy@herbally.app",
    },
    {
      icon: Scale,
      title: t("contact.termsTitle"),
      text: t("contact.termsText"),
      email: "legal@herbally.app",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">
        {t("contact.title")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("contact.intro")}</p>

      <div className="mt-10 space-y-6">
        {entries.map(({ icon: Icon, title, text, email }) => (
          <section
            key={email}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {title}
            </h2>
            <p className="mt-2 text-muted-foreground">{text}</p>
            <p className="mt-3">
              <a
                href={`mailto:${email}`}
                className="font-medium text-primary underline hover:no-underline"
              >
                {email}
              </a>
            </p>
          </section>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {t("contact.linksTitle")}
        </h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>
            <Link href="/faq" className="text-primary hover:underline">
              {t("footer.faq")}
            </Link>
          </li>
          <li>
            <Link href="/methodology" className="text-primary hover:underline">
              {t("footer.methodology")}
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="text-primary hover:underline">
              {t("footer.privacy")}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
