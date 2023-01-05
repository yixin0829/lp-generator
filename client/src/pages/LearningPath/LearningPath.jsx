import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import { Container, Draggable } from "react-smooth-dnd";

import "./LearningPath.scss";

import CopyToClip from "../../assets/copy-regular.svg";
import SpaceShip from "../../assets/spaceship.png";
import { SearchbarHome } from "../HomePage/HomePage";
import Button from "../../components/Button/Button";

async function generateLp(topic) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/v1/lp/${topic}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

const applyDrag = (arr, dragResult) => {
  const { removedIndex, addedIndex, payload } = dragResult;
  if (removedIndex === null && addedIndex === null) return arr;

  const result = [...arr];
  let itemToAdd = payload;

  if (removedIndex !== null) {
    itemToAdd = result.splice(removedIndex, 1)[0];
  }

  if (addedIndex !== null) {
    result.splice(addedIndex, 0, itemToAdd);
  }

  return result;
};

function useForceUpdate() {
  const [value, setValue] = useState(0);
  return () => setValue((value) => value + 1);
}

function copyToClipboard(lp) {
  let out = "";
  for (const title of Object.keys(lp)) {
    out = out + title + "\n";
    for (const step of lp[title]) {
      out = out + "\t" + step + "\n";
    }
  }
  navigator.clipboard.writeText(out);
}

export default function LearningPath() {
  const [lp, setLp] = useState();
  const [badRequest, setBadRequest] = useState();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term");
  const forceUpdate = useForceUpdate();

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
        <h1>{topic}</h1>
        <img
          src={CopyToClip}
          className="copy-button"
          onClick={(e) => {
            copyToClipboard(lp);
          }}
          alt="copy"
        ></img>
      </div>
      {badRequest || lp ? <SearchMore /> : <div></div>}
      {badRequest ? (
        <div>
          <img src={SpaceShip} className="full-img" alt="" />
          <h2 className="bad-request">
            Please try again with another response.
          </h2>
        </div>
      ) : lp ? (
        <div className="flex-container">
          {Object.keys(lp).map((lpSection) => {
            return (
              <div key={lpSection.toString()} className="level-container">
                <h2>{lpSection}</h2>
                <Container
                  dragBeginDelay={window.innerWidth <= 767 ? 500 : 0}
                  key={lpSection.toString()}
                  groupName={"1"}
                  getChildPayload={(i) => lp[lpSection][i]}
                  onDrop={(dropResult) => {
                    lp[lpSection] = applyDrag(lp[lpSection], dropResult);
                    setLp(lp);
                    forceUpdate();
                  }}
                >
                  {lp[lpSection].map((item, index) => {
                    return (
                      <Draggable key={item.toString() + indexedDB.toString()}>
                        <li key={item.toString() + indexedDB.toString()}>
                          {item}
                        </li>
                      </Draggable>
                    );
                  })}
                </Container>
              </div>
            );
          })}
        </div>
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
        <Button label={"Search"} className="desktop-only" onClick={goSearch} />
      </div>
      <div style={{ height: "15px" }} />
    </div>
  );
};
