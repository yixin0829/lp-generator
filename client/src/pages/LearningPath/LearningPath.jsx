import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
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
import { isDetailsOpen, nextDetails } from "./conceptDetails";
import {
  failureCopy,
  failureReason,
  failureScreen,
} from "./generationFailure";
import { generationReducer, initialGeneration } from "./generationMachine";
import { initialShare, shareReducer } from "./shareMachine";

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
// The backend's default limit (LP_RATE_LIMIT, 15/minute) clears within a minute.
const RATE_LIMIT_WAIT_MS = 60_000;

// Resolves to the generation machine's next event: the path, or why there is none.
async function requestPath(topic) {
  let response;
  try {
    response = await fetch(apiUrl(`/v1/lp/${encodeURIComponent(topic)}`));
  } catch (error) {
    console.error("[LearningPath] requestPath error:", error);
    return { type: "failed", reason: "offline" };
  }
  // The platform's own errors, such as its 504, are not JSON.
  const body = await response.json().catch(() => null);
  const completion = body?.completion;
  if (
    response.status === 200 &&
    completion &&
    typeof completion === "object" &&
    !Array.isArray(completion)
  ) {
    return { type: "succeeded", path: extractPath(completion) };
  }
  return { type: "failed", reason: failureReason(response.status, body?.code) };
}

function extractPath(completion) {
  const details = {};
  const levels = {};
  const graph = {
    nodes: completion.nodes || [],
    edges: completion.edges || [],
  };

  for (const level of LEVEL_ORDER) {
    const concepts = completion[level];
    if (!concepts) continue;
    levels[level] = concepts.map((c) => {
      if (typeof c === "string") return c;
      details[c.name] = {
        summary: c.summary,
        why: c.why,
        connection: c.connection,
      };
      return c.name;
    });
  }
  return { levels, details, graph };
}

// The link goes to the clipboard, or the reader is told to copy it by hand.
async function copyShareLink(url, showSnackbar, { created }) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("No clipboard.");
    await navigator.clipboard.writeText(url);
    showSnackbar("Share link copied! Anyone with the link can view this copy.");
  } catch {
    showSnackbar(
      created
        ? "Share created. Copy the link shown below."
        : "Copy the link shown below.",
    );
  }
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
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term")?.trim() ?? "";
  // See generationMachine.js for the phases and shareMachine.js for the link's.
  const [generation, dispatch] = useReducer(
    generationReducer,
    topic,
    initialGeneration,
  );
  const [share, dispatchShare] = useReducer(shareReducer, initialShare);
  // A new topic on the same mounted page starts both machines over.
  if (generation.topic !== topic) {
    dispatch({ type: "topicChanged", topic });
    dispatchShare({ type: "reset" });
  }
  const { phase, path } = generation;
  const ready = phase === "ready";
  const [viewMode, setViewMode] = useState("graph");
  const mainRef = useRef(null);
  const viewRef = useRef(null);
  // The loading bar's document rect at completion; the card opens out of it.
  const barRef = useRef(null);
  const revealPath = useCallback((bar) => {
    barRef.current = bar ?? null;
    dispatch({ type: "revealed" });
  }, []);
  const reorder = useCallback((levels) => {
    dispatch({ type: "reordered", levels });
    dispatchShare({ type: "edited" });
  }, []);
  const [ghost, setGhost] = useState(null);
  const clearGhost = useCallback(() => setGhost(null), []);
  const [entrance] = useState(playsFirstLoadEntrance);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  const shareRowRef = useRef(null);
  const shareFromTop = useRef(null);
  const { enqueueSnackbar } = useSnackbar();
  const isSharing = share.phase === "creating";
  const hasShareRow = Boolean(share.url);

  async function copyPath() {
    if (
      !(await copyToClipboard(path?.levels, path?.details, enqueueSnackbar))
    ) {
      return;
    }
    // Repeated copies extend the Copied state instead of queueing another.
    clearTimeout(copiedTimer.current);
    setCopied(true);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function shareLearningPath() {
    if (share.phase === "shared") {
      // The path has not changed since the link was made, so there is nothing new to save.
      await copyShareLink(share.url, enqueueSnackbar, { created: false });
      return;
    }
    if (!ready || isSharing) return;
    const view = viewRef.current;
    shareFromTop.current = view
      ? view.getBoundingClientRect().top + window.scrollY
      : null;
    dispatchShare({ type: "requested" });
    try {
      const response = await fetch(apiUrl("/v1/shares"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createShareSnapshot({
            topic,
            levels: path.levels,
            conceptDetails: path.details,
            graph: path.graph,
            defaultView: viewMode,
          }),
        ),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.share_id) {
        enqueueSnackbar(shareErrorMessage(response.status, body));
        dispatchShare({ type: "failed" });
        return;
      }
      const url = `${window.location.origin}/share/${body.share_id}`;
      dispatchShare({ type: "created", url });
      await copyShareLink(url, enqueueSnackbar, { created: true });
    } catch {
      enqueueSnackbar(
        "Couldn't reach the server. Check your connection and try again.",
      );
      dispatchShare({ type: "failed" });
    }
  }

  // Each attempt asks once; an answer for an earlier topic or attempt is dropped.
  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    requestPath(topic).then((event) => {
      if (!cancelled) dispatch(event);
    });
    return () => {
      cancelled = true;
    };
  }, [topic, generation.attempt]);

  // A direct link rises in, the bar 60 ms after the title; client-side arrivals
  // get the route crossfade.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!entrance || !main || prefersReducedMotion()) return;
    const animations = [
      [":scope > .title-container", 0],
      [".loading-progress-container", 60],
    ].map(([selector, delay]) =>
      play(main.querySelector(selector), ENTRANCE, {
        duration: 400,
        delay,
        easing: EASE_OUT,
        fill: "backwards",
      }),
    );
    return () => animations.forEach((animation) => animation?.cancel());
  }, [entrance]);

  // Runs after the children's layout effects, so the graph is built and the pill placed.
  useLayoutEffect(() => {
    const main = mainRef.current;
    const view = viewRef.current;
    const bar = barRef.current;
    barRef.current = null;
    if (!ready || !main || !view) return;
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
  }, [ready]);

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

  if (phase === "idle") {
    return (
      <main className="learning-path-page">
        <Seo title="Learning Path" noindex />
        <h2 className="bad-request">What do you want to learn?</h2>
        <SearchMore />
      </main>
    );
  }

  const failed = phase === "failed";
  const hasGraph = path?.graph.nodes.length > 0;

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
      {ready && (
        <p className="path-helper">
          {viewMode === "graph"
            ? "Select a concept to see how it connects to the others."
            : "Drag and drop concepts to reorder them, then copy the path to your notes!"}
        </p>
      )}
      {failed || ready ? <SearchMore /> : <div></div>}
      {failed ? (
        <FailurePanel
          reason={generation.reason}
          onRetry={() => dispatch({ type: "retried" })}
        />
      ) : ready ? (
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
          {share.url && (
            <p className="share-result" ref={shareRowRef}>
              <a href={share.url} target="_blank" rel="noopener noreferrer">
                Open share link <span aria-hidden="true">↗</span>
              </a>
              {share.phase === "shared" ? (
                <span className="share-url">{share.url}</span>
              ) : (
                <span className="share-stale">
                  Shows the earlier order. Share again for a new link.
                </span>
              )}
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
                  nodes={path.graph.nodes}
                  edges={path.graph.edges}
                  reveal={initial}
                />
              ) : (
                <LPItems
                  key={topic}
                  levels={path.levels}
                  onReorder={reorder}
                  conceptDetails={path.details}
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
          <LoadingProgress
            key={`${topic}:${generation.attempt}`}
            estimateGeneration
            complete={phase === "completing"}
            onComplete={revealPath}
          />
        </div>
      )}
      <div style={{ height: "30px" }} />
      {ghost && <BarGhost bar={ghost} onGone={clearGhost} />}
    </main>
  );
}

