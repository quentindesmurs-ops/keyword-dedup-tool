import { NextRequest, NextResponse } from "next/server";
import { fetchSerp } from "@/lib/serper";
import { clusterKeywords } from "@/lib/similarity";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keywords: string[] = (body.keywords || [])
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);
    const country = body.country || "fr";
    const language = body.language || "fr";
    const threshold = typeof body.threshold === "number" ? body.threshold : 0.5;

    if (keywords.length < 2) {
      return NextResponse.json(
        { error: "Il faut au moins 2 mots-clés à comparer." },
        { status: 400 }
      );
    }
    if (keywords.length > 40) {
      return NextResponse.json(
        { error: "Limite : 40 mots-clés par analyse (coût des appels SERP)." },
        { status: 400 }
      );
    }

    // Récupération séquentielle avec petite concurrence pour rester sous les limites de Serper.
    const CONCURRENCY = 5;
    const allData = [];
    for (let i = 0; i < keywords.length; i += CONCURRENCY) {
      const batch = keywords.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((kw) => fetchSerp(kw, country, language))
      );
      allData.push(...results);
    }

    const errors = allData.filter((d) => d.error);
    const { clusters, pairSimilarities } = clusterKeywords(allData, threshold);

    return NextResponse.json({
      serpData: allData,
      clusters,
      pairSimilarities,
      errors: errors.map((e) => ({ keyword: e.keyword, error: e.error })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
