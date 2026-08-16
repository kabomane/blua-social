-- Migration 003 — L'identifiant de connexion devient l'email.
-- username reste le nom public (@...), unique.

ALTER TABLE users ADD COLUMN email TEXT;

CREATE UNIQUE INDEX users_email ON users(email);
