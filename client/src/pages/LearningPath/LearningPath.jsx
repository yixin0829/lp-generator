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

async function generateLp(topic) {
  if (!topic || typeof topic !== "string") {
    return [null, 400];
  }
  try {
    const response = await fetch(apiUrl(`/v1/lp/${encodeURIComponent(topic)}`));
    const data = await response.json();
    return [data, response.status];
  } catch (error) {
    console.error("[LearningPath] generateLp error:", error);
    return [null, 500];
  }
}

function copyToClipboard(lp, showSnackbar) {
  if (!lp) {
    showSnackbar("Please wait until the learning path is generated!");
    return;
  }
  let out = "";
  for (const title of Object.keys(lp)) {
    out = out + title + "\n";
    for (const step of lp[title]) {
      out = out + "\t" + step + "\n";
    }
  }
  navigator.clipboard.writeText(out);
  showSnackbar("Copied to clipboard!");
}

export default function LearningPath() {
  const [lp, setLp] = useState(null);
  const [badRequest, setBadRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term")?.trim() ?? "";
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    setLp(null);
    setBadRequest(false);

    if (!topic) {
      setBadRequest(true);
      return;
    }

    let cancelled = false;
    const getLp = async () => {
      setIsLoading(true);
      const [result, statusCode] = await generateLp(topic);
      if (cancelled) return;

      const completion = result?.completion;
      const hasValidCompletion =
        completion &&
        typeof completion === "object" &&
        !Array.isArray(completion) &&
        Object.values(completion).every((value) => Array.isArray(value));

      if (statusCode !== 200 || !hasValidCompletion) {
        setBadRequest(true);
      } else {
        setLp(completion);
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
        <h2 className="bad-request">Please provide a topic in the URL (?term=...).</h2>
        <SearchMore />
      </div>
    );
  }

  return (
    <div className="learning-path-page">
      <div className="title-container">
        <h1>
          Learning <div className="gradient-text">{topic}</div> ...
        </h1>
        <img
          src={CopyToClip}
          className="copy-button"
          onClick={() => {
            copyToClipboard(lp, enqueueSnackbar);
          }}
          alt="copy"
        />
      </div>
      <p>
        Drag and drop bullets to reorder and copy the result to your own notes!
      </p>
      {badRequest || lp ? <SearchMore /> : <div></div>}
      {badRequest ? (
        <div>
          <img src={SpaceShip} className="full-img" alt="" />
          <h2 className="bad-request">
            Please try again with another response.
          </h2>
        </div>
      ) : lp ? (
        <LPItems key={topic} lp={lp} setLp={setLp} />
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

function LPItems({ lp, setLp }) {
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
          <Container key={itemsKey} id={itemsKey} items={items[itemsKey]} />
        ))}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId ? <Item id={activeId} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Container({ id, items }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <SortableContext
      id={id}
      items={items}
      strategy={verticalListSortingStrategy}
    >
      <div ref={setNodeRef} className="level-container">
        <h2>{id}</h2>
        {(Array.isArray(items) ? items : []).map((id) => (
          <SortableItem key={id} id={id} />
        ))}
      </div>
    </SortableContext>
  );
}

function SortableItem({ id }) {
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
      <Item id={id} style={{ opacity: isDragging ? 0.5 : 1 }} />
    </div>
  );
}

function Item({ id, style }) {
  return (
    <div style={style}>
      <li>{id}</li>
    </div>
  );
}
