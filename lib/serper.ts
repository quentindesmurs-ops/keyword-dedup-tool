export type SerpResult = {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  position: number;
};

export type SerpData = {
  keyword: string;
  results: SerpResult[];
  error?: string;
};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Appelle Serper.dev pour un mot-clé et renvoie les 10 premiers résultats organiques.
export async function fetchSerp(
  keyword: string,
  country: string,
  language: string
): Promise<SerpData> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return { keyword, results: [], error: "SERPER_API_KEY manquante" };
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: keyword,
        gl: country || "fr",
        hl: language || "fr",
        num: 10,
      }),
    });

    if (!res.ok) {
      return { keyword, results: [], error: `Erreur Serper (${res.status})` };
    }

    const data = await res.json();
    const organic = Array.isArray(data.organic) ? data.organic : [];

    const results: SerpResult[] = organic.slice(0, 10).map((item: any, i: number) => ({
      url: item.link || "",
      domain: getDomain(item.link || ""),
      title: item.title || "",
      snippet: item.snippet || "",
      position: i + 1,
    }));

    return { keyword, results };
  } catch (e: any) {
    return { keyword, results: [], error: e?.message || "Erreur inconnue" };
  }
}
