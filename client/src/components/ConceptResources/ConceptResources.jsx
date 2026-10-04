import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../config/api";
import "./ConceptResources.scss";

export default function ConceptResources({ topic, concepts }) {
  const [selected, setSelected] = useState(concepts[0]?.label ?? "");
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const active = useRef(null);
  useEffect(() => {
    active.current?.abort();
    setSelected(concepts[0]?.label ?? ""); setResult(null); setPhase("idle");
    return () => active.current?.abort();
  }, [topic]);

  async function load() {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 22000);
    setPhase("loading"); setResult(null);
    try {
      const concept = concepts.find((item) => item.label === selected);
      const response = await fetch(apiUrl("/v1/resources"), {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ topic, concept: selected, level: concept?.level ?? "Beginner", language: "en" }),
      });
      if (!response.ok) throw new Error("Resources unavailable");
      const data = await response.json();
      if (active.current !== controller) return;
      setResult(data); setPhase("done");
    } catch (error) {
      if (error.name !== "AbortError" && active.current === controller) setPhase("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!concepts.length) return null;
  return (
    <section className="concept-resources" aria-labelledby="resources-heading">
      <h2 id="resources-heading">Learn one concept</h2>
      <p>Choose a concept and find a guide to start practicing.</p>
      <div className="resource-controls">
        <label>Concept
          <select value={selected} onChange={(event) => { active.current?.abort(); active.current = null; setSelected(event.target.value); setResult(null); setPhase("idle"); }}>
            {concepts.map((concept) => <option key={concept.id ?? concept.label} value={concept.label}>{concept.label} · {concept.level}</option>)}
          </select>
        </label>
        <button type="button" onClick={load} disabled={phase === "loading"}>{phase === "loading" ? "Finding resources…" : "Find resources"}</button>
      </div>
      <div aria-live="polite">
        {phase === "error" && <p role="alert">Resources are temporarily unavailable. Your path is still here. Try again when you are ready.</p>}
        {result?.message && <p>{result.message}</p>}
        {result?.resources?.length > 0 && <ul className="resource-cards">{result.resources.map((resource) => {
          let url; try { url = new URL(resource.url); } catch { return null; }
          if (url.protocol !== "https:" || url.username || url.password) return null;
          return <li key={resource.url}>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}<span className="resource-new-tab"> (opens in a new tab)</span></a>
            <p className="resource-meta">{resource.publisher} · {resource.format} · Path level: {resource.level}</p>
            <p>{resource.why}</p>
            <small>{resource.provenance === "catalogue" ? "Reviewed catalogue" : "Cited web search"} · Retrieved {resource.retrieved_at.slice(0, 10)}</small>
          </li>;
        })}</ul>}
      </div>
    </section>
  );
}
