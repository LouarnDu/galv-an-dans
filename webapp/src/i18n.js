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
    succes_inscription: "Gwir da bostel evit kavout da liamm merañ.",
    lien_invalide: "Liamm direizh pe gont dilamet.",
    lien_invalide_suppr: "Liamm direizh pe gont dilamet dija.",
  },
};

export function extraireLangue(request) {
  const langue = (request.headers.get("X-Lang") || "fr").toLowerCase();
  return MESSAGES[langue] ? langue : "fr";
}

export function messagesPour(request) {
  return MESSAGES[extraireLangue(request)];
}
