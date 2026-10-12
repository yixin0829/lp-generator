import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoadingProgress from "../LoadingProgress/LoadingProgress";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import "./LearningPath.scss";

import { SearchbarHome } from "../HomePage/HomePage";
import Button from "../../components/Button/Button";
import { useSnackbar } from "notistack";
import { apiUrl } from "../../config/api";
import { findPublicTopicByAlias } from "../../data/publicTopics";
import Seo from "../../seo/Seo";
import NetworkGraph from "./NetworkGraph";
import { createShareSnapshot } from "../../util/shareSnapshot";

const LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced"];
const MODERATION_DETAIL_HINTS = ["content policy", "moderation", "flagged"];

function isModerationError(statusCode, detail) {
  if (statusCode !== 400 || typeof detail !== "string") {
    return false;
  }
  const normalizedDetail = detail.toLowerCase();
  return MODERATION_DETAIL_HINTS.some((hint) =>
    normalizedDetail.includes(hint),
  );
}

async function generateLp(topic) {
  if (!topic || typeof topic !== "string") {
    return { data: null, statusCode: 400, errorDetail: "Missing topic." };
  }
  try {
    const response = await fetch(apiUrl(`/v1/lp/${encodeURIComponent(topic)}`));

    if (response.status === 504) {
      return {
        data: null,
        statusCode: 504,
        errorDetail: "The request timed out. Please try again.",
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        data: null,
        statusCode: response.status,
        errorDetail: "Received an invalid response from the server.",
      };
    }

    const errorDetail =
      response.status === 200
        ? null
        : typeof data?.detail === "string"
          ? data.detail
          : null;
    return { data, statusCode: response.status, errorDetail };
  } catch (error) {
    console.error("[LearningPath] generateLp error:", error);
    return { data: null, statusCode: 500, errorDetail: "Network error." };
  }
}

function extractConceptData(completion) {
  const details = {};
  const flat = {};
  const graphData = {
    nodes: completion.nodes || [],
    edges: completion.edges || [],
  };

  for (const level of LEVEL_ORDER) {
    const concepts = completion[level];
    if (!concepts) continue;
    flat[level] = concepts.map((c) => {
      if (typeof c === "string") return c;
      details[c.name] = {
        summary: c.summary,
        why: c.why,
        connection: c.connection,
      };
      return c.name;
    });
  }
  return { flat, details, graphData };
}

async function copyToClipboard(lp, conceptDetails, showSnackbar) {
  if (!lp) {
    showSnackbar("Please wait until the learning path is generated!");
    return;
  }
  const hasDetails = conceptDetails && Object.keys(conceptDetails).length > 0;
  let out = "";
  for (const title of Object.keys(lp)) {
    out += `## ${title}\n\n`;
    for (const step of lp[title]) {
      const d = hasDetails ? conceptDetails[step] : null;
      out += `- **${step}**`;
      if (d?.summary) out += ` — ${d.summary}`;
      out += "\n";
      if (d?.why) out += `  - *Why it matters:* ${d.why}\n`;
      if (d?.connection) out += `  - *Connects to:* ${d.connection}\n`;
    }
    out += "\n";
  }
  try {
    await navigator.clipboard.writeText(out.trimEnd());
    showSnackbar("Copied to clipboard!");
  } catch {
    showSnackbar(
      "Could not copy. Check your browser clipboard permission and try again.",
    );
  }
}

