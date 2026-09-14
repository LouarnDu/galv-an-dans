"""
Alerte Fest-Noz — V2
=====================
Utilise l'API interne de Tamm-Kreiz (endpoint ajax_blocAgendaMensuel.html,
découverte via les DevTools du navigateur) pour récupérer directement
l'agenda de chaque groupe favori : dates, lieux (avec coordonnées GPS),
type d'événement et line-up complet — sans avoir à scraper chaque page
d'événement une par une.

Dépendances : pip install requests
"""

from __future__ import annotations
import json
import os
import re
import time
from datetime import date
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
# Les réglages (adresse, rayon, favoris) ne sont plus codés en dur ici : ils
# viennent de config.json, structuré comme une LISTE d'utilisateurs — même
# s'il n'y en a qu'un pour l'instant. Le jour où on veut ajouter des amis,
# il suffira d'ajouter des entrées dans ce fichier (ou, plus tard, dans une
# vraie base de données qui aura la même forme), sans toucher au script.

CONFIG_PATH = Path(__file__).parent / "config.json"
NOTIFIED_PATH = Path(__file__).parent / "notified.json"

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
RESEND_FROM_EMAIL = "onboarding@resend.dev"


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
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)["utilisateurs"]


def charger_notifies() -> dict[str, list[str]]:
    if not NOTIFIED_PATH.exists():
        return {}
    with open(NOTIFIED_PATH, encoding="utf-8") as f:
        return json.load(f)


def sauvegarder_notifies(notifies: dict[str, list[str]]) -> None:
    with open(NOTIFIED_PATH, "w", encoding="utf-8") as f:
        json.dump(notifies, f, ensure_ascii=False, indent=2)


def formater_email(alertes: list[dict]) -> tuple[str, str]:
    """Construit (sujet, corps) du mail récapitulatif pour une liste d'alertes."""
    sujet = f"🎶 {len(alertes)} nouvelle(s) date(s) de tes groupes favoris"
    lignes = []
    for evt in sorted(alertes, key=lambda e: e["date"]):
        lignes.append(
            f"[{evt['type']}] {evt['ville']} le {evt['date']}\n"
            f"  Groupe(s) favori(s) : {', '.join(evt['favoris_presents'])}\n"
            f"  Plateau complet : {evt['plateau']}\n"
            f"  🚗 {evt['duree']} min de chez toi\n"
            f"  {evt['url']}\n"
        )
    corps = "\n".join(lignes)
    return sujet, corps


def envoyer_email(destinataire: str, sujet: str, corps: str) -> bool:
    """Envoie un email via l'API HTTP de Resend. Retourne False si la clé
    API n'est pas configurée (mode local sans email) ou en cas d'erreur
    d'envoi."""
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
                "text": corps,
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
            alertes.append(evt)
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

    for utilisateur in utilisateurs:
        nom = utilisateur["nom"]
        print(f"\n{'=' * 50}\n{nom} — {utilisateur['adresse']}\n{'=' * 50}")

        alertes, ids_evenements_futurs = calculer_alertes_pour_utilisateur(utilisateur)
        afficher_alertes(utilisateur, alertes)

        deja_notifies = set(notifies.get(nom, []))
        nouvelles_alertes = [evt for evt in alertes if evt["id"] not in deja_notifies]

        if nouvelles_alertes:
            print(f"\n  → {len(nouvelles_alertes)} nouvelle(s) alerte(s) à notifier.")
            sujet, corps = formater_email(nouvelles_alertes)
            envoyer_email(utilisateur.get("email", ""), sujet, corps)
        else:
            print("\n  → Rien de nouveau depuis la dernière exécution, pas d'email envoyé.")

        # On mémorise les événements déjà notifiés, en ne gardant que ceux qui
        # sont encore à venir (les événements passés sont naturellement purgés
        # puisqu'ils ne réapparaissent plus dans ids_evenements_futurs).
        ids_a_retenir = (deja_notifies | {evt["id"] for evt in nouvelles_alertes}) & ids_evenements_futurs
        notifies[nom] = sorted(ids_a_retenir)

    sauvegarder_notifies(notifies)


if __name__ == "__main__":
    main()
