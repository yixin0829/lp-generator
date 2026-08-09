import { useState } from "react";
import NetworkGraph from "../../pages/LearningPath/NetworkGraph";
import "./LearningPathView.scss";

export default function LearningPathView({ levels, conceptDetails = {}, graph, defaultView = "graph" }) {
  const hasGraph = graph?.nodes?.length > 0;
  const [view, setView] = useState(hasGraph ? defaultView : "list");

  return (
    <section className="readonly-learning-path" aria-label="Learning path">
      {hasGraph && (
        <div className="view-toggle" aria-label="Learning path view">
          <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>Graph</button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
        </div>
      )}
      {view === "graph" && hasGraph ? (
        <NetworkGraph nodes={graph.nodes} edges={graph.edges} />
      ) : (
        <div className="readonly-levels">
          {["Beginner", "Intermediate", "Advanced"].map((level) => (
            <section className="readonly-level" key={level}>
              <h2>{level}</h2>
              <ol>
                {(levels?.[level] ?? []).map((concept) => {
                  const name = typeof concept === "string" ? concept : concept.name;
                  const detail = typeof concept === "string" ? conceptDetails[name] : concept;
                  return (
                    <li key={name}>
                      <h3>{name}</h3>
                      {detail?.summary && <p>{detail.summary}</p>}
                      {detail?.why && <p><strong>Why it matters:</strong> {detail.why}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
