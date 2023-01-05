import React from "react";

import "./LoadingSpinner.scss";

export default function LoadingSpinner() {
  const loadingTexts = [
    "Generating personalized learning path...",
    "Mapping out your journey to knowledge...",
    "Assembling the building blocks for success...",
    "Navigating the road to learning...",
    "Discovering new educational horizons...",
    "Finding the path that fits your needs...",
    "Creating a customized learning experience...",
    "Uncovering the best way to reach your goals...",
    "Breaking down problems and finding solutions...",
    "Helping you take the first steps towards success...",
    "Constructing a roadmap to learning...",
    "Gathering the tools you need to succeed...",
    "Organizing the path to your goals...",
    "Designing a learning plan just for you...",
    "Fitting the pieces of your education together...",
    "Finding the right resources for your needs...",
    "Crafting a personalized learning strategy...",
    "Assembling the right plan for your goals...",
    "Helping you chart a course to success...",
    "Putting the pieces of your learning puzzle together...",
    "Gathering data from across the universe...",
    "Searching through the vast expanse of knowledge...",
    "Sifting through the sands of time...",
    "Please wait while we process your request...",
    "The wait will be worth it, we promise...",
    "Just a moment while we gather the information you need...",
    "Hold tight while we search for the answers you seek...",
    "One moment while we retrieve the data you requested...",
    "Searching through the endless expanse of the internet...",
    "Just a moment while we bring you the information you desire...",
  ];
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
      <div style={{ height: "10px" }} />
      <p>{loadingTexts[Math.floor(Math.random() * loadingTexts.length)]}</p>
    </div>
  );
}
