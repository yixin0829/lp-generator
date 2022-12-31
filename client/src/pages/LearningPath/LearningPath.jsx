import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import { Container, Draggable } from "react-smooth-dnd";

import "./LearningPath.scss";

import CopyToClip from "../../assets/copy-regular.svg";

async function generateLp(topic) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/v1/lp/${topic}`);
    const data = await response.json();
    console.log(data.completion);
    return data.completion;
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
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("term");
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const getLp = async () => {
      const result = await generateLp(topic);
      setLp(result);
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
      {lp ? (
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
              // <div key={lpSection.toString()} className="level-container">
              //   <h2>{lpSection}</h2>
              //   <ul>
              //     {lp[lpSection].map((item, index) => {
              //       return (
              //         <li key={item.toString() + indexedDB.toString()}>
              //           {item}
              //         </li>
              //       );
              //     })}
              //   </ul>
              // </div>
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
    </div>
  );
}