export default function LearningPath() {
  const [lp, setLp] = useState(null);
  const [conceptDetails, setConceptDetails] = useState({});
  const [graphData, setGraphData] = useState(null);
  const [viewMode, setViewMode] = useState("graph");
  const [retryCount, setRetryCount] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [failureStatus, setFailureStatus] = useState(null);
  const [badRequest, setBadRequest] = useState(false);
  const [isModeratedTopic, setIsModeratedTopic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const revealPath = useCallback(() => setIsLoading(false), []);
  const [shareUrl, setShareUrl] = useState("");
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term")?.trim() ?? "";
  const { enqueueSnackbar } = useSnackbar();

  async function shareLearningPath() {
    if (!lp || !graphData || isSharing) return;
    setIsSharing(true);
    try {
      const response = await fetch(apiUrl("/v1/shares"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createShareSnapshot({
            topic,
            levels: lp,
            conceptDetails,
            graph: graphData,
            defaultView: viewMode,
          }),
        ),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.share_id)
        throw new Error(body.detail || "Unable to create share.");
      const createdUrl = `${window.location.origin}/share/${body.share_id}`;
      setShareUrl(createdUrl);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(createdUrl);
          enqueueSnackbar(
            "Share link copied! Anyone with the link can view this copy.",
          );
        } catch {
          enqueueSnackbar("Share created. Copy the link shown below.");
        }
      } else {
        enqueueSnackbar("Share created. Copy the link shown below.");
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Unable to create share.");
    } finally {
      setIsSharing(false);
    }
  }

  useEffect(() => {
    setLp(null);
    setConceptDetails({});
    setGraphData(null);
    setShareUrl("");
    setBadRequest(false);
    setFailureStatus(null);
    setIsModeratedTopic(false);

    if (!topic) {
      setBadRequest(true);
      return;
    }

    let cancelled = false;
    const getLp = async () => {
      setIsLoading(true);
      const { data, statusCode, errorDetail } = await generateLp(topic);
      if (cancelled) return;

      const completion = data?.completion;
      const hasValidCompletion =
        completion &&
        typeof completion === "object" &&
        !Array.isArray(completion);

      if (statusCode !== 200 || !hasValidCompletion) {
        setFailureStatus(statusCode);
        setIsModeratedTopic(isModerationError(statusCode, errorDetail));
        setBadRequest(true);
        setIsLoading(false);
      } else {
        const { flat, details, graphData: gd } = extractConceptData(completion);
        setConceptDetails(details);
        setLp(flat);
        setGraphData(gd);
      }
    };

    getLp();
    return () => {
      cancelled = true;
    };
  }, [topic, retryCount]);

  if (!topic) {
    return (
      <main className="learning-path-page">
        <Seo title="Learning Path" noindex />
        <h2 className="bad-request">What do you want to learn?</h2>
        <SearchMore />
      </main>
    );
  }

  const hasGraph = graphData?.nodes?.length > 0;

  return (
    <main className="learning-path-page">
      <Seo
        title={`Learn ${topic}`}
        description={`AI-generated learning path for ${topic}: beginner to advanced concepts.`}
        path="/learningpath"
        noindex
      />
      <div className="title-container">
        <h1>{topic} learning path</h1>
      </div>
      {lp && !isLoading && (
        <p>
          {viewMode === "graph"
            ? "Select a concept to see how it connects to the others."
            : "Drag and drop concepts to reorder them, then copy the path to your notes!"}
        </p>
      )}
      {badRequest || (lp && !isLoading) ? <SearchMore /> : <div></div>}
      {badRequest ? (
        <div className="status-panel" role="alert">
          {isModeratedTopic ? (
            <>
              <h2 className="bad-request">
                This topic cannot be generated because it was flagged by content
                moderation.
              </h2>
              <p className="bad-request">
                Please try a safer, educational phrasing (for example, focus on
                history, prevention, ethics, or legal context).
              </p>
            </>
          ) : (
            <>
              <h2>Couldn't generate this learning path.</h2>
              <p>
                {failureStatus === 400
                  ? "Try a shorter topic or a different phrase."
                  : "Try again with the same topic, or enter something else."}
              </p>
              {failureStatus !== 400 && (
                <Button
                  label="Try again"
                  onClick={() => setRetryCount((count) => count + 1)}
                />
              )}
            </>
          )}
        </div>
      ) : lp && !isLoading ? (
        <>
          <div className="learning-path-controls">
            {hasGraph && (
              <div
                className="view-toggle"
                role="group"
                aria-label="Learning path view"
              >
                <button
                  aria-pressed={viewMode === "graph"}
                  className={viewMode === "graph" ? "active" : ""}
                  onClick={() => setViewMode("graph")}
                >
                  Graph
                </button>
                <button
                  aria-pressed={viewMode === "list"}
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  List
                </button>
              </div>
            )}
            <div
              className="path-actions"
              role="group"
              aria-label="Learning path actions"
            >
              <Button
                className="copy-action"
                label="Copy path"
                isSecondary
                onClick={() =>
                  copyToClipboard(lp, conceptDetails, enqueueSnackbar)
                }
              />
              <Button
                className="share-action"
                isSecondary
                aria-describedby="share-visibility"
                label={isSharing ? "Creating link..." : "Share path"}
                disabled={isSharing}
                onClick={shareLearningPath}
              />
            </div>
          </div>
          <p id="share-visibility" className="share-hint">
            Anyone with the link can view a copy of this path.
          </p>
          {shareUrl && (
            <p className="share-result">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                Open share link <span aria-hidden="true">↗</span>
              </a>
              <span className="share-url">{shareUrl}</span>
            </p>
          )}
          {viewMode === "graph" && hasGraph ? (
            <NetworkGraph
              key={topic}
              nodes={graphData.nodes}
              edges={graphData.edges}
            />
          ) : (
            <LPItems
              key={topic}
              lp={lp}
              setLp={setLp}
              conceptDetails={conceptDetails}
            />
          )}
        </>
      ) : (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "40vh",
          }}
        >
          {isLoading ? (
            <LoadingProgress
              key={`${topic}:${retryCount}`}
              estimateGeneration
              complete={Boolean(lp)}
              onComplete={revealPath}
            />
          ) : null}
        </div>
      )}
      <div style={{ height: "30px" }} />
    </main>
  );
}

