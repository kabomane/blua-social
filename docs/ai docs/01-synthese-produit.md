# Synthèse produit — Blue Atmosphere

Dernière consolidation : 2026-08-19. Source de vérité : `docs/*.txt`.

## Promesse

Blue Atmosphere est un réseau social géographique et asynchrone où chaque
message doit voyager. Le contenu existe dès l'envoi, mais personne d'autre que
l'expéditeur ne peut le voir avant son arrivée autorisée par le backend.

La boucle à valider en Beta 1 est : découvrir → participer → envoyer → attendre
→ recevoir → répondre → créer un lien → revenir.

## Espaces et graphe social

| Espace | Audience | Transport |
|---|---|---|
| Home | abonnés unilatéraux éligibles au début de la diffusion + échos de branches | auteur → hub, puis broadcast V3 |
| Branches | membres éligibles lorsque le message atteint la branche | auteur → coordonnées immuables de la branche, puis broadcast V3 |
| Cui-to-cui | un ami réciproque unique | delivery directe temporaire |

- Un follow est **unilatéral** : si A suit B, A reçoit les notes Home de B,
  même si B ne suit pas A.
- L'amitié est dérivée de deux follows actifs réciproques. Elle débloque le
  cui-to-cui ; un follow simple ne donne jamais accès aux messages privés.
- Un unfollow retire la réception des futures notes de la personne qui n'est
  plus suivie. Si la réciprocité disparaît, le cui-to-cui n'accepte plus de
  nouvel envoi, sans supprimer les messages Direct déjà arrivés.
- Aucun like, compteur public de popularité, trending opaque ou compte
  influenceur.
- Répondre et transmettre sont des actions de communication qui consomment une
  capacité. Une transmission crée un nouveau trajet ; elle n'est jamais un
  multicast gratuit.
- Les messages entrants et leur contenu restent invisibles avant l'arrivée.
  Les trajets sortants sont consultables par leur expéditeur.

## Livraison V3

Un message est stocké une seule fois. Une delivery représente seulement un
trajet physique unique : auteur → utilisateur, auteur → branche, ou auteur →
hub Home.

Home et Branch ne créent aucune delivery par destinataire. Après l'arrivée au
hub ou à la branche, un `broadcast` est créé. Le backend :

1. vérifie l'éligibilité historique à `distribution_started_at` ;
2. autorise immédiatement si le broadcast est settled ou si le bit est posé ;
3. sinon calcule l'arrivée virtuelle vers la dernière position connue ;
4. pose atomiquement le bit reçu dans un chunk de 512 bits si l'heure est
   atteinte ;
5. ne renvoie jamais le contenu avant cette autorisation.

Les slots Home et Branch sont stables et jamais réutilisés. Pour Home,
l'éligibilité historique dépend du follow abonné → auteur existant au début de
la diffusion, pas d'une amitié réciproque. Après `settled_at`, les chunks
temporaires sont purgés, mais les périodes historiques restent.

Un Direct conserve son droit de lecture dans `messages.available_at`, même
après purge opportuniste de sa delivery détaillée.

## Moyens de transport

### Pigeon / BIRD

- Haversine × 1,10 ;
- vitesse déterministe triangulaire entre 40 et 60 km/h, centrée sur 50 ;
- seeds incluant message, destination et étape ;
- 12 h de vol puis 12 h de repos, sans repos final inutile ;
- vitesse et timeline sauvegardées pour tout trajet physique fixe.

### Lettre / POST

- 40 hubs, 5 régions, 10 gateways ;
- collecte, trajet local, traitement, horaires, samedi ralenti, dimanche fermé,
  départs périodiques, transport terrestre/rapide/aérien et distribution finale ;
- aucune variation artificielle supplémentaire : la logistique déterministe
  produit déjà les écarts ;
- timeline complète et route sauvegardées.

Chaque compte possède 5 slots pigeon et 5 slots lettre. La ressource de
l'auteur est rendue à l'arrivée du premier trajet physique, pas à la fin du
broadcast.

## Branches

- Position GPS immuable après création ; coordonnées exactes privées.
- Publiques ou privées selon le périmètre finalement retenu pour la Beta 1.
- Adhésion historisée, rôles OWNER/MODERATOR/MEMBER, slots stables.
- Quota de création, transfert de propriété, archivage plutôt que destruction
  d'une communauté active, découverte par proximité/activité/liens explicables.
- Modération minimale nécessaire : règles, signalement, suppression logique,
  suspension/ban et nomination de modérateurs.

## Vie privée et sécurité produit

- Position exacte disponible uniquement côté serveur ; l'UI affiche une ville.
- Localisation initialisée à l'inscription puis redemandée au premier plan au
  plus une fois toutes les 24 h. Aucun suivi GPS d'arrière-plan.
- Blocage, rate limiting, signalement, anti-bot et modération complètent la
  rareté naturelle des moyens d'envoi.
- Pas de pay-to-win sur la capacité de transport.

## Découverte, UX et contenu

- Sans ami, l'utilisateur découvre des branches publiques proches et peut
  accomplir un premier envoi pendant l'onboarding.
- Home paginée : messages des comptes suivis réellement arrivés + échos explicables de
  branches. Pas de scroll frénétique ni contenu en vol révélé.
- Écrans attendus : onboarding, Home, composer, Branches/Explorer, détail de
  branche, Cui-to-cui, conversation/réponses, Arrivées, trajets sortants et
  carte de suivi, Profil, Signets, Paramètres.
- Navigation mobile actuelle : Home, deux raccourcis configurables et bouton
  Paramètres. Le menu est une pile de bulles ouverte uniquement par ce bouton;
  il assombrit la page et verrouille son défilement.

## Portes publiques et SEO

Les routes publiques fixes, branches publiques et éventuellement profils
explicitement publics doivent être rendus côté serveur avec vrais statuts HTTP,
canonical, Open Graph, robots et sitemap. L'API et le SSR partagent exactement
les mêmes fonctions de visibilité. Home, Directs, Arrivées et Paramètres sont
toujours `noindex`.

## Hors cible automatique

Les idées listées comme « plus tard », « optionnelles » ou questions ouvertes
ne deviennent pas automatiquement des exigences Beta 1 : collection étendue
d'oiseaux, carte 3D, vidéos/pièces jointes, recherche plein texte, monétisation,
statistiques publiques, branches privées avancées ou modération communautaire
complexe. Elles nécessitent une décision produit explicite dans la phase 0 de
la roadmap.
