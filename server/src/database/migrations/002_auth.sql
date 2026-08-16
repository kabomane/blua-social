-- Migration 002 — Authentification
-- Le schéma initial (doc SQLite) ne prévoyait pas de mot de passe.
-- Règle produit : 4 caractères minimum, aucune autre contrainte.

ALTER TABLE users ADD COLUMN password_hash TEXT;
