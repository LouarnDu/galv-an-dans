CREATE TABLE IF NOT EXISTS utilisateurs (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  profil_url TEXT NOT NULL,
  adresse TEXT NOT NULL,
  home_lat REAL NOT NULL,
  home_lon REAL NOT NULL,
  rayon_minutes INTEGER NOT NULL,
  repeter_evenements INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
