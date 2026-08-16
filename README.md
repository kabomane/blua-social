# Blue Atmosphere

> Un réseau social où les messages voyagent vraiment.

Réseau social géographique et **asynchrone** : chaque message est transporté par
un oiseau (ou par la poste) et n'est visible par son destinataire qu'à
l'arrivée réelle du voyage. La distance, le temps et la capacité de
communication (pigeons limités) font partie du protocole social.

La conception complète se trouve dans [`docs/`](docs/) :

- [`blue atmosphere .txt`](docs/blue%20atmosphere%20.txt) — vision produit, Home, branches, cui-to-cui, principes
- [`send method.txt`](docs/send%20method.txt) — spécification des moteurs de livraison BIRD / POST
- [`update pigeon speed.txt`](docs/update%20pigeon%20speed.txt) — vitesse des oiseaux (distribution triangulaire 40-60 km/h)
- [`blue atmosphere sqlite.txt`](docs/blue%20atmosphere%20sqlite.txt) — architecture SQLite du MVP
- [`home_posts_via_hub.txt`](docs/home_posts_via_hub.txt) — diffusion Home via le hub le plus proche
- [`ai docs/`](docs/ai%20docs/) — documentation de travail de l'assistant IA

## Fonctionnement

Blue Atmosphere ralentit volontairement la communication : un contenu créé
maintenant peut n'être lu que plus tard, lorsque son trajet est terminé. Le
temps de transport est calculé une fois à l'envoi puis enregistré ; un message
entrant devient visible lorsque `delivered_at <= now`.

Trois espaces structurent le réseau :

- **Home** : publications destinées aux amis. L'auteur envoie une seule fois
  vers son hub géographiquement le plus proche. Le hub distribue ensuite une
  livraison indépendante à chaque ami ; chacun reçoit le post à son propre
  moment. Le pigeon ou timbre de l'auteur est libéré à l'arrivée au hub.
- **Branches** : communautés publiques ou privées ancrées à un lieu fixe,
  destinées à la découverte et aux échanges autour d'un territoire.
- **Cui-to-cui** : conversations privées directes entre deux personnes.

Les amitiés sont réciproques. Il n'y a ni likes, ni followers, ni compteurs de
popularité : répondre et transmettre sont des actions de communication, avec
un coût de capacité. Les coordonnées fournies par le navigateur sont conservées
pour calculer les trajets ; l'interface n'expose qu'une ville, jamais une
position exacte.

### Deux modes d'envoi

| Mode | Logique | Usage naturel |
|---|---|---|
| **Pigeon** | Trajet aérien direct, vitesse déterministe entre 40 et 60 km/h, 8 h de vol par jour | Rapide à courte distance, lent sur les longs trajets |
| **Poste** | Collecte, hubs, gateways, horaires et transports terrestres/aériens | Plus lente localement, meilleure pour les longues distances |

Les deux modes sont déterministes : même message, mêmes étapes et même heure
d'arrivée. Les pigeons et timbres sont des ressources limitées. Leur état est
dérivé du temps, sans worker chargé de faire « arriver » les messages.

## Stack

| Côté | Technologies |
|---|---|
| Client | React 19, Vite 8, TypeScript, Tailwind CSS 4 |
| Serveur | Node.js, Express 5, TypeScript, better-sqlite3 |
| Base | SQLite unique (`server/data/app.db`), WAL |

## Démarrage

```bash
npm install            # racine (concurrently)
npm --prefix client install
npm --prefix server install
npm run db:migrate     # crée/actualise server/data/app.db
npm run dev            # serveur (3001) + client (5173) en parallèle
```

Le client proxifie `/api` vers `http://localhost:3001`.

### HTTPS local (géolocalisation)

La géolocalisation fonctionne sur `http://localhost`, mais les navigateurs la
bloquent sur une adresse réseau en HTTP (`http://192.168.x.x:5173`). Pour
tester sur un téléphone ou une autre machine du réseau local :

```bash
npm run cert:dev          # génère un certificat OpenSSL local
npm run dev:https
```

Le script utilise OpenSSL installé ou celui fourni par Git for Windows. Pour
éviter l’avertissement du navigateur, importez le certificat uniquement dans
le magasin de confiance de votre utilisateur Windows :

```powershell
npm run cert:dev -- -Trust
```

Les clés sont créées dans `client/.cert/`, ignorées par Git. L’API reste sur
HTTP local : le proxy Vite assure la liaison, tandis que le navigateur reçoit
bien l’application en HTTPS.

## Structure

```
client/                  React + Vite + Tailwind
  src/
    features/            home, branches, cui-to-cui, pigeons,
                         notifications, explore, profile, onboarding
    components/  lib/  api/  types/

server/                  API Node + Express + SQLite
  data/app.db            base unique du MVP (générée, non versionnée)
  src/
    database/            db.ts, migrate.ts, migrations/*.sql
    delivery-engine/     rules.ts, birds.ts, hubs.ts (40 hubs / 10 gateways),
                         haversine.ts, seeded-random.ts, bird.ts, post.ts
    users/ friendships/ branches/ messages/
    deliveries/ pigeons/ notifications/

docs/                    conception produit + doc IA
```

## Principes non négociables (rappel)

1. Message ≠ Delivery — le contenu et le voyage sont deux objets distincts.
2. Le voyage est calculé **une seule fois** à l'envoi, jamais recalculé
   (randoms déterministes seedés par `messageId`).
3. La visibilité est **dérivée du temps** (`delivered_at <= now`) — pas de
   worker, pas d'UPDATE d'état.
4. Un pigeon = une action de communication ; disponibilité dérivée de
   `busy_until <= now`. Pour Home, il est occupé uniquement jusqu'au hub de
   relais ; jamais jusqu'au dernier ami livré.
5. Pas de likes, pas de followers — amitiés réciproques et branches
   géographiques immuables.
