import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import Searchbar from "../../components/Searchbar/Searchbar";
import { apiUrl } from "../../config/api";
import { SITE_URL, SITE_NAME } from "../../config/site";
import Seo from "../../seo/Seo";
import {
  findPublicTopicByAlias,
  publicTopicBySlug,
} from "../../data/publicTopics";

import logo from "../../assets/logo.png";
import "./HomePage.scss";

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description:
        "Generate structured learning paths for any topic with AI. Beginner to advanced concepts, organized and ready to learn.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/learningpath?term={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "EducationalApplication",
      operatingSystem: "All",
      description:
        "AI-powered learning path generator that organizes any topic into beginner, intermediate, and advanced concepts.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ["https://github.com/yixin0829/lp-generator"],
    },
  ],
};

export default function HomePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [lpCounter, setLpCounter] = useState(null); // local fallback while stats load

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const response = await fetch(apiUrl("/v1/stats"));
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const total = payload?.learning_paths_generated;
        if (!cancelled && typeof total === "number" && total >= 0) {
          setLpCounter(total);
        }
      } catch {
        // Keep fallback value when stats service is unavailable.
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  function goSearch() {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return;
    }

    const publicTopic = findPublicTopicByAlias(trimmedTerm);
    if (publicTopic) {
      navigate(`/learn/${publicTopic.slug}`);
      return;
    }

    navigate({
      pathname: "/learningpath",
      search: `?term=${encodeURIComponent(trimmedTerm)}`,
    });
  }

  return (
    <main className="home-page">
      <Seo jsonLd={homeJsonLd} />
      <div className="home-brand">
        <img src={logo} width={44} height={44} alt="" />
        <h1>LearnAnything</h1>
      </div>
      <p className="home-intro">
        Generate a learning path for anything that's on your mind.
        {lpCounter > 0 && (
          <span className="subtitle-count">
            <strong>{lpCounter.toLocaleString()}</strong> paths have been
            generated.
          </span>
        )}
      </p>
      <form
        className="topic-search"
        onSubmit={(event) => {
          event.preventDefault();
          goSearch();
        }}
      >
        <SearchbarHome onChange={setSearchTerm} />
        <Button label="Generate" type="submit" disabled={!searchTerm.trim()} />
      </form>
      <Recommended />
    </main>
  );
}

export function Recommended() {
  const featuredSlugs = [
    "javascript",
    "negotiation",
    "creative-writing",
    "cooking",
    "meditation",
  ];

  return (
    <section className="recommended" aria-labelledby="recommended-heading">
      <div className="section-heading">
        <h2 id="recommended-heading">Recommended</h2>
        <Link to="/topics">
          Browse all topics <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="recommended-container">
        {featuredSlugs.map((slug) => {
          const topic = publicTopicBySlug.get(slug);
          return (
            <Link
              key={slug}
              to={`/learn/${slug}`}
              className="recommended-prompt"
            >
              {topic.topic}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SearchbarHome({ onChange, onEnter }) {
  const id = useId();
  return (
    <div className="topic-field">
      <label htmlFor={id}>What do you want to learn?</label>
      <Searchbar
        placeholder="e.g. JavaScript or cooking"
        onChange={onChange}
        onEnterKey={onEnter}
        inputArgs={{ id, maxLength: 120, enterKeyHint: "go" }}
      />
    </div>
  );
}
