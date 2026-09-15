import { jsonResponse, errorResponse, geocodeAdresse } from "../../_shared.js";

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

// GET /api/u/:id — préférences actuelles (pour préremplir le formulaire d'édition).
export async function onRequestGet({ params, env }) {
  const row = await env.DB.prepare(
    `SELECT nom, email, profil_url, adresse, rayon_minutes FROM utilisateurs WHERE id = ?`
  )
    .bind(params.id)
    .first();

  if (!row) return errorResponse("Lien invalide ou compte supprimé.", 404);
  return jsonResponse(row);
}

// PUT /api/u/:id — met à jour les préférences (re-géocode l'adresse).
export async function onRequestPut({ request, params, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Corps de requête JSON invalide.");
  }

  const existe = await env.DB.prepare(`SELECT id FROM utilisateurs WHERE id = ?`).bind(params.id).first();
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
      params.id
    )
    .run();

  return jsonResponse({ ok: true });
}

// DELETE /api/u/:id — supprime le compte.
export async function onRequestDelete({ params, env }) {
  const existe = await env.DB.prepare(`SELECT id FROM utilisateurs WHERE id = ?`).bind(params.id).first();
  if (!existe) return errorResponse("Lien invalide ou compte déjà supprimé.", 404);

  await env.DB.prepare(`DELETE FROM utilisateurs WHERE id = ?`).bind(params.id).run();
  return jsonResponse({ ok: true });
}
