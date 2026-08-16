# AI Docs — Index

Documentation de travail de l'assistant IA pour Blue Atmosphere.
C'est ma mémoire de projet : décisions, synthèses, état d'avancement.

## Fichiers

- [01-synthese-produit.md](01-synthese-produit.md) — règles produit condensées depuis les 4 docs de conception
- [02-architecture-technique.md](02-architecture-technique.md) — stack, structure, décisions techniques et leurs raisons
- [03-etat-du-projet.md](03-etat-du-projet.md) — ce qui est fait, ce qui reste, prochaines étapes

## Règles que je m'impose

1. Les fichiers de conception `docs/*.txt` sont la **source de vérité** — en cas de doute,
   les relire avant de coder ; ne jamais les contredire silencieusement.
2. Tenir `03-etat-du-projet.md` à jour à chaque session de travail.
3. Toute décision technique non couverte par les docs est consignée dans
   `02-architecture-technique.md` avec sa justification.
4. Avant d'ajouter une fonctionnalité, la passer au test de cohérence
   (doc principal §53) : compatible avec la lenteur ? respecte la rareté
   des pigeons ? pas de métriques de popularité ?
