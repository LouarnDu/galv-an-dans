import {
  jsonResponse,
  errorResponse,
  geocodeAdresse,
  envoyerEmailBienvenue,
  declencherAlerteImmediate,
  genererId,
} from "./shared.js";

const RAYON_MAX_MINUTES = 300;

function echapperICS(texte) {
  return String(texte)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function echapperHtml(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Renvoie la date du lendemain (jourStr au format YYYY-MM-DD), avec ou sans tirets.
function jourSuivant(jourStr, avecTirets) {
  const d = new Date(`${jourStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  return avecTirets ? iso : iso.replace(/-/g, "");
}

// Lit et valide les paramètres communs à toutes les routes calendrier.
// Retourne soit {erreur}, soit les paramètres prêts à l'emploi.
function extraireParamsAgenda(request) {
  const sp = new URL(request.url).searchParams;
  const titre = sp.get("titre");
  const debut = sp.get("debut");
  const fin = sp.get("fin");
  const jour = sp.get("jour");

  if (!titre) return { erreur: "Paramètre 'titre' manquant." };
  if (!jour && (!debut || !fin)) {
    return { erreur: "Paramètres 'debut'/'fin' (événement avec horaire) ou 'jour' (journée complète) manquants." };
  }

  const description = sp.get("description") || "";
  return {
    id: sp.get("id") || "evt",
    titre,
    description,
    // Version HTML (liens cliquables) utilisée par Google Agenda/Outlook ;
    // le .ics garde toujours la version texte brut (le format iCalendar
    // n'affiche pas le HTML).
    descriptionHtml: sp.get("description_html") || description,
    lieu: sp.get("lieu") || "",
    debut,
    fin,
    jour,
  };
}

function construireICS(p) {
  const dtstamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Galv an dañs//FR",
    "BEGIN:VEVENT",
    `UID:evt-${p.id}@galvandans.xyz`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (p.jour) {
    lignes.push(
      `DTSTART;VALUE=DATE:${p.jour.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${jourSuivant(p.jour, false)}`
    );
  } else {
    lignes.push(
      `DTSTART;TZID=Europe/Paris:${p.debut.replace(/[-:]/g, "")}`,
      `DTEND;TZID=Europe/Paris:${p.fin.replace(/[-:]/g, "")}`
    );
  }

  lignes.push(`SUMMARY:${echapperICS(p.titre)}`);
  if (p.description) lignes.push(`DESCRIPTION:${echapperICS(p.description)}`);
  if (p.lieu) lignes.push(`LOCATION:${echapperICS(p.lieu)}`);
  lignes.push("END:VEVENT", "END:VCALENDAR");

  return lignes.join("\r\n");
}

function reponseICS(icsTexte) {
  return new Response(icsTexte, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="evenement.ics"',
    },
  });
}

function construireLienGoogle(p) {
  const params = { action: "TEMPLATE", text: p.titre, details: p.descriptionHtml, location: p.lieu };
  if (p.jour) {
    params.dates = `${p.jour.replace(/-/g, "")}/${jourSuivant(p.jour, false)}`;
  } else {
    params.dates = `${p.debut.replace(/[-:]/g, "")}/${p.fin.replace(/[-:]/g, "")}`;
    params.ctz = "Europe/Paris";
  }
  return "https://calendar.google.com/calendar/render?" + new URLSearchParams(params).toString();
}

function construireLienOutlook(p) {
  const params = {
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: p.titre,
    body: p.descriptionHtml,
    location: p.lieu,
  };
  if (p.jour) {
    params.startdt = p.jour;
    params.enddt = jourSuivant(p.jour, true);
    params.allday = "true";
  } else {
    params.startdt = p.debut;
    params.enddt = p.fin;
    params.allday = "false";
  }
  return "https://outlook.live.com/calendar/0/deeplink/compose?" + new URLSearchParams(params).toString();
}

function lienIcsDirect(p) {
  const params = { id: p.id, titre: p.titre, description: p.description, lieu: p.lieu };
  if (p.jour) params.jour = p.jour;
  else {
    params.debut = p.debut;
    params.fin = p.fin;
  }
  return "/api/calendrier.ics?" + new URLSearchParams(params).toString();
}

function estAndroid(request) {
  return /Android/i.test(request.headers.get("User-Agent") || "");
}

function estIOS(request) {
  return /iPhone|iPad|iPod/i.test(request.headers.get("User-Agent") || "");
}

function pageChoixAgenda(p) {
  const corps = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ajouter à mon agenda</title>
<style>
  body { background:#0f1620; color:#e8edf4; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; padding:32px 16px; }
  .wrap { max-width:420px; margin:0 auto; }
  h1 { font-size:1.4rem; margin-bottom:4px; }
  p { color:#93a2b8; }
  a.btn { display:block; text-align:center; text-decoration:none; background:#17212e; border:1px solid #2a3648;
          color:#e8edf4; border-radius:8px; padding:14px; margin-top:12px; font-weight:600; }
  a.btn:hover { border-color:#3ba9a0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Ajouter à mon agenda</h1>
  <p>${echapperHtml(p.titre)}</p>
  <a class="btn" href="${echapperHtml(construireLienGoogle(p))}">Google Agenda</a>
  <a class="btn" href="${echapperHtml(construireLienOutlook(p))}">Outlook</a>
  <a class="btn" href="${echapperHtml(lienIcsDirect(p))}">Apple Calendar / autre (.ics)</a>
</div>
</body>
</html>`;

  return new Response(corps, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// GET /agenda — point d'entrée unique du lien "Ajouter à mon agenda" dans
// l'email :
// - Android : redirige directement vers Google Agenda (aucun fichier
//   impliqué — les navigateurs intégrés des applis mail comme Gmail
//   téléchargent systématiquement les .ics au lieu de proposer de les
//   ouvrir, donc autant s'en passer).
// - iOS : sert le .ics (Apple Calendar le gère nativement très bien).
// - Desktop : petite page avec un bouton par fournisseur.
function gererDemandeAgenda(request) {
  const p = extraireParamsAgenda(request);
  if (p.erreur) return errorResponse(p.erreur);
  if (estAndroid(request)) return Response.redirect(construireLienGoogle(p), 302);
  if (estIOS(request)) return reponseICS(construireICS(p));
  return pageChoixAgenda(p);
}

// GET /api/calendrier.ics — le fichier .ics brut (utilisé directement par
// la page de choix desktop, et comme lien de secours).
function genererCalendrierIcs(request) {
  const p = extraireParamsAgenda(request);
  if (p.erreur) return errorResponse(p.erreur);
  return reponseICS(construireICS(p));
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
async function creerUtilisateur(request, env, ctx) {
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

  // Déclenche une première alerte immédiate pour ce seul utilisateur,
  // sans attendre le prochain run hebdomadaire. Ne bloque pas la réponse.
  ctx.waitUntil(declencherAlerteImmediate(env, id));

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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    if (pathname === "/agenda" && method === "GET") {
      return gererDemandeAgenda(request);
    }

    if (pathname === "/api/calendrier.ics" && method === "GET") {
      return genererCalendrierIcs(request);
    }

    if (pathname === "/api/users") {
      if (method === "POST") return creerUtilisateur(request, env, ctx);
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
