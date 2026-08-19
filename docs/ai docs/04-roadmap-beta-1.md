# Roadmap précise — Beta 1

Dernière consolidation : 2026-08-19.

Cette roadmap couvre toutes les exigences explicites et actives de `docs/*.txt`.
Elle distingue les fonctions nécessaires à la Beta 1 des idées laissées
ouvertes ou explicitement reportées dans les documents.

## Définition de la Beta 1

La Beta 1 est une version testable par plusieurs utilisateurs réels où la
boucle suivante fonctionne de bout en bout avec des données persistantes :

inscription → découverte d'une branche → création d'un lien social → envoi par
pigeon ou lettre → attente réelle → arrivée → lecture → réponse → notification
→ retour dans l'application.

La Beta 1 est atteinte seulement si :

- [ ] aucune donnée de démonstration n'est nécessaire au parcours principal ;
- [ ] toutes les API privées sont authentifiées et autorisées côté serveur ;
- [ ] BIRD et POST sont déterministes, testés et persistés historiquement ;
- [ ] Home et Branch utilisent réellement la diffusion V3 sans fan-out ;
- [ ] Direct, réponses et transmissions respectent l'arrivée et la capacité ;
- [ ] les écrans desktop et mobile couvrent le parcours complet ;
- [ ] blocage, signalement et modération minimale protègent les testeurs ;
- [ ] les portes publiques respectent les règles SEO et de confidentialité ;
- [ ] sauvegardes, logs, supervision, migrations et restauration sont testés ;
- [ ] accessibilité, sécurité, performance et tests de concurrence passent ;
- [ ] les trois hypothèses produit du document principal §89 sont mesurables.

## Tableau de progression

| Phase | Statut au 2026-08-19 | Blocage principal |
|---|---|---|
| 0. Décisions produit | À faire | règles Beta 1 encore ouvertes |
| 1. Socle et schéma | Partiel | historique des follows, tests et schéma cible |
| 2. Auth/localisation | Partiel | localisation 24 h/UI bloquante faite, aucune session serveur |
| 3. Moteurs | Partiel | Haversine/FNV/BIRD premier trajet faits; POST complet absent |
| 4. Graphe social | Non commencé | router vide |
| 5. Branches | Non commencé | router vide |
| 6. Envoi/capacité | Partiel | Home premier trajet + quota 5/5, autres destinations absentes |
| 7. Diffusion V3 | Schéma seulement | aucun service bitmap/access |
| 8. Lectures | Maquette UI | données de démonstration |
| 9. Arrivées/suivi | Partiel | suivi sortant Home/Mappy fait; arrivées et notifications API absentes |
| 10. Application complète | Partiel | navigation faite, pages/routes factices |
| 11. SSR/SEO | Non commencé | architecture SSR absente |
| 12. Sécurité/robustesse | Non commencé | auth et API incomplètes |
| 13. Production | Non commencé | PostgreSQL/hébergement non décidés |
| 14. Validation Beta | Non commencé | dépend des phases précédentes |

## Ordre de réalisation

Les phases sont ordonnées par dépendances. Une phase peut commencer en
parallèle uniquement si elle ne dépend pas d'un modèle ou contrat encore
instable. Chaque case doit correspondre à du code testé, pas seulement à une
interface ou une table.

---

## Phase 0 — Figer les décisions produit Beta 1

Objectif : supprimer les ambiguïtés qui modifieraient le schéma ou les droits.

### Capacité et transport

- [ ] Fixer le nombre initial de pigeons et de timbres.
- [ ] Fixer le nombre maximal d'envois simultanés par méthode.
- [ ] Définir récupération/réassort : uniquement retour temporel, recharge
  périodique ou stock consommable pour les timbres.
- [ ] Fixer les bornes mondiales `settled_at` versionnées pour BIRD et POST.
- [ ] Confirmer le délai minimal local et le comportement à distance quasi
  nulle.

### Graphe social et messages

- [x] Fixer la règle sociale : follow unilatéral pour la Home ; deux follows
  réciproques dérivent une amitié et débloquent le cui-to-cui.
- [ ] Décider si le follow est toujours immédiat ou soumis à acceptation pour
  certains comptes privés.
