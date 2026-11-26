export type RedFlagCategory =
  | "suicidal_crisis"
  | "cardiac_respiratory"
  | "neurologic_stroke"
  | "anaphylaxis"
  | "gi_hemorrhage"
  | "severe_hepatic_renal"
  | "pregnancy_emergency"
  | "sepsis_high_fever";

export interface RedFlagGuidanceLocale {
  headline: string;
  body: string;
  actions: string[];
  helpline: string;
}

export interface RedFlagDetection {
  isRedFlag: boolean;
  category?: RedFlagCategory;
  severity?: "emergency";
  guidance?: {
    en: RedFlagGuidanceLocale;
    fr: RedFlagGuidanceLocale;
  };
}

interface RedFlagRule {
  category: RedFlagCategory;
  patterns: RegExp[];
  guidance: {
    en: RedFlagGuidanceLocale;
    fr: RedFlagGuidanceLocale;
  };
}

const GENERAL_EMERGENCY_ACTIONS_EN = [
  "Stop any non-prescribed herbs or supplements right now and keep labels/bottles to show clinicians.",
  "Call 911 (US/Canada), 112 / 15 (EU/France), 999 (UK), or go to the nearest emergency department immediately.",
  "Do not rely on herbal products, symptom searches, or AI tools to evaluate urgent symptoms.",
];

