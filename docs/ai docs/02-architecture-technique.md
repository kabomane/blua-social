# Architecture technique

## Stack retenue (2026-08-15)

| Couche | Choix | Version | Raison |
|---|---|---|---|
| UI | React | 19.2 | demandé |
| Bundler | Vite | 8.2 | demandé ; plugin `@tailwindcss/vite` |
| CSS | Tailwind CSS | 4.3 | demandé ; config v4 = `@import "tailwindcss"` dans `index.css`, pas de tailwind.config.js |
| Langage | TypeScript | client ~6.0 / serveur 7.0 | demandé (versions posées par les scaffolds npm) |
| API | Express | 5.2 | doc SQLite prévoit une « Node.js API » ; Express = simple, standard |
| DB | better-sqlite3 | 13.0 | synchrone, transactions simples, parfait pour le modèle « écritures courtes » du doc |
| DX | tsx (serveur), concurrently (racine) | | dev sans étape de build |

## Décisions prises (non couvertes explicitement par les docs)

1. **Monorepo simple `client/` + `server/`** sans workspaces npm — deux
   `package.json` indépendants, scripts d'orchestration à la racine.
2. **better-sqlite3 plutôt que node:sqlite ou sqlite3** : API synchrone →
   transactions `BEGIN IMMEDIATE` triviales et courtes (exigence doc §21).
3. **Proxy Vite `/api` → localhost:3001** : pas de CORS en dev.
4. **Migrations SQL brutes** dans `server/src/database/migrations/*.sql`,
   appliquées par `migrate.ts` (table `_migrations`). Pas d'ORM : le doc
   fournit déjà le SQL exact.
5. **Le schéma suit le doc SQLite à la lettre** (tables, colonnes, indexes,
   PRAGMA WAL / foreign_keys / busy_timeout 5000).
6. **Timestamps en secondes Unix (INTEGER)** — cohérent avec
   `unixepoch()` utilisé dans les requêtes du doc.
7. `hubs.ts`, `birds.ts`, `rules.ts` = **données en code** (versionnables),
   comme demandé par le doc SQLite §19. Les 40 hubs sont déjà saisis.
8. Les moteurs `bird.ts`, `post.ts`, `haversine.ts`, `seeded-random.ts` sont
   des **stubs typés** (signatures + TODO pointant vers les sections des
   docs) — l'implémentation viendra quand on écrira l'app.

## Invariants à respecter en codant

- Voyage calculé une seule fois à l'envoi ; randoms seedés par messageId
  (seeds dérivées par étape) ; jamais `Math.random()`.
- Visibilité/disponibilité **dérivées du temps** :
  `delivered_at <= now`, `busy_until <= now`, `visible_at <= now`.
  Pas de worker, pas d'UPDATE d'état au MVP.
- Transaction d'envoi atomique : vérif pigeons → INSERT message →
  INSERT pigeon_action → INSERT deliveries (même fichier DB, transaction courte).
- Pour Home : 1 trajet auteur→hub, puis N livraisons individuelles depuis ce
  hub. `pigeon_actions.busy_until` = arrivée au hub ; chaque delivery stocke
  `origin_hub_id` et `dispatched_at`.
- Jamais d'appel réseau/calcul long dans une transaction SQLite.
- Home en fan-out on read (abonnements ACCEPTED + deliveries arrivées + échos), LIMIT 20.
- Friendships normalisées : `user_a_id = min(id1,id2)`, `user_b_id = max`.
- lat/lon d'une branche : immuables après création.

## Ports

- Client Vite : 5173
- API : 3001 (`PORT` env pour changer)