- [ ] Définir réponse publique dans une branche, réponse Home et réponse privée.
- [ ] Définir précisément la transmission : vers Home, branche ou personne,
  coût et relation au message source.
- [ ] Fixer la taille maximale du texte et le traitement des liens.
- [ ] Décider annulation, suppression et édition après départ. La proposition
  documentée est : brouillon modifiable, contenu figé et non rappelable après
  envoi.
- [ ] Fixer la durée de conservation des messages et timelines détaillées.

### Branches

- [ ] Fixer le quota de branches publiques possédées.
- [ ] Décider si les branches privées entrent en Beta 1 et dans quel quota.
- [ ] Décider si une branche peut être consultée sans adhésion.
- [ ] Définir les permissions OWNER/MODERATOR/MEMBER.
- [ ] Fixer conditions d'archivage d'une branche vide/inactive.
- [ ] Définir transfert volontaire et transfert automatique de propriété.
- [ ] Décider si une branche se crée uniquement à la position actuelle.

### Identité, confidentialité et contenu public

- [ ] Confirmer Blue Atmosphere comme nom Beta 1 et fixer la terminologie UI.
- [ ] Décider si un profil peut être explicitement public et indexable.
- [ ] Définir l'effet d'un blocage dans une branche publique.
- [ ] Fixer politique de noms/pseudos et procédure de signalement.
- [ ] Décider si intérêts d'onboarding, photos, pièces jointes, mentions,
  recherche et contenu éphémère sont dans ou hors Beta 1.

### Critère de sortie

- [ ] Un court document de décisions remplit toutes les cases ci-dessus et
  chaque décision est reportée dans la synthèse, le schéma cible et les tests.

---

## Phase 1 — Socle d'ingénierie et schéma cible

### Documentation et architecture

- [ ] Aligner README, commentaires et noms de fichiers sur les documents
  actuels (`send methodes`, `b-atmos sqlite`, V3, follows unilatéraux).
- [ ] Supprimer toute règle résiduelle de deliveries Home individuelles.
- [ ] Écrire les contrats TypeScript communs pour User, Branch, Message,
  Delivery, Broadcast, Timeline, Notification et erreurs API.
- [ ] Choisir le vrai routeur React et séparer layouts public, auth et privé.
- [ ] Rendre l'horloge injectable dans les services temporels.

### Base de données

- [ ] Écrire un schéma Beta 1 consolidé après la phase 0.
- [ ] Conserver `follows` comme relation active orientée et ajouter son
  historique (`follow_periods` ou équivalent) pour l'audience V3 Home.
- [ ] Décider du rôle de `friendships`/`friendship_periods` : cache dérivé de la
  réciprocité ou suppression, sans double source de vérité.
- [ ] Ajouter capacité BIRD et POST avec modèle historique/auditable.
- [ ] Ajouter sessions, blocages, signalements, règles/sanctions de branche,
  historique de propriété, intérêts et signets selon périmètre.
- [ ] Ajouter contraintes CHECK sur types, rôles, méthodes et cohérence des
  destinataires.
- [ ] Ajouter politiques de suppression et cascades explicites.
- [ ] Auditer tous les indexes pour feeds paginés, droits historiques,
  notifications, purges et géographie.
- [ ] Écrire seeds de développement réalistes sans données privées.

### Qualité

- [ ] Installer un framework de tests serveur/client et un runner E2E.
- [ ] Ajouter format/lint/typecheck/test/build à une CI.
- [ ] Tester migrations depuis base vide et depuis chaque version historique.
- [ ] Ajouter validation de configuration et environnements test/dev/prod.

### Critère de sortie

- [ ] Une base neuve et une copie d'une base historique migrent vers le même
  schéma ; CI verte ; aucun contrat métier critique n'est encore ambigu.

---

## Phase 2 — Authentification, sessions et localisation

### Backend

- [ ] Créer sessions serveur opaques avec cookie Secure, HttpOnly, SameSite,
  expiration, rotation et révocation.
- [ ] Ajouter `GET /api/session`, logout serveur et révocation de toutes les
  sessions d'un compte.
