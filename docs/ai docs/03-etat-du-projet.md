# État réel du projet

Dernier audit du code : 2026-08-19.

## Résumé

Le projet est un prototype UI authentifiable avec schéma SQLite préparé pour
la diffusion V3. L'inscription et la connexion fonctionnent, mais il n'existe
pas encore de session serveur. Home possède un premier envoi physique et quota
serveur minimal; feed, réponses, transmissions, branches et notifications
restent principalement des démonstrations locales.

## Fonctionnel aujourd'hui

### Outillage et exécution

- [x] React/Vite/TypeScript/Tailwind et Express/TypeScript configurés.
- [x] Scripts racine `dev`, `dev:https`, `build`, `typecheck`, `db:migrate`.
- [x] HTTPS local et exposition réseau pour tester la géolocalisation mobile.
- [x] Build client et typecheck serveur opérationnels ; lint client disponible.
- [ ] Aucun framework ni suite de tests automatisés.
- [ ] Aucun pipeline CI/CD.

### Base de données

- [x] SQLite unique, WAL, foreign keys et busy timeout.
- [x] Migrations 001–007 rejouables sur une base neuve.
- [x] Tables de base : users, friendships, branches, memberships, messages,
  deliveries, pigeon_actions, notifications.
- [x] Structures V3 : friendship/branch membership periods, slots Home,
  broadcasts, bitmap chunks, `messages.available_at`,
  `users.location_checked_at`.
- [x] Schéma vérifié sur la base locale et en mémoire.
- [ ] Aucun code métier n'écrit ou ne lit encore les broadcasts/bitmaps.
- [x] La migration 005/table `follows` correspond à la relation Home
  unilatérale confirmée le 2026-08-19.
- [ ] Le schéma V3 historise les amitiés mais pas encore chaque follow orienté ;
  il faut ajouter `follow_periods` pour figer l'audience Home à l'heure de
  `distribution_started_at`.
- [ ] Le schéma manque encore les décisions Beta 1 : sessions, invitations
  de follow, blocages, signalements/modération, capacité POST, intérêts,
  propriété de branche, signets et audit.
- [ ] PostgreSQL production et éventuelle parité SQLite non conçus.

### Authentification et localisation

- [x] Vérification de disponibilité email/pseudo.
- [x] Inscription email + mot de passe (minimum 4) + pseudo + géolocalisation
  obligatoire + timezone.
- [x] Hash scrypt salé ; résolution de ville Nominatim best effort.
- [x] Connexion email/mot de passe.
- [x] UI d'authentification en trois étapes et stockage local IndexedDB.
- [x] `location_checked_at` initialisé à l'inscription et mis à jour par
  `POST /api/auth/location`; le client bloque l'accès après 24 h sans accord
  de localisation au premier plan.
- [x] Avatar de profil: upload JPEG/PNG/WebP limité à 5 Mo dans le bucket local
  `server/data/profile-bucket`; seules URLs avatar et ville sont exposées.
- [ ] La « session » actuelle n'est qu'un objet utilisateur côté client :
  aucune session/token serveur, cookie HttpOnly, expiration ou révocation.
- [ ] Pas de logout serveur, récupération de compte, protection CSRF ni
  limitation de tentatives. L'endpoint de position reste provisoirement fondé
  sur l'identifiant de la session locale, faute de session serveur.

### Moteurs de livraison

- [x] Paramètres BIRD/POST centralisés.
- [x] Rouge-gorge 40/50/60, 40 hubs, 5 régions et 10 gateways saisis.
- [x] Haversine, random déterministe FNV-1a et premier trajet BIRD implémentés.
- [ ] Moteur POST complet et gestion des calendriers/fuseaux non implémentés;
  le premier trajet Home POST utilise provisoirement collecte + acheminement
  local simplifiés.
- [ ] Aucun test avec les exemples Lille → Londres/Montréal/Tokyo.
- [x] Progression et position visuelle dérivées côté client pour le premier
  trajet sortant Home; Mappy affiche son planisphère et l'itinéraire.

### API métier

- [x] `GET /api/health` et routes `/api/auth/*` montées.
- [x] `GET /api/deliveries/capacity` et `POST /api/deliveries/outbound`:
  transaction message, delivery et slot BIRD/POST avec quota 5/5 et
  restitution à `busy_until`.
- [ ] Routes sociales Branch/Cui-to-cui, lecture paginée, résolution V3,
  notification, purge et modération restent à implémenter.
- [ ] Aucune politique d'autorisation partagée API/SSR.

### Interface

- [x] Design Home responsive validé, thèmes clair et sombre noir profond.
- [x] Composer et choix BIRD/POST maquettés.
- [x] Cartes de feed, conversation, réponses et transmissions maquettées.
- [x] Compteurs Home et Profil issus de l'API de capacité (quota 5/5).
- [x] Navigation desktop avec Home, Branches, Cui-to-cui, Arrivées, Signets,
  Profil et Paramètres.
- [x] Navigation mobile flottante, safe-area, deux raccourcis persistés, badge
  Signets conditionnel et menu à bulles. Le menu s'ouvre uniquement au bouton,
  assombrit l'écran et verrouille son défilement.
- [x] Paramètres : thème, choix des raccourcis isolés par utilisateur et
  déconnexion locale.
- [ ] Feed et branches utilisent des constantes de démonstration.
- [ ] Réponses/transmissions restent des maquettes locales; seul envoi Home
  crée actuellement le premier trajet physique serveur.
- [x] Vues locales de démonstration pour Branches, Cui-to-cui, Notifications,
  Signets et Profil, accessibles depuis la navigation.
- [ ] Pas de vrai routeur ni données API pour ces vues, détail de branche,
  conversation privée ou onboarding post-inscription.
- [x] Carte Mappy intégrée aux trajets sortants du Profil, sans thème global;
  elle ne montre que le trajet de son expéditeur.
- [ ] Aucune donnée de signet réelle ; le compteur vaut zéro.

### SEO et pages publiques

- [ ] Aucun SSR, entry server, routes publiques dédiées ou hydratation.
- [ ] Pas de pages `/about`, `/how-it-works`, légales, branche publique ou
  profil public.
- [ ] Pas de canonical, Open Graph, robots, sitemap, JSON-LD ni vrais 404 SSR.

## Dettes et contradictions prioritaires

1. Les AI docs sont désormais alignés sur le follow unilatéral ; les passages
   du document produit/V3 parlant seulement « d'amis » devront être clarifiés
   lors de leur prochaine révision.
2. La diffusion V3 actuelle repose sur `friendship_periods`, alors que la Home
   doit reposer sur l'historique orienté des follows.
3. `004_home_delivery_hub.sql` conserve des colonnes de l'ancien modèle ; il
   faut décider si elles restent utiles au trajet physique initial ou migrer
   vers une représentation V3 plus explicite.
4. L'authentification actuelle ne protège aucune API multi-utilisateur.
5. SQLite est le runtime actuel alors que la documentation SEO vise PostgreSQL
   en production.
6. Les décisions produit ouvertes empêchent de figer tout le schéma Beta 1.

## Prochaine action

Commencer par la phase 0 puis la phase 1 de
[04-roadmap-beta-1.md](04-roadmap-beta-1.md). Ne pas brancher l'UI de messages
avant d'avoir un moteur déterministe testé, une session serveur et un modèle
social/schema stabilisés.
