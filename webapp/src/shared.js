// Utilitaires partagés par les routes API.

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "GalvAnDans/1.0 (https://galvandans.xyz)";

// Convertit une adresse texte en coordonnées GPS via Nominatim (OpenStreetMap).
// Retourne {lat, lon} ou null si l'adresse n'a pas pu être géolocalisée.
export async function geocodeAdresse(adresse) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(adresse)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
  });
  if (!resp.ok) return null;
  const resultats = await resp.json();
  if (!resultats.length) return null;
  return { lat: parseFloat(resultats[0].lat), lon: parseFloat(resultats[0].lon) };
}

// Envoie l'email de bienvenue contenant le lien secret d'édition, via l'API Resend.
export async function envoyerEmailBienvenue(env, destinataire, nom, lienEdition) {
  const sujet = "Bienvenue sur Galv an dañs — ton lien de gestion";
  const corps =
    `Salut ${nom},\n\n` +
    `Ton alerte fest-noz est bien créée. Tu recevras le premier email d'ici ` +
    `quelques minutes puis un email d'alerte par semaine.\n\n` +
    `Via le lien ci-dessous, tu pourras modifier tes préférences ou supprimer ` +
    `ton compte à tout moment. Il sera présent en bas de chaque email d'alerte.\n\n` +
    `${lienEdition}\n\n` +
    `Ne le partage avec personne : quiconque possède ce lien peut modifier ` +
    `tes préférences.\n`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Galv an dañs - alertes fest-noz <alertes@galvandans.xyz>",
      to: [destinataire],
      subject: sujet,
      text: corps,
    }),
  });
  return resp.ok;
}

export function genererId() {
  return crypto.randomUUID();
}

// Déclenche immédiatement le workflow GitHub Actions pour ce seul
// utilisateur (au lieu d'attendre le prochain run hebdomadaire), via
// l'API "workflow_dispatch" de GitHub. Best-effort : une erreur ici ne
// doit jamais faire échouer l'inscription elle-même (appelée via
// ctx.waitUntil, après la réponse HTTP).
export async function declencherAlerteImmediate(env, utilisateurId) {
  try {
    const resp = await fetch(
      "https://api.github.com/repos/LouarnDu/galv-an-dans/actions/workflows/alerte.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "galv-an-dans-webapp",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs: { utilisateur_id: utilisateurId } }),
      }
    );
    if (!resp.ok) {
      console.error("Échec du déclenchement GitHub Actions :", resp.status, await resp.text());
    }
  } catch (exc) {
    console.error("Erreur lors du déclenchement GitHub Actions :", exc);
  }
}
