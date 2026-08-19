# Architecture technique

Dernière consolidation : 2026-08-19.

## Stack actuelle

| Couche | Choix actuel | Cible Beta 1 |
|---|---|---|
| UI | React 19, Vite 8, TypeScript, Tailwind CSS 4 | SPA privée + rendu serveur des portes publiques |
| API | Express 5, TypeScript | API versionnée, authentifiée et partagée avec les règles SSR |
| DB locale | SQLite, better-sqlite3, WAL | conservée pour développement/tests si la parité est garantie |
| DB production | non implémentée | PostgreSQL selon la documentation SEO ; PostGIS à décider |
| Auth | scrypt, aucun token/session serveur | session sécurisée par cookie HttpOnly |
| Tests | aucun framework installé | unitaires, intégration DB/API et E2E responsive |

## Structure retenue

- Monorepo simple `client/` + `server/`, sans workspaces.
- Proxy Vite `/api` vers Express en développement.
- Migrations SQL ordonnées dans `server/src/database/migrations`.
- Bucket local des avatars dans `server/data/profile-bucket`; le fichier est
  nommé par UUID opaque, la base ne stocke que sa clé et son horodatage.
- Timestamps SQLite en secondes Unix.
- Données d'équilibrage versionnées en code : oiseaux, règles, 40 hubs et 10
  gateways.
- Une base unique pour les écritures atomiques du MVP local.

## Invariants de livraison

1. Aucun calcul de voyage n'utilise `Math.random()`.
2. Tout trajet physique est calculé avant la transaction, puis persisté une
   seule fois avec ses paramètres historiques.
3. Une transaction d'envoi reste courte : revalidation de capacité, message,
   action, delivery initiale et données de broadcast nécessaires.
4. Aucune requête réseau, géocodage ou opération longue dans une transaction.
5. `messages` contient le contenu unique ; `deliveries` ne contient que les
   trajets physiques uniques.
6. Home et Branch utilisent le broadcast V3, jamais N deliveries utilisateur.
7. La réception V3 est décidée côté backend. Le set-bit est atomique et ne
   modifie qu'un chunk de 64 octets.
8. Les slots et périodes historiques ne sont jamais reconstruits depuis
   l'ordre SQL et les slots libérés ne sont jamais réutilisés.
9. Un Direct est lisible uniquement par son destinataire lorsque
   `available_at <= now`, même après purge de sa delivery.
10. La disponibilité d'une ressource est dérivée du temps ; aucun worker exact
    à l'heure d'arrivée n'est requis pour autoriser une lecture.
11. Chaque compte a 5 slots BIRD et 5 slots POST. `pigeon_actions.action_type`
    porte la méthode et `busy_until` représente l'arrivée du premier trajet
    physique, jamais une redistribution V3.

## Modèle social actif

- `follows` est la relation active fondamentale et orientée : A → B permet à A
  de recevoir la Home de B.
- L'amitié n'est pas une seconde action utilisateur : elle est dérivée de
  A → B + B → A et constitue la condition d'envoi d'un cui-to-cui.
- L'éligibilité historique Home doit reposer sur des périodes de follow
  orientées couvrant `distribution_started_at`. Le schéma actuel possède
  `friendship_periods`, insuffisant pour un follow unilatéral : une migration
  `follow_periods` ou équivalente est requise.
- `home_recipient_slots` reste orienté par auteur (`publisher_user_id`) et
  abonné (`recipient_user_id`) ; son slot n'est jamais réutilisé.
- `friendships` peut être supprimée ou conservée comme cache dérivé, mais ne
  doit jamais devenir une source divergente des deux follows actifs.
- `branch_membership_periods` fait autorité pour l'éligibilité historique
  Branch ; `branch_memberships` sert à l'état courant.

## Visibilité et confidentialité

- Les coordonnées utilisateur ne sortent jamais de l'API publique.
- `location_checked_at` pilote un rafraîchissement au premier plan toutes les
  24 h au maximum.
- Le client bloque l'application si cette position est expirée jusqu'à l'appel
  `POST /api/auth/location` ou la déconnexion. Cet endpoint reste provisoire:
  il reçoit l'identifiant client car les sessions serveur n'existent pas.
- Toute requête de feed, branche, Direct, réponse, notification et SSR passe
  par des fonctions d'autorisation partagées.
- Un bot SEO est un visiteur anonyme ordinaire, sans exception d'arrivée.
- Les suppressions de contenu doivent être logiques/auditables lorsque la
  modération ou l'historique de droits l'exige.

## Frontend et navigation

- Breakpoint desktop à 1100 px.
- Desktop : sidebar complète ; mobile : barre flottante Home + deux raccourcis
  + Menu.
- Le menu mobile s'ouvre uniquement au bouton Paramètres, se ferme par ce
  bouton, Échap ou clic hors menu, et verrouille le scroll de la page.
- Les préférences thème et raccourcis sont dans IndexedDB. Les raccourcis sont
  isolés par clé utilisateur (`pref:mobile-shortcuts:<userId>`), mais ne sont
  pas encore synchronisés entre appareils.
- `GET /api/deliveries/capacity` expose capacité et trajets sortants de la
  session locale; `POST /api/deliveries/outbound` crée actuellement le premier
  trajet Home. Mappy affiche seulement ce trajet sortant.
- Le routage actuel repose sur `history.pushState` dans `HomePage`; un vrai
  routeur et des layouts public/privé sont requis avant la Beta 1.

## SSR et production

- Vite doit produire `dist/client` et `dist/server` ; Express sert le rendu
  public et hydrate ensuite React.
- Routes indexables : `/`, pages produit/légales, liste de branches publiques,
  branche publique et éventuellement profil explicitement public.
- Routes privées : `noindex, nofollow`, absentes du sitemap.
- Canonical, Open Graph, statuts 200/301/403/404 réels, robots, sitemap et
  JSON-LD seulement pour un contenu réellement rendu.
- Le passage SQLite → PostgreSQL, l'hébergement, les sauvegardes et la
  supervision doivent être tranchés dans la phase fondation Beta 1.

## Qualité attendue

- Validation stricte des entrées et erreurs API structurées.
- Pagination par curseur, limites bornées et requêtes indexées.
- Horloge injectable dans les moteurs et règles d'accès pour des tests
  déterministes.
- Tests de concurrence pour capacité, attribution de slots et bitmap.
- Accessibilité clavier/lecteur d'écran, responsive mobile réel et respect des
  safe areas.
- Aucun secret versionné ; configuration par environnement.

## Ports de développement

- Client Vite : 5173, avec HTTPS local pour la géolocalisation réseau.
- API Express : 3001.
