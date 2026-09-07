# Dédoublonnage de mots-clés (SERP similarity)

Outil interne Uni-Médias pour dédoublonner une liste de mots-clés en comparant leurs SERPs Google (approche façon [12pages](https://12pages.io) / [Thot SEO](https://thot-seo.fr/comparateur-de-serps/)).

## Principe

1. On colle une liste de mots-clés (un par ligne).
2. L'outil récupère le top 10 Google de chaque mot-clé via [Serper.dev](https://serper.dev).
3. Il compare chaque paire de mots-clés sur 4 critères : URLs identiques, URLs en commun, similarité des titres, similarité des snippets.
4. Un score composite détermine si deux mots-clés visent la même intention de recherche.
5. Les mots-clés similaires sont regroupés en clusters (algorithme Union-Find, transitif).
6. Pour chaque cluster, on choisit quel mot-clé garder (manuellement, ou automatiquement si des volumes de recherche sont fournis).
7. Export CSV de la liste finale nettoyée.

## Variables d'environnement

- `SERPER_API_KEY` : clé API Serper.dev (même clé que le repo `qbst-tool`, ou une nouvelle si tu préfères séparer les quotas).

## Déploiement (sans installation locale)

Même méthode que les autres outils du groupe :
1. Créer un nouveau repo GitHub, uploader ces fichiers un par un (ou via le bouton "Add file" > "Upload files") en respectant l'arborescence `app/`, `app/api/analyze/`, `lib/`.
2. Importer le repo dans Vercel.
3. Ajouter la variable d'environnement `SERPER_API_KEY` dans les settings Vercel du projet.
4. Déployer.

## Limites actuelles (v1)

- 40 mots-clés max par analyse (coût des appels API).
- Comparaison uniquement basée sur le SERP (pas d'IA sémantique) — approche jugée plus fiable par le brief initial.
- Le choix du mot-clé à garder par groupe est manuel par défaut ; l'import de volumes (format `mot-clé;volume`) le pré-sélectionne automatiquement.

## Pistes d'évolution

- Ajout d'une option "similarité sémantique" (embeddings) en complément du SERP, pour les cas où l'API SERP est indisponible.
- Import CSV direct (au lieu du copier-coller) pour les mots-clés et les volumes.
- Historique des analyses passées.