- [ ] Protéger toutes les routes privées par middleware.
- [ ] Ajouter limitation de tentatives login/register/check disponibilité.
- [ ] Prévenir énumération de comptes et normaliser email/pseudo.
- [ ] Ajouter protection CSRF adaptée au modèle de session.
- [ ] Ajouter récupération de compte ou documenter son exclusion Beta 1.
- [ ] Créer `POST /api/users/me/location` : mise à jour uniquement lorsque
  nécessaire, horodatage serveur, validation GPS, reverse geocoding hors
  transaction.
- [ ] Ne jamais renvoyer latitude/longitude dans un DTO public.

### Frontend

- [ ] Remplacer l'objet session IndexedDB par le bootstrap serveur.
- [ ] Gérer expiration, erreurs réseau, reconnexion et logout multi-onglets.
- [ ] Demander la position au premier plan seulement si l'API indique une
  ancienneté d'au moins 24 h.
- [ ] Terminer onboarding : intérêts retenus, branches proches et premier envoi.

### Tests

- [ ] Tests scrypt, timing, cookies, expiration, CSRF, brute force et fuite de
  coordonnées.
- [ ] Tests refus/absence GPS et mise à jour 24 h sans tracking arrière-plan.

### Critère de sortie

- [ ] Deux navigateurs connectés à deux comptes ne peuvent accéder qu'à leurs
  propres données privées ; une session révoquée cesse immédiatement d'agir.

---

## Phase 3 — Moteurs de livraison déterministes

### Primitives

- [ ] Implémenter Haversine avec validation et cas antipodes/coordonnées égales.
- [ ] Implémenter FNV-1a et `seededRandom` stable dans `[0,1)`.
- [ ] Tester reproductibilité entre processus et absence de `Math.random()`.
- [ ] Implémenter recherche du hub/gateway le plus proche et suppression des
  doublons de route.

### BIRD

- [ ] Implémenter vitesse triangulaire avec seeds
  `messageId:targetId:speed:1|2`, arrondie à 0,1 km/h.
- [ ] Implémenter distance effective, heures de vol, repos et heure d'arrivée.
- [ ] Sauvegarder vitesse, distances, heures et timeline historiques.
- [ ] Calculer statut et position visuelle sans modifier le voyage.

### POST

- [ ] Implémenter collecte et trajets locaux.
- [ ] Implémenter traitement hub/gateway, horaires locaux, samedi et dimanche.
- [ ] Décider/implémenter jours fériés régionaux.
- [ ] Implémenter sélection GROUND/FAST_GROUND/PLANE et fréquences de départ.
- [ ] Implémenter distribution finale, route, timeline, statut et position.
- [ ] Tester changements de fuseau, DST et passage de date.

### Tests de référence

- [ ] Cas Lille → Londres, Montréal et Tokyo pour BIRD.
- [ ] Cas postaux même région, inter-région, hub déjà gateway, week-end et
  fermeture nocturne.
- [ ] Snapshots de timelines et tests de non-régression des règles versionnées.

### Critère de sortie

- [ ] Même entrée = résultat byte-for-byte identique ; les exemples documentés
  restent dans leurs ordres de grandeur ; aucun ancien trajet ne change après
  modification d'une règle globale.

---

## Phase 4 — Follows, amitié dérivée et blocage

### Backend

- [ ] Endpoints recherche d'utilisateurs sans exposer leurs coordonnées.
- [ ] Endpoints follow/unfollow et lecture abonnements/abonnés sans compteur
  public de popularité.
- [ ] Ouvrir/fermer atomiquement une période de follow orientée.
- [ ] Dériver l'amitié de deux follows actifs, sans écriture sociale séparée.
- [ ] Attribution idempotente et jamais réutilisée des `home_recipient_slots`.
- [ ] Endpoint liste d'amis paginée et demandes reçues/envoyées.
- [ ] Blocage : empêcher nouvelle demande, Direct et interactions définies en
  phase 0 ; fermer/masquer les relations selon la politique retenue.
- [ ] Garantir qu'un nouveau follow ne donne aucun accès rétroactif aux anciens
  broadcasts Home.

