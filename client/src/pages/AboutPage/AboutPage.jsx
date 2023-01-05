import React from "react";

import "./AboutPage.scss";
import JK from "../../assets/JK.jpg";
import YT from "../../assets/YT.jpg";

export default function AboutPage() {
  return (
    <div className="about-page">
      <div style={{ height: "100px" }} />
      <h1>About</h1>
      <p>This application helps people learn anything they want!</p>
      <p>Write something more detailed here eventually...</p>
      <div style={{ height: "30px" }} />
      <h1>Meet the Devs</h1>
      <div style={{ height: "10px" }} />
      <div className="about-container">
        <Person
          personDescription={
            "Artist at heart, Yixin is a senior Computer Engineering student studying at the University of Toronto. He is currently interested in running, chess, NLP, graph learning, Techno, films and digital painting."
          }
          personImage={YT}
          personName={"Yixin Tian"}
        />
        <Person
          personDescription={
            "James loves frontend and web development! Enjoy using this website to learn about anything you want!"
          }
          personImage={JK}
          personName={"James Kokoska"}
        />
      </div>
      <div style={{ height: "50px" }} />
    </div>
  );
}

const Person = ({ personName, personDescription, personImage }) => {
  return (
    <div className="person-bio">
      <img src={personImage} alt="dev img" />
      <h3>{personName}</h3>
      <p>{personDescription}</p>
    </div>
  );
};