function SearchMore() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  function goSearch() {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return;
    }

    const publicTopic = findPublicTopicByAlias(trimmedTerm);
    if (publicTopic) {
      navigate(`/learn/${publicTopic.slug}`);
      return;
    }

    navigate({
      pathname: "/learningpath",
      search: `?term=${encodeURIComponent(trimmedTerm)}`,
    });
  }

  return (
    <form
      className="search-more topic-search"
      onSubmit={(event) => {
        event.preventDefault();
        goSearch();
      }}
    >
      <SearchbarHome onChange={setSearchTerm} />
      <Button label="Generate" type="submit" disabled={!searchTerm.trim()} />
    </form>
  );
}

function LPItems({ lp, setLp, conceptDetails }) {
  const [items, setItems] = useState(lp);
  const [activeId, setActiveId] = useState();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    setItems(lp);
  }, [lp]);

  function findContainer(id) {
    if (id in items) {
      return id;
    }

    return Object.keys(items).find((key) => items[key].includes(id));
  }

  function handleDragStart(event) {
    const { active } = event;
    const { id } = active;

    setActiveId(id);
  }

  function handleDragOver(event) {
    const { active, over, draggingRect } = event;
    if (!over) return;
    const { id } = active;
    const { id: overId } = over;

    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return;
    }

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.indexOf(id);
      const overIndex = overItems.indexOf(overId);
      let newIndex;
      if (overId in prev) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowLastItem =
          over &&
          overIndex === overItems.length - 1 &&
          draggingRect?.offsetTop > over.rect?.offsetTop + over.rect.height;
        const modifier = isBelowLastItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }
      const out = {
        ...prev,
        [activeContainer]: [
          ...prev[activeContainer].filter((item) => item !== active.id),
        ],
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          prev[activeContainer][activeIndex],
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ],
      };
      setLp(out);
      return out;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }
    const { id } = active;
    const { id: overId } = over;
    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);
    if (
      !activeContainer ||
      !overContainer ||
      activeContainer !== overContainer
    ) {
      setActiveId(null);
      return;
    }
    const activeIndex = items[activeContainer].indexOf(active.id);
    const overIndex = items[overContainer].indexOf(overId);
    if (activeIndex !== overIndex) {
      setItems((currentItems) => {
        const nextItems = {
          ...currentItems,
          [overContainer]: arrayMove(
            currentItems[overContainer],
            activeIndex,
            overIndex,
          ),
        };
        setLp(nextItems);
        return nextItems;
      });
    }
    setActiveId(null);
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return (
    <div className="flex-container">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {Object.keys(items).map((itemsKey) => (
          <Container
            key={itemsKey}
            id={itemsKey}
            items={items[itemsKey]}
            conceptDetails={conceptDetails}
          />
        ))}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId ? <Item id={activeId} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Container({ id, items, conceptDetails }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <SortableContext
      id={id}
      items={items}
      strategy={verticalListSortingStrategy}
    >
      <div ref={setNodeRef} className="level-container">
        <h2>{id}</h2>
        <ul className="concept-list">
          {(Array.isArray(items) ? items : []).map((itemId) => (
            <SortableItem
              key={itemId}
              id={itemId}
              details={conceptDetails?.[itemId]}
            />
          ))}
        </ul>
      </div>
    </SortableContext>
  );
}

function SortableItem({ id, details }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : "",
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className="sortable-concept">
      <Item
        id={id}
        style={{ opacity: isDragging ? 0.5 : 1 }}
        details={details}
        hideDetails={isDragging}
        handleProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef }}
      />
    </li>
  );
}

function Item({ id, style, details, handleProps, hideDetails = false }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const showDetails = !hideDetails && (hovered || expanded);
  return (
    <div style={style} className="concept-item">
      {handleProps ? (
        <button
          type="button"
          className="concept-drag-handle"
          {...handleProps}
          aria-label={"Reorder " + id}
        >
          <span aria-hidden="true">•</span>
          <span>{id}</span>
        </button>
      ) : (
        <div className="concept-drag-preview">• {id}</div>
      )}
      {details?.summary && (
        <div
          className="concept-summary-area"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            className="concept-summary"
            aria-expanded={showDetails}
            aria-controls={detailId}
            onClick={() => setExpanded((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setHovered(false);
                setExpanded(false);
              }
            }}
          >
            {details.summary}
          </button>
          {showDetails && (
            <div
              className="concept-tooltip"
              id={detailId}
              role="region"
              aria-label={id + " details"}
            >
              <h4>{id}</h4>
              <div className="tooltip-section">
                <span className="tooltip-label">Why it matters</span>
                <p>{details.why}</p>
              </div>
              <div className="tooltip-section">
                <span className="tooltip-label">How it connects</span>
                <p>{details.connection}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
