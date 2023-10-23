import React, { useEffect, useState } from "react";
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

async function generateLp(topic) {
  try {
    // const response = await fetch(`http://127.0.0.1:8000/v1/lp/${topic}`);
    const response = await fetch(
      `http://3.12.34.202:8000/v2/lp/${topic}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
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
  const [lp, setLp] = useState();
  const [badRequest, setBadRequest] = useState();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term");
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  useEffect(() => {
    const getLp = async () => {
      const result = await generateLp(topic);
      if (result.status_code !== 200) {
        setBadRequest(true);
      } else {
        setLp(result.completion);
      }
    };
    getLp();
  }, []);

  return (
    <div className="learning-path-page">
      <div className="title-container">
        <h1>
          Learning <div className="gradient-text">{topic}</div> ...
        </h1>
        <img
          src={CopyToClip}
          className="copy-button"
          onClick={(e) => {
            copyToClipboard(lp, enqueueSnackbar);
          }}
          alt="copy"
        ></img>
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
        <LPItems lp={lp} setLp={setLp} />
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
          <LoadingSpinner />
        </div>
      )}
      <div style={{ height: "30px" }} />
    </div>
  );
}

const SearchMore = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const onChange = (text) => {
    setSearchTerm(text);
  };

  const goSearch = () => {
    if (searchTerm === "") {
      return;
    }
    navigate({
      pathname: "/learningpath",
      search: `?term=${searchTerm}`,
    });
  };
  return (
    <div style={{ textAlign: "center" }} className="search-more">
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <SearchbarHome onChange={onChange} onEnter={goSearch} />
        <div style={{ width: "15px" }} className="desktop-only" />
        <Button label={"Generate"} className="desktop-only" onClick={goSearch} />
      </div>
      <div style={{ height: "15px" }} />
    </div>
  );
};

const LPItems = ({ lp, setLp }) => {
  const [items, setItems] = useState(lp);
  const [activeId, setActiveId] = useState();
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
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
          items[activeContainer][activeIndex],
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ],
      };
      setLp(out);
      return out;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    const { id } = active;
    const { id: overId } = over;
    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);
    if (
      !activeContainer ||
      !overContainer ||
      activeContainer !== overContainer
    ) {
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
        {Object.keys(items).map((itemsKey) => {
          return <Container id={itemsKey} items={items[itemsKey]} />;
        })}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId ? <Item id={activeId} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

const Container = (props) => {
  const { id, items } = props;
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext
      id={id}
      items={items}
      strategy={verticalListSortingStrategy}
    >
      <div ref={setNodeRef} className="level-container">
        <h2>{id}</h2>
        {items.map((id) => (
          <SortableItem key={id} id={id} />
        ))}
      </div>
    </SortableContext>
  );
};

const SortableItem = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : "",
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Item id={props.id} style={{ opacity: isDragging ? 0.5 : 1 }} />
    </div>
  );
};

const Item = ({ id, style }) => {
  return (
    <div style={{ ...style }}>
      <li>{id}</li>
    </div>
  );
};
