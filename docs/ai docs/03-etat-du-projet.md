# État du projet

Dernière mise à jour : 2026-08-15 (mockups + retours design + mappy)

## Décisions design (retours utilisateur 2026-08-15)

Série Styles :
- Mockup 1 (Ciel clair) : VALIDÉ — light mode.
- Mockup 2 (Vol de nuit) : VALIDÉ — dark mode.
- Mockup 3 (Courrier) : idée bonne, trop agressif — à adoucir si réutilisé.
- Mockup 4 (Néo-brutaliste) : REJETÉ — pas assez réseau social.

Série Compositions :
- Compo A (Carte-first) : REJETÉE.
- Compo B (Perchoir/mail) : REJETÉE (trop boîte mail).
- Compo C (Volière/TweetDeck) : à garder de côté — version TweetDeck prévue plus tard.
- Compo D (Mobile) : REJETÉE.
- Composition retenue : celle des mockups Styles (nav gauche / feed / pigeonnier),
  à retravailler.

Points produit ajoutés par l'utilisateur :
- Pas que des pigeons : aussi des LETTRES (méthode POST de send method.txt),
  en quantité limitée elle aussi. L'UI doit exposer les deux moyens d'envoi.
- Module « mappy » (front-test/mappy/) : référence visuelle POUR LE SUIVI DES
  ENVOIS. App React + d3-geo, planisphère Natural Earth, routes pointillées,
  moteur BIRD/POST conforme à la spec. À garder comme référence.
