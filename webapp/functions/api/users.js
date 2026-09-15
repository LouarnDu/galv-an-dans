import { jsonResponse, errorResponse, geocodeAdresse, envoyerEmailBienvenue, genererId } from "../_shared.js";

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
export async function onRequestPost({ request, env }) {
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
export async function onRequestGet({ request, env }) {
  const cle = request.headers.get("X-Api-Key");
  if (!cle || cle !== env.SYNC_API_KEY) {
    return errorResponse("Non autorisé.", 401);
  }

  const { results } = await env.DB.prepare(
    `SELECT nom, email, profil_url, adresse, home_lat, home_lon, rayon_minutes FROM utilisateurs`
  ).all();

  return jsonResponse({ utilisateurs: results });
}
