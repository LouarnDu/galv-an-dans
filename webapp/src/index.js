import { jsonResponse, errorResponse, geocodeAdresse, envoyerEmailBienvenue, genererId } from "./shared.js";

const RAYON_MAX_MINUTES = 300;

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
    `SELECT nom, email, profil_url, adresse, home_lat, home_lon, rayon_minutes FROM utilisateurs`
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
