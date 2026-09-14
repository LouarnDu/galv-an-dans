# Contexte du projet — Galv an dañs (alerte fest-noz)

Dépôt GitHub : https://github.com/LouarnDu/galv-an-dans (public)

## Objectif
Application qui alerte l'utilisateur quand un de ses groupes/artistes favoris
(suivis sur son profil Tamm-Kreiz) joue un fest-noz, fest-deiz ou concert à
moins de X minutes de route de chez lui.

## État actuel
- `festnoz_alerte.py` : script fonctionnel qui...
  1. lit `config.json` (liste d'utilisateurs, structure déjà pensée pour
     en accueillir plusieurs bien qu'il n'y en ait qu'un seul pour l'instant)
  2. scrape la page de profil public Tamm-Kreiz de l'utilisateur pour
     récupérer dynamiquement sa liste de favoris (pas besoin de login,
     cette liste est publique)
  3. interroge l'API interne de Tamm-Kreiz (`ajax_blocAgendaMensuel.html`,
     découverte via les DevTools du navigateur) pour chaque favori, pour
     récupérer son agenda complet (dates, lieu, coordonnées GPS, type
     d'événement, line-up)
  4. calcule le temps de trajet en voiture depuis le domicile via l'API
     publique OSRM
  5. affiche les événements en dessous du seuil de minutes défini

- Testé et fonctionnel en local sur Windows (Python 3.14).
- **GitHub Actions opérationnel et validé de bout en bout (2026-09-14)** :
  scraping des favoris, agenda Tamm-Kreiz, calcul de trajet OSRM, envoi
  d'email via Resend et anti-doublon — testé en conditions réelles, email
  bien reçu. Cron actif : lundi/mercredi/vendredi à 2h UTC. Détails de la
  mise en place et des choix techniques ci-dessous.

## Mise en place GitHub Actions (2026-09-14) — détails et historique
Décisions prises avec l'utilisateur :
- **Dépôt GitHub public.** Conséquence : `config.json` (adresse, coordonnées
  GPS, email) et `notified.json` ne sont **jamais commités** (`.gitignore`).
  Un `config.example.json` sert de modèle public sans données personnelles.
  Le vrai `config.json` est reconstruit à chaque run depuis le secret GitHub
  `CONFIG_JSON` (contenu JSON complet).
- **Envoi d'email via l'API HTTP de Resend** (https://resend.com).
  Historique des tentatives :
  - Protonmail en expéditeur → impossible (nécessite Bridge, incompatible
    avec un runner cloud éphémère).
  - Brevo (relais SMTP tiers) avec un expéditeur `@protonmail.com` →
    bloqué : la politique **DMARC stricte (`p=reject`) de protonmail.com**
    interdit à tout tiers d'envoyer en son nom sans authentifier le domaine
    (impossible, Proton en est propriétaire, pas l'utilisateur).
  - Gmail (compte dédié) en SMTP direct → abandonné : Google a refusé la
    validation par téléphone (numéro déjà lié à 2 comptes Google existants).
  - GMX (compte dédié) → abandonné : la création de compte échouait déjà
    (vérification anti-fraude à l'inscription), avant même d'atteindre
    l'étape SMTP.
  - Solution retenue : **Resend**, un service fait pour l'envoi programmatique
    depuis un script/serveur. Pas de nouvelle boîte mail à créer :
    inscription sur resend.com avec l'adresse Protonmail existante de
    l'utilisateur (juste comme identifiant de compte), puis récupération
    d'une clé API. Envoi via une requête HTTP POST vers
    `https://api.resend.com/emails`, expéditeur `onboarding@resend.dev`
    (fourni par Resend, sans vérification de domaine nécessaire). Free tier
    largement suffisant pour l'usage (100 emails/jour). Secret GitHub :
    `RESEND_API_KEY`.

  **⚠️ Limite découverte à l'usage (2026-09-14) :** sans domaine vérifié,
  Resend (comme tout service d'envoi transactionnel gratuit — protection
  anti-spam standard du secteur) refuse d'envoyer vers une adresse
  différente de celle du compte Resend lui-même (erreur `403 Forbidden`).
  Donc tant qu'aucun domaine n'est vérifié : `config.json`/`CONFIG_JSON`
  doit avoir pour chaque utilisateur `email` = l'adresse Protonmail utilisée
  à l'inscription sur resend.com. **Ça casse la vision multi-utilisateurs**
  (chacun avec sa propre adresse) tant qu'un domaine n'est pas vérifié.
  Solution retenue pour l'instant : rester sur un seul utilisateur (email =
  compte Resend), et vérifier un vrai domaine le jour où un 2e utilisateur
  est ajouté pour de vrai. Pistes de **domaine gratuit** évoquées pour ce
  jour-là (l'utilisateur ne veut pas payer) : **is-a.dev** (sous-domaine
  gratuit via PR GitHub, backend Cloudflare, supporte les enregistrements
  TXT nécessaires pour SPF/DKIM) ou **FreeDNS (afraid.org)** (inscription
  immédiate, contrôle DNS complet). Freenom (.tk/.ml/.ga) explicitement
  écarté : service arrêté aux nouvelles inscriptions depuis 2023.
- **Fréquence : une fois par semaine, le lundi à 2h UTC** (réduit encore la
  sollicitation des API Tamm-Kreiz/OSRM ; changé depuis lundi/mercredi/
  vendredi le 2026-09-14 suite à un retour de l'utilisateur). Voir
  `.github/workflows/alerte.yml`. Déclenchement manuel via l'onglet Actions
  toujours possible à tout moment pour tester (case `forcer_envoi`
  disponible).
- **Anti-doublon** : `festnoz_alerte.py` mémorise les `eve_id` déjà notifiés
  dans `notified.json`, purgés automatiquement une fois l'événement passé.
  Ce fichier n'est pas commité (dépôt public) ; il est persisté entre les
  runs via le cache GitHub Actions (`actions/cache`, clé `notified-<run_id>`
  + `restore-keys: notified-`).
- **Option de test `forcer_envoi`** : case à cocher sur le déclenchement
  manuel du workflow (`workflow_dispatch`) qui ignore l'anti-doublon et
  renvoie toutes les alertes actuelles — pratique pour vérifier que l'email
  arrive bien sans devoir attendre un vrai nouvel événement. Passée au
  script via la variable d'env `FORCER_ENVOI`.

### Fichiers ajoutés/modifiés
- `festnoz_alerte.py` : + `envoyer_email()` (API Resend, désactivé si
  `RESEND_API_KEY` absent → utile pour tester en local sans configurer
  l'email), + `charger_notifies()`/`sauvegarder_notifies()`, `main()`
  n'envoie que les nouvelles alertes (sauf `FORCER_ENVOI`).
- `requirements.txt`, `config.example.json`, `.gitignore`,
  `.github/workflows/alerte.yml`.

### Secrets GitHub configurés
`CONFIG_JSON` (contenu complet du `config.json` réel), `RESEND_API_KEY`.

## Vision à plus long terme (pas la priorité immédiate)
- Une interface où plusieurs utilisateurs pourraient créer un compte,
  indiquer leur profil Tamm-Kreiz, leur adresse et leur rayon — d'où le
  choix de structurer `config.json` comme une liste dès le début.
- Une application Android pour les réglages par utilisateur et les
  notifications push, à la place des emails.

## Contraintes
- Ne jamais committer de mot de passe, clé API ou donnée personnelle en
  clair (dépôt public → tout passe par les secrets GitHub Actions).
- Rester raisonnable dans la fréquence des appels aux API tierces
  (Tamm-Kreiz, OSRM) — usage personnel, pas de scraping agressif.
