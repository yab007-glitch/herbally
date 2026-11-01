import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/page-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { addLocalePrefix } from "@/lib/i18n/routing";

export const revalidate = 86400;

const COPY = {
  en: {
    title: "Editorial policy",
    description:
      "How HerbAlly writes, checks and corrects its herbal reference: who is accountable, how AI is used, what the review labels mean, and how to report an error.",
    intro:
      "This page explains how the information on HerbAlly is produced, who is accountable for it, and how to get something corrected. It is deliberately specific — a health reference should be able to say exactly where its words come from.",
    sections: [
      {
        heading: "Who is accountable",
        body: [
          "HerbAlly is written and maintained by Yasser Bheekun, a medical laboratory technologist certified with the OPTMQ (Ordre professionnel des technologistes médicaux du Québec) and the CSMLS (Canadian Society for Medical Laboratory Science). He holds a DEC in Biomedical Laboratory Technology and works in a hospital laboratory at the McGill University Health Centre in Montreal.",
          "That is the accountability line: one named person, with a health-science education, answerable for what this site publishes. It is not a content team, and it is not an anonymous editorial board.",
        ],
      },
      {
        heading: "How the pages are produced",
        body: [
          "Herb monographs begin as AI-assisted drafts built from published sources, then are edited for accuracy, safety framing and plain language. Where a page has been checked against a primary source (a pharmacopoeia, a systematic review, a regulator's monograph) it says so.",
          "AI is used as a drafting and structuring tool, never as the final authority. No page is published claiming a clinical review that did not happen.",
        ],
      },
      {
        heading: "What the labels mean",
        body: [
          "“Human-verified” (primary source) — the content was checked against a named primary source, and the source is listed on the page.",
          "“AI-summarized” — drafted with AI assistance from published material and edited, but not independently checked against a primary source.",
          "“Unverified” — not yet checked. Treat it as a starting point, not an answer.",
          "“Not clinically reviewed” — no licensed clinician has reviewed this page. This label is shown honestly wherever it applies; it is not a failure of the page, it is a limit you should know about.",
        ],
      },
      {
        heading: "Safety claims",
        body: [
          "Interaction severity, contraindications and pregnancy/nursing assessments are the highest-risk statements on this site. They are written conservatively: where the evidence is thin, the page says “unknown” rather than guessing.",
          "HerbAlly is educational information, not medical advice, diagnosis or treatment. Nothing here replaces your prescriber or pharmacist, who can see your full history and your actual prescriptions.",
        ],
      },
      {
        heading: "Corrections",
        body: [
          "If you find something wrong — a dose, an interaction, a claim that overstates the evidence — email info@herbally.app with the page URL and what is incorrect. Corrections that affect safety are handled first.",
          "Corrected pages show an updated revision date. Substantive corrections are noted on the page rather than quietly overwritten.",
        ],
      },
      {
        heading: "Funding and independence",
        body: [
          "HerbAlly is free to use. It is funded by donations, and may carry clearly labelled advertising on public reference pages in future. Sponsors and advertisers have no influence over editorial content, interaction ratings or which herbs are covered.",
        ],
      },
    ],
    contactHeading: "Report an error",
    contactBody:
      "Email info@herbally.app with the page URL. Please do not send personal health information.",
    back: "Back to herbs",
  },
  fr: {
    title: "Politique éditoriale",
    description:
      "Comment HerbAlly rédige, vérifie et corrige sa référence sur les plantes : qui est responsable, comment l'IA est utilisée, ce que signifient les étiquettes de révision et comment signaler une erreur.",
    intro:
      "Cette page explique comment l'information sur HerbAlly est produite, qui en est responsable, et comment faire corriger quelque chose. Elle est volontairement précise : une référence en santé doit pouvoir dire exactement d'où viennent ses mots.",
    sections: [
      {
        heading: "Qui est responsable",
        body: [
          "HerbAlly est rédigé et maintenu par Yasser Bheekun, technologiste médical certifié par l'OPTMQ (Ordre professionnel des technologistes médicaux du Québec) et la SCSLM (Société canadienne de science de laboratoire médical). Il détient un DEC en technologie d'analyses biomédicales et travaille dans un laboratoire hospitalier du Centre universitaire de santé McGill, à Montréal.",
          "C'est la ligne de responsabilité : une personne nommée, formée en sciences de la santé, répond de ce que ce site publie. Ce n'est pas une équipe de contenu, ni un comité éditorial anonyme.",
        ],
      },
      {
        heading: "Comment les pages sont produites",
        body: [
          "Les monographies de plantes commencent comme des ébauches assistées par IA, construites à partir de sources publiées, puis sont révisées pour l'exactitude, le cadrage de sécurité et la clarté du langage. Lorsqu'une page a été vérifiée contre une source primaire (pharmacopée, revue systématique, monographie d'un organisme de réglementation), elle le dit.",
          "L'IA sert à rédiger et à structurer, jamais d'autorité finale. Aucune page n'est publiée en prétendant une révision clinique qui n'a pas eu lieu.",
        ],
      },
      {
        heading: "Ce que signifient les étiquettes",
        body: [
          "« Vérifié par un humain » (source primaire) — le contenu a été vérifié contre une source primaire nommée, et la source figure sur la page.",
          "« Résumé par IA » — rédigé avec l'aide de l'IA à partir de documents publiés et révisé, mais sans vérification indépendante contre une source primaire.",
          "« Non vérifié » — pas encore vérifié. À traiter comme un point de départ, pas comme une réponse.",
          "« Non révisé cliniquement » — aucun clinicien autorisé n'a révisé cette page. Cette étiquette est affichée honnêtement partout où elle s'applique ; ce n'est pas un échec de la page, c'est une limite que vous devez connaître.",
        ],
      },
      {
        heading: "Les affirmations de sécurité",
        body: [
          "La gravité des interactions, les contre-indications et les évaluations grossesse/allaitement sont les affirmations les plus à risque du site. Elles sont rédigées avec prudence : quand les données sont minces, la page indique « inconnu » plutôt que de deviner.",
          "HerbAlly est une information éducative, pas un avis médical, un diagnostic ou un traitement. Rien ici ne remplace votre prescripteur ou votre pharmacien, qui connaissent votre historique complet et vos ordonnances réelles.",
        ],
      },
      {
        heading: "Corrections",
        body: [
          "Si vous trouvez une erreur — une dose, une interaction, une affirmation qui exagère les données — écrivez à info@herbally.app avec l'URL de la page et ce qui est incorrect. Les corrections touchant la sécurité sont traitées en premier.",
          "Les pages corrigées affichent une date de révision mise à jour. Les corrections importantes sont indiquées sur la page plutôt que silencieusement écrasées.",
        ],
      },
      {
        heading: "Financement et indépendance",
        body: [
          "HerbAlly est gratuit. Le site est financé par les dons et pourrait afficher, à l'avenir, de la publicité clairement identifiée sur les pages de référence publiques. Les commanditaires et annonceurs n'ont aucune influence sur le contenu éditorial, sur les cotes d'interaction ni sur le choix des plantes couvertes.",
        ],
      },
    ],
    contactHeading: "Signaler une erreur",
    contactBody:
      "Écrivez à info@herbally.app avec l'URL de la page. N'envoyez pas de renseignements personnels sur votre santé.",
    back: "Retour aux plantes",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const c = COPY[locale];
  const path = addLocalePrefix("/editorial-policy", locale);
  return {
    title: `${c.title} | HerbAlly`,
    description: c.description,
    alternates: {
      canonical: `${siteUrl()}${path}`,
      languages: {
        en: `${siteUrl()}/editorial-policy`,
        fr: `${siteUrl()}/fr/editorial-policy`,
        "x-default": `${siteUrl()}/editorial-policy`,
      },
    },
  };
}

export default async function EditorialPolicyPage() {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const c = COPY[locale];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow mb-3">HerbAlly</p>
      <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {c.title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {c.intro}
      </p>

      <div className="rule my-8" />

      <div className="space-y-9">
        {c.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-medium text-foreground">
              {section.heading}
            </h2>
            <div className="mt-2 space-y-3">
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rule my-8" />

      <section className="rounded-sm border border-border bg-accent/40 p-5">
        <h2 className="text-base font-medium text-foreground">
          {c.contactHeading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {c.contactBody}
        </p>
        <a
          href="mailto:info@herbally.app"
          className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          info@herbally.app
        </a>
      </section>

      <p className="mt-8 text-sm">
        <Link
          href="/herbs"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {c.back}
        </Link>
      </p>
    </div>
  );
}