const GENERAL_EMERGENCY_ACTIONS_FR = [
  "Interrompez immédiatement toute prise de plantes ou compléments non prescrits et conservez les flacons pour l'équipe médicale.",
  "Appelez le 911 (Canada/É.-U.), le 15 / 112 (France/Europe) ou rendez-vous immédiatement aux urgences les plus proches.",
  "N'utilisez pas de plantes médicinales, de moteur de recherche symptomatique ou d'outil d'IA pour évaluer des symptômes urgents.",
];

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    category: "suicidal_crisis",
    patterns: [
      /\b(?:suicid(?:e|al)|kill myself|end my life|want to die|self[- ]?harm|hurt myself|cutting myself|intentional overdose)\b/i,
      /\b(?:suicid(?:aire|er)|me tuer|en finir avec la vie|envie de mourir|automutilation|me faire du mal|surdose volontaire)\b/i,
    ],
    guidance: {
      en: {
        headline: "Immediate crisis support needed — seek help right now",
        body: "HerbAlly cannot provide crisis counseling or herbal suggestions for self-harm or suicidal thoughts. Confidential, free support is available right now.",
        actions: [
          "Call or text 988 (US & Canada Suicide & Crisis Lifeline) right away.",
          "If you are in immediate physical danger, call 911 (or 112 / 999) or go to the nearest emergency department.",
          "Reach out to a trusted person nearby so you are not alone right now.",
        ],
        helpline:
          "988 (US/Canada) · Text HOME to 741741 · Emergency: 911 / 112",
      },
      fr: {
        headline:
          "Soutien immédiat requis — contactez une ligne d'aide maintenant",
        body: "HerbAlly ne peut ni fournir de soutien en situation de crise ni recommander de plantes en cas d'idées suicidaires ou d'automutilation. Une aide confidentielle et gratuite est disponible 24 h/24.",
        actions: [
          "Appelez ou envoyez un SMS au 988 (Canada/É.-U.) ou appelez le 3114 (France) sans attendre.",
          "En cas de danger physique immédiat, appelez le 911 / 15 / 112 ou rendez-vous aux urgences les plus proches.",
          "Prévenez une personne de confiance près de vous pour ne pas rester seul(e).",
        ],
        helpline: "988 (Canada) · 3114 (France) · Urgences : 911 / 15 / 112",
      },
    },
  },
  {
    category: "anaphylaxis",
    patterns: [
      /\b(?:anaphyla(?:xis|ctic)|throat swelling|tongue swelling|swollen (?:throat|tongue|lips)|airway swelling|severe allergic reaction|hives and (?:trouble|difficulty) breathing|wheezing after taking)\b/i,
      /\b(?:anaphylax(?:ie|ique)|gonflement de la gorge|gonflement de la langue|lèvres gonflées|œdème de quincke|réaction allergique sévère|urticaire avec essoufflement)\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible severe allergic reaction (anaphylaxis) — emergency care needed",
        body: "Airway swelling, hives with breathing trouble, or systemic allergic symptoms require immediate emergency medical care, not herbal lookup.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline:
          "Emergency: 911 (US/Canada) · 112 / 15 (EU) · Use epinephrine auto-injector if prescribed.",
      },
      fr: {
        headline:
          "Réaction allergique grave possible (anaphylaxie) — urgence médicale",
        body: "Un gonflement de la gorge ou de la langue, ou une réaction allergique avec gêne respiratoire, exige une prise en charge médicale d'urgence et non une recherche sur les plantes.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline:
          "Urgences : 911 (Canada) · 15 / 112 (France/Europe) · Utilisez votre auto-injecteur d'épinéphrine si prescrit.",
      },
    },
  },
  {
    category: "cardiac_respiratory",
    patterns: [
      /\b(?:chest pain|chest tightness|chest pressure|crushing chest|pain radiating to (?:left )?(?:arm|jaw)|shortness of breath|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|struggling to breathe|coughing up blood|hemoptysis)\b/i,
      /\b(?:douleur thoracique|douleur à la poitrine|oppression thoracique|serrement dans la poitrine|essoufflement (?:sévère|aigu|soudain)|difficulté à respirer|du mal à respirer|cracher du sang|hémoptysie)\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible cardiac or respiratory emergency — seek urgent care immediately",
        body: "Chest pain, breathing difficulty, or coughing up blood may indicate a life-threatening heart or lung emergency. Herbal search and AI guidance are disabled for red-flag symptoms.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline: "Emergency: 911 (US/Canada) · 112 / 15 (EU) · 999 (UK)",
      },
      fr: {
        headline:
          "Urgence cardiaque ou respiratoire possible — consultez d'urgence",
        body: "Une douleur thoracique, une difficulté respiratoire ou un crachat de sang peuvent révéler une urgence vitale. La recherche par symptômes et l'IA sont désactivées pour ces signes d'alerte.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline: "Urgences : 911 (Canada) · 15 / 112 (France/Europe)",
      },
    },
  },
  {
    category: "neurologic_stroke",
    patterns: [
      /\b(?:stroke symptoms?|face drooping|facial droop|slurred speech|sudden (?:numbness|weakness|confusion|vision loss)|one side (?:numb|weak)|worst headache of my life|thunderclap headache|seizure|convulsions?|passed out|loss of consciousness)\b/i,
      /\b(?:avc|paralysie faciale|trouble soudain de la parole|engourdissement soudain|faiblesse d'un côté|perte de vision soudaine|pire mal de tête|convulsions?|perte de connaissance|évanouissement)\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible neurologic or stroke emergency — call emergency services now",
        body: "Sudden weakness, facial droop, speech trouble, vision loss, seizures, fainting, or a sudden severe headache require immediate medical evaluation.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline: "Emergency: 911 (US/Canada) · 112 / 15 (EU) · 999 (UK)",
      },
      fr: {
        headline:
          "Urgence neurologique ou AVC possible — appelez les secours sans délai",
        body: "Une faiblesse soudaine, une asymétrie faciale, un trouble de la parole, des convulsions, un évanouissement ou une céphalée brutale imposent une évaluation médicale immédiate.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline: "Urgences : 911 (Canada) · 15 / 112 (France/Europe)",
      },
    },
  },
  {
    category: "gi_hemorrhage",
    patterns: [
      /\b(?:vomiting blood|hematemesis|black tarry stools?|melena|heavy (?:rectal|gastrointestinal) bleeding|blood in (?:vomit|stool)|severe abdominal pain|rigid abdomen)\b/i,
      /\b(?:vomissement de sang|hématémèse|selles noires|méléna|saignement (?:rectal|digestif) abondant|sang dans les vomissements|douleur abdominale (?:aiguë|intense|sévère))\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible internal bleeding or acute abdominal emergency — seek urgent care",
        body: "Vomiting blood, black tarry stools, heavy bleeding, or severe acute abdominal pain require immediate in-person medical assessment, not herbal lookup.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline:
          "Emergency: 911 (US/Canada) · Poison Control: 1-800-222-1222 (US) / 1-844-764-7669 (Canada)",
      },
      fr: {
        headline:
          "Hémorragie digestive ou urgence abdominale possible — consultez d'urgence",
        body: "Des vomissements de sang, des selles noires, un saignement abondant ou une douleur abdominale intense nécessitent une évaluation médicale immédiate.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline: "Urgences : 911 (Canada) · 15 / 112 (France/Europe)",
      },
    },
  },
  {
    category: "severe_hepatic_renal",
    patterns: [
      /\b(?:jaundice|yellowing (?:of )?(?:the )?(?:skin|eyes)|yellow eyes|yellow skin|unable to urinate|cannot urinate|anuria|acute liver failure)\b/i,
      /\b(?:jaunisse|ictère|peau jaune|yeux jaunes|incapacité d'uriner|ne peux plus uriner|insuffisance hépatique aiguë)\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible acute liver or kidney warning sign — urgent medical evaluation needed",
        body: "Jaundice (yellow skin or eyes) or sudden inability to urinate can signal serious liver or kidney injury, including herb-induced hepatotoxicity. Seek prompt medical evaluation.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline:
          "Emergency: 911 · Poison Control: 1-800-222-1222 (US) / 1-844-764-7669 (Canada)",
      },
      fr: {
        headline:
          "Signe d'alerte hépatique ou rénal — évaluation médicale urgente requise",
        body: "Une jaunisse (peau ou yeux jaunes) ou une impossibilité d'uriner peut signaler une atteinte hépatique ou rénale grave, parfois liée aux plantes. Consultez sans délai.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline:
          "Urgences : 911 (Canada) · 15 / 112 (France) · Centre antipoison",
      },
    },
  },
  {
    category: "pregnancy_emergency",
    patterns: [
      /\b(?:pregnant[^.!?\n]{0,40}(?:bleeding|severe pain|cramping)|vaginal bleeding (?:during|in) pregnancy|ectopic|preeclampsia|decreased fetal movement)\b/i,
      /\b(?:enceinte[^.!?\n]{0,40}(?:saignement|douleur sévère)|saignement pendant la grossesse|pré-?éclampsie|diminution des mouvements f[œo]taux)\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Urgent pregnancy warning sign — contact obstetric care or emergency services",
        body: "Bleeding, severe pain, preeclampsia signs, or decreased fetal movement during pregnancy require immediate obstetric evaluation, never herbal self-treatment.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline:
          "Emergency: 911 (US/Canada) · 112 / 15 (EU) · Contact your OB/midwife triage line immediately.",
      },
      fr: {
        headline:
          "Signe d'alerte pendant la grossesse — consultez les urgences obstétricales",
        body: "Un saignement, une douleur intense, des signes de prééclampsie ou une baisse des mouvements fœtaux exigent un avis médical immédiat, sans automédication par les plantes.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline: "Urgences : 911 (Canada) · 15 / 112 (France/Europe)",
      },
    },
  },
  {
    category: "sepsis_high_fever",
    patterns: [
      /\b(?:sepsis|septic shock|high fever (?:with|and) (?:stiff neck|confusion)|stiff neck (?:with|and) fever)\b/i,
      /\b(?:septicémie|choc septique|fièvre élevée (?:avec|et) (?:raideur de nuque|confusion))\b/i,
    ],
    guidance: {
      en: {
        headline:
          "Possible severe infection or meningitis warning sign — seek emergency care",
        body: "High fever with stiff neck, confusion, or suspected sepsis requires immediate hospital care.",
        actions: GENERAL_EMERGENCY_ACTIONS_EN,
        helpline: "Emergency: 911 (US/Canada) · 112 / 15 (EU)",
      },
      fr: {
        headline:
          "Signe d'infection grave possible — consultez immédiatement les urgences",
        body: "Une fièvre élevée accompagnée de raideur de nuque, de confusion ou d'une suspicion de septicémie nécessite des soins hospitaliers immédiats.",
        actions: GENERAL_EMERGENCY_ACTIONS_FR,
        helpline: "Urgences : 911 (Canada) · 15 / 112 (France/Europe)",
      },
    },
  },
];

export function detectRedFlagSymptom(input: string): RedFlagDetection {
  const normalized = input.trim();
  if (!normalized) return { isRedFlag: false };

  for (const rule of RED_FLAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        isRedFlag: true,
        category: rule.category,
        severity: "emergency",
        guidance: rule.guidance,
      };
    }
  }

  return { isRedFlag: false };
}

export function formatRedFlagChatRefusal(
  detection: RedFlagDetection,
  locale: "en" | "fr"
): string {
  const copy = detection.guidance?.[locale];
  if (!copy) {
    return locale === "fr"
      ? "Vos symptômes peuvent nécessiter des soins médicaux urgents. Appelez les services d'urgence (911 / 15 / 112) ou rendez-vous aux urgences."
      : "These symptoms may require urgent medical care. Call emergency services (911 / 112) or visit the nearest emergency department immediately.";
  }

  return [
    `⚠️ **${copy.headline}**`,
    "",
    copy.body,
    "",
    ...copy.actions.map((step) => `- ${step}`),
    "",
    `**${copy.helpline}**`,
  ].join("\n");
}
