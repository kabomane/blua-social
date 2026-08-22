-- Réponses contextuelles, transmissions persistées et historique Home orienté.

ALTER TABLE messages ADD COLUMN source_message_id TEXT REFERENCES messages(id);
CREATE INDEX messages_source ON messages(source_message_id);

CREATE TABLE follow_periods (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,
    followed_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    CHECK (follower_id != followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (followed_id) REFERENCES users(id)
);

CREATE INDEX follow_period_lookup
ON follow_periods(follower_id, followed_id, started_at, ended_at);

INSERT INTO follow_periods (id, follower_id, followed_id, started_at, ended_at)
SELECT 'follow:' || follower_id || ':' || followed_id || ':' || created_at,
       follower_id, followed_id, created_at,
       CASE WHEN status = 'ACCEPTED' THEN NULL ELSE COALESCE(accepted_at, created_at) END
FROM follows;

INSERT INTO branch_membership_periods (
    id, branch_id, user_id, slot_index, role, joined_at, left_at
)
SELECT 'membership:' || membership.branch_id || ':' || membership.user_id,
       membership.branch_id,
       membership.user_id,
       (
         SELECT COUNT(*) - 1
         FROM branch_memberships earlier
         WHERE earlier.branch_id = membership.branch_id
           AND (earlier.joined_at < membership.joined_at
                OR (earlier.joined_at = membership.joined_at AND earlier.user_id <= membership.user_id))
       ),
       membership.role, membership.joined_at, NULL
FROM branch_memberships membership
WHERE NOT EXISTS (
    SELECT 1 FROM branch_membership_periods period
    WHERE period.branch_id = membership.branch_id AND period.user_id = membership.user_id
);
