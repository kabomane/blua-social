# Mappy · Messagerie lente

Application React/Vite qui intègre le moteur de globe Mappy dans les fiches de suivi de la messagerie.

## Ouvrir

Double-cliquer sur `ouvrir-mappy.cmd`.

## Carte intégrée

- globe et frontières Natural Earth chargés localement ;
- caméra automatiquement cadrée sur le plus petit cap couvrant tout le trajet ;
- zoom volontairement borné par le cadrage, sans contrôles utilisateur ;
- interactions souris et tactiles désactivées sur le globe ;
- tracés pointillés, points, anneaux, labels et distance issus du style de l’artifact original.
- géométrie Natural Earth 1:110m préchargée pour accélérer le premier rendu dans les cartes.

L’artifact d’origine et l’ancienne version autonome sont conservés dans `reference/` et `legacy/`.
