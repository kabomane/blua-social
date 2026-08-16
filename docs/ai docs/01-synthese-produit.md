# Synthèse produit — Blue Atmosphere

Condensé opérationnel des 4 docs de conception. Source de vérité : `docs/*.txt`.

## Concept

Réseau social géographique **asynchrone** : tout message est matérialisé par un
transport (oiseau ou poste) qui voyage réellement. Le destinataire ne voit rien
avant l'arrivée. Positionnement : « Un réseau social où les messages voyagent
vraiment. »

## Les 3 espaces

| Espace | Rôle | Équivalent |
|---|---|---|
| **Home** | publications des abonnements + échos de branches (découverte) | timeline personnelle |
| **Branches** | communautés attachées à une position GPS **immuable** | subreddit + lieu numérique |
| **Cui-to-cui** | conversation privée 1:1 | DM |

## Règles sociales clés

- **Abonnements unilatéraux** : Home reçoit les comptes suivis. Deux
  abonnements réciproques créent une amitié, requise pour le cui-to-cui.
  Pas de likes, de compteurs publics de popularité ou de trending.
- L'interaction principale est **répondre** (coûte un pigeon).
- **Transmission** (repost) : consomme un pigeon, propagation réelle de
  proche en proche — pas de multicast gratuit.
- 1 post Home = 1 action d'envoi : auteur → hub le plus proche, puis une
  livraison distincte du hub vers chaque abonné. Chaque abonné reçoit donc à un
  moment différent ; le pigeon/slot de l'auteur est libéré à son arrivée au hub.
- **Pigeons entrants invisibles** : surprise à l'arrivée, jamais de
  « un message arrive dans 17 min ». Les pigeons **sortants** sont visibles.
- Quota de branches publiques possédées (~3) ; propriété transférable ;
  une branche publique active survit à son créateur.
- Pas de pay-to-win : la monétisation ne touche jamais la capacité pigeon.
- Vie privée : jamais de coordonnées exactes d'utilisateur exposées —
  afficher « Paris », pas une lat/lon.

## Moteur de livraison (send method.txt)

Deux méthodes opposées, toutes deux **déterministes** (seed = messageId) et
calculées **une seule fois à l'envoi** :

### BIRD (rouge-gorge, MVP)
- Trajet direct A→B, ignore hubs/horaires/week-ends, sauf publication Home :
  auteur→hub puis hub→chaque ami (relais immédiat).
- distance effective = Haversine × 1.10.
- Vitesse : **40-60 km/h, distribution triangulaire centrée 50**
  (2 tirages seedés `msgId:speed:1` / `:speed:2`, moyenne × 20 + 40)
  — c'est l'update qui remplace l'ancien 45 km/h ± 8 %.
- 8 h de vol / jour, 16 h de repos (pas de repos final inutile).
- Rapide en local (~6 h Lille→Londres), très lent au long cours
  (~29 j Lille→Tokyo).

### POST
- Infrastructure : **40 hubs, 5 régions, 10 gateways** (données dans le doc).
- Route : hub le plus proche → (gateways si changement de région) → hub
  destination ; doublons adjacents supprimés.
- Collecte 2-6 h, transport local max(d/65, 2 h), traitement hub 5-12 h
  (gateway 8-16 h), horaires 06-22, samedi 08-16 à 50 %, dimanche fermé.
- Transports : GROUND 75 (<500 km), FAST_GROUND 120 (500-1500), PLANE 750
  (>1500 km ou inter-région), avec fréquences de départ (4/6/8/12 h).
- Lente en local (~1-2 j), efficace au long cours (~4-6 j Lille→Tokyo).
- Pas de random artificiel supplémentaire : la logistique EST la variation.

La **timeline complète** est sauvegardée ; l'état courant = timeline + now.

## MVP (V0)

Compte, localisation précise, abonnements, amitié dérivée, pigeons limités,
Home abonnements, branches
publiques géolocalisées, envoi branche, cui-to-cui, délais par distance,
réponses, notifications d'arrivée, exploration simple.
**Hors MVP** : collection d'oiseaux, carte 3D, algos complexes, reposts
sophistiqués, modération avancée.

Hypothèse critique à valider : la boucle
ouvrir → découvrir → envoyer → attendre → recevoir → répondre → revenir
est-elle plaisante ?
