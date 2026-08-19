-- Profil et rafraîchissement volontaire de localisation.
-- Les octets avatar vivent dans le bucket local, jamais dans SQLite.
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at INTEGER;
