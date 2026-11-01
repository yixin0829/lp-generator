import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import Searchbar from "../../components/Searchbar/Searchbar";
import { apiUrl } from "../../config/api";
import {
  EASE_OUT,
  cubicBezier,
  isInitialPage,
  onDone,
  play,
  playsFirstLoadEntrance,
  prefersReducedMotion,
} from "../../motion/motion";
import { rememberTopicMorph } from "../../motion/topicMorph";
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

// Index 0 is the input's real placeholder; the rest rotate in on Home only.
const EXAMPLE_TOPICS = [
  "e.g. JavaScript or cooking",
  "e.g. Machine learning",
  "e.g. Beginner guitar",
  "e.g. Public speaking",
  "e.g. Personal finance",
  "e.g. Watercolor painting",
];

const HERO_STEPS = [
  [".home-brand", 0],
  [".home-intro", 50],
  ["form.topic-search", 100],
  [".recommended .section-heading", 150],
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [lpCounter, setLpCounter] = useState(null); // local fallback while stats load
  // Holds the count's line while stats load, so the form does not jump when it lands.
  const [countReserved, setCountReserved] = useState(true);
  const [entrance] = useState(playsFirstLoadEntrance);
  const [countsUp] = useState(isInitialPage);
  const mainRef = useRef(null);
  const countRef = useRef(null);
  const hasCount = lpCounter > 0;

  useEffect(() => {
    let cancelled = false;
    // A request that hangs gives the line back eventually.
    const giveUp = setTimeout(() => setCountReserved(false), 5000);

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
      } finally {
        if (!cancelled) {
          clearTimeout(giveUp);
          setCountReserved(false);
        }
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, []);

  // First-load hero: the backwards fill applies the first frame before paint.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!entrance || !main) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      const fade = play(main, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: "ease",
        fill: "backwards",
      });
      return () => fade?.cancel();
    }

    const chips = [...main.querySelectorAll(".recommended-prompt")];
    const steps = [
      ...HERO_STEPS.map(([selector, delay]) => [
        main.querySelector(selector),
        delay,
      ]),
      ...chips.map((chip, index) => [chip, 190 + 30 * index]),
    ];
    // translate, not transform: the chips' hover and press use transform.
    const animations = steps.map(([element, delay]) =>
      play(
        element,
        [
          { opacity: 0, translate: "0 6px", filter: "blur(4px)" },
          { opacity: 1, translate: "0 0", filter: "blur(0px)" },
        ],
        { duration: 400, delay, easing: EASE_OUT, fill: "backwards" },
      ),
    );
    return () => animations.forEach((animation) => animation?.cancel());
  }, [entrance]);

  // The count ticks up on the first page of a load and fades in otherwise.
  useLayoutEffect(() => {
    const count = countRef.current;
    if (!hasCount || !count) {
      return undefined;
    }

    if (!countsUp || prefersReducedMotion()) {
      const fade = play(count, [{ opacity: 0 }, { opacity: 1 }], {
        duration: prefersReducedMotion() ? 120 : 220,
        easing: "ease",
      });
      return () => fade?.cancel();
    }

    const strong = count.querySelector("strong");
    // React's own text node: writing nodeValue keeps React owning it.
    const text = strong.firstChild;
    const finalText = text.nodeValue;
    const total = Number(finalText.replace(/\D/g, ""));
    // 12,873 counts up from 10,000, so every value fills the held width.
    const from = 10 ** (String(total).length - 1);
    const width = strong.getBoundingClientRect().width;
    Object.assign(strong.style, {
      display: "inline-block",
      minWidth: `${width}px`,
      textAlign: "right",
    });
    const format = new Intl.NumberFormat();
    const ease = cubicBezier(0.23, 1, 0.32, 1);
    // A keyframe-less animation is the clock, so route swaps, unmount and
    // reduced motion end the count like any other animation.
    const clock = play(strong, [], { duration: 900 });
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (clock?.currentTime ?? 0) / 900);
      text.nodeValue = format.format(
        Math.round(from + (total - from) * ease(progress)),
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    onDone(clock, () => {
      cancelAnimationFrame(frame);
      text.nodeValue = finalText;
      Object.assign(strong.style, { display: "", minWidth: "", textAlign: "" });
    });
    return () => clock?.cancel();
  }, [hasCount, countsUp]);

  function goSearch(form) {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return;
    }

    const publicTopic = findPublicTopicByAlias(trimmedTerm);
    rememberTopicMorph(trimmedTerm, form);
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
    <main className="home-page" ref={mainRef}>
      <Seo jsonLd={homeJsonLd} />
      <div className="home-brand">
        <img src={logo} width={44} height={44} alt="" />
        <h1>LearnAnything</h1>
      </div>
      <p className="home-intro">
        Generate a learning path for anything that's on your mind.
        {hasCount ? (
          <span className="subtitle-count" ref={countRef}>
            <strong>{lpCounter.toLocaleString()}</strong> paths have been
            generated.
          </span>
        ) : (
          countReserved && (
            // One no-break space: a plain space would collapse the line.
            <span className="subtitle-count" aria-hidden="true">
              {" "}
            </span>
          )
        )}
      </p>
      <form
        className="topic-search"
        onSubmit={(event) => {
          event.preventDefault();
          goSearch(event.currentTarget);
        }}
      >
        <SearchbarHome onChange={setSearchTerm} examples={EXAMPLE_TOPICS} />
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
              onClick={(event) =>
                rememberTopicMorph(topic.topic, event.currentTarget)
              }
            >
              {topic.topic}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SearchbarHome({ onChange, onEnter, examples }) {
  const id = useId();
  return (
    <div className="topic-field">
      <label htmlFor={id}>What do you want to learn?</label>
      <Searchbar
        placeholder="e.g. JavaScript or cooking"
        placeholderExamples={examples}
        onChange={onChange}
        onEnterKey={onEnter}
        inputArgs={{ id, maxLength: 120, enterKeyHint: "go" }}
      />
    </div>
  );
}
