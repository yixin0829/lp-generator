import React from "react";

import "./AboutPage.scss";
import JK from "../../assets/JK.jpg";
import YT from "../../assets/YT.jpg";
import { SITE_URL, SITE_NAME } from "../../config/site";
import Seo from "../../seo/Seo";

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about`,
      url: `${SITE_URL}/about`,
      name: `About ${SITE_NAME}`,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ["https://github.com/yixin0829/lp-generator"],
      member: [
        { "@id": `${SITE_URL}/#person-yixin` },
        { "@id": `${SITE_URL}/#person-james` },
      ],
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person-yixin`,
      name: "Yixin Tian",
      url: "https://www.yixtian.com",
      sameAs: [
        "https://github.com/yixin0829",
        "https://www.linkedin.com/in/yixintian/",
      ],
      jobTitle: "Computer Engineer",
      knowsAbout: [
        "Human-AI Interaction",
        "Personal Knowledge Management",
        "Machine Learning",
      ],
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person-james`,
      name: "James Kokoska",
      sameAs: ["https://github.com/jameskokoska"],
      knowsAbout: ["Frontend Development", "Web Development"],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "About",
          item: `${SITE_URL}/about`,
        },
      ],
    },
  ],
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <Seo
        title="About"
        description="Meet the developers behind LearnAnything — an AI-powered learning path generator that helps you learn any topic from beginner to advanced."
        path="/about"
        jsonLd={aboutJsonLd}
      />
      <div style={{ height: "100px" }} />
      <h1>About</h1>
      <p>Why did we build LearnAnything? You might ask. Well, we want you to think of LearnAnything as more than just a learning path generator, but as an entry point for YOU to begin your learning journey on any topic that you could possibly imagine. Just as Mahatma Gandhi once said, "Live as if you were to die tomorrow. Learn as if you were to live forever."</p>
      <div style={{ height: "30px" }} />
      <h1>Meet the Devs</h1>
      <div style={{ height: "10px" }} />
      <div className="about-container">
        <Person
          personDescription={
            "Yixin is a computer engineer located in Toronto, Canada. He is interested in human-AI interaction research, personal knowledge management, drumming and films."
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
