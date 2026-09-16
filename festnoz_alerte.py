"""
Galv an dañs — alerte fest-noz
================================
Utilise l'API interne de Tamm-Kreiz (endpoint ajax_blocAgendaMensuel.html,
découverte via les DevTools du navigateur) pour récupérer directement
l'agenda de chaque groupe favori : dates, lieux (avec coordonnées GPS),
type d'événement et line-up complet — sans avoir à scraper chaque page
d'événement une par une.

Dépendances : pip install requests
"""

from __future__ import annotations
import html
import json
import os
import re
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
# La liste des utilisateurs vient de l'API du site web (webapp/, hébergé sur
# Cloudflare Pages + D1) plutôt que d'un fichier local : chaque utilisateur
# gère ses propres préférences (profil Tamm-Kreiz, adresse, rayon) via un
# formulaire, sans avoir à toucher à ce dépôt.

NOTIFIED_PATH = Path(__file__).parent / "notified.json"
CACHE_EVENEMENTS_PATH = Path(__file__).parent / "cache_evenements.json"

USERS_API_URL = os.environ.get("USERS_API_URL")
USERS_API_KEY = os.environ.get("USERS_API_KEY")

EVENT_TYPES_KEPT = ("fest noz", "fest deiz", "fest-deiz", "concert")

AGENDA_API_URL = "https://tamm-kreiz.bzh/ajax_blocAgendaMensuel.html"
HEADERS = {
    "User-Agent": "FestNozAlerte/0.2 (usage personnel non-commercial)",
    "X-Requested-With": "XMLHttpRequest",
}

# ---------------------------------------------------------------------------
# ENVOI D'EMAIL (API HTTP de Resend — https://resend.com)
# ---------------------------------------------------------------------------
# Identifiants lus depuis des variables d'environnement (secrets GitHub Actions
# en production, jamais codés en dur). Si absents, l'email est simplement
# désactivé et le script se contente d'afficher les résultats dans la console
# — pratique pour tester en local sans configurer d'email.
# "onboarding@resend.dev" est l'adresse d'expédition fournie par Resend,
# utilisable sans avoir à posséder/vérifier de domaine.
RESEND_API_URL = "https://api.resend.com/emails"
RESEND_FROM_EMAIL = "alertes@galvandans.xyz"
WEBAPP_BASE_URL = "https://app.galvandans.xyz"


