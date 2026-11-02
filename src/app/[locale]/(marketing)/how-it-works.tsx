import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

/**
 * Editorial block below the checker (SEO brief, Workstream B).
 *
 * The homepage's job is the tool, but a page that is only a form gives a search
 * engine and a first-time visitor nothing to judge the site on. This explains
 * what the checker does, what it cannot do, how the evidence is graded and
 * where the sources come from — in the site's own voice, with no claim that is
 * not already true of the data model.
 *
 * Copy lives here rather than in the dictionaries: it is one long-form page
 * section, like /editorial-policy, and splitting eight paragraphs into ICU keys
 * only makes the French drift harder to see.
 */

type Block = {
  title: string;
  body: string;
  link?: { href: string; label: string };
};

type Copy = {
  title: string;
  intro: string;
  blocks: Block[];
  nextTitle: string;
  nextLinks: { href: string; label: string }[];
  disclaimer: string;
};

const COPY: Record<"en" | "fr", Copy> = {
  en: {
    title: "How this herb–drug interaction checker works",
    intro:
      "HerbAlly is a free reference for medicinal herbs and the medicines they can interfere with. This section explains what the checker does with the herb and medication you type, where the answers come from, and the limits worth knowing before you act on one.",
    blocks: [
      {
        title: "What the checker does",
        body: "When you enter a herb and a medication, HerbAlly looks the pair up in its own curated table of herb–drug interactions. Each recorded pair carries a severity — severe, moderate or mild — a plain-language description of what happens, the mechanism where it is known, and the source it came from. If the pair is in the table, you get that record. If it is not, the checker says so instead of inventing an answer, and offers the Virtual Herbalist, which answers from that herb's cited profile.",
        link: {
          href: "/herb-drug-interactions",
          label: "Browse the interaction library",
        },
      },
      {
        title: "What it does not do",
        body: "It is not a complete interaction database. A pair that is missing is not evidence that the combination is safe — most herb–drug combinations have never been studied at all, and much of what has been published is a single case report. The checker also cannot see your dose, your other medicines, your kidney or liver function, or how you space your doses. It cannot tell you whether a combination is safe for you.",
      },
      {
        title: "How the evidence is graded",
        body: "Every profile carries an evidence grade. Primary source means the claim traces to a specific study or official monograph. Clinical evidence means human trials exist but are limited or mixed. Traditional use means the use is documented historically and has not been tested clinically. “Unknown — not enough data” is a real answer here, not a placeholder: about half the library has no citation behind at least one field, and those pages say so.",
        link: { href: "/methodology", label: "Read the methodology" },
      },
      {
        title: "Where the information comes from",
        body: "Profiles are compiled from published literature — PubMed abstracts, and reference sources including NCCIH, WHO monographs and EMA herbal monographs — and each page lists the articles it was built from. Interaction pairs are curated separately and individually sourced. A page also states plainly when it has not yet been reviewed by a human.",
      },
      {
        title: "How to use it without getting hurt",
        body: "Treat a result as a reason to ask a question, not a verdict. Write down every herb, supplement, vitamin and medicine you take, with dose and timing, and take that list to a pharmacist. A pharmacist can check it against your actual prescriptions and your history, which this site cannot see. If you have already combined something and feel unwell, stop and seek care rather than waiting to see how it goes.",
        link: { href: "/calculator", label: "Adult dosage calculator" },
      },
    ],
    nextTitle: "Where to go next",
    nextLinks: [
      { href: "/herbs", label: "Herb database" },
      { href: "/symptoms", label: "Herbs by symptom" },
      { href: "/faq", label: "Common questions" },
      { href: "/disclaimer", label: "Medical disclaimer" },
    ],
    disclaimer:
      "HerbAlly is educational material — not medical advice, diagnosis or treatment. It is not affiliated with the FDA or Health Canada, and it is not a substitute for a pharmacist or physician who knows your history.",
  },
  fr: {
    title:
      "Comment fonctionne ce vérificateur d’interactions plante-médicament",
    intro:
      "HerbAlly est une référence gratuite sur les plantes médicinales et les médicaments avec lesquels elles peuvent interagir. Cette section explique ce que le vérificateur fait avec la plante et le médicament que vous saisissez, d’où viennent les réponses et quelles limites il faut connaître avant d’agir.",
    blocks: [
      {
        title: "Ce que fait le vérificateur",
        body: "Quand vous entrez une plante et un médicament, HerbAlly cherche la paire dans sa propre table d’interactions plante-médicament. Chaque paire répertoriée porte une gravité — grave, modérée ou légère — une description en langage clair de ce qui se passe, le mécanisme lorsqu’il est connu, et la source d’où elle vient. Si la paire est dans la table, vous obtenez cette fiche. Sinon, le vérificateur le dit plutôt que d’inventer une réponse, et propose l’herboriste virtuel, qui répond à partir de la fiche sourcée de la plante.",
        link: {
          href: "/herb-drug-interactions",
          label: "Parcourir la bibliothèque d’interactions",
        },
      },
      {
        title: "Ce qu’il ne fait pas",
        body: "Ce n’est pas une base d’interactions complète. Une paire absente ne prouve pas que l’association est sans danger : la plupart des combinaisons plante-médicament n’ont jamais été étudiées, et une bonne partie de ce qui a été publié tient à un seul cas rapporté. Le vérificateur ne voit pas non plus votre dose, vos autres médicaments, l’état de vos reins ou de votre foie, ni l’espacement de vos prises. Il ne peut pas vous dire si une association est sécuritaire pour vous.",
      },
      {
        title: "Comment le niveau de preuve est établi",
        body: "Chaque fiche porte un niveau de preuve. Source primaire signifie que l’énoncé renvoie à une étude précise ou à une monographie officielle. Preuves cliniques signifie qu’il existe des essais chez l’humain, mais limités ou contradictoires. Usage traditionnel signifie que l’usage est documenté historiquement sans avoir été testé cliniquement. « Inconnu — données insuffisantes » est une vraie réponse ici, pas un espace vide : environ la moitié de la bibliothèque n’a aucune source derrière au moins un champ, et ces fiches le disent.",
        link: { href: "/methodology", label: "Lire la méthodologie" },
      },
      {
        title: "D’où viennent les renseignements",
        body: "Les fiches sont compilées à partir de la littérature publiée — résumés PubMed, et sources de référence dont le NCCIH, les monographies de l’OMS et les monographies végétales de l’EMA — et chaque page énumère les articles sur lesquels elle s’appuie. Les paires d’interactions sont répertoriées séparément, une source à la fois. Une page indique aussi clairement lorsqu’elle n’a pas encore été révisée par une personne.",
      },
      {
        title: "Comment l’utiliser sans se mettre en danger",
        body: "Prenez un résultat comme une raison de poser une question, pas comme un verdict. Écrivez tout ce que vous prenez — plantes, suppléments, vitamines, médicaments — avec la dose et l’heure, et apportez cette liste à un pharmacien. Le pharmacien peut la vérifier contre vos ordonnances et votre dossier, ce que ce site ne peut pas voir. Si vous avez déjà combiné quelque chose et que vous vous sentez mal, arrêtez et consultez plutôt que d’attendre de voir comment ça évolue.",
        link: { href: "/calculator", label: "Calculateur de posologie adulte" },
      },
    ],
    nextTitle: "Où aller ensuite",
    nextLinks: [
      { href: "/herbs", label: "Base de données des plantes" },
      { href: "/symptoms", label: "Plantes par symptôme" },
      { href: "/faq", label: "Questions fréquentes" },
      { href: "/disclaimer", label: "Avertissement médical" },
    ],
    disclaimer:
      "HerbAlly est du contenu éducatif — ni un avis médical, ni un diagnostic, ni un traitement. Le site n’est affilié ni à la FDA ni à Santé Canada, et il ne remplace pas un pharmacien ou un médecin qui connaît votre dossier.",
  },
};

export function HowItWorks({ locale }: { locale: Locale }) {
  const c = COPY[locale === "fr" ? "fr" : "en"];

  return (
    <section
      aria-labelledby="how-it-works-title"
      className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6"
    >
      <div className="rule mb-10" />
      <h2
        id="how-it-works-title"
        className="text-2xl font-bold tracking-tight text-foreground"
      >
        {c.title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {c.intro}
      </p>

      <div className="mt-8 space-y-7">
        {c.blocks.map((block) => (
          <div key={block.title}>
            <h3 className="text-base font-semibold text-foreground">
              {block.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {block.body}
            </p>
            {block.link ? (
              <Link
                href={block.link.href}
                className="mt-2 inline-block text-sm text-primary hover:underline"
              >
                {block.link.label} →
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <h3 className="mt-10 text-base font-semibold text-foreground">
        {c.nextTitle}
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {c.nextLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        {c.disclaimer}
      </p>
    </section>
  );
}