// What went wrong, with the way forward that fits the reason.
function FailurePanel({ reason, onRetry }) {
  const screen = failureScreen(reason);
  const { heading, body } = failureCopy(reason);
  const copyClass = screen === "flagged" ? "bad-request" : undefined;
  return (
    <div className="status-panel" role="alert">
      <h2 className={copyClass}>{heading}</h2>
      <p className={copyClass}>{body}</p>
      {screen === "retry" && <Button label="Try again" onClick={onRetry} />}
      {screen === "wait" && <RetryAfterWait onRetry={onRetry} />}
    </div>
  );
}

// A retry inside the rate limit's window would be turned away again, so the
// button counts the window down first.
function RetryAfterWait({ onRetry }) {
  const [secondsLeft, setSecondsLeft] = useState(RATE_LIMIT_WAIT_MS / 1000);

  useEffect(() => {
    const end = performance.now() + RATE_LIMIT_WAIT_MS;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const waiting = secondsLeft > 0;
  return (
    <Button
      aria-label="Try again"
      label={
        waiting ? (
          // Hidden from assistive tech, so the alert is read once and not every second.
          <span aria-hidden="true">Try again in {secondsLeft} s</span>
        ) : (
          "Try again"
        )
      }
      disabled={waiting}
      onClick={onRetry}
    />
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

function LPItems({ levels, onReorder, conceptDetails }) {
  const [items, setItems] = useState(levels);
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
    setItems(levels);
  }, [levels]);

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
      onReorder(out);
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
        onReorder(nextItems);
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
  // closed, peek, pinned or dismissed: see conceptDetails.js.
  const [mode, setMode] = useState("closed");
  const send = (event) => setMode((current) => nextDetails(current, event));
  // A finger never hovers: on touch the card opens and shuts by tapping.
  const sendHover = (event, pointer) => {
    if (pointer.pointerType !== "touch") send(event);
  };
  const detailId = useId();
  const showDetails = !hideDetails && isDetailsOpen(mode);
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
          onPointerEnter={(event) => sendHover("enter", event)}
          onPointerLeave={(event) => sendHover("leave", event)}
        >
          <button
            type="button"
            className="concept-summary"
            aria-expanded={showDetails}
            aria-controls={detailId}
            onClick={() => send("toggle")}
            onKeyDown={(event) => {
              if (event.key === "Escape") send("escape");
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
