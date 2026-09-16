// Traductions de l'interface (fr/en/br). Fichier chargé par index.html et
// edit.html. Modifiable directement ici pour corriger des formulations.

window.LANGUES = [
  { code: "fr", nom: "Français" },
  { code: "en", nom: "English" },
  { code: "br", nom: "Brezhoneg" },
];

window.TEXTES = {
  fr: {
    titre_principal: "Galv an dañs — appel à la danse",
    soustitre_accueil:
      "Reçois une alerte par email quand tes groupes favoris (suivis sur Tamm-Kreiz) jouent dans un fest-noz, fest-deiz ou concert près de chez toi.",
    label_prenom: "Ton prénom",
    label_email: "Ton email",
    hint_email: "Pour recevoir les alertes",
    label_profil: "Lien de ton profil Tamm-Kreiz",
    label_adresse: "Ton adresse ou ville",
    hint_adresse: "Sert uniquement à calculer le temps de trajet.",
    label_rayon: "Rayon (minutes de route)",
    label_repeter: "Me renvoyer les mêmes événements à chaque email (plutôt qu'une seule fois)",
    bouton_creer: "Créer mon alerte",
    footer_deja_inscrit: "Déjà inscrit(e) ? Utilise le lien reçu par email pour voir et modifier tes préférences.",
    erreur_reseau: "Erreur réseau, réessaie dans un instant.",
    titre_edit: "Mes préférences",
    chargement: "Chargement...",
    lien_invalide_id: "Lien invalide : identifiant manquant dans l'URL.",
    pret_a_modifier: "Modifie ce que tu veux, puis enregistre.",
    compte_supprime: "Ton compte a été supprimé.",
    bouton_enregistrer: "Enregistrer",
    bouton_supprimer: "Supprimer mon compte",
    confirm_suppression: "Supprimer définitivement ton compte et tes alertes ?",
    prefs_enregistrees: "Préférences enregistrées.",
  },
  en: {
    titre_principal: "Galv an dañs — call to the dance",
    soustitre_accueil:
      "Get an email alert when your favourite bands (those you follow on Tamm-Kreiz) play in a fest-noz, fest-deiz or concert near you.",
    label_prenom: "Your first name",
    label_email: "Your email",
    hint_email: "To receive your alerts",
    label_profil: "Link to your Tamm-Kreiz profile",
    label_adresse: "Your address or town",
    hint_adresse: "Only used to calculate travel time.",
    label_rayon: "Radius (minutes by car)",
    label_repeter: "Send me the same events in every email (instead of just once)",
    bouton_creer: "Create my alert",
    footer_deja_inscrit: "Already signed up? Use the link you received by email to view and change your settings.",
    erreur_reseau: "Network error, please try again in a moment.",
    titre_edit: "My settings",
    chargement: "Loading...",
    lien_invalide_id: "Invalid link: missing identifier in the URL.",
    pret_a_modifier: "Change what you like, then save.",
    compte_supprime: "Your account has been deleted.",
    bouton_enregistrer: "Save",
    bouton_supprimer: "Delete my account",
    confirm_suppression: "Permanently delete your account and alerts?",
    prefs_enregistrees: "Settings saved.",
  },
  br: {
    titre_principal: "Galv an dañs",
    soustitre_accueil:
      "Resev ur c'hemennadenn dre bostel pa vez ur fest-noz, fest-deiz pe ur c'hoñsert tost dit gant da strolladoù muiañ karet (ar re az peus laket war da bennroll Tamm-Kreiz).",
    label_prenom: "Da anv bihan",
    label_email: "Da chomlec'h bostel",
    hint_email: "Evit resev ar c'hemennadennoù",
    label_profil: "Liamm da vrofil Tamm-Kreiz",
    label_adresse: "Da chomlec'h pe gêr",
    hint_adresse: "Evit goût pe hir e vo an hent",
    label_rayon: "Kelc'hiad (munutennoù gant ar c'harr)",
    label_repeter: "Kas din bewech ar roll abadennoù a-bezh (e lec'h kas din a re nevez hepken)",
    bouton_creer: "Krouiñ ma c'hemenn",
    footer_deja_inscrit: "Lakaet 'poa da anv dija ? Klik war al liamm er fin ar postel az peus bet evit gwellet en-dro ha cheñch da zibaboù.",
    erreur_reseau: "Fazi rouedad, klask en-dro a-benn un nebeud eiladennoù 'ta",
    titre_edit: "Ma dibaboù",
    chargement: "O kargañ...",
    lien_invalide_id: "Liamm direizh : mankout a ra an naoudi er URL.",
    pret_a_modifier: "Cheñch ar pezh a fell dit, ha enrollañ ar cheñchamenchoù.",
    compte_supprime: "Dilemet eo bet da gont.",
    bouton_enregistrer: "Enrollañ",
    bouton_supprimer: "Dilemel ma c'hont",
    confirm_suppression: "Dilemel da gont ha da gemennoù da vat ?",
    prefs_enregistrees: "Da zibaboù zo bet enrollet.",
  },
};

