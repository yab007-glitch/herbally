import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";

export const revalidate = 86400;

const COPY = {
  en: {
    title: "Editorial policy",
    description:
      "How HerbAlly writes, verifies, and corrects its herbal profiles: named accountability, AI disclosure, evidence labels, and corrections.",
    intro:
      "This page explains how the information on HerbAlly is produced, who is accountable for it, and how to get something corrected. It is deliberately specific — a health reference should be able to say exactly where its words come from.",
    sections: [
      {
        heading: "Who is accountable",
        body: [
          "HerbAlly is written, maintained, and editorially reviewed by Yasser Bheekun, a medical laboratory technologist certified with the OPTMQ (Ordre professionnel des technologistes médicaux du Québec) and the CSMLS (Canadian Society for Medical Laboratory Science). He holds a DEC in Biomedical Laboratory Technology and works in a hospital laboratory at the McGill University Health Centre in Montreal.",
          "That is the accountability line: one named person, with a health-science education, answerable for what this site publishes. It is not an anonymous content team or hidden board.",
          "As reviewer of record, Yasser progressively reviews and validates published herb profiles against primary regulatory and clinical monographs (Health Canada NHP, EMA HMPC, NIH NCCIH, NIH LiverTox, and PubMed). Each herb page carries a visible review badge showing whether it has been personally human-reviewed and signed off, flagged as needing re-review after edits, or compiled from cited sources awaiting personal review — educational oversight, explicitly distinct from licensed physician clinical care.",
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
          "“Human-reviewed” — a named reviewer (with date) has personally read and signed off on the current entry against cited primary sources.",
          "“Needs re-review” — the entry was updated after cross-checking or new evidence and is treated as unreviewed until signed off again.",
          "“AI-summarized” — drafted with AI assistance from published material and edited, but not independently checked against a primary source.",
          "“Not human-reviewed” / “Unverified” — no person has checked and signed off this page yet. Treat it carefully and verify against the listed primary sources.",
          "“Not clinically reviewed” — no licensed clinician has reviewed this page. This label is shown honestly wherever it applies; it is not a failure of the page, it is a limit you should know about.",
        ],
      },
      {
        heading: "Safety claims",
        body: [
          "Interaction severity, contraindications and pregnancy/nursing assessments are the highest-risk statements on this site. They are written conservatively: where the evidence is thin, the page says “unknown” rather than guessing.",
          "Pediatric dosing (under age 18) and classical weight/age scaling formulas (Clark's, Young's, Fried's, BSA) are disabled site-wide. Legacy interaction pairs without a recorded licensed clinical reviewer sign-off carry blocked clinical action notices.",
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
          "HerbAlly is free to use and is funded by voluntary donations. Google AdSense is currently inactive; if advertising is enabled on standard public herb reference pages in future after explicit cookie consent, health-input tools, embedded widgets (/embed/*), and permanently quarantined toxic botanical pages remain strictly ad-free and cookie-free. Sponsors and advertisers have no influence over editorial content, interaction ratings, or which herbs are covered.",
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
      "Comment HerbAlly rédige, vérifie et corrige ses fiches : personne responsable, rôle de l'IA, étiquettes de révision et signalement d'erreurs.",
    intro:
      "Cette page explique comment l'information sur HerbAlly est produite, qui en est responsable, et comment faire corriger quelque chose. Elle est volontairement précise : une référence en santé doit pouvoir dire exactement d'où viennent ses mots.",
    sections: [
      {
        heading: "Qui est responsable",
        body: [
          "HerbAlly est rédigé, maintenu et révisé sur le plan éditorial par Yasser Bheekun, technologiste médical certifié par l'OPTMQ (Ordre professionnel des technologistes médicaux du Québec) et la SCSLM (Société canadienne de science de laboratoire médical). Il détient un DEC en technologie d'analyses biomédicales et travaille dans un laboratoire hospitalier du Centre universitaire de santé McGill, à Montréal.",
          "C'est la ligne de responsabilité : une personne nommée, formée en sciences de la santé, répond de ce que ce site publie. Ce n'est ni une équipe de contenu anonyme ni un comité éditorial caché.",
          "À titre de réviseur de référence, Yasser relit et valide progressivement les fiches publiées par rapport aux monographies réglementaires et cliniques primaires (Santé Canada, EMA HMPC, NIH NCCIH, NIH LiverTox et PubMed). Chaque fiche affiche un badge explicite indiquant si elle a été personnellement validée par un humain, marquée « À réviser de nouveau » après mise à jour, ou compilée en attente de validation — une révision éditoriale, distincte d'un acte médical clinique.",
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
          "« Révisé par un humain » — une personne nommée (avec date) a personnellement relu et validé la fiche actuelle par rapport aux sources primaires citées.",
          "« À réviser de nouveau » — la fiche a été mise à jour après recoupement ou nouvelles données et doit être considérée comme non révisée jusqu'à nouvelle validation.",
          "« Résumé par IA » — rédigé avec l'aide de l'IA à partir de documents publiés et révisé, mais sans vérification indépendante contre une source primaire.",
          "« Non révisé par un humain » / « Non vérifié » — aucune personne n'a encore relu et validé cette page. Vérifiez toujours les sources primaires citées.",
          "« Non révisé cliniquement » — aucun clinicien autorisé n'a révisé cette page. Cette étiquette est affichée honnêtement partout où elle s'applique ; ce n'est pas un échec de la page, c'est une limite que vous devez connaître.",
        ],
      },
      {
        heading: "Les affirmations de sécurité",
        body: [
          "La gravité des interactions, les contre-indications et les évaluations grossesse/allaitement sont les affirmations les plus à risque du site. Elles sont rédigées avec prudence : quand les données sont minces, la page indique « inconnu » plutôt que de deviner.",
          "La posologie pédiatrique (moins de 18 ans) et les formules classiques d'ajustement selon le poids ou l'âge (Clark, Young, Fried, surface corporelle) sont désactivées sur tout le site. Les anciennes fiches d'interactions sans validation clinique enregistrée affichent un avis de conduite clinique bloquée.",
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
          "HerbAlly est gratuit et soutenu par des dons volontaires. Google AdSense est actuellement inactif ; si de la publicité clairement identifiée est activée ultérieurement sur les pages publiques standard de plantes après consentement explicite, les outils de santé, les widgets intégrables (/embed/*) et les plantes toxiques en quarantaine demeurent strictement sans publicité ni témoin publicitaire. Les commanditaires et annonceurs n'ont aucune influence sur le contenu éditorial, les cotes d'interaction ni le choix des plantes couvertes.",
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
    // The root layout appends "| HerbAlly"; adding it here rendered it twice.
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `${siteUrl()}${path}`,
      languages: {
        en: `${siteUrl()}/editorial-policy`,
        fr: `${siteUrl()}/fr/editorial-policy`,
        "x-default": `${siteUrl()}/editorial-policy`,
      },
    },
    // Without this the page inherited the homepage openGraph, so sharing it
    // produced og:url = https://herbally.app — the wrong page entirely.
    openGraph: {
      title: c.title,
      description: c.description,
      url: `${siteUrl()}${path}`,
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: c.title,
        },
      ],
    },
  };
}

export default async function EditorialPolicyPage() {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const c = COPY[locale];
  const url = `${siteUrl()}${addLocalePrefix("/editorial-policy", locale)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <WebPageSchema title={c.title} description={c.description} url={url} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Yasser Bheekun",
            jobTitle:
              "Medical Laboratory Technologist (MLT) — Editor & Reviewer of Record",
            hasCredential: [
              "OPTMQ Certified Medical Laboratory Technologist",
              "CSMLS Certified Medical Laboratory Technologist",
              "DEC in Biomedical Laboratory Technology, Dawson College",
            ],
            affiliation: {
              "@type": "Organization",
              name: "McGill University Health Centre (hospital laboratory)",
            },
            url,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: c.title, url: "/editorial-policy" },
        ]}
      />
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

      <section
        id="clinical-governance-protocol"
        aria-labelledby="governance-protocol-heading"
        className="space-y-6 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
      >
        <div>
          <p className="eyebrow">
            {locale === "fr"
              ? "Gouvernance clinique et charte"
              : "Clinical Governance & SOP"}
          </p>
          <h2
            id="governance-protocol-heading"
            className="mt-1 text-xl font-semibold text-foreground"
          >
            {locale === "fr"
              ? "Protocole d'intégration des réviseurs cliniques, comité consultatif et délais SLA"
              : "Clinical Reviewer Onboarding Protocol, Advisory Charter & Correction SLAs"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {locale === "fr"
              ? "HerbAlly sépare strictement la vérification éditoriale des sources (MLT) de la validation clinique par des professionnels titulaires d'un permis d'exercice, avec des déclencheurs automatiques en base de données qui réinitialisent la signature clinique dès qu'une fiche est modifiée."
              : "HerbAlly strictly separates editorial source verification (MLT) from licensed clinical sign-off, backed by database triggers that reset prior clinical approval whenever an herb or interaction record is revised."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4 text-sm">
            <h3 className="font-semibold text-foreground">
              {locale === "fr"
                ? "Séparation des rôles (éditorial vs clinique)"
                : "Role Separation (Editorial vs. Clinical)"}
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  {locale === "fr"
                    ? "Réviseur éditorial :"
                    : "Editorial reviewer:"}
                </strong>{" "}
                {locale === "fr"
                  ? "vérifie la clarté, les sources primaires (Santé Canada, EMA, NCCIH, LiverTox, PubMed) et la parité EN/FR ; ne peut pas lever le blocage d'action clinique."
                  : "verifies source citations, framing, and EN/FR parity; cannot unlock clinician_approved clinical action status."}
              </li>
              <li>
                <strong className="text-foreground">
                  {locale === "fr"
                    ? "Réviseur clinique agréé :"
                    : "Licensed clinical reviewer:"}
                </strong>{" "}
                {locale === "fr"
                  ? "pharmacien(ne), médecin ou toxicologue titulaire d'un permis vérifié avec divulgation des conflits d'intérêts et consentement écrit d'attribution publique."
                  : "licensed pharmacist (PharmD/RPh), physician (MD/DO), or toxicologist with verified active licence, written COI disclosure, and explicit attribution consent."}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 text-sm">
            <h3 className="font-semibold text-foreground">
              {locale === "fr"
                ? "Comité consultatif clinique (0 membre siégeant actuellement)"
                : "Clinical Advisory Board Seats (0 Currently Seated)"}
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Seat A</strong> —{" "}
                {locale === "fr"
                  ? "Pharmacien(ne) / Interactions plante-médicament : Vacant"
                  : "Pharmacist / Herb–Drug Interactions: Vacant"}
              </li>
              <li>
                <strong className="text-foreground">Seat B</strong> —{" "}
                {locale === "fr"
                  ? "Médecin / Toxicologie générale : Vacant"
                  : "Physician / General & Toxicology: Vacant"}
              </li>
              <li>
                <strong className="text-foreground">Seat C</strong> —{" "}
                {locale === "fr"
                  ? "Pédiatrie / Tératologie : Vacant (posologie pédiatrique désactivée sur tout le site)"
                  : "Pediatric / Teratology Consultant: Vacant (pediatric dosing remains disabled site-wide)"}
              </li>
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">
                  {locale === "fr" ? "Gravité d'incident" : "Incident Severity"}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {locale === "fr" ? "Délai cible (SLA)" : "Target Triage SLA"}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {locale === "fr"
                    ? "Mesure de confinement immédiate"
                    : "Engineering & Clinical Containment"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-muted-foreground">
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">
                  Critical
                </td>
                <td className="px-3 py-2 font-semibold text-destructive">
                  24 hours
                </td>
                <td className="px-3 py-2">
                  {locale === "fr"
                    ? "Mise en quarantaine immédiate de la fiche et désactivation de toute plage posologique jusqu'à validation."
                    : "Immediate surface/row quarantine and suppression of automated dosage outputs pending review."}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">High</td>
                <td className="px-3 py-2 font-semibold text-foreground">
                  72 hours
                </td>
                <td className="px-3 py-2">
                  {locale === "fr"
                    ? "Ajout d'un bandeau d'alerte ou blocage clinique avec réévaluation prioritaire et journal public."
                    : "Safety banner / clinical-action block with prioritized review and public correction entry."}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">
                  Medium
                </td>
                <td className="px-3 py-2">7 days</td>
                <td className="px-3 py-2">
                  {locale === "fr"
                    ? "Consignation dans l'audit interne, vérification des sources primaires et file éditoriale."
                    : "Logged for source verification, editorial triage, and regression test update."}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">Low</td>
                <td className="px-3 py-2">30 days</td>
                <td className="px-3 py-2">
                  {locale === "fr"
                    ? "Regroupement avec le cycle planifié de révision documentaire (sans jamais collecter de données patients PHI)."
                    : "Batched into scheduled content audit (zero patient PHI permitted in intake logs)."}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
        <div className="mt-4 border-t border-border/70 pt-3 text-sm text-muted-foreground">
          <p>
            {locale === "fr"
              ? "Vous êtes contributeur, chercheur(se), pharmacien(ne) ou médecin ? Connectez-vous via LinkedIn OpenID Connect pour suggérer une amélioration ou vous porter volontaire pour la révision clinique :"
              : "Are you a contributor, researcher, pharmacist, or physician? Sign in with LinkedIn OpenID Connect to suggest source-backed edits or volunteer for clinical review triage:"}
          </p>
          <Link
            href="/clinical-review"
            className="mt-1.5 inline-block font-medium text-primary underline underline-offset-4"
          >
            {locale === "fr"
              ? "Ouvrir le portail des réviseurs cliniques →"
              : "Open Clinical Reviewer Portal →"}
          </Link>
        </div>
      </section>

      <p className="mt-8 flex flex-wrap gap-5 text-sm">
        <Link
          href="/herbs"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {c.back}
        </Link>
        <Link
          href="/methodology#governance-coverage"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr"
            ? "Couverture de gouvernance en direct"
            : "Live Governance & Corrections Log"}
        </Link>
        <Link
          href="/methodology"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr" ? "Méthodologie" : "Methodology"}
        </Link>
        <Link
          href="/about"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr" ? "À propos" : "About"}
        </Link>
        <Link
          href="/disclaimer"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr" ? "Avertissement médical" : "Medical Disclaimer"}
        </Link>
        <Link
          href="/privacy"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === "fr" ? "Confidentialité" : "Privacy"}
        </Link>
      </p>
    </div>
  );
}
