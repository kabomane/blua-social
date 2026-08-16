-- ============================================================================
-- Migration 001 — Schéma initial MVP Blue Atmosphere
-- Source : docs/blue atmosphere sqlite.txt
-- Une seule base : data/app.db (WAL, foreign_keys ON, busy_timeout 5000)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS — coordonnées précises côté serveur uniquement (l'UI affiche la ville)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id TEXT PRIMARY KEY,

    username TEXT NOT NULL UNIQUE,

    latitude REAL NOT NULL,
    longitude REAL NOT NULL,

    city TEXT,
    country_code TEXT,
    timezone TEXT,

    created_at INTEGER NOT NULL
);

-- ----------------------------------------------------------------------------
-- FRIENDSHIPS — amitiés réciproques (pas de followers).
-- Normaliser : user_a_id = min(user1, user2), user_b_id = max(user1, user2).
-- status : PENDING | ACCEPTED | BLOCKED
-- ----------------------------------------------------------------------------
CREATE TABLE friendships (
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,

    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,

    PRIMARY KEY (user_a_id, user_b_id),

    FOREIGN KEY (user_a_id) REFERENCES users(id),
    FOREIGN KEY (user_b_id) REFERENCES users(id)
);

CREATE INDEX friendships_a ON friendships(user_a_id);
CREATE INDEX friendships_b ON friendships(user_b_id);

-- ----------------------------------------------------------------------------
-- BRANCHES — communautés attachées à une position géographique IMMUTABLE.
-- visibility : PUBLIC | PRIVATE
-- ----------------------------------------------------------------------------
CREATE TABLE branches (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,

    owner_id TEXT NOT NULL,

    latitude REAL NOT NULL,
    longitude REAL NOT NULL,

    visibility TEXT NOT NULL DEFAULT 'PUBLIC',

    created_at INTEGER NOT NULL,
    archived_at INTEGER,

    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX branches_location ON branches(latitude, longitude);

-- ----------------------------------------------------------------------------
-- BRANCH_MEMBERSHIPS — rôles : OWNER | MODERATOR | MEMBER
-- ----------------------------------------------------------------------------
CREATE TABLE branch_memberships (
    branch_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'MEMBER',

    joined_at INTEGER NOT NULL,

    PRIMARY KEY (branch_id, user_id),

    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX memberships_user ON branch_memberships(user_id);

-- ----------------------------------------------------------------------------
-- MESSAGES — contenu logique unique pour tous les types.
-- type : HOME | BRANCH | DIRECT | REPLY
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
    id TEXT PRIMARY KEY,

    author_id TEXT NOT NULL,

    type TEXT NOT NULL,

    content TEXT NOT NULL,

    branch_id TEXT,
    recipient_user_id TEXT,
    parent_message_id TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (recipient_user_id) REFERENCES users(id),
    FOREIGN KEY (parent_message_id) REFERENCES messages(id)
);

CREATE INDEX messages_author_created ON messages(author_id, created_at DESC);
CREATE INDEX messages_branch_created ON messages(branch_id, created_at DESC);
CREATE INDEX messages_recipient_created ON messages(recipient_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- DELIVERIES — le voyage d'un message vers UNE destination.
-- MESSAGE != DELIVERY : un message peut avoir N deliveries.
-- recipient_type : USER | BRANCH | HOME
-- method : BIRD | POST
-- Le voyage est calculé UNE SEULE FOIS à l'envoi (timeline_json sauvegardée).
-- Visibilité dérivée du temps : delivered_at <= now (pas de worker).
-- ----------------------------------------------------------------------------
CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,

    message_id TEXT NOT NULL,

    recipient_type TEXT NOT NULL,
    recipient_id TEXT,

    method TEXT NOT NULL,

    origin_lat REAL NOT NULL,
    origin_lon REAL NOT NULL,

    -- Pour une publication HOME : hub depuis lequel la copie individuelle
    -- est relayée. NULL pour les communications directes (DM, branche, réponse).
    origin_hub_id TEXT,

    destination_lat REAL NOT NULL,
    destination_lon REAL NOT NULL,

    sent_at INTEGER NOT NULL,
    -- Instant où CETTE livraison part réellement. Pour HOME, il correspond à
    -- l'arrivée du trajet initial auteur → hub ; pour un trajet direct, sent_at.
    dispatched_at INTEGER,
    delivered_at INTEGER NOT NULL,

    distance_km REAL,

    timeline_json TEXT,

    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX deliveries_message ON deliveries(message_id);
CREATE INDEX deliveries_arrival ON deliveries(delivered_at);
CREATE INDEX deliveries_recipient_arrival
    ON deliveries(recipient_type, recipient_id, delivered_at);

-- ----------------------------------------------------------------------------
-- PIGEON_ACTIONS — un pigeon = une ACTION de communication (1 action,
-- éventuellement N deliveries). Pour HOME, busy_until est l'arrivée du
-- trajet initial auteur → hub, jamais l'arrivée chez le dernier ami.
-- Disponibilité dérivée du temps : disponible quand busy_until <= now
-- (pas d'UPDATE d'état).
-- ----------------------------------------------------------------------------
CREATE TABLE pigeon_actions (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,

    action_type TEXT NOT NULL,

    started_at INTEGER NOT NULL,
    busy_until INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX pigeon_actions_active ON pigeon_actions(user_id, busy_until);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS — journal des arrivées. Visible quand visible_at <= now :
-- aucun message entrant visible avant son arrivée.
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,
    type TEXT NOT NULL,

    message_id TEXT,

    visible_at INTEGER NOT NULL,
    read_at INTEGER,

    created_at INTEGER NOT NULL
);

CREATE INDEX notifications_user_visible ON notifications(user_id, visible_at DESC);
