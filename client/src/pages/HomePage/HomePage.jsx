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
      <h1>Learn Anything</h1>
      <h2>Generate a learning path for anything that's on your mind</h2>
      <div style={{ height: "4px" }} />
      <h2>
        <div class="gradient-text">500</div> paths generated so far...
      </h2>
      <div style={{ height: "25px" }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <SearchbarHome onChange={onChange} onEnter={goSearch} />
        <div style={{ width: "15px" }} className="desktop-only" />
        <Button label={"Search"} className="desktop-only" onClick={goSearch} />
      </div>
      <div style={{ height: "15px" }} />
      <div
        style={{ textAlign: "center", width: "100%" }}
        className="mobile-only"
      >
        <Button label={"Search"} inline onClick={goSearch} />
      </div>
    </div>
  );
}

export const SearchbarHome = ({ onChange, onEnter }) => {
  const placeholders = [
    "code",
    "JavaScript",
    "learn React JS",
    "become famous",
    "fish",
    "make money",
    "get a job",
    "negotiate effectively",
    "manage time and be more productive",
    "lead and manage a team",
    "give presentations",
    "public speeches",
    "sell or market products",
    "network and build professional relationships",
    "write creative content",
    "cook",
    "swim",
    "surf",
    "meditate",
    "invest money",
    "drive a car",
    "speak effectively",
    "paint",
    "draw",
    "invest in real estate",
    "speak another language",
    "play a musical instrument",
    "garden",
    "dance",
    "ride a motorcycle",
    "practice mindfulness",
    "give massages",
    "play chess",
    "climb a mountain",
    "go on a long distance hike",
    "run a marathon",
    "learn self-defense",
    "train a pet",
    "write a novel",
    "start a blog",
    "make a podcast",
    "create a YouTube channel",
    "make a website",
    "design a logo",
    "create a social media marketing campaign",
    "make a short film",
    "write and produce music",
    "build a model airplane",
    "knit or crochet",
    "build a piece of furniture",
    "take professional photographs",
    "write and publish a cookbook",
    "create a board game",
    "make a video game",
    "design and 3D print an object",
    "create a mobile app",
    "design and sew a piece of clothing",
    "write and produce a play",
    "write and illustrate a children's book",
    "paint a series of portraits.",
    "skydive",
    "scuba dive",
    "sail a boat",
    "snowboard",
    "ski",
    "rock climb",
    "play golf",
    "do magic tricks",
    "juggle",
    "do pottery",
    "stop bad habits",
    "help the world",
    "help out",
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
          (prevPlaceholderIndex) =>
            (prevPlaceholderIndex + 1) % placeholders.length
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
