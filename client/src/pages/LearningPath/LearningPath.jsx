import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import {
  createShareSnapshot,
  shareErrorMessage,
} from "../../util/shareSnapshot";
import ViewToggle from "../../components/ViewToggle/ViewToggle";
import ViewSwap from "../../components/ViewSwap/ViewSwap";
import {
  EASE_OUT,
  SPRING_MS,
  SPRING_SOFT,
  cancelAnimationsWithin,
  onDone,
  play,
  playsFirstLoadEntrance,
  prefersReducedMotion,
  readOpacity,
} from "../../motion/motion";
import { rememberTopicMorph } from "../../motion/topicMorph";

// A direct link rises in like Home's hero.
const ENTRANCE = [
  { opacity: 0, translate: "0 6px", filter: "blur(4px)" },
  { opacity: 1, translate: "0 0", filter: "blur(0px)" },
];
const FADE_IN = [{ opacity: 0 }, { opacity: 1 }];
const REVEAL_CONTROLS = [
  ":scope > .path-helper",
  ":scope > .search-more",
  ":scope > .learning-path-controls",
  ":scope > .share-hint",
];

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

// Resolves true only after a successful write.
async function copyToClipboard(lp, conceptDetails, showSnackbar) {
  if (!lp) {
    showSnackbar("Please wait until the learning path is generated!");
    return false;
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
    return true;
  } catch {
    showSnackbar(
      "Could not copy. Check your browser clipboard permission and try again.",
    );
    return false;
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
  const mainRef = useRef(null);
  const viewRef = useRef(null);
  // The loading bar's document rect at completion; the card opens out of it.
  const barRef = useRef(null);
  const revealPath = useCallback((bar) => {
    barRef.current = bar ?? null;
    setIsLoading(false);
  }, []);
  const [ghost, setGhost] = useState(null);
  const clearGhost = useCallback(() => setGhost(null), []);
  const [entrance] = useState(playsFirstLoadEntrance);
  const entranceStart = useRef(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  const [shareUrl, setShareUrl] = useState("");
  const shareRowRef = useRef(null);
  const shareFromTop = useRef(null);
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term")?.trim() ?? "";
  const { enqueueSnackbar } = useSnackbar();
  const revealed = Boolean(lp) && !isLoading && !badRequest;
  const hasShareRow = Boolean(shareUrl);

  async function copyPath() {
    if (!(await copyToClipboard(lp, conceptDetails, enqueueSnackbar))) return;
    // Repeated copies extend the Copied state instead of queueing another.
    clearTimeout(copiedTimer.current);
    setCopied(true);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function shareLearningPath() {
    if (!lp || !graphData || isSharing) return;
    const view = viewRef.current;
    shareFromTop.current = view
      ? view.getBoundingClientRect().top + window.scrollY
      : null;
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
      if (!response.ok || !body.share_id) {
        enqueueSnackbar(shareErrorMessage(response.status, body));
        return;
      }
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
    } catch {
      enqueueSnackbar(
        "Couldn't reach the server. Check your connection and try again.",
      );
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

  // A direct link rises in; client-side arrivals get the route crossfade.
  useLayoutEffect(() => {
    const title = mainRef.current?.querySelector(":scope > .title-container");
    if (!entrance || !title || prefersReducedMotion()) return;
    entranceStart.current = performance.now();
    const animation = play(title, ENTRANCE, {
      duration: 400,
      easing: EASE_OUT,
      fill: "backwards",
    });
    return () => animation?.cancel();
  }, [entrance]);

  // The bar follows the title 60 ms later; loading starts one render after mount.
  useLayoutEffect(() => {
    const start = entranceStart.current;
    const container = mainRef.current?.querySelector(
      ".loading-progress-container",
    );
    if (!isLoading || start === null || !container) return;
    entranceStart.current = null;
    const animation = play(container, ENTRANCE, {
      duration: 400,
      delay: Math.max(0, 60 - (performance.now() - start)),
      easing: EASE_OUT,
      fill: "backwards",
    });
    return () => animation?.cancel();
  }, [isLoading]);

  // Runs after the children's layout effects, so the graph is built and the pill placed.
  useLayoutEffect(() => {
    const main = mainRef.current;
    const view = viewRef.current;
    const bar = barRef.current;
    barRef.current = null;
    if (!revealed || !main || !view) return;
    const controls = REVEAL_CONTROLS.map((selector) =>
      main.querySelector(selector),
    );
    const animations = [];
    if (prefersReducedMotion()) {
      for (const element of [...controls, view]) {
        animations.push(
          play(element, FADE_IN, {
            duration: 150,
            easing: "ease",
            fill: "backwards",
          }),
        );
      }
      return () => animations.forEach((animation) => animation?.cancel());
    }
    // Read every rect before anything starts moving.
    const card = view.getBoundingClientRect();
    const opens =
      bar !== null && view.querySelector(".network-graph-container") !== null;
    controls.forEach((element, index) => {
      animations.push(
        play(
          element,
          [
            { opacity: 0, translate: "0 6px" },
            { opacity: 1, translate: "0 0" },
          ],
          {
            duration: 320,
            delay: 80 + 40 * index,
            easing: EASE_OUT,
            fill: "backwards",
          },
        ),
      );
    });
    if (opens) {
      // The card's visible window starts as the bar and grows into the card.
      const b = { ...bar, top: bar.top - window.scrollY };
      const side = Math.max(0, (card.width - b.width) / 2);
      const dx = b.left + b.width / 2 - (card.left + card.width / 2);
      const dy = b.top - card.top;
      const bottom = Math.max(0, card.height - b.height);
      // Opening under the risen controls keeps them readable on phones.
      view.classList.add("is-opening");
      const opening = play(
        view,
        [
          {
            translate: `${dx}px ${dy}px`,
            clipPath: `inset(0px ${side}px ${bottom}px ${side}px round ${b.height / 2}px)`,
          },
          {
            translate: "0px 0px",
            clipPath: "inset(0px 0px 0px 0px round 16px)",
          },
        ],
        { duration: SPRING_MS, easing: SPRING_SOFT, fill: "backwards" },
      );
      onDone(opening, () => view.classList.remove("is-opening"));
      animations.push(opening);
      setGhost(b);
    } else {
      // A list is not a card, so it rises instead.
      animations.push(
        play(
          view,
          [
            { opacity: 0, translate: "0 12px" },
            { opacity: 1, translate: "0 0" },
          ],
          { duration: 450, delay: 120, easing: EASE_OUT, fill: "backwards" },
        ),
      );
    }
    return () => animations.forEach((animation) => animation?.cancel());
  }, [revealed]);

  // The first share row rises, and the view glides down to make room for it.
  useLayoutEffect(() => {
    const row = shareRowRef.current;
    const view = viewRef.current;
    if (!hasShareRow || !row) return;
    const reduced = prefersReducedMotion();
    const animations = [
      play(
        row,
        reduced
          ? FADE_IN
          : [
              { opacity: 0, translate: "0 -4px" },
              { opacity: 1, translate: "0 0" },
            ],
        { duration: reduced ? 120 : 240, easing: reduced ? "ease" : EASE_OUT },
      ),
    ];
    const fromTop = shareFromTop.current;
    if (!reduced && view && fromTop !== null) {
      const shift = fromTop - (view.getBoundingClientRect().top + window.scrollY);
      if (Math.abs(shift) >= 1) {
        animations.push(
          play(view, [{ translate: `0 ${shift}px` }, { translate: "0 0" }], {
            duration: SPRING_MS,
            easing: SPRING_SOFT,
          }),
        );
      }
    }
    return () => animations.forEach((animation) => animation?.cancel());
  }, [hasShareRow]);

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
    <main className="learning-path-page" ref={mainRef}>
      <Seo
        title={`Learn ${topic}`}
        description={`AI-generated learning path for ${topic}: beginner to advanced concepts.`}
        path="/learningpath"
        noindex
      />
      <div className="title-container">
        {/* Two spans, so a route transition can fly the typed topic into place. */}
        <h1>
          <span className="title-topic">{topic}</span>{" "}
          <span className="title-rest">learning path</span>
        </h1>
      </div>
      {lp && !isLoading && (
        <p className="path-helper">
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
            {hasGraph && <ViewToggle view={viewMode} onChange={setViewMode} />}
            <div
              className="path-actions"
              role="group"
              aria-label="Learning path actions"
            >
              {/* Share leads as the filled button. As a secondary button
                  after Copy, far fewer people shared. */}
              <Button
                className="share-action"
                aria-describedby="share-visibility"
                aria-label={isSharing ? "Creating link..." : "Share path"}
                aria-busy={isSharing}
                label={
                  isSharing ? (
                    // Phones keep the short label so the row still fits while
                    // the link is created.
                    <span>
                      <span className="action-busy">Creating link...</span>
                      <span className="action-busy-short">Share</span>
                    </span>
                  ) : (
                    <span>
                      Share<span className="action-noun"> path</span>
                    </span>
                  )
                }
                disabled={isSharing}
                onClick={shareLearningPath}
              />
              <Button
                className="copy-action"
                aria-label="Copy path"
                // One inline span keeps the space that a flex button drops.
                label={<CopyLabel copied={copied} />}
                isSecondary
                onClick={copyPath}
              />
            </div>
          </div>
          <p id="share-visibility" className="share-hint">
            Anyone with the link can view a copy of this path.
          </p>
          {shareUrl && (
            <p className="share-result" ref={shareRowRef}>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                Open share link <span aria-hidden="true">↗</span>
              </a>
              <span className="share-url">{shareUrl}</span>
            </p>
          )}
          <ViewSwap
            ref={viewRef}
            view={viewMode === "graph" && hasGraph ? "graph" : "list"}
          >
            {(view, { initial }) =>
              view === "graph" ? (
                <NetworkGraph
                  key={topic}
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  reveal={initial}
                />
              ) : (
                <LPItems
                  key={topic}
                  lp={lp}
                  setLp={setLp}
                  conceptDetails={conceptDetails}
                />
              )
            }
          </ViewSwap>
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
      {ghost && <BarGhost bar={ghost} onGone={clearGhost} />}
    </main>
  );
}

// The full loading bar, painted where it was and dissolving over the opening card.
function BarGhost({ bar, onGone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const animation = play(ref.current, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 200,
      easing: "ease",
      fill: "forwards",
    });
    onDone(animation, onGone);
    return () => animation?.cancel();
  }, [onGone]);
  return (
    <div
      ref={ref}
      className="bar-ghost"
      aria-hidden="true"
      style={{
        left: bar.left,
        top: bar.top,
        width: bar.width,
        height: bar.height,
      }}
    />
  );
}

// "Copy path" rolls to a drawn check and "Copied"; the button never changes width.
function CopyLabel({ copied }) {
  const labelRef = useRef(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const label = labelRef.current;
    const text = label.querySelector(".copy-label-text");
    const done = label.querySelector(".copy-label-done");
    const outEl = copied ? text : done;
    const inEl = copied ? done : text;
    // Read before cancelling, so a swap mid-roll continues from where it is.
    const outFrom = readOpacity(outEl);
    const inFrom = readOpacity(inEl);
    cancelAnimationsWithin(label);
    outEl.style.opacity = "0";
    inEl.style.opacity = "1";
    if (prefersReducedMotion()) return;
    play(
      outEl,
      [
        { opacity: outFrom, translate: "0 0", filter: "blur(0px)" },
        { opacity: 0, translate: "0 -6px", filter: "blur(2px)" },
      ],
      { duration: 160, easing: EASE_OUT },
    );
    play(
      inEl,
      [
        { opacity: inFrom, translate: "0 6px", filter: "blur(2px)" },
        { opacity: 1, translate: "0 0", filter: "blur(0px)" },
      ],
      { duration: 240, delay: 40, easing: EASE_OUT, fill: "backwards" },
    );
    if (copied) {
      play(
        label.querySelector(".copy-check path"),
        [{ strokeDashoffset: 14 }, { strokeDashoffset: 0 }],
        { duration: 300, delay: 100, easing: EASE_OUT, fill: "backwards" },
      );
    }
  }, [copied]);

  useEffect(() => {
    const label = labelRef.current;
    return () => cancelAnimationsWithin(label);
  }, []);

  // The text span keeps the space that a flex container drops.
  return (
    <span className="copy-label" ref={labelRef}>
      <span className="copy-label-text">
        Copy<span className="action-noun"> path</span>
      </span>
      <span className="copy-label-done" aria-hidden="true">
        <svg className="copy-check" viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
        <span className="copy-done-text">Copied</span>
      </span>
    </span>
  );
}

function SearchMore() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  function goSearch(form) {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return;
    }

    // The typed topic flies into the next page's heading.
    rememberTopicMorph(trimmedTerm, form);
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
        goSearch(event.currentTarget);
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
    active,
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
        // Hide every concept's details during any drag: a tooltip opening under the
        // pointer resizes the page and makes keyboard drags oscillate between targets.
        hideDetails={active !== null}
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
  // The tooltip stays mounted through its exit; reopening reverses the same element.
  const [tooltipShown, setTooltipShown] = useState(false);
  if (showDetails && !tooltipShown) setTooltipShown(true);
  const tooltipRef = useRef(null);
  const detailsOpen = useRef(showDetails);

  useLayoutEffect(() => {
    detailsOpen.current = showDetails;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const reduced = prefersReducedMotion();
    let from = showDetails
      ? { opacity: 0, scale: "0.96" }
      : { opacity: 1, scale: "1" };
    if (tooltip.getAnimations().length > 0) {
      const { scale } = getComputedStyle(tooltip);
      from = {
        opacity: readOpacity(tooltip),
        scale: scale && scale !== "none" ? scale : "1",
      };
    }
    // A finished exit still holds opacity 0 with its forwards fill, untracked.
    for (const animation of tooltip.getAnimations()) animation.cancel();
    const to = showDetails
      ? { opacity: 1, scale: "1" }
      : { opacity: 0, scale: "0.98" };
    const keyframes = reduced
      ? [{ opacity: from.opacity }, { opacity: to.opacity }]
      : [from, to];
    const animation = play(tooltip, keyframes, {
      duration: showDetails && !reduced ? 150 : 100,
      easing: EASE_OUT,
      fill: showDetails ? "none" : "forwards",
    });
    if (!showDetails) {
      onDone(animation, () => {
        if (!detailsOpen.current) setTooltipShown(false);
      });
    }
  }, [showDetails]);

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
          {tooltipShown && (
            <div
              ref={tooltipRef}
              className={`concept-tooltip${showDetails ? "" : " is-closing"}`}
              id={detailId}
              role="region"
              aria-label={id + " details"}
              aria-hidden={showDetails ? undefined : "true"}
              inert={!showDetails}
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