// Applique la langue choisie à tous les éléments marqués data-i18n /
// data-i18n-placeholder, met à jour le sélecteur de drapeaux, et retient
// le choix pour les prochaines visites.
window.appliquerLangue = function appliquerLangue(langue) {
  const dict = window.TEXTES[langue] || window.TEXTES.fr;
  document.documentElement.lang = langue;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const cle = el.getAttribute("data-i18n");
    const valeur = dict[cle];
    if (valeur) {
      el.textContent = valeur;
      el.hidden = false;
    } else if (valeur === "") {
      // Clé volontairement vide pour cette langue (ex : explication du nom
      // de l'appli, inutile en breton) : on masque l'élément.
      el.hidden = true;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-placeholder");
    if (dict[cle]) el.placeholder = dict[cle];
  });
  document.querySelectorAll(".drapeau").forEach((btn) => {
    btn.classList.toggle("actif", btn.dataset.lang === langue);
  });

  window.langueActuelle = langue;
  try {
    localStorage.setItem("langue", langue);
  } catch {
    // Stockage indisponible (navigation privée, etc.) : pas grave, on
    // continue sans mémoriser le choix.
  }
};

// Construit la petite barre de drapeaux et l'insère dans le conteneur donné.
window.initSelecteurLangue = function initSelecteurLangue(conteneur) {
  const barre = document.createElement("div");
  barre.className = "langues";
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "Langue / Language / Yezh");

  // SVG dessinés à la main plutôt que des emoji drapeau : sur Windows,
  // beaucoup de polices affichent 🇫🇷/🇬🇧 comme du texte "FR"/"GB" au lieu
  // d'une vraie image — pas de souci de rendu avec du SVG.
  const drapeauFrance = `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
    <rect width="10" height="20" fill="#0055A4"/>
    <rect x="10" width="10" height="20" fill="#fff"/>
    <rect x="20" width="10" height="20" fill="#EF4135"/>
  </svg>`;

  const drapeauRoyaumeUni = `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
    <rect width="30" height="20" fill="#00247d"/>
    <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="4"/>
    <path d="M0,0 L30,20 M30,0 L0,20" stroke="#cf142b" stroke-width="1.5"/>
    <path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6"/>
    <path d="M15,0 V20 M0,10 H30" stroke="#cf142b" stroke-width="3.5"/>
  </svg>`;

  // Gwenn ha du : 9 bandes (5 noires, 4 blanches, en commençant et finissant
  // par du noir), canton blanc en haut à gauche avec des mouchetures d'hermine.
  const drapeauBreton = `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
    <rect width="30" height="20" fill="#000"/>
    <g fill="#fff">
      <rect y="2.22" width="30" height="2.23"/>
      <rect y="6.67" width="30" height="2.23"/>
      <rect y="11.11" width="30" height="2.23"/>
      <rect y="15.56" width="30" height="2.22"/>
    </g>
    <rect width="13" height="11.11" fill="#fff"/>
    <g fill="#000">
      <circle cx="3" cy="2.2" r="0.9"/><circle cx="6.5" cy="2.2" r="0.9"/><circle cx="10" cy="2.2" r="0.9"/>
      <circle cx="4.7" cy="4.8" r="0.9"/><circle cx="8.3" cy="4.8" r="0.9"/>
      <circle cx="3" cy="7.4" r="0.9"/><circle cx="6.5" cy="7.4" r="0.9"/><circle cx="10" cy="7.4" r="0.9"/>
      <circle cx="4.7" cy="10" r="0.9"/><circle cx="8.3" cy="10" r="0.9"/>
    </g>
  </svg>`;

  const drapeaux = [
    { code: "fr", contenu: drapeauFrance, titre: "Français" },
    { code: "br", contenu: drapeauBreton, titre: "Brezhoneg" },
    { code: "en", contenu: drapeauRoyaumeUni, titre: "English" },
  ];

  for (const d of drapeaux) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drapeau";
    btn.dataset.lang = d.code;
    btn.title = d.titre;
    btn.setAttribute("aria-label", d.titre);
    btn.innerHTML = d.contenu;
    btn.addEventListener("click", () => appliquerLangue(d.code));
    barre.appendChild(btn);
  }

  conteneur.appendChild(barre);

  let langueDepart = "fr";
  try {
    langueDepart = localStorage.getItem("langue") || "fr";
  } catch {
    langueDepart = "fr";
  }
  appliquerLangue(langueDepart);
};
