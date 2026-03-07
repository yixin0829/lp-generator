import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
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

import CopyToClip from "../../assets/copy-regular.svg";
import SpaceShip from "../../assets/spaceship.png";
import { SearchbarHome } from "../HomePage/HomePage";
import Button from "../../components/Button/Button";
import { useSnackbar } from "notistack";
import { apiUrl } from "../../config/api";
import Seo from "../../seo/Seo";
import NetworkGraph from "./NetworkGraph";

const LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced"];
const MODERATION_DETAIL_HINTS = ["content policy", "moderation", "flagged"];

function isModerationError(statusCode, detail) {
  if (statusCode !== 400 || typeof detail !== "string") {
    return false;
  }
  const normalizedDetail = detail.toLowerCase();
  return MODERATION_DETAIL_HINTS.some((hint) => normalizedDetail.includes(hint));
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
      response.status === 200 ? null : typeof data?.detail === "string" ? data.detail : null;
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
      details[c.name] = { summary: c.summary, why: c.why, connection: c.connection };
      return c.name;
    });
  }
  return { flat, details, graphData };
}

function copyToClipboard(lp, conceptDetails, showSnackbar) {
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
  navigator.clipboard.writeText(out.trimEnd());
  showSnackbar("Copied to clipboard!");
}

export default function LearningPath() {
  const [lp, setLp] = useState(null);
  const [conceptDetails, setConceptDetails] = useState({});
  const [graphData, setGraphData] = useState(null);
  const [viewMode, setViewMode] = useState("graph");
  const [badRequest, setBadRequest] = useState(false);
  const [isModeratedTopic, setIsModeratedTopic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term")?.trim() ?? "";
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    setLp(null);
    setConceptDetails({});
    setGraphData(null);
    setBadRequest(false);
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
        setIsModeratedTopic(isModerationError(statusCode, errorDetail));
        setBadRequest(true);
      } else {
        const { flat, details, graphData: gd } = extractConceptData(completion);
        setConceptDetails(details);
        setLp(flat);
        setGraphData(gd);
      }
      setIsLoading(false);
    };

    getLp();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  if (!topic) {
    return (
      <div className="learning-path-page">
        <Seo title="Learning Path" noindex />
        <h2 className="bad-request">Please provide a topic in the URL (?term=...).</h2>
        <SearchMore />
      </div>
    );
  }

  const hasGraph = graphData?.nodes?.length > 0;

  return (
    <div className="learning-path-page">
      <Seo
        title={`Learn ${topic}`}
        description={`AI-generated learning path for ${topic}: beginner to advanced concepts.`}
        path="/learningpath"
        noindex
      />
      <div className="title-container">
        <h1>
          Learning <div className="accent-text">{topic}</div> ...
        </h1>
        <img
          src={CopyToClip}
          className="copy-button"
          onClick={() => {
            copyToClipboard(lp, conceptDetails, enqueueSnackbar);
          }}
          alt="copy"
        />
      </div>
      <p>
        {viewMode === "graph"
          ? "Explore the concept graph — hover nodes and edges for details."
          : "Drag and drop bullets to reorder and copy the result to your own notes!"}
      </p>
      {badRequest || lp ? <SearchMore /> : <div></div>}
      {badRequest ? (
        <div>
          <img src={SpaceShip} className="full-img" alt="" />
          {isModeratedTopic ? (
            <>
              <h2 className="bad-request">
                This topic cannot be generated because it was flagged by content moderation.
              </h2>
              <p className="bad-request">
                Please try a safer, educational phrasing (for example, focus on history,
                prevention, ethics, or legal context).
              </p>
            </>
          ) : (
            <h2 className="bad-request">Please try again with another response.</h2>
          )}
        </div>
      ) : lp ? (
        <>
          {hasGraph && (
            <div className="view-toggle">
              <button
                className={viewMode === "graph" ? "active" : ""}
                onClick={() => setViewMode("graph")}
              >
                Graph
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
            </div>
          )}
          {viewMode === "graph" && hasGraph ? (
            <NetworkGraph
              key={topic}
              nodes={graphData.nodes}
              edges={graphData.edges}
            />
          ) : (
            <LPItems key={topic} lp={lp} setLp={setLp} conceptDetails={conceptDetails} />
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
          {isLoading ? <LoadingSpinner /> : null}
        </div>
      )}
      <div style={{ height: "30px" }} />
    </div>
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

    navigate({
      pathname: "/learningpath",
      search: `?term=${encodeURIComponent(trimmedTerm)}`,
    });
  }

  return (
    <div style={{ textAlign: "center" }} className="search-more">
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <SearchbarHome onChange={setSearchTerm} onEnter={goSearch} />
        <div style={{ width: "15px" }} className="desktop-only" />
        <Button label="Generate" className="desktop-only" onClick={goSearch} />
      </div>
      <div style={{ height: "15px" }} />
    </div>
  );
}

function LPItems({ lp, setLp, conceptDetails }) {
  const [items, setItems] = useState(lp);
  const [activeId, setActiveId] = useState();
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
      setItems((items) => ({
        ...items,
        [overContainer]: arrayMove(
          items[overContainer],
          activeIndex,
          overIndex
        ),
      }));
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
          <Container key={itemsKey} id={itemsKey} items={items[itemsKey]} conceptDetails={conceptDetails} />
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
        {(Array.isArray(items) ? items : []).map((itemId) => (
          <SortableItem key={itemId} id={itemId} details={conceptDetails?.[itemId]} />
        ))}
      </div>
    </SortableContext>
  );
}

function SortableItem({ id, details }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : "",
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Item id={id} style={{ opacity: isDragging ? 0.5 : 1 }} details={isDragging ? null : details} />
    </div>
  );
}

function Item({ id, style, details }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={style}
      className="concept-item"
      onMouseEnter={() => details && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <li>{id}</li>
      {hovered && details && (
        <div className="concept-tooltip">
          <h4>{id}</h4>
          <div className="tooltip-section">
            <span className="tooltip-label">What it is</span>
            <p>{details.summary}</p>
          </div>
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
  );
}
