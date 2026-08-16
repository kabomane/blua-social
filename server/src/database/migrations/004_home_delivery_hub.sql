-- Migration 004 — diffusion Home via hub.
-- Source : docs/home_posts_via_hub.txt.
-- origin_hub_id et dispatched_at sont NULL pour les communications directes.

ALTER TABLE deliveries ADD COLUMN origin_hub_id TEXT;
ALTER TABLE deliveries ADD COLUMN dispatched_at INTEGER;

CREATE INDEX deliveries_origin_hub_dispatched
ON deliveries(origin_hub_id, dispatched_at);
