// Traductions des messages générés par l'API (erreurs de validation,
// confirmations...). Langue choisie côté client via l'en-tête X-Lang.

export const MESSAGES = {
  fr: {
    corps_invalide: "Corps de requête invalide.",
    nom_requis: "Le nom est requis.",
    email_invalide: "Email invalide.",
    profil_invalide: "L'URL de profil doit être une page tamm-kreiz.bzh.",
    adresse_requise: "L'adresse (ou ville) est requise.",
    rayon_invalide: (max) => `Le rayon doit être un nombre de minutes entre 1 et ${max}.`,
    json_invalide: "Corps de requête JSON invalide.",
    adresse_introuvable: "Adresse introuvable, vérifie l'orthographe et réessaie.",
    erreur_envoi_email: "Erreur lors de l'envoi de l'email, réessaie dans quelques instants.",
    succes_inscription: "Vérifie tes emails pour récupérer ton lien de gestion.",
    lien_invalide: "Lien invalide ou compte supprimé.",
    lien_invalide_suppr: "Lien invalide ou compte déjà supprimé.",
  },
  en: {
    corps_invalide: "Invalid request body.",
    nom_requis: "Name is required.",
    email_invalide: "Invalid email.",
    profil_invalide: "The profile URL must be a tamm-kreiz.bzh page.",
    adresse_requise: "The address (or town) is required.",
    rayon_invalide: (max) => `Radius must be a number of minutes between 1 and ${max}.`,
    json_invalide: "Invalid JSON request body.",
    adresse_introuvable: "Address not found, check the spelling and try again.",
    erreur_envoi_email: "Error sending the email, please try again in a moment.",
    succes_inscription: "Check your emails to get your management link.",
    lien_invalide: "Invalid link or deleted account.",
    lien_invalide_suppr: "Invalid link or account already deleted.",
  },
  br: {
    corps_invalide: "Korf ar goulenn direizh.",
    nom_requis: "Ret eo lakaat an anv.",
    email_invalide: "Chomlec'h postel direizh.",
    profil_invalide: "Ret eo d'al liamm profil bezañ ur bajenn tamm-kreiz.bzh.",
    adresse_requise: "Ret eo lakaat ar chomlec'h pe gêr",
    rayon_invalide: (max) => `Ret eo d'ar kelc'hiad bezañ un niver a vunutennoù etre 1 ha ${max}.`,
    json_invalide: "Korf goulenn JSON direizh.",
    adresse_introuvable: "N'eo ket bet kavet ar chomlec'h, \ngwir da reizhskrivadur ha klask en-dro.",
    erreur_envoi_email: "Fazi en ur gas ar postel, klask en-dro a-benn un nebeud munutennoù.",
    succes_inscription: "Sell ouzh da vouest-postel da gavout da liamm merañ",
    lien_invalide: "Liamm direizh pe gont dilamet.",
    lien_invalide_suppr: "Liamm direizh pe gont dilamet dija.",
  },
};

// Email de bienvenue envoyé à l'inscription (sujet fixe + corps généré à
// partir du prénom et du lien d'édition).
export const EMAIL_BIENVENUE = {
  fr: {
    sujet: "Bienvenue sur Galv an dañs — ton lien de gestion",
    corps: (nom, lien) =>
      `Salut ${nom},\n\n` +
      `Ton alerte fest-noz est bien créée. Tu recevras le premier email d'ici ` +
      `quelques minutes puis un email d'alerte par semaine.\n\n` +
      `Via le lien ci-dessous, tu pourras modifier tes préférences ou supprimer ` +
      `ton compte à tout moment. Il sera présent en bas de chaque email d'alerte.\n\n` +
      `${lien}\n\n` +
      `Ne le partage avec personne : quiconque possède ce lien peut modifier ` +
      `tes préférences ou supprimer ton compte`,
  },
  en: {
    sujet: "Welcome to Galv an dañs — your management link",
    corps: (nom, lien) =>
      `Hi ${nom},\n\n` +
      `Your fest-noz alert is all set up. You'll get your first email within a few ` +
      `minutes, then one alert a week.\n\n` +
      `Using the link below, you can change your settings or delete your account ` +
      `at any time. It will also be included at the bottom of every alert email.\n\n` +
      `${lien}\n\n` +
      `Don't share it with anyone: whoever has this link can change your settings ` +
      `or delete your account.`,
  },
  br: {
    sujet: "Donemat war Galv an dañs — da liamm merañ",
    corps: (nom, lien) =>
      `Salud dit ${nom}, mat an traoù ganit ? \n\n` +
      `Krouet eo bet da c'hemenn fest-noz. Ar postel kentañ 'po a-benn un nebeud ` +
      `munutennoù, ha goude-se ur postel kemenn bep sizhun.\n\n` +
      `Dre al liamm dindan, e c'hellez cheñch da zibaboù pe zilemel da gont da bep ` +
      `mare. Al liamm-mañ a vo ivez en traoñ pep postel kemenn.\n\n` +
      `${lien}\n\n` +
      `Na rein al liamm-mañ da zen : forzh piv en deus anezhañ a c'hello cheñch ` +
      `da zibaboù pe zilemel da gont.`,
  },
};

export function extraireLangue(request) {
  const langue = (request.headers.get("X-Lang") || "fr").toLowerCase();
  return MESSAGES[langue] ? langue : "fr";
}

export function messagesPour(request) {
  return MESSAGES[extraireLangue(request)];
}

// Valide/normalise une langue fournie par le client (ex: le champ "langue"
// du formulaire d'inscription) — retombe sur "fr" si absente ou inconnue.
export function normaliserLangue(langue) {
  const v = String(langue || "fr").toLowerCase();
  return MESSAGES[v] ? v : "fr";
}