### Frontend

- [ ] Explorer/rechercher des personnes, suivre/ne plus suivre et afficher si
  la relation réciproque a débloqué le cui-to-cui.
- [ ] Profil avec actions ami, retirer, bloquer et signaler.
- [ ] États vide, chargement, erreur, refus et compte bloqué.

### Tests

- [ ] Courses sur follow/unfollow réciproques et unicité des périodes/slots.
- [ ] Matrice : A suit B seulement, B suit A seulement, réciproque, aucun follow
  et blocage, pour Home et Direct.

### Critère de sortie

- [ ] A peut suivre B et recevoir ses futures notes sans accès Direct ; après le
  follow retour de B, les deux Homes sont alimentées et le Direct est autorisé.

---

## Phase 5 — Branches, découverte et gouvernance

### Backend

- [ ] CRUD de branche selon règles Beta 1, slug stable et coordonnées immuables.
- [ ] Quota de propriété vérifié en transaction.
- [ ] Rejoindre/quitter avec `branch_memberships` et périodes historiques.
- [ ] Attribution atomique d'un slot stable, jamais réutilisé.
- [ ] Rôles et permissions OWNER/MODERATOR/MEMBER.
- [ ] Transfert de propriété avec acceptation, historique et libération du quota.
- [ ] Archivage/restauration ; suppression seulement selon politique décidée.
- [ ] Exploration paginée par proximité, activité réelle, amis présents et
  intérêts, avec score simple et explicable, sans trending global.
- [ ] Branches privées si incluses : invitation, visibilité et SSR interdit.

### Modération minimale

- [ ] Règles de branche visibles.
- [ ] Signalement de contenu/membre.
- [ ] Suppression logique d'un message par rôle autorisé.
- [ ] Suspension, ban, verrouillage temporaire et nomination de modérateur.
- [ ] Journal d'audit et recours/support minimal.

### Frontend

- [ ] Liste/carte légère des branches proches et résultats explicables.
- [ ] Détail branche, membres/règles, rejoindre/quitter et composer.
- [ ] Création, gestion, transfert, archive et modération selon permissions.

### Critère de sortie

- [ ] Le scénario produit §77 fonctionne entièrement et un nouveau membre ne
  voit jamais les broadcasts antérieurs à son adhésion.

---

## Phase 6 — Capacité et transaction d'envoi

### Services communs

- [ ] Calculer tous les trajets hors transaction avec un message ID définitif.
- [ ] Revalider auteur, destination, follow/mutualité/membership, blocage et capacité dans
  une transaction courte.
- [ ] Persister message, action de capacité, delivery physique et références
  historiques de manière atomique.
- [ ] Idempotency key sur les envois pour éviter les doublons réseau.
- [ ] BIRD et POST ont des compteurs/slots séparés et des règles versionnées.
- [ ] `busy_until` correspond à l'arrivée du premier trajet physique.

### Types d'envoi

- [ ] Home : une delivery auteur → hub proche, aucun destinataire individuel.
- [ ] Branch : une delivery auteur → coordonnées immuables de la branche.
- [ ] Direct : une delivery auteur → dernière position connue du destinataire,
  et copie immédiate de l'arrivée dans `messages.available_at`.
- [ ] Réponse : destination et visibilité dérivées du contexte décidé.
- [ ] Transmission : nouveau message/action/trajet relié à la source.

### API et UI

- [ ] `POST /api/messages` avec DTO par type et méthode.
- [ ] Endpoint capacité actuelle et trajets sortants.
- [ ] Composer réel, erreurs de capacité, confirmation de destination et état
  envoyé non modifiable.
- [ ] Compteurs UI provenant uniquement du serveur.

### Tests

- [ ] Concurrence : N envois simultanés ne dépassent jamais la capacité.
- [ ] Rollback complet sur erreur et idempotence sur retry.
- [ ] Aucun appel réseau ou calcul long sous verrou DB.

### Critère de sortie

- [ ] Chaque type d'envoi produit exactement une ligne de contenu et le nombre
  attendu de trajets physiques, sans capacité négative ni double envoi.

---

## Phase 7 — Diffusion V3 et résolution d'accès

