"use client";

import { useState, useMemo } from "react";

type Cluster = {
  id: number;
  keywords: string[];
  keptKeyword: string | null;
  pairScores: { a: string; b: string; score: number }[];
};

export default function Home() {
  const [keywordsInput, setKeywordsInput] = useState("");
  const [country, setCountry] = useState("fr");
  const [language, setLanguage] = useState("fr");
  const [threshold, setThreshold] = useState(0.5);
  const [volumesInput, setVolumesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [selection, setSelection] = useState<Record<number, string>>({});

  const volumes = useMemo(() => {
    const map = new Map<string, number>();
    volumesInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split(/[;,\t]/);
        if (parts.length >= 2) {
          const kw = parts[0].trim().toLowerCase();
          const vol = parseInt(parts[1].replace(/\s/g, ""), 10);
          if (!isNaN(vol)) map.set(kw, vol);
        }
      });
    return map;
  }, [volumesInput]);

  async function runAnalysis() {
    setError(null);
    setClusters(null);
    const keywords = keywordsInput
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length < 2) {
      setError("Ajoute au moins 2 mots-clés (un par ligne).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, country, language, threshold }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'analyse.");
        return;
      }

      const cl: Cluster[] = data.clusters;
      // Pré-sélection : volume le plus élevé si dispo, sinon le mot-clé le plus court.
      const initialSelection: Record<number, string> = {};
      cl.forEach((c) => {
        if (c.keywords.length === 1) {
          initialSelection[c.id] = c.keywords[0];
        } else {
          let best = c.keywords[0];
          let bestVol = volumes.get(best.toLowerCase()) ?? -1;
          let hasAnyVolume = bestVol >= 0;
          for (const kw of c.keywords) {
            const v = volumes.get(kw.toLowerCase());
            if (v !== undefined) {
              hasAnyVolume = true;
              if (v > bestVol) {
                bestVol = v;
                best = kw;
              }
            }
          }
          if (!hasAnyVolume) {
            best = [...c.keywords].sort((a, b) => a.length - b.length)[0];
          }
          initialSelection[c.id] = best;
        }
      });
      setSelection(initialSelection);
      setClusters(cl);
    } catch (e: any) {
      setError(e?.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!clusters) return;
    const rows = [["mot_cle_a_garder", "mots_cles_regroupes", "nb_doublons"]];
    clusters.forEach((c) => {
      const kept = selection[c.id] || c.keywords[0];
      rows.push([kept, c.keywords.join(" | "), String(c.keywords.length - 1)]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mots-cles-dedoublonnes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const duplicateClusters = clusters?.filter((c) => c.keywords.length > 1) || [];
  const totalDuplicates = duplicateClusters.reduce((sum, c) => sum + c.keywords.length -
