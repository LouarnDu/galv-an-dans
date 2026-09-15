# Contexte du projet — Galv an dañs (alerte fest-noz)

Dépôt GitHub : https://github.com/LouarnDu/galv-an-dans (public)

## Objectif
Application qui alerte l'utilisateur quand un de ses groupes/artistes favoris
(suivis sur son profil Tamm-Kreiz) joue un fest-noz, fest-deiz ou concert à
moins de X minutes de route de chez lui.

## État actuel
- `festnoz_alerte.py` : script fonctionnel qui...
  1. récupère la liste des utilisateurs via l'API du site web (`webapp/`,
     voir plus bas) plutôt que d'un fichier local
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
  bien reçu. Cron actif : une fois par semaine (lundi 2h UTC).
- **Interface web self-service opérationnelle et validée de bout en bout
  (2026-09-15)** : inscription via `webapp/` (Cloudflare Workers) → email
  de bienvenue reçu → lien d'édition fonctionnel → `festnoz_alerte.py`
  récupère bien les utilisateurs via l'API (`USERS_API_URL`/`USERS_API_KEY`)
  → alerte envoyée avec succès (reçue en spam la première fois — normal pour
  un domaine tout juste vérifié, sans historique d'envoi). Détails
  ci-dessous.

## Mise en place GitHub Actions (2026-09-14) — détails et historique
Décisions prises avec l'utilisateur :
- **Dépôt GitHub public.** Conséquence : `notified.json` n'est **jamais
  commité** (`.gitignore`). Les données personnelles des utilisateurs vivent
  désormais dans la base D1 de `webapp/` (voir section dédiée plus bas), plus
  du tout dans ce dépôt.
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

  **⚠️→✅ Limite découverte le 2026-09-14, résolue le 2026-09-15 :** sans
  domaine vérifié, Resend (comme tout service d'envoi transactionnel gratuit
  — protection anti-spam standard du secteur) refuse d'envoyer vers une
  adresse différente de celle du compte Resend lui-même (erreur
  `403 Forbidden`), ce qui cassait la vision multi-utilisateurs. Deux pistes
  de domaine **gratuit** tentées et abandonnées :
  - **is-a.dev** : bloqué par leur politique (case "lien vers un site web"
    obligatoire pour l'approbation + interdiction explicite d'usage d'IA
    pour rédiger les pull requests, citant nommément "Claude Code").
  - **FreeDNS (afraid.org)** : bloqué techniquement — création
    d'enregistrements commençant par `_` (requis pour DKIM/DMARC : `resend.
    _domainkey`, `_dmarc`) restreinte aux propriétaires du domaine partagé
    depuis 2016.

  Solution retenue : **achat d'un vrai domaine**, `galvandans.xyz` chez
  Porkbun (~2$ la 1ère année, ~14$/an ensuite — assumé comme un test pour le
  CV de l'utilisateur, pas forcément durable ; `galvandans.com` à ~11$/an
  fixe envisagé si le projet perdure). DKIM/SPF/DMARC vérifiés sans
  restriction une fois propriétaire du domaine. `RESEND_FROM_EMAIL` mis à
  jour vers `alertes@galvandans.xyz`.
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
- `requirements.txt`, `.gitignore`, `.github/workflows/alerte.yml`.

### Secrets GitHub configurés
`RESEND_API_KEY`, `USERS_API_URL`, `USERS_API_KEY` (les deux derniers
pointent vers l'API de `webapp/`, voir section suivante — `CONFIG_JSON` a
été retiré, plus utilisé).

## Interface web self-service (`webapp/`) — 2026-09-15
Remplace l'édition manuelle du secret `CONFIG_JSON` par un vrai formulaire :
chaque utilisateur s'inscrit et gère ses propres préférences (profil
Tamm-Kreiz, adresse, rayon) via un lien secret personnel, sans toucher à
GitHub. Sert aussi de pièce à montrer sur le CV de l'utilisateur (stack
full-stack serverless).

- **Stack** : Cloudflare Workers (le produit "Pages" a été fusionné dans
  "Workers" par Cloudflare — architecture actuelle : un seul script Worker
  + un dossier d'assets statiques, configurés via `wrangler.jsonc`, déployé
  automatiquement à chaque push par Cloudflare Workers Builds
  `npx wrangler deploy`). Hébergé sur `app.galvandans.xyz` (sous-domaine
  choisi pour ne pas toucher aux enregistrements Resend déjà en place sur
  l'apex `galvandans.xyz`).
- **Auth** : lien secret unique par utilisateur (UUID v4 dans l'URL,
  `/edit.html?id=...`), pas de mot de passe. Limite assumée pour ce v1 :
  pas de double opt-in par email à l'inscription (usage entre amis, lien non
  indexé — `<meta name="robots" content="noindex">`).
- **Géocodage** : adresse → lat/lon automatique via Nominatim (OpenStreetMap,
  gratuit), côté serveur (`webapp/src/shared.js`).
- **API** (routée dans `webapp/src/index.js`, un seul point d'entrée Worker) :
  `POST /api/users` (inscription + géocodage + email de bienvenue avec le
  lien), `GET`/`PUT`/`DELETE /api/u/:id` (gestion des préférences),
  `GET /api/users` (liste complète, protégée par le header `X-Api-Key`
  comparé au secret Cloudflare `SYNC_API_KEY` — c'est cette route que
  `festnoz_alerte.py` interroge désormais via `USERS_API_URL`/`USERS_API_KEY`).
  Tout ce qui ne matche pas `/api/*` est servi depuis `webapp/public/` via
  le binding `env.ASSETS`.
- **Schéma D1** : `webapp/schema.sql`, table `utilisateurs` avec les mêmes
  noms de champs que l'ancien `config.json` (intégration sans friction côté
  script Python). L'identifiant de la base (`database_id`) doit être renseigné
  dans `webapp/wrangler.jsonc` après création de la base (placeholder à
  remplacer).

### ⚠️ Piège Cloudflare : "Runtime" vs "Build" variables
Cloudflare distingue deux sections qui se ressemblent dans le dashboard du
Worker : **"Build variables and secrets"** (utilisées uniquement pendant
`wrangler deploy`, invisibles au code une fois déployé) et **"Runtime
variables and secrets"** (celles que `env.MA_VARIABLE` lit réellement dans
`src/index.js`). Une variable ajoutée dans la mauvaise section ne produit
aucune erreur visible côté Cloudflare — le code la voit juste comme
`undefined`. C'est ce qui a fait échouer `SYNC_API_KEY` (401 Unauthorized)
alors que `RESEND_API_KEY` fonctionnait : seule cette dernière avait été
ajoutée côté "Runtime". **Toujours vérifier qu'un secret/variable runtime
est bien dans la section "Runtime variables and secrets".**

### État du déploiement (2026-09-15)
- Worker déployé et fonctionnel sur `https://galv-an-dans.<compte>.workers.dev`.
- Base D1 `galvandans-db` créée et peuplée (schéma appliqué, premier
  utilisateur — Ilan — inscrit via le formulaire).
- Secrets Cloudflare (section **Runtime**) : `RESEND_API_KEY`, `SYNC_API_KEY`.
- Secrets GitHub : `USERS_API_URL` (pointe actuellement vers l'URL
  `*.workers.dev`), `USERS_API_KEY`. `CONFIG_JSON` supprimé.
- **DNS migré chez Cloudflare** (nameservers Porkbun → Cloudflare) pour
  pouvoir attacher un domaine personnalisé au Worker (Cloudflare exige que
  la zone entière soit gérée par eux, pas juste un CNAME). Les 4
  enregistrements Resend (DKIM/SPF×2/DMARC) ont été recréés côté Cloudflare
  avant la baisse des nameservers Porkbun.
- **Reste à faire** une fois la zone Cloudflare passée en statut "Active"
  (peut prendre plusieurs heures après le changement de nameservers) :
  attacher `app.galvandans.xyz` comme domaine personnalisé du Worker
  (Settings → Domains & Routes), puis mettre à jour le secret GitHub
  `USERS_API_URL` vers cette nouvelle URL (aucun autre changement de code
  nécessaire).

### Déploiement (à faire côté utilisateur, dashboard Cloudflare)
1. Compte Cloudflare gratuit.
2. Workers & Pages → Create → onglet Workers → connecter le dépôt Git
   `LouarnDu/galv-an-dans` → **Root directory = `webapp`** (réglable dans
   Settings → Build après création si pas proposé à la création).
3. D1 → créer une base (`galvandans-db`) → Console → exécuter le contenu de
   `schema.sql` → noter le `database_id` généré → le renseigner dans
   `webapp/wrangler.jsonc` (remplace le placeholder), committer/pousser.
4. Worker → Settings → Variables and Secrets → `RESEND_API_KEY` (même clé
   que celle déjà utilisée), `SYNC_API_KEY` (nouveau secret aléatoire).
5. Worker → Settings → Domains & Routes → ajouter `app.galvandans.xyz` →
   CNAME donné par Cloudflare à ajouter côté Porkbun.
6. Secrets GitHub : `USERS_API_URL`
   (`https://app.galvandans.xyz/api/users`), `USERS_API_KEY` (= `SYNC_API_KEY`).
7. L'utilisateur s'inscrit lui-même via le nouveau formulaire (remplace son
   entrée manuelle), vérifie l'email + le lien reçus, puis confirme via un
   run manuel du workflow (`forcer_envoi`).

## Vision à plus long terme (pas la priorité immédiate)
- Une application Android pour les réglages par utilisateur et les
  notifications push, à la place des emails/du site web.

## Contraintes
- Ne jamais committer de mot de passe, clé API ou donnée personnelle en
  clair (dépôt public → tout passe par les secrets GitHub Actions).
- Rester raisonnable dans la fréquence des appels aux API tierces
  (Tamm-Kreiz, OSRM) — usage personnel, pas de scraping agressif.
