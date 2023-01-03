import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Searchbar from "../../components/Searchbar/Searchbar";
import Button from "../../components/Button/Button";

import "./HomePage.scss";

export default function HomePage() {
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
    <div className="home-page">
      <h1>Learn Everything!!</h1>
      <h2>Generate a learning path for anything that's on your mind</h2>
      <div style={{ height: "15px" }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <SearchbarHome onChange={onChange} onEnter={goSearch} />
        <div style={{ width: "15px" }} className="desktop-only" />
        <Button label={"Search"} className="desktop-only" />
      </div>
      <div style={{ height: "15px" }} />
      <div
        style={{ textAlign: "center", width: "100%" }}
        className="mobile-only"
      >
        <Button label={"Search"} inline />
      </div>
    </div>
  );
}

const SearchbarHome = ({ onChange, onEnter }) => {
  const placeholders = [
    "code",
    "JavaScript",
    "React",
    "become famous",
    "fish",
    "make money",
    "get a job",
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(
    Math.floor(Math.random() * placeholders.length)
  );
  const [placeholderSwitch, setPlaceholderSwitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderSwitch(true);
      setTimeout(() => {
        setPlaceholderSwitch(false);
        setPlaceholderIndex(
          (prevPlaceholderIndex) => (prevPlaceholderIndex + 1) % 4
        );
      }, 350);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Searchbar
      placeholder={"How to " + placeholders[placeholderIndex] + "..."}
      className={
        placeholderSwitch ? "text-input-search-placeholder-transition" : ""
      }
      onChange={onChange}
      onEnterKey={onEnter}
    ></Searchbar>
  );
};
