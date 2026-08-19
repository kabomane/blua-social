# AI Docs — Index

Mémoire de travail consolidée du projet Blue Atmosphere.

Dernière consolidation : 2026-08-19.

## Fichiers

- [01-synthese-produit.md](01-synthese-produit.md) — règles produit actives et
  périmètre fonctionnel issu de `docs/*.txt` ;
- [02-architecture-technique.md](02-architecture-technique.md) — architecture,
  invariants et écarts techniques connus ;
- [03-etat-du-projet.md](03-etat-du-projet.md) — inventaire factuel de ce qui
  fonctionne réellement aujourd'hui ;
- [04-roadmap-beta-1.md](04-roadmap-beta-1.md) — chemin ordonné et critères
  d'acceptation pour atteindre la Beta 1.

## Ordre d'autorité des documents

1. Les fichiers `docs/*.txt` sont la source de vérité produit et technique.
2. Les addendums les plus récents remplacent les formulations antérieures :
   `delivery-algorithm-v3.txt`, `home_posts_via_hub.txt` et les sections V3 des
   autres documents prévalent notamment sur tout fan-out de deliveries.
3. Le code et les migrations décrivent l'état réellement implémenté, pas la
   cible produit.
4. Les présents AI docs synthétisent les sources ; ils ne créent pas de règle
   produit nouvelle.

## Décision utilisateur postérieure aux fichiers source

- **2026-08-19 — graphe social** : un follow A → B donne à A les futures notes
  Home de B. Le cui-to-cui reste verrouillé. Deux follows réciproques donnent
  chacun accès à la Home de l'autre et dérivent une amitié qui débloque le
  cui-to-cui. Cette décision prévaut sur les paragraphes plus anciens de
  `docs/*.txt` limitant la Home aux seuls amis réciproques.
- **2026-08-19 — capacité** : chaque compte possède 5 slots BIRD et 5 slots
  POST. Un slot est bloqué seulement jusqu'à l'arrivée du premier trajet
  physique : auteur → hub Home, auteur → branche, ou auteur → destinataire
  Direct. Une redistribution V3 ne bloque jamais de slot supplémentaire.
- **2026-08-19 — profil** : une photo de profil est retenue pour la Beta locale;
  elle est stockée dans le bucket local et limitée aux images JPEG/PNG/WebP.

## Règles de maintenance

1. Mettre à jour `03-etat-du-projet.md` après chaque changement fonctionnel.
2. Mettre à jour les cases de `04-roadmap-beta-1.md` seulement après test du
   critère d'acceptation correspondant.
3. Consigner dans `02-architecture-technique.md` toute décision technique non
   couverte par les sources.
4. Ne jamais masquer une contradiction : l'inscrire comme dette ou décision à
   prendre.
5. Tester toute fonctionnalité contre les principes du document produit §53 :
   lenteur utile, destination réelle, rareté, absence de métriques de
   popularité, anti-spam et fonctionnement explicable.