def appeler_agenda_groupe(entity_id: str, entity_type: str, annee: int) -> dict | None:
    champ_id = "fmu_id" if entity_type == "groupe" else "aen_id"
    payload = {
        "opt[optionsRecherche][jour]": "1",
        "opt[optionsRecherche][mois]": "1",
        "opt[optionsRecherche][annee]": str(annee),
        "opt[optionsRecherche][dprs][]": "1",
        "opt[optionsRecherche][carte]": "true",
        f"opt[optionsRecherche][{champ_id}]": entity_id,
    }
    resp = requests.post(AGENDA_API_URL, data=payload, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    try:
        return resp.json()
    except ValueError:
        print(f"     ⚠️ Réponse non-JSON pour {champ_id}={entity_id}, annee={annee} :")
        print(f"     {resp.text[:300]!r}")
        return None


def evenements_futurs_du_groupe(nom: str, entity_id: str, entity_type: str) -> list[dict]:
    aujourdhui = date.today()
    evenements = []
    annee = aujourdhui.year
    vues = set()

    # On suit la pagination par année tant que l'API en propose une suivante
    while True:
        data = appeler_agenda_groupe(entity_id, entity_type, annee)
        if data is None:
            break
        for bloc_mois in data.get("resultats", []):
            for eve in bloc_mois.get("eves", []):
                if eve["eve_id"] in vues:
                    continue
                vues.add(eve["eve_id"])

                eve_date = date.fromisoformat(eve["eve_date"])
                if eve_date < aujourdhui:
                    continue  # événement déjà passé

                type_libelle = eve.get("tev_libelle", "")
                if not any(k in type_libelle.lower() for k in EVENT_TYPES_KEPT):
                    continue

                evenements.append({
                    "id": eve["eve_id"],
                    "date": eve_date,
                    "type": type_libelle,
                    "ville": eve["vil_nom"],
                    "lat": float(eve["vil_geo_x"]),
                    "lon": float(eve["vil_geo_y"]),
                    "plateau": eve.get("plateau", ""),
                    "url": "https://tamm-kreiz.bzh" + eve["url"],
                    "groupe_favori": nom,
                })

        annee_suivante = data.get("anneeSuivante")
        if not annee_suivante:
            break
        annee = int(annee_suivante)
        time.sleep(0.5)

    return evenements


def recuperer_details_evenement(url_evenement: str) -> dict:
    """Scrape la page d'un événement pour récupérer son heure et l'adresse
    complète du lieu (absentes de l'API agenda mensuel). N'est appelé que
    pour les événements retenus dans une alerte (peu nombreux), pas pour
    tous les événements trouvés. Retourne {"heure": str|None, "adresse": str|None}."""
    details = {"heure": None, "adresse": None}
    try:
        resp = requests.get(url_evenement, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        return details

    soup = BeautifulSoup(resp.text, "html.parser")

    titre_heure = soup.find("h4", string=re.compile(r"Date et heure", re.IGNORECASE))
    if titre_heure:
        detail = titre_heure.find_next("p", class_="detail_item")
        if detail:
            texte = detail.get_text(" ", strip=True)
            m = re.search(r"(\d{1,2}h\d{2})", texte)
            details["heure"] = m.group(1) if m else None

    titre_lieu = soup.find("h3", string=re.compile(r"^\s*Lieu\s*$", re.IGNORECASE))
    if titre_lieu:
        detail = titre_lieu.find_next("p", class_="detail_item")
        if detail:
            lignes = [l.strip() for l in detail.get_text("\n").split("\n") if l.strip()]
            lignes_adresse = []
            for ligne in lignes:
                # Lignes d'infos annexes du type "Parking : oui" / "Parquet : non"
                # à exclure de l'adresse.
                if re.match(r"^\w+\s*:\s*(oui|non)$", ligne, re.IGNORECASE):
                    break
                lignes_adresse.append(ligne)
            if lignes_adresse:
                details["adresse"] = ", ".join(lignes_adresse)

    return details


def parser_heure(heure: str) -> tuple[int, int] | None:
    m = re.match(r"(\d{1,2})h(\d{2})", heure)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def lien_calendrier(evt: dict) -> str:
    """Lien vers /agenda sur le site web : sert directement le .ics sur
    mobile (le système propose le choix d'appli), ou une page de choix
    Google/Outlook/Apple sur desktop — adapté à l'appareil qui clique."""
    titre = f"{evt['type']} à {evt['ville']} avec " + " - ".join(evt["favoris_presents"])
    lieu = evt.get("adresse") or evt["ville"]
    description = f"{evt['plateau']}\n\nVoir l'événement sur Tamm Kreiz : {evt['url']}"
    # Version HTML utilisée par Google Agenda/Outlook (qui rendent les liens
    # dans la description) — le .ics garde la version texte brut ci-dessus,
    # car le format iCalendar n'affiche pas le HTML.
    description_html = (
        f"{html.escape(evt['plateau'])}<br><br>"
        f'<a href="{html.escape(evt["url"])}">Voir sur Tamm Kreiz</a>'
    )

    params = {
        "id": str(evt["id"]),
        "titre": titre,
        "description": description,
        "description_html": description_html,
        "lieu": lieu,
    }

    heure = parser_heure(evt["heure"]) if evt.get("heure") else None
    if heure:
        debut = datetime(evt["date"].year, evt["date"].month, evt["date"].day, *heure)
        fin = debut + timedelta(hours=3)
        params["debut"] = debut.strftime("%Y-%m-%dT%H:%M:%S")
        params["fin"] = fin.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        params["jour"] = evt["date"].isoformat()

    return f"{WEBAPP_BASE_URL}/agenda?" + urlencode(params)


def temps_trajet_minutes(depart: tuple[float, float], arrivee: tuple[float, float]) -> float | None:
    """Temps de trajet voiture via OSRM (serveur public de démo, gratuit)."""
    lat1, lon1 = depart
    lat2, lon2 = arrivee
    url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
    resp = requests.get(url, params={"overview": "false"}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != "Ok":
        return None
    return data["routes"][0]["duration"] / 60


def charger_config() -> list[dict]:
    resp = requests.get(USERS_API_URL, headers={"X-Api-Key": USERS_API_KEY}, timeout=15)
    resp.raise_for_status()
    return resp.json()["utilisateurs"]


def charger_notifies() -> dict[str, list[str]]:
    if not NOTIFIED_PATH.exists():
        return {}
    with open(NOTIFIED_PATH, encoding="utf-8") as f:
        return json.load(f)


def sauvegarder_notifies(notifies: dict[str, list[str]]) -> None:
    with open(NOTIFIED_PATH, "w", encoding="utf-8") as f:
        json.dump(notifies, f, ensure_ascii=False, indent=2)


def charger_cache_evenements() -> dict[str, dict]:
    """Cache local (par nom d'utilisateur) des derniers événements calculés
    — permet de retester l'envoi d'email (UTILISER_CACHE) sans re-solliciter
    Tamm-Kreiz/OSRM à chaque essai."""
    if not CACHE_EVENEMENTS_PATH.exists():
        return {}
    with open(CACHE_EVENEMENTS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    for entree in data.values():
        for evt in entree["alertes"]:
            evt["date"] = date.fromisoformat(evt["date"])
    return data


def sauvegarder_cache_evenements(cache: dict[str, dict]) -> None:
    serialisable = {
        nom: {
            "alertes": [{**evt, "date": evt["date"].isoformat()} for evt in entree["alertes"]],
            "ids_futurs": list(entree["ids_futurs"]),
        }
        for nom, entree in cache.items()
    }
    with open(CACHE_EVENEMENTS_PATH, "w", encoding="utf-8") as f:
        json.dump(serialisable, f, ensure_ascii=False, indent=2)


JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
MOIS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


def formater_date_fr(d: date) -> str:
    """Ex : Vendredi 5 Septembre (pas d'année, jamais nécessaire ici puisque
    les alertes ne portent que sur des événements à venir)."""
    return f"{JOURS_FR[d.weekday()]} {d.day} {MOIS_FR[d.month - 1]}"


def formater_email(utilisateur: dict, alertes: list[dict]) -> tuple[str, str, str]:
    """Construit (sujet, corps_html, corps_texte) du mail récapitulatif,
    groupé par date. La version HTML porte les liens cliquables ("voir sur
    Tamm Kreiz", "ajouter à mon calendrier") ; la version texte sert de
    secours pour les clients mail qui n'affichent pas le HTML."""
    n = len(alertes)
    sujet = (
        f"📣 {n} nouvelle date de tes groupes favoris"
        if n == 1
        else f"📣 {n} nouvelles dates de tes groupes favoris"
    )

    blocs_html = []
    blocs_texte = []
    date_courante = None
    for evt in sorted(alertes, key=lambda e: e["date"]):
        if evt["date"] != date_courante:
            date_courante = evt["date"]
            titre_date = formater_date_fr(date_courante)
            blocs_html.append(f"<h2>{html.escape(titre_date)}</h2>")
            blocs_texte.append(f"\n{titre_date}\n{'-' * len(titre_date)}")

        heure_txt = f" à {evt['heure']}" if evt.get("heure") else ""
        titre_evt = f"{evt['type']} à {evt['ville']}{heure_txt}"
        favoris_txt = ", ".join(evt["favoris_presents"])

        lien_ics = lien_calendrier(evt)

        blocs_html.append(
            "<p>"
            f"<strong>{html.escape(titre_evt)}</strong><br>"
            f"Groupe(s) favori(s) : {html.escape(favoris_txt)}<br>"
            f"Plateau complet : {html.escape(evt['plateau'])}<br>"
            f"🚗 {evt['duree']} min de chez toi<br>"
            f'<a href="{html.escape(evt["url"])}">Voir sur Tamm Kreiz</a><br>'
            f'<a href="{html.escape(lien_ics)}">Ajouter à mon agenda</a>'
            "</p>"
        )
        blocs_texte.append(
            f"{titre_evt}\n"
            f"  Groupe(s) favori(s) : {favoris_txt}\n"
            f"  Plateau complet : {evt['plateau']}\n"
            f"  🚗 {evt['duree']} min de chez toi\n"
            f"  Voir sur Tamm Kreiz : {evt['url']}\n"
            f"  Ajouter à mon agenda : {lien_ics}\n"
        )

    pied_html = ""
    pied_texte = ""
    lien_id = utilisateur.get("id")
    if lien_id:
        lien_prefs = f"{WEBAPP_BASE_URL}/edit.html?id={lien_id}"
        pied_html = f'<p><a href="{html.escape(lien_prefs)}">Gérer tes préférences</a> (adresse, rayon, profil)</p>'
        pied_texte = f"\nGérer tes préférences (adresse, rayon, profil) : {lien_prefs}\n"

    corps_html = "<html><body>" + "".join(blocs_html) + pied_html + "</body></html>"
    corps_texte = "\n".join(blocs_texte) + pied_texte

    return sujet, corps_html, corps_texte


def envoyer_email(destinataire: str, sujet: str, corps_html: str, corps_texte: str) -> bool:
    """Envoie un email via l'API HTTP de Resend (HTML + texte de secours).
    Retourne False si la clé API n'est pas configurée (mode local sans
    email) ou en cas d'erreur d'envoi."""
    cle_api = os.environ.get("RESEND_API_KEY")

    if not cle_api or not destinataire:
        print("  ⚠️ Clé API absente (RESEND_API_KEY) ou destinataire manquant : "
              "email non envoyé (affichage console uniquement).")
        return False

    try:
        resp = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {cle_api}"},
            json={
                "from": RESEND_FROM_EMAIL,
                "to": [destinataire],
                "subject": sujet,
                "html": corps_html,
                "text": corps_texte,
            },
            timeout=20,
        )
        resp.raise_for_status()
        print(f"  ✅ Email envoyé à {destinataire}.")
        return True
    except requests.RequestException as exc:
        print(f"  ❌ Échec de l'envoi de l'email : {exc}")
        return False


def recuperer_favoris_depuis_profil(profil_url: str) -> dict:
    """Scrape la liste publique des favoris sur une page de profil Tamm-Kreiz.

    Pas besoin d'être connecté : cette liste est visible publiquement sur
    la page de profil de chaque utilisateur inscrit.
    """
    resp = requests.get(profil_url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    titre = soup.find(string=re.compile(r"favoris de", re.IGNORECASE))
    if not titre:
        print(f"  ⚠️ Section favoris introuvable sur {profil_url}")
        return {}

    favoris = {}
    for a in titre.find_all_next("a", href=True):
        m = re.match(r"^/(groupe|personne)/(\d+)/", a["href"])
        if not m:
            if favoris:  # on a quitté la liste des favoris
                break
            continue
        entity_type, entity_id = m.group(1), m.group(2)
        nom = a.get_text(strip=True)
        if nom:
            favoris[nom] = {"id": entity_id, "type": entity_type}

    return favoris


def calculer_alertes_pour_utilisateur(utilisateur: dict) -> tuple[list[dict], set[str]]:
    home_coords = (utilisateur["home_lat"], utilisateur["home_lon"])
    max_minutes = utilisateur["rayon_minutes"]

    favoris_utilisateur = recuperer_favoris_depuis_profil(utilisateur["profil_url"])
    print(f"  {len(favoris_utilisateur)} favori(s) trouvé(s) sur le profil.")

    tous_evenements = {}  # eve_id -> dict avec liste des favoris présents

    for nom, favori in favoris_utilisateur.items():
        entity_id, entity_type = favori["id"], favori["type"]
        print(f"  Récupération de l'agenda de {nom} ({entity_type} id {entity_id}) ...")
        for evt in evenements_futurs_du_groupe(nom, entity_id, entity_type):
            if evt["id"] not in tous_evenements:
                tous_evenements[evt["id"]] = evt
                tous_evenements[evt["id"]]["favoris_presents"] = []
            tous_evenements[evt["id"]]["favoris_presents"].append(nom)
        time.sleep(0.5)

    print(f"  → {len(tous_evenements)} événement(s) trouvé(s) avec au moins un favori.")

    alertes = []
    for evt in tous_evenements.values():
        duree = temps_trajet_minutes(home_coords, (evt["lat"], evt["lon"]))
        if duree is None:
            print(f"     ❌ Calcul de trajet échoué pour {evt['ville']}")
            continue
        duree = round(duree)
        print(f"     [{evt['type']}] {evt['ville']} le {evt['date']} — 🚗 {duree} min "
              f"(favoris : {', '.join(evt['favoris_presents'])})")
        if duree <= max_minutes:
            evt["duree"] = duree
            evt.update(recuperer_details_evenement(evt["url"]))
            alertes.append(evt)
            time.sleep(0.5)  # politesse envers le serveur Tamm-Kreiz
        time.sleep(1)  # politesse envers le serveur OSRM

    return alertes, set(tous_evenements.keys())


def afficher_alertes(utilisateur: dict, alertes: list[dict]) -> None:
    print(f"\n  Résultat pour {utilisateur['nom']} :")
    if not alertes:
        print("  Aucune alerte pour le moment.")
        return
    print(f"  {len(alertes)} alerte(s) :\n")
    for evt in alertes:
        print(
            f"  [{evt['type']}] {evt['ville']} le {evt['date']}\n"
            f"    Groupe(s) favori(s) présents : {', '.join(evt['favoris_presents'])}\n"
            f"    Tout le plateau : {evt['plateau']}\n"
            f"    🚗 {evt['duree']} min de chez lui/elle\n"
            f"    {evt['url']}\n"
        )


def main():
    utilisateurs = charger_config()
    notifies = charger_notifies()

    forcer_envoi = os.environ.get("FORCER_ENVOI", "").strip().lower() in ("1", "true", "yes")
    if forcer_envoi:
        print("⚙️  FORCER_ENVOI actif : l'anti-doublon est ignoré, "
              "toutes les alertes actuelles seront (re)notifiées.\n")

    utiliser_cache = os.environ.get("UTILISER_CACHE", "").strip().lower() in ("1", "true", "yes")
    cache_evenements = charger_cache_evenements() if utiliser_cache else {}
    if utiliser_cache:
        print("⚙️  UTILISER_CACHE actif : réutilisation des derniers événements "
              "calculés, pas de nouvel appel à Tamm-Kreiz/OSRM.\n")

    for utilisateur in utilisateurs:
        nom = utilisateur["nom"]
        print(f"\n{'=' * 50}\n{nom} — {utilisateur['adresse']}\n{'=' * 50}")

        if utiliser_cache and nom in cache_evenements:
            alertes = cache_evenements[nom]["alertes"]
            ids_evenements_futurs = set(cache_evenements[nom]["ids_futurs"])
            print(f"  → {len(alertes)} alerte(s) reprise(s) du cache local.")
        else:
            alertes, ids_evenements_futurs = calculer_alertes_pour_utilisateur(utilisateur)
            cache_evenements[nom] = {"alertes": alertes, "ids_futurs": ids_evenements_futurs}
        afficher_alertes(utilisateur, alertes)

        deja_notifies = set() if forcer_envoi else set(notifies.get(nom, []))
        nouvelles_alertes = [evt for evt in alertes if evt["id"] not in deja_notifies]

        if nouvelles_alertes:
            print(f"\n  → {len(nouvelles_alertes)} nouvelle(s) alerte(s) à notifier.")
            sujet, corps_html, corps_texte = formater_email(utilisateur, nouvelles_alertes)
            envoyer_email(utilisateur.get("email", ""), sujet, corps_html, corps_texte)
        else:
            print("\n  → Rien de nouveau depuis la dernière exécution, pas d'email envoyé.")

        # On mémorise les événements déjà notifiés, en ne gardant que ceux qui
        # sont encore à venir (les événements passés sont naturellement purgés
        # puisqu'ils ne réapparaissent plus dans ids_evenements_futurs).
        ids_a_retenir = (deja_notifies | {evt["id"] for evt in nouvelles_alertes}) & ids_evenements_futurs
        notifies[nom] = sorted(ids_a_retenir)

    sauvegarder_notifies(notifies)
    if not utiliser_cache:
        sauvegarder_cache_evenements(cache_evenements)


if __name__ == "__main__":
    main()