### Création des broadcasts

- [ ] Matérialiser de façon idempotente le broadcast lorsque la delivery vers
  hub/branche est arrivée ; pas besoin d'un worker exact à la seconde.
- [ ] Home : origine HUB, abonnés dont le follow vers l'auteur existait à
  `distribution_started_at`.
- [ ] Branch : origine BRANCH, membres éligibles à l'arrivée branche.
- [ ] Calculer `settled_at` depuis la constante versionnée par méthode.

### Bitmap

- [ ] Résoudre le slot stable Home ou Branch.
- [ ] Lire bit/chunk et créer un BLOB de 64 octets si absent.
- [ ] Poser un bit atomiquement avec revalidation de l'éligibilité.
- [ ] Prouver qu'une mise à jour concurrente ne perd aucun autre bit.
- [ ] Ne jamais remettre un bit à zéro et ne pas l'utiliser comme analytics.

### `resolveAccess`

- [ ] Vérifier la période de follow orientée (Home) ou de membership (Branch)
  avant tout calcul.
- [ ] Autoriser si settled ou bit déjà reçu.
- [ ] Sinon calculer à la lecture vers la dernière position connue avec seed
  message + utilisateur.
- [ ] Refuser sans fuite de contenu si l'arrivée n'est pas atteinte.
- [ ] Une réception obtenue reste visible après déplacement.

### Purges

- [ ] Purge opportuniste/périodique des chunks settled.
- [ ] Purge des deliveries Direct arrivées en conservant `available_at`.
- [ ] Conservation des périodes et traces compactes nécessaires aux droits.

### Critère de sortie

- [ ] Test à grande audience prouvant 1 message + 1 delivery initiale + 1
  broadcast + chunks temporaires, jamais N deliveries ni N contenus.

---

## Phase 8 — Lectures, conversations et découverte Home

### API

- [ ] Home paginée par curseur, limite 20 par défaut et maximum borné.
- [ ] Mélanger messages des comptes suivis autorisés et échos de branches sans révéler de
  contenu non arrivé.
- [ ] Score d'échos simple : proximité, activité réelle, amis présents,
  récence/intérêts retenus ; fournir une explication UI.
- [ ] Feed de branche paginé passant par `resolveAccess`.
- [ ] Liste et conversation Direct filtrées par destinataire + `available_at`.
- [ ] Threads de réponses dans leur contexte d'autorisation.
- [ ] Messages envoyés/en vol visibles uniquement par l'expéditeur.
- [ ] Vrais codes 403/404 sans révéler l'existence d'un contenu privé.

### UI

- [ ] Remplacer `DEMO_FEED`, `DEMO_BRANCHES` et compteurs en mémoire par API.
- [ ] États chargement, vide, pagination, retry et hors-ligne léger.
- [ ] Ne jamais annoncer un pigeon entrant ni une ETA entrante.
- [ ] Afficher âge, distance arrondie et origine publique sans coordonnées.
- [ ] Branches accessibles depuis les échos et retour de navigation cohérent.

### Critère de sortie

- [ ] Une requête manipulée côté client ne peut récupérer aucun message avant
  arrivée ; le feed reste utilisable sans ami grâce aux branches/échos.

---

## Phase 9 — Arrivées, notifications et suivi sortant

### Backend

- [ ] Journal d'arrivées paginé et `read_at`.
- [ ] Notifications idempotentes de message/réponse arrivée, sans contenu en
  vol ni double notification.
- [ ] Endpoint de trajets sortants avec timeline/status dérivés de l'heure.
- [ ] Politique de notification navigateur/push décidée ; si push retenu,
  permissions, abonnements et révocation.

### Frontend

- [ ] Page Arrivées, badge non lu et marquage lu.
- [ ] Page des envois sortants : méthode, destination publique, état et étapes.
- [ ] Intégrer une version production du module mappy pour la visualisation des
  trajets sortants, sans position utilisateur tierce exacte.
- [ ] Animations sobres d'envoi/réception respectant reduced-motion.

### Critère de sortie

- [ ] Le destinataire découvre l'existence et le contenu seulement à l'arrivée,
  tandis que l'expéditeur peut suivre son propre trajet sans fuite privée.

