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
  const totalDuplicates = duplicateClusters.reduce((sum, c) => sum + c.keywords.length - 1, 0);

  return (
    <div className="container">
      <header className="masthead">
        <h1>Dédoublonnage de mots-clés</h1>
        <p className="subtitle">
          Colle une liste de mots-clés, l'outil compare leurs SERPs (via Serper.dev) et regroupe ceux dont les résultats se ressemblent — comme 12pages ou Thot SEO.
        </p>
      </header>

      <div className="panel">
        <label>Liste de mots-clés (un par ligne)</label>
        <textarea
          value={keywordsInput}
          onChange={(e) => setKeywordsInput(e.target.value)}
          placeholder={"symptome grossesse\nsymptome de la grossesse\nrecette tarte aux pommes\n..."}
        />

        <div className="row">
          <div>
            <label>Pays (gl)</label>
            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="fr" />
          </div>
          <div>
            <label>Langue (hl)</label>
            <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="fr" />
          </div>
        </div>

        <div className="threshold-row">
          <label>Seuil de similarité : {(threshold * 100).toFixed(0)}%</label>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
        </div>

        <div className="field-group">
          <label>Volumes de recherche (optionnel) — format "mot-clé;volume", un par ligne</label>
          <textarea
            style={{ minHeight: 80 }}
            value={volumesInput}
            onChange={(e) => setVolumesInput(e.target.value)}
            placeholder={"symptome grossesse;12000\nsymptome de la grossesse;500"}
          />
        </div>

        <button className="primary" onClick={runAnalysis} disabled={loading}>
          {loading ? "Analyse en cours..." : "Analyser les SERPs"}
        </button>

        {error && <div className="error-box">{error}</div>}
        {loading && (
          <div className="loading">
            Récupération des SERPs et calcul des similarités, ça peut prendre quelques dizaines de secondes selon le nombre de mots-clés...
          </div>
        )}
      </div>

      {clusters && (
        <>
          <div className="stat-strip">
            <div className="stat-cell">
              <div className="value">{clusters.length}</div>
              <div className="label">groupes détectés</div>
            </div>
            <div className="stat-cell">
              <div className="value">{duplicateClusters.length}</div>
              <div className="label">groupes avec doublons</div>
            </div>
            <div className="stat-cell">
              <div className="value">{totalDuplicates}</div>
              <div className="label">mots-clés à éliminer</div>
            </div>
          </div>

          <div className="export-row">
            <span>
              Liste nettoyée : <strong>{clusters.length}</strong> mots-clés à conserver sur {clusters.reduce((s, c) => s + c.keywords.length, 0)} au départ.
            </span>
            <button className="secondary" onClick={exportCsv}>
              Exporter en CSV
            </button>
          </div>

          <div className="cluster-list">
            {clusters.map((c) => (
              <div key={c.id} className={`cluster-card ${c.keywords.length > 1 ? "duplicate" : "single"}`}>
                <div className="cluster-title">
                  {c.keywords.length > 1
                    ? `Groupe de ${c.keywords.length} mots-clés similaires`
                    : "Mot-clé unique (pas de doublon détecté)"}
                </div>
                {c.keywords.map((kw) => {
                  const pairScore = c.pairScores.find((p) => p.a === kw || p.b === kw);
                  const vol = volumes.get(kw.toLowerCase());
                  return (
                    <label className="kw-option" key={kw}>
                      {c.keywords.length > 1 ? (
                        <input
                          type="radio"
                          name={`cluster-${c.id}`}
                          checked={selection[c.id] === kw}
                          onChange={() => setSelection({ ...selection, [c.id]: kw })}
                        />
                      ) : (
                        <span style={{ width: 14 }} />
                      )}
                      <span className="kw-text">{kw}</span>
                      {vol !== undefined && <span className="data-tag">{vol} rech./mois</span>}
                      {pairScore && (
                        <span className="data-tag score">{(pairScore.score * 100).toFixed(0)}% similaire</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
