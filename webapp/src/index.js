import { jsonResponse, errorResponse, geocodeAdresse, envoyerEmailBienvenue, genererId } from "./shared.js";

const RAYON_MAX_MINUTES = 300;

function echapperICS(texte) {
  return String(texte)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function jourSuivantISO(jourStr) {
  const d = new Date(`${jourStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// GET /api/calendrier.ics — génère un événement iCalendar (.ics) universel
// (Google, Outlook, Apple Calendar, etc.) à partir de paramètres passés en
// query string. Public et sans état : ne fait que renvoyer ce qu'on lui a
// donné, mis en forme.
function genererCalendrierIcs(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "evt";
  const titre = params.get("titre");
  const description = params.get("description") || "";
  const lieu = params.get("lieu") || "";
  const debut = params.get("debut");
  const fin = params.get("fin");
  const jour = params.get("jour");

  if (!titre) return errorResponse("Paramètre 'titre' manquant.");
  if (!jour && (!debut || !fin)) {
    return errorResponse("Paramètres 'debut'/'fin' (événement avec horaire) ou 'jour' (journée complète) manquants.");
  }

  const dtstamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Galv an dañs//FR",
    "BEGIN:VEVENT",
    `UID:evt-${id}@galvandans.xyz`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (jour) {
    const j = jour.replace(/-/g, "");
    lignes.push(`DTSTART;VALUE=DATE:${j}`, `DTEND;VALUE=DATE:${jourSuivantISO(jour)}`);
  } else {
    lignes.push(
      `DTSTART;TZID=Europe/Paris:${debut.replace(/[-:]/g, "")}`,
      `DTEND;TZID=Europe/Paris:${fin.replace(/[-:]/g, "")}`
    );
  }

  lignes.push(`SUMMARY:${echapperICS(titre)}`);
  if (description) lignes.push(`DESCRIPTION:${echapperICS(description)}`);
  if (lieu) lignes.push(`LOCATION:${echapperICS(lieu)}`);
  lignes.push("END:VEVENT", "END:VCALENDAR");

  return new Response(lignes.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="evenement.ics"',
    },
  });
}

function validerEntree(body) {
  if (!body || typeof body !== "object") return "Corps de requête invalide.";
  if (!body.nom || typeof body.nom !== "string" || !body.nom.trim()) return "Le nom est requis.";
  if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) return "Email invalide.";
  if (!body.profil_url || !body.profil_url.startsWith("https://tamm-kreiz.bzh/")) {
    return "L'URL de profil doit être une page tamm-kreiz.bzh.";
  }
  if (!body.adresse || typeof body.adresse !== "string" || !body.adresse.trim()) return "L'adresse est requise.";
  const rayon = Number(body.rayon_minutes);
  if (!Number.isFinite(rayon) || rayon <= 0 || rayon > RAYON_MAX_MINUTES) {
    return `Le rayon doit être un nombre de minutes entre 1 et ${RAYON_MAX_MINUTES}.`;
  }
  return null;
}

// POST /api/users — inscription d'un nouvel utilisateur.
async function creerUtilisateur(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Corps de requête JSON invalide.");
  }

  const erreur = validerEntree(body);
  if (erreur) return errorResponse(erreur);

  const coords = await geocodeAdresse(body.adresse.trim());
  if (!coords) {
    return errorResponse("Adresse introuvable, vérifie l'orthographe et réessaie.");
  }

  const id = genererId();
  await env.DB.prepare(
    `INSERT INTO utilisateurs (id, nom, email, profil_url, adresse, home_lat, home_lon, rayon_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.nom.trim(),
      body.email.trim(),
      body.profil_url.trim(),
      body.adresse.trim(),
      coords.lat,
      coords.lon,
      Math.round(Number(body.rayon_minutes))
    )
    .run();

  const lienEdition = `${new URL(request.url).origin}/edit.html?id=${id}`;
  const emailEnvoye = await envoyerEmailBienvenue(env, body.email.trim(), body.nom.trim(), lienEdition);

  if (!emailEnvoye) {
    await env.DB.prepare(`DELETE FROM utilisateurs WHERE id = ?`).bind(id).run();
    return errorResponse("Erreur lors de l'envoi de l'email, réessaie dans quelques instants.", 502);
  }

  return jsonResponse({ ok: true, message: "Vérifie tes emails pour récupérer ton lien de gestion." }, 201);
}

// GET /api/users — liste complète, réservée au script d'alerte (clé API requise).
async function listerUtilisateurs(request, env) {
  const cle = request.headers.get("X-Api-Key");
  if (!cle || cle !== env.SYNC_API_KEY) {
    return errorResponse("Non autorisé.", 401);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, nom, email, profil_url, adresse, home_lat, home_lon, rayon_minutes FROM utilisateurs`
  ).all();

  return jsonResponse({ utilisateurs: results });
}

// GET /api/u/:id — préférences actuelles (pour préremplir le formulaire d'édition).
async function obtenirUtilisateur(id, env) {
  const row = await env.DB.prepare(
    `SELECT nom, email, profil_url, adresse, rayon_minutes FROM utilisateurs WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!row) return errorResponse("Lien invalide ou compte supprimé.", 404);
  return jsonResponse(row);
}

// PUT /api/u/:id — met à jour les préférences (re-géocode l'adresse).
async function modifierUtilisateur(id, request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Corps de requête JSON invalide.");
  }

  const existe = await env.DB.prepare(`SELECT id FROM utilisateurs WHERE id = ?`).bind(id).first();
  if (!existe) return errorResponse("Lien invalide ou compte supprimé.", 404);

  const erreur = validerEntree(body);
  if (erreur) return errorResponse(erreur);

  const coords = await geocodeAdresse(body.adresse.trim());
  if (!coords) {
    return errorResponse("Adresse introuvable, vérifie l'orthographe et réessaie.");
  }

  await env.DB.prepare(
    `UPDATE utilisateurs
     SET nom = ?, email = ?, profil_url = ?, adresse = ?, home_lat = ?, home_lon = ?, rayon_minutes = ?
     WHERE id = ?`
  )
    .bind(
      body.nom.trim(),
      body.email.trim(),
      body.profil_url.trim(),
      body.adresse.trim(),
      coords.lat,
      coords.lon,
      Math.round(Number(body.rayon_minutes)),
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

// DELETE /api/u/:id — supprime le compte.
async function supprimerUtilisateur(id, env) {
  const existe = await env.DB.prepare(`SELECT id FROM utilisateurs WHERE id = ?`).bind(id).first();
  if (!existe) return errorResponse("Lien invalide ou compte déjà supprimé.", 404);

  await env.DB.prepare(`DELETE FROM utilisateurs WHERE id = ?`).bind(id).run();
  return jsonResponse({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    if (pathname === "/api/calendrier.ics" && method === "GET") {
      return genererCalendrierIcs(request);
    }

    if (pathname === "/api/users") {
      if (method === "POST") return creerUtilisateur(request, env);
      if (method === "GET") return listerUtilisateurs(request, env);
    }

    const matchUtilisateur = pathname.match(/^\/api\/u\/([^/]+)$/);
    if (matchUtilisateur) {
      const id = matchUtilisateur[1];
      if (method === "GET") return obtenirUtilisateur(id, env);
      if (method === "PUT") return modifierUtilisateur(id, request, env);
      if (method === "DELETE") return supprimerUtilisateur(id, env);
    }

    if (pathname.startsWith("/api/")) {
      return errorResponse("Route inconnue.", 404);
    }

    return env.ASSETS.fetch(request);
  },
};