---

## Phase 10 — Application complète et navigation

### Routage et pages

- [ ] Installer/configurer le routeur avec routes protégées et deep links.
- [ ] Home, Branches, détail branche, Cui-to-cui, conversation, Arrivées,
  suivi, Profil, Signets et Paramètres fonctionnels.
- [ ] Signets : sauvegarder/retirer des notes autorisées, compteur dynamique,
  liste paginée ; définir comportement si contenu supprimé ou accès perdu.
- [ ] Profil : identité publique retenue, ville approximative, amis et actions
  sans métriques de popularité.
- [ ] Paramètres : thème, raccourcis, confidentialité, blocages, sessions,
  notifications et compte.

### Responsive et accessibilité

- [ ] Conserver sidebar desktop et barre mobile à quatre actions.
- [ ] Menu mobile complet au bouton/swipes, focus trap, Escape, restauration du
  focus et scroll lock sans saut de layout.
- [ ] Navigation clavier, focus visible, labels, `aria-current`, dialogues et
  annonces d'erreur testés au lecteur d'écran.
- [ ] Safe areas, tailles tactiles, anti-zoom iOS et reduced-motion.
- [ ] Tester téléphones étroits, tablette, 1100 px et grands écrans.

### Critère de sortie

- [ ] Tous les parcours Beta 1 sont réalisables au clavier et sur téléphone
  réel, sans route factice, `href="#"` ni donnée de démonstration.

---

## Phase 11 — Pages publiques, SSR et SEO

### Rendu public

- [ ] Entrées React client/server et build Vite double sortie.
- [ ] `/`, `/about`, `/how-it-works`, `/branches`, `/legal/*`.
- [ ] `/branches/:slug` SSR uniquement pour branche publique existante.
- [ ] `/u/:username` seulement si profils publics confirmés et opt-in.
- [ ] Fonctions de visibilité partagées entre API et SSR.
- [ ] Aucun message non arrivé, Direct, Home privée ou coordonnées exactes dans
  HTML, payload d'hydratation ou cache.

### SEO technique

- [ ] Title/description/canonical/Open Graph par page.
- [ ] Statuts 200, 301, 403/404 réels ; jamais SPA 200 sur URL inexistante.
- [ ] `robots.txt` et sitemap dynamique limité aux URLs indexables.
- [ ] `lastmod` modifié seulement par contenu public.
- [ ] `noindex, nofollow` sur routes privées.
- [ ] JSON-LD Organization/ProfilePage/DiscussionForumPosting uniquement si le
  contenu correspondant est réellement public et rendu.
- [ ] Vérification Search Console avant ouverture publique.

### Critère de sortie

- [ ] Un crawl anonyme ne trouve aucune donnée privée ou en vol et reçoit HTML,
  canonical, statuts et sitemap cohérents sans exécuter JavaScript.

---

## Phase 12 — Sécurité, confidentialité et robustesse

### Protection applicative

- [ ] Validation/sanitation de toutes les entrées et taille des payloads.
- [ ] Rate limits par IP, compte et action sensible.
- [ ] Anti-bot minimal à l'inscription sans bloquer abusivement les testeurs.
- [ ] En-têtes de sécurité, CSP, HTTPS, cookies, CORS et proxy de confiance.
- [ ] Prévention XSS dans messages, liens, SSR et JSON-LD.
- [ ] Matrice d'autorisation automatisée pour toutes les routes.
- [ ] Export/suppression de compte et politique de conservation minimale.

### Performance et concurrence

- [ ] EXPLAIN/bench des feeds, recherche géographique et purges.
- [ ] Tests de charge sur lecture V3 et contention bitmap.
- [ ] Pagination et limites sur toutes les collections.
- [ ] Cache uniquement après preuve, sans contourner droits ou heure d'arrivée.
- [ ] Gestion propre des erreurs Nominatim et dépendances externes.

### Critère de sortie

- [ ] Revue sécurité sans fuite critique, charge Beta supportée et tests de
  concurrence verts sur capacité, slots et bitmaps.

---

