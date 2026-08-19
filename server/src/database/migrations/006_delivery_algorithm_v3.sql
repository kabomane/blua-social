-- Migration 006 — Algorithme de diffusion V3.
-- Sources : docs/delivery-algorithm-v3.txt et docs/b-atmos sqlite.txt §28.
-- Les broadcasts remplacent le fan-out de deliveries pour HOME et BRANCH.

-- La dernière position est confirmée au plus une fois par 24 h côté client au
-- premier plan ; elle n'implique aucun suivi d'arrière-plan.
ALTER TABLE users ADD COLUMN location_checked_at INTEGER NOT NULL DEFAULT 0;

-- L'arrivée d'un DIRECT reste lisible même après la purge opportuniste de sa
-- delivery détaillée.
ALTER TABLE messages ADD COLUMN available_at INTEGER;

-- Périodes historiques : les tables actives restent adaptées aux requêtes
-- courantes, mais ces périodes font autorité pour l'accès à un broadcast passé.
CREATE TABLE branch_membership_periods (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    UNIQUE(branch_id, slot_index),
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX membership_period_lookup
ON branch_membership_periods(branch_id, user_id, joined_at, left_at);

CREATE TABLE friendship_periods (
    id TEXT PRIMARY KEY,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    CHECK (user_a_id < user_b_id),
    FOREIGN KEY (user_a_id) REFERENCES users(id),
    FOREIGN KEY (user_b_id) REFERENCES users(id)
);

CREATE INDEX friendship_period_lookup
ON friendship_periods(user_a_id, user_b_id, started_at, ended_at);

-- Slot stable par couple auteur/destinataire. Il n'est jamais réutilisé, même
-- après la fin de l'amitié : les anciens bitmaps restent ainsi interprétables.
CREATE TABLE home_recipient_slots (
    publisher_user_id TEXT NOT NULL,
    recipient_user_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    assigned_at INTEGER NOT NULL,
    PRIMARY KEY (publisher_user_id, recipient_user_id),
    UNIQUE(publisher_user_id, slot_index),
    FOREIGN KEY (publisher_user_id) REFERENCES users(id),
    FOREIGN KEY (recipient_user_id) REFERENCES users(id)
);

CREATE TABLE broadcasts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
    audience_type TEXT NOT NULL CHECK (audience_type IN ('HOME', 'BRANCH')),
    origin_type TEXT NOT NULL CHECK (origin_type IN ('HUB', 'BRANCH')),
    origin_id TEXT NOT NULL,
    origin_lat REAL NOT NULL,
    origin_lon REAL NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('BIRD', 'POST')),
    distribution_started_at INTEGER NOT NULL,
    settled_at INTEGER NOT NULL CHECK (settled_at >= distribution_started_at),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX broadcasts_active
ON broadcasts(audience_type, distribution_started_at, settled_at);

-- 512 bits exactement (64 octets) par chunk. Le contrôle de taille et le
-- set-bit atomique sont assurés par la couche applicative lors de l'écriture.
CREATE TABLE broadcast_bitmap_chunks (
    broadcast_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    received_bits BLOB NOT NULL CHECK (length(received_bits) = 64),
    PRIMARY KEY (broadcast_id, chunk_index),
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id)
);
