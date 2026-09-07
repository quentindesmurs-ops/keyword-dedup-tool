import { SerpData, SerpResult } from "./serper";

export type PairSimilarity = {
  keywordA: string;
  keywordB: string;
  exactUrlMatches: number; // nombre d'URLs identiques
  urlOverlapPct: number; // % d'URLs en commun
  titleOverlapPct: number; // % de similarité des titres
  snippetOverlapPct: number; // % de similarité des snippets
  score: number; // score composite 0-1
};

export type Cluster = {
  id: number;
  keywords: string[];
  keptKeyword: string | null; // choix manuel ou auto (volume)
  pairScores: { a: string; b: string; score: number }[];
};

const STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en", "à",
  "pour", "sur", "avec", "dans", "au", "aux", "ou", "ce", "cette", "ces",
  "que", "qui", "est", "sont", "il", "elle", "vous", "nous", "se", "son",
  "sa", "ses", "d", "l", "the", "a", "an", "of", "to", "for", "in", "on",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // retire les accents
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Similarité moyenne des titres/snippets entre les URLs communes des deux SERPs.
function avgTextSimilarity(
  resultsA: SerpResult[],
  resultsB: SerpResult[],
  field: "title" | "snippet"
): number {
  const mapB = new Map(resultsB.map((r) => [r.url, r]));
  let total = 0;
  let count = 0;
  for (const rA of resultsA) {
    const rB = mapB.get(rA.url);
    if (rB) {
      total += jaccard(tokenize(rA[field]), tokenize(rB[field]));
      count++;
    }
  }
  // Si aucune URL commune, on compare quand même l'ensemble des textes concaténés
  // pour capter une similarité thématique résiduelle (poids plus faible, géré par le score composite).
  if (count === 0) {
    const allA = tokenize(resultsA.map((r) => r[field]).join(" "));
    const allB = tokenize(resultsB.map((r) => r[field]).join(" "));
    return jaccard(allA, allB);
  }
  return total / count;
}

export function comparePair(dataA: SerpData, dataB: SerpData): PairSimilarity {
  const urlsA = new Set(dataA.results.map((r) => r.url));
  const urlsB = new Set(dataB.results.map((r) => r.url));

  let exactUrlMatches = 0;
  for (const u of urlsA) if (urlsB.has(u)) exactUrlMatches++;

  const smallerSize = Math.min(urlsA.size, urlsB.size) || 1;
  const urlOverlapPct = exactUrlMatches / smallerSize;

  const titleOverlapPct = avgTextSimilarity(dataA.results, dataB.results, "title");
  const snippetOverlapPct = avgTextSimilarity(dataA.results, dataB.results, "snippet");

  // Score composite pondéré : les URLs communes comptent le plus (signal Google le plus fiable)
  const score =
    0.5 * urlOverlapPct + 0.2 * titleOverlapPct + 0.15 * snippetOverlapPct +
    // bonus si beaucoup d'URLs exactement identiques (similarité "forte")
    0.15 * (exactUrlMatches / 10);

  return {
    keywordA: dataA.keyword,
    keywordB: dataB.keyword,
    exactUrlMatches,
    urlOverlapPct,
    titleOverlapPct,
    snippetOverlapPct,
    score: Math.min(1, score),
  };
}

// Union-Find pour regrouper les mots-clés dont le score dépasse le seuil.
export function clusterKeywords(
  allData: SerpData[],
  threshold: number
): { clusters: Cluster[]; pairSimilarities: PairSimilarity[] } {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  allData.forEach((d) => find(d.keyword));

  const pairSimilarities: PairSimilarity[] = [];
  const pairScoreMap = new Map<string, { a: string; b: string; score: number }[]>();

  for (let i = 0; i < allData.length; i++) {
    for (let j = i + 1; j < allData.length; j++) {
      const dataA = allData[i];
      const dataB = allData[j];
      if (dataA.error || dataB.error) continue;

      const sim = comparePair(dataA, dataB);
      pairSimilarities.push(sim);

      if (sim.score >= threshold) {
        union(dataA.keyword, dataB.keyword);
        const rootPairs = pairScoreMap.get(find(dataA.keyword)) || [];
        rootPairs.push({ a: dataA.keyword, b: dataB.keyword, score: sim.score });