- Auth : mot de passe minimum 4 caractères, aucune autre contrainte.
- Dark mode : NOIR PROFOND (base #060607 / panneaux #0e0e10 / bordures #232328),
  pas de bleu marine. Le bleu reste uniquement couleur d'accent.

## Auth implémentée (2026-08-15)

- Migration 002 : colonne password_hash (scrypt salt:hash).
- POST /api/auth/register et /api/auth/login (validation 4 chars serveur).
- Position par défaut à l'inscription : Paris (temporaire, en attendant
  l'onboarding géolocalisation).
- Client : AuthPage React (Tailwind v4, @custom-variant dark par classe),
  user stocké en localStorage (ba:user), thème dans ba:theme.
- Pas de vraie session/token pour l'instant — à faire plus tard.
- Inscription en 2 étapes : email+mdp (check email libre) puis @username
  (check dispo live, debounce 400 ms). Pas de champ "confirmer le mdp"
  (retiré à la demande de l'utilisateur). Login = email+mdp.
- Stockage local : IndexedDB "blua-local" (store kv) — session:user,
  pref:theme. Plus de localStorage.

## Home v1 (2026-08-15)

- HomePage.tsx : compo validée (nav gauche / feed / pigeonnier droite),
  light + dark noir profond.
- Compose avec choix destination (Amis/Branche/Cui-to-cui) ET transporteur
  🐦 pigeon / ✉️ lettre (timbres) — deux ressources limitées distinctes.
- Feed + pigeonnier = données de DÉMO en dur, à brancher sur l'API.
- Envoi décrémente pigeons/timbres côté UI seulement (TODO POST /api/messages).

## Design pass 2 (2026-08-15, retours utilisateur)

- PAS D'EMOJI dans l'UI : icônes SVG inline (src/components/icons.tsx,
  style Lucide stroke). Ton "pro, standards réseau social".
- Pigeonnier nommé SUPPRIMÉ : pas de noms de pigeons ("c'est pas un jeu
  vidéo"). À la place : compteurs simples (pigeons / timbres / en route).
- Sidebar gauche sticky plein écran, pilule user collée en bas.
- Responsive : mobile = header sticky (logo + compteurs + thème) et
  TAB BAR fixe en bas (Home, Explorer, Messages, Arrivées, Profil) —
  standard app sociale. Colonnes latérales masquées < lg.

## Design pass 3 (2026-08-15)

- Breakpoint desktop/mobile relevé de 1024px (lg Tailwind par défaut) à
  1100px (--breakpoint-lg custom dans index.css) — en dessous, 3 colonnes
  compressaient trop.
- Colonnes latérales espacées (gap 24→40px desktop), padding vertical
  harmonisé (py-8 partout), pilule user avec pt-8/pb-10 pour ne plus
  toucher les bords.
- Carte "Capacité d'envoi" : label explicatif inutile retiré, ne reste
  que les 3 compteurs (pigeons / timbres / en route).
- Anti-zoom iOS : tous les champs forcés à min. 16px (garde-fou global
  `input,textarea,select{font-size:1rem}` en @layer base + text-[16px]
  explicite sur les champs auth). Cibles tactiles <32px agrandies
  (bouton thème, Répondre/Transmettre, toggle pigeon/lettre, Annuler).
  touch-action:manipulation + tap-highlight transparent partout.
- Post du feed : méta compactée sur UNE ligne ("il y a 2h · 264 km · via
  Paris" au lieu de deux lignes avec "arrivé"). Le mot "arrivé" est
  redondant, retiré.
- LOCALISATION OBLIGATOIRE à l'inscription (nouvelle étape 3 du wizard
  auth, après email+mdp et @username) :
  - client : navigator.geolocation.getCurrentPosition, timezone via
    Intl.DateTimeFormat().resolvedOptions().timeZone ;
  - serveur : lat/lon requis dans /api/auth/register (400 sinon), conservés
    avec la précision fournie par le navigateur pour calculer les trajets ;
    la position exacte n'est jamais affichée dans l'UI ;
  - ville résolue via Nominatim (reverse geocoding, best-effort, jamais
    bloquant si échec) ;
  - testé : refus sans lat/lon, acceptation avec coordonnées conservées et
    ville "Paris" résolue correctement.

## Fait

- [x] Lecture des 4 docs de conception (`docs/*.txt`)
- [x] Client : Vite 8 + React 19 + TS + Tailwind 4 installés et configurés
      (plugin `@tailwindcss/vite`, proxy `/api`, build vérifié)
- [x] Arborescence client : `features/{home, branches, cui-to-cui, pigeons,
      notifications, explore, profile, onboarding}`, `components/`, `lib/`,
      `api/`, `types/` (vides, .gitkeep)
- [x] Serveur : Express 5 + better-sqlite3 + tsx, `src/index.ts` minimal
      avec `GET /api/health` (typecheck OK)
- [x] DB : migration `001_init.sql` fidèle au doc SQLite — 8 tables créées
      dans `server/data/app.db`, WAL vérifié
- [x] Delivery-engine : `rules.ts` (paramètres d'équilibrage complets),
      `birds.ts` (ROBIN 40/50/60), `hubs.ts` (les 40 hubs / 10 gateways
      saisis) + stubs typés `haversine.ts`, `seeded-random.ts`, `bird.ts`,
      `post.ts`
- [x] Stubs de routes par module (users, friendships, branches, messages,
      deliveries, pigeons, notifications)
- [x] Racine : README, .gitignore, scripts (`dev`, `db:migrate`, `build`)

## Pas fait (volontairement — consigne : squelette uniquement)

- [ ] Implémentation des moteurs BIRD / POST (specs complètes dans
      `send method.txt` §46 ; stubs prêts)
- [ ] `seededRandom` (FNV-1a, §11) et `distanceKm` Haversine (§03)
- [ ] Routes API métier + transaction d'envoi atomique (§15 doc SQLite)
- [ ] UI (aucun écran ; App.tsx = placeholder)
- [ ] Auth / sessions (rien dans les docs — à clarifier avec l'utilisateur)
- [ ] Git non initialisé (demande explicite : pas de lien GitHub pour l'instant)

## Prochaines étapes suggérées (ordre conseillé doc §88)

1. Implémenter `seeded-random.ts` + `haversine.ts` (petits, testables)
2. Implémenter `bird.ts` puis `post.ts` avec les exemples des docs comme
   tests (Lille→Londres ~6 h, Lille→Montréal ~16-17 j, Lille→Tokyo ~29 j)
3. Transaction d'envoi + capacité pigeons
4. Routes lecture (Home fan-out on read, branche, cui-to-cui, notifications)
5. Écrans MVP : onboarding, Home, écrire, pigeonnier, branche, explorer

## Questions ouvertes à poser à l'utilisateur

- Nombre initial de pigeons par utilisateur (doc §87 : non tranché ; MVP
  suggère 3-5)
- Auth : simple username (comme le schéma users) ou vrai login ?
- Le nom « Blue Atmosphere » est-il le nom final ? (doc : naming à définir)
