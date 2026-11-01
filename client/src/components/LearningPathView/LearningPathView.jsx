import { useState } from "react";
import NetworkGraph from "../../pages/LearningPath/NetworkGraph";
import ViewSwap from "../ViewSwap/ViewSwap";
import ViewToggle from "../ViewToggle/ViewToggle";
import "./LearningPathView.scss";

export default function LearningPathView({
  levels,
  conceptDetails = {},
  graph,
  defaultView = "graph",
}) {
  const hasGraph = graph?.nodes?.length > 0;
  const [view, setView] = useState(hasGraph ? defaultView : "list");

  return (
    <section className="readonly-learning-path" aria-label="Learning path">
      {hasGraph && <ViewToggle view={view} onChange={setView} />}
      <ViewSwap view={view === "graph" && hasGraph ? "graph" : "list"}>
        {(shown) =>
          shown === "graph" ? (
            <NetworkGraph nodes={graph.nodes} edges={graph.edges} />
          ) : (
            <div className="readonly-levels">
              {["Beginner", "Intermediate", "Advanced"].map((level, index) => (
                <section className="readonly-level" key={level}>
                  <h2>
                    <span className="stage-number">Stage {index + 1}</span>
                    {level}
                  </h2>
                  <ol>
                    {(levels?.[level] ?? []).map((concept) => {
                      const name =
                        typeof concept === "string" ? concept : concept.name;
                      const detail =
                        typeof concept === "string"
                          ? conceptDetails[name]
                          : concept;
                      return (
                        <li key={name}>
                          <h3>{name}</h3>
                          {detail?.summary && <p>{detail.summary}</p>}
                          {detail?.why && (
                            <p>
                              <strong>Why it matters:</strong> {detail.why}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )
        }
      </ViewSwap>
    </section>
  );
}
