-- Migration 005 — abonnements unilatéraux ; amitié = abonnement réciproque.
-- Source : docs/social_graph_followers.txt.

CREATE TABLE follows (
    follower_id TEXT NOT NULL,
    followed_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACCEPTED',
    created_at INTEGER NOT NULL,
    accepted_at INTEGER,

    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id != followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (followed_id) REFERENCES users(id)
);

CREATE INDEX follows_followed_status ON follows(followed_id, status);
CREATE INDEX follows_follower_status ON follows(follower_id, status);
