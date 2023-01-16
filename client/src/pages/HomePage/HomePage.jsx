import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Searchbar from "../../components/Searchbar/Searchbar";
import Button from "../../components/Button/Button";

import "./HomePage.scss";
import logo from "../../assets/logo.png";

export default function HomePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [lpCounter, setLpCounter] = useState(0);

  useEffect(() => {
    // Use https://api.countapi.xyz/get/learn-anything.ca/test for testing
    fetch("https://api.countapi.xyz/get/learn-anything.ca/lp_counter_new")
      .then((res) => res.json())
      .then((res) => {
        setLpCounter(res.value);
      });
  }, []);

  const onChange = (text) => {
    setSearchTerm(text);
  };

  const goSearch = () => {
    if (searchTerm === "") {
      return;
    }

    fetch(
      "https://api.countapi.xyz/update/learn-anything.ca/lp_counter_new/?amount=1"
    )
      .then((res) => res.json())
      .then((res) => {
        setLpCounter(res.value);
      });

    navigate({
      pathname: "/learningpath",
      search: `?term=${searchTerm}`,
    });
  };

  return (
    <div className="home-page">
      <div
        style={{ paddingTop: "100px", textAlign: "center", width: "100%" }}
        className="mobile-only"
      >
        <img inline src={logo} width={100} height={100}></img>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <h1>LearnAnything</h1>
        <div style={{ width: "15px" }} className="desktop-only" />
        <img className="desktop-only" src={logo} width={100} height={100}></img>
      </div>
      <div style={{ height: "4px" }} />
      <h2 className="header-shadow">
        Generate a learning path for anything that's on your mind.
      </h2>
      <div style={{ height: "4px" }} />
      <h2>
        <div className="gradient-text">{lpCounter != 0 ? lpCounter : ""}</div>{" "}
        paths have been generated and learnt.
      </h2>
      <div style={{ height: "25px" }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <SearchbarHome onChange={onChange} onEnter={goSearch} />
        <div style={{ width: "15px" }} className="desktop-only" />
        <Button label={"Generate"} className="desktop-only" onClick={goSearch} />
      </div>
      <div style={{ height: "15px" }} />
      <div
        style={{ paddingTop: "10px", textAlign: "center", width: "100%" }}
        className="mobile-only"
      >
        <Button label={"Generate"} inline onClick={goSearch} />
      </div>
      <Recommended />
    </div>
  );
}

const placeholders = [
  "How to code",
  "Coding",
  "JavaScript",
  "React JS",
  "How to become famous",
  "Becoming famous",
  "How to fish",
  "Fishing",
  "How to apply a job",
  "How to negotiate effectively",
  "Negotiation",
  "How to manage time and be more productive",
  "Time management",
  "How to lead and manage a team",
  "Team management and leadership",
  "How to give presentations",
  "Public speaking",
  "How to sell or market products",
  "Sales and marketing",
  "How to network and build professional relationships",
  "Career networking",
  "How to write creative content",
  "Creative writing",
  "How to cook",
  "Cooking",
  "How to swim",
  "Swimming",
  "How to surf",
  "How to practice mindfulness",
  "How to meditate",
  "Meditation",
  "How to paint",
  "Digital drawing",
  "Blockchain",
  "How to invest in real estate",
  "Real estate investing",
  "How to speak another language",
  "Speaking another language",
  "How to play a musical instrument",
  "Playing a musical instrument",
  "How to garden",
  "Gardening",
  "How to dance",
  "Street dancing",
  "How to ride a motorcycle",
  "Riding a motorcycle",
  "How to give massages",
  "How to play chess",
  "Playing chess",
  "How to rock climb",
  "Rock climbing",
  "How to backpack",
  "Backpacking",
  "How to run a marathon",
  "Running a marathon",
  "How to learn self-defense",
  "How to train a pet",
  "How to write a novel",
  "How to start a blog",
  "How to make a podcast",
  "How to create a YouTube channel",
  "How to make a website",
  "How to design a logo",
  "How to create a social media marketing campaign",
  "How to make a short film",
  "How to write and produce music",
  "How to build a model airplane",
  "How to knit or crochet",
  "How to build a piece of furniture",
  "How to take professional photographs",
  "How to write and publish a cookbook",
  "How to create a board game",
  "How to make a video game",
  "How to design and 3D print an object",
  "How to create a mobile app",
  "How to design and sew a piece of clothing",
  "How to write and produce a play",
  "How to write and illustrate a children's book",
  "How to paint a series of portraits.",
  "How to skydive",
  "How to scuba dive",
  "How to sail a boat",
  "How to snowboard",
  "How to ski",
  "How to play golf",
  "How to do magic tricks",
  "How to juggle",
  "How to do pottery",
  "How to stop bad habits",
  "How to change the world",
  "Changing the world",
  "How to love",
  "Love",
];

export const Recommended = () => {
  const navigate = useNavigate();

  const [placeholdersState, setPlaceholdersState] = useState(
    placeholders.sort(() => Math.random() - 0.5).slice(0, 5)
  );

  const onClick = (searchTerm) => {
    fetch(
      "https://api.countapi.xyz/update/learn-anything.ca/lp_counter/?amount=1"
    );

    navigate({
      pathname: "/learningpath",
      search: `?term=${searchTerm}`,
    });
  };

  return (
    <div>
      <h3 className="recommended-header">Recommended</h3>
      <div className="recommended-container">
        {placeholdersState.map((element) => {
          return (
            <div
              onClick={() => onClick(element)}
              className="recommended-prompt"
            >
              {element}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SearchbarHome = ({ onChange, onEnter }) => {
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
            (prevPlaceholderIndex +
              Math.floor(Math.random() * placeholders.length)) %
            placeholders.length
        );
      }, 350);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Searchbar
      placeholder={"e.g. " + placeholders[placeholderIndex] + "..."}
      className={
        placeholderSwitch ? "text-input-search-placeholder-transition" : ""
      }
      onChange={onChange}
      onEnterKey={onEnter}
    ></Searchbar>
  );
};