## Phase 13 — PostgreSQL, déploiement et exploitation

### Décision et migration production

- [ ] Confirmer PostgreSQL pour production et rôle éventuel de PostGIS.
- [ ] Porter migrations, transactions, contraintes, BLOB/bytea et set-bit
  atomique avec tests de parité SQLite/PostgreSQL.
- [ ] Écrire import/export et rollback de migration.
- [ ] Définir stratégie d'environnements et données de staging anonymisées.

### Exploitation

- [ ] Hébergement client/SSR/API/DB et variables secrètes.
- [ ] Sauvegardes automatiques chiffrées et restauration testée.
- [ ] Logs structurés sans coordonnées/contenus sensibles.
- [ ] Monitoring : erreurs, latence, saturation DB, échecs de jobs/purges.
- [ ] Health/readiness checks et arrêt gracieux.
- [ ] Procédure incident, rollback applicatif et migration compatible.
- [ ] Analytics produit internes sans likes/compteurs publics ni utilisation du
  bitmap comme suivi de lecture.

### Critère de sortie

- [ ] Staging reproductible depuis zéro, sauvegarde restaurée avec succès,
  migration/rollback répétés et alertes vérifiées.

---

## Phase 14 — Validation Beta 1

### Tests finaux

- [ ] E2E multi-utilisateur des scénarios produit §75–78.
- [ ] E2E Home/Branch/Direct pour BIRD et POST avec horloge contrôlée.
- [ ] E2E nouvel abonné/nouveau membre exclu des anciens broadcasts.
- [ ] E2E déplacement après réception : le message ne disparaît pas.
- [ ] E2E purge chunks/delivery Direct sans perte d'accès.
- [ ] Audit accessibilité, responsive, sécurité et confidentialité.
- [ ] Tests de restauration, montée de version et compatibilité anciens trajets.

### Préparation testeurs

- [ ] Conditions d'utilisation, confidentialité, règles communautaires et canal
  de support/signalement.
- [ ] Jeu de branches de départ pour résoudre le cold start.
- [ ] Invitation d'un groupe contrôlé de quelques dizaines de personnes.
- [ ] Instrumenter uniquement les métriques produit utiles : activation,
  premier envoi, arrivée, réponse, retour, branches actives et frustration de
  capacité.
- [ ] Plan de collecte qualitative sur attente, branches et rareté.

### Go / No-Go

- [ ] Aucun bug bloquant ou faille critique ouverte.
- [ ] Les parcours principaux ont un taux de succès acceptable sur mobile et
  desktop.
- [ ] Les données permettent de tester les trois hypothèses du §89.
- [ ] Une procédure claire permet de suspendre la Beta et restaurer les données.

---

## Matrice de couverture des documents

| Source | Couverture roadmap |
|---|---|
| `blue atmosphere .txt` | phases 0, 4–10, 12, 14 |
| `send methodes.txt` | phases 3, 6, 9 |
| `update pigeon vitesse.txt` | phases 3, 6, 7 |
| `home_posts_via_hub.txt` | phases 6–8 |
| `delivery-algorithm-v3.txt` | phases 1, 4–8, 12 |
| `b-atmos sqlite.txt` | phases 1, 6–8, 12–13 |
| `seo_react_vite_express.txt` | phases 11 et 13 |

## Fonctions citées mais non automatiquement incluses dans la Beta 1

Ces sujets figurent dans les documents comme futurs, optionnels ou ouverts. Ils
restent dans la phase 0 jusqu'à décision explicite :

- collection de nombreuses espèces d'oiseaux et progression ;
- carte mondiale 3D ou univers visuel avancé ;
- branches privées avancées et modération communautaire complexe ;
- photos, vidéos, pièces jointes et mentions ;
- recherche plein texte globale ;
- statistiques publiques de voyage ou popularité ;
- contenu éphémère ;
- monétisation ;
- recommandations opaques/IA ;
- Redis, queues et workers de livraison à grande échelle.

Le suivi cartographique des **envois sortants**, la poste complète, la diffusion
V3, la modération minimale et le SEO public sont en revanche inclus, car ils
sont devenus des règles ou références explicites dans les documents actuels.
