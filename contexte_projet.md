# Contexte du projet — Alerte Fest-Noz

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

## Étape en cours — mise en place GitHub Actions (2026-09-14)
Décisions prises avec l'utilisateur :
- **Dépôt GitHub public.** Conséquence : `config.json` (adresse, coordonnées
  GPS, email) et `notified.json` ne sont **jamais commités** (`.gitignore`).
  Un `config.example.json` sert de modèle public sans données personnelles.
  Le vrai `config.json` est reconstruit à chaque run depuis le secret GitHub
  `CONFIG_JSON` (contenu JSON complet).
- **Envoi d'email via Brevo** (pas Gmail : refusé par l'utilisateur ; pas
  Protonmail en expéditeur : nécessite Bridge, incompatible avec un runner
  cloud éphémère). L'utilisateur **reçoit** bien les mails sur son adresse
  Protonmail, seul l'expéditeur technique est un compte Brevo (SMTP relay
  gratuit, smtp-relay.brevo.com:587). Secrets GitHub : `BREVO_SMTP_LOGIN`,
  `BREVO_SMTP_KEY`, `FROM_EMAIL`.
- **Fréquence : lundi/mercredi/vendredi à 2h UTC** (~"tous les 2-3 jours",
  plus prévisible qu'un cron `*/2`). Voir `.github/workflows/alerte.yml`.
- **Anti-doublon** : `festnoz_alerte.py` mémorise les `eve_id` déjà notifiés
  dans `notified.json`, purgés automatiquement une fois l'événement passé.
  Ce fichier n'est pas commité (dépôt public) ; il est persisté entre les
  runs via le cache GitHub Actions (`actions/cache`, clé `notified-<run_id>`
  + `restore-keys: notified-`).

### Fichiers ajoutés/modifiés
- `festnoz_alerte.py` : + `envoyer_email()` (SMTP Brevo, désactivé si
  variables d'env absentes → utile pour tester en local sans configurer
  l'email), + `charger_notifies()`/`sauvegarder_notifies()`, `main()`
  n'envoie que les nouvelles alertes.
- `requirements.txt`, `config.example.json`, `.gitignore`,
  `.github/workflows/alerte.yml`.

### Reste à faire (manuel, côté utilisateur — je n'ai ni Git ni GitHub CLI
installés sur cette machine, je ne peux donc pas le faire à sa place) :
1. Installer Git for Windows.
2. Créer le dépôt GitHub (public), `git init` / `add` / `commit` / `push`
   en local (`config.json` et `notified.json` resteront non commités grâce
   au `.gitignore`).
3. Créer un compte Brevo gratuit → récupérer identifiant SMTP + clé API
   SMTP.
4. Dans les secrets du dépôt GitHub (Settings → Secrets and variables →
   Actions), ajouter : `CONFIG_JSON` (contenu complet du `config.json` réel,
   avec l'adresse email Protonmail comme destinataire), `BREVO_SMTP_LOGIN`,
   `BREVO_SMTP_KEY`, `FROM_EMAIL`.
5. Vérifier un run manuel via l'onglet Actions → "Run workflow"
   (workflow_dispatch) avant de laisser tourner le cron automatique.

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
