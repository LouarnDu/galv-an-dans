// Traductions de l'interface (fr/en/br). Fichier chargé par index.html et
// edit.html. Modifiable directement ici pour corriger des formulations.

window.LANGUES = [
  { code: "fr", nom: "Français" },
  { code: "en", nom: "English" },
  { code: "br", nom: "Brezhoneg" },
];

window.TEXTES = {
  fr: {
    soustitre_accueil:
      "Reçois une alerte par email quand tes groupes favoris (suivis sur Tamm-Kreiz) jouent un fest-noz, fest-deiz ou concert près de chez toi.",
    label_prenom: "Ton prénom",
    label_email: "Ton email",
    hint_email: "Pour recevoir les alertes et ton lien de gestion.",
    label_profil: "URL de ton profil Tamm-Kreiz",
    label_adresse: "Ton adresse",
    hint_adresse: "Sert uniquement à calculer le temps de trajet.",
    label_rayon: "Rayon (minutes de route)",
    label_repeter: "Me renvoyer les mêmes événements à chaque email (plutôt qu'une seule fois)",
    bouton_creer: "Créer mon alerte",
    footer_deja_inscrit: "Déjà inscrit(e) ? Utilise le lien reçu par email pour modifier tes préférences.",
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
    soustitre_accueil:
      "Get an email alert when your favourite bands (followed on Tamm-Kreiz) play a fest-noz, fest-deiz or concert near you.",
    label_prenom: "Your first name",
    label_email: "Your email",
    hint_email: "To receive alerts and your management link.",
    label_profil: "Your Tamm-Kreiz profile URL",
    label_adresse: "Your address",
    hint_adresse: "Only used to calculate travel time.",
    label_rayon: "Radius (minutes by car)",
    label_repeter: "Send me the same events in every email (instead of just once)",
    bouton_creer: "Create my alert",
    footer_deja_inscrit: "Already signed up? Use the link you received by email to change your preferences.",
    erreur_reseau: "Network error, please try again in a moment.",
    titre_edit: "My preferences",
    chargement: "Loading...",
    lien_invalide_id: "Invalid link: missing identifier in the URL.",
    pret_a_modifier: "Change what you like, then save.",
    compte_supprime: "Your account has been deleted.",
    bouton_enregistrer: "Save",
    bouton_supprimer: "Delete my account",
    confirm_suppression: "Permanently delete your account and alerts?",
    prefs_enregistrees: "Preferences saved.",
  },
  br: {
    soustitre_accueil:
      "Resev ur c'hemennadenn dre bostel pa vez ur fest-noz, fest-deiz pe ur c'hoñsert tost dit gant da strolladoù karetañ (heuliet war Tamm-Kreiz).",
    label_prenom: "Da anv-bihan",
    label_email: "Da bostel",
    hint_email: "Evit resev ar c'hemennadennoù ha da ere merañ.",
    label_profil: "URL da vrofil Tamm-Kreiz",
    label_adresse: "Da chomlec'h",
    hint_adresse: "Implijet hepken evit jediñ an amzer-hent.",
    label_rayon: "Skin (munutennoù gant ar c'harr)",
    label_repeter: "Kas din adarre an hevelep degouezhioù bep gwezh (kentoc'h eget ur wezh hepken)",
    bouton_creer: "Krouiñ ma c'hemenn",
    footer_deja_inscrit: "Enskrivet dija? Implij an ere resevet dre bostel evit cheñch da zibaboù.",
    erreur_reseau: "Fazi rouedad, klask en-dro a-benn un nebeud eiladennoù.",
    titre_edit: "Ma dibaboù",
    chargement: "O kargañ...",
    lien_invalide_id: "Ere direizh : mankout a ra an naoudi er URL.",
    pret_a_modifier: "Cheñch ar pezh a fell dit, ha gwareziñ goude.",
    compte_supprime: "Dilamet eo bet da gont.",
    bouton_enregistrer: "Gwareziñ",
    bouton_supprimer: "Dilemel ma c'hont",
    confirm_suppression: "Dilemel da gont ha da gemennoù da vat ?",
    prefs_enregistrees: "Dibaboù gwarezet.",
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
    if (dict[cle]) el.textContent = dict[cle];
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

  const drapeauBreton = `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
    <rect width="30" height="20" fill="#000"/>
    <g fill="#fff">
      <rect y="0" width="30" height="2.22"/>
      <rect y="4.44" width="30" height="2.22"/>
      <rect y="8.88" width="30" height="2.22"/>
      <rect y="13.33" width="30" height="2.22"/>
      <rect y="17.77" width="30" height="2.23"/>
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
    { code: "fr", contenu: "🇫🇷", titre: "Français" },
    { code: "en", contenu: "🇬🇧", titre: "English" },
    { code: "br", contenu: drapeauBreton, titre: "Brezhoneg" },
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
