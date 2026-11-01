import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  cancelAnimationsWithin,
  noteRouteChange,
  play,
  prefersReducedMotion,
} from "./motion";
import { takeTopicMorph } from "./topicMorph";
import {
  activeViewTransition,
  canViewTransition,
  startViewTransition,
} from "./viewTransition";

// Route changes crossfade through a View Transition. The page that is shown
// trails the router's location by one transition: the old page stays until the
// transition's update callback commits the new one, so the browser can
// snapshot it first. Render <Routes location={shown}> with the returned value.

const pageKey = (location) => `${location.pathname}${location.search}`;

const isLearningPath = (pathname) =>
  pathname === "/learningpath" || pathname.startsWith("/learn/");

export function useRouteTransition(location) {
  const [shown, setShown] = useState(location);
  const latest = useRef(location);
  const shownKey = useRef(pageKey(location));

  useLayoutEffect(() => {
    latest.current = location;
    // A hash or state change keeps the page; nothing to transition.
    if (pageKey(location) === shownKey.current) {
      setShown(location);
      return;
    }
    // Outside React's commit, so flushing a pending transition may flushSync.
    queueMicrotask(() => swapPage(latest, shownKey, setShown));
  }, [location]);

  return shown;
}

function swapPage(latest, shownKey, setShown) {
  const pending = activeViewTransition();
  // A route update that has not run yet commits the newest location itself.
  if (
    (pending?.kind === "route" || pending?.kind === "route-fade") &&
    !pending.updated
  ) {
    return;
  }
  if (pageKey(latest.current) === shownKey.current) {
    setShown(latest.current);
    return;
  }

  const page = document.getElementById("main-content");
  // The leaving page's sequences end on their settled frame before the snapshot.
  cancelAnimationsWithin(page);
  const morph = takeTopicMorph();
  const commit = () => {
    noteRouteChange();
    shownKey.current = pageKey(latest.current);
    flushSync(() => setShown(latest.current));
  };

  if (prefersReducedMotion()) {
    startViewTransition("route-fade", commit);
    return;
  }
  if (!canViewTransition()) {
    commit();
    play(
      document.getElementById("main-content"),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 220, delay: 40, easing: "ease", fill: "backwards" },
    );
    return;
  }

  const flight =
    morph &&
    isLearningPath(latest.current.pathname) &&
    page?.contains(morph.source)
      ? makeTopicProxy(morph)
      : null;
  const proxy = flight?.proxy;
  let named = [];
  startViewTransition(
    "route",
    () => {
      // One element per name in each snapshot: the proxy leaves before the heading is named.
      proxy?.remove();
      commit();
      if (!flight) return;
      // Back before the swap keeps the source page; its text shows again.
      flight.hiddenText.style.color = "";
      named = nameHeading(morph.topic);
    },
    {
      onFinish: () => {
        proxy?.remove();
        for (const element of named) element.style.viewTransitionName = "";
      },
    },
  );
}

// A fixed, text-only stand-in for the topic where the reader last saw it. An
// input's value is not an element, and naming a whole chip would morph its box.
function makeTopicProxy({ topic, source }) {
  const input = source.matches("form") ? source.querySelector("input") : null;
  let box;
  let style;
  if (input) {
    // A topic wider than its input is clipped there; flying it would reveal hidden text.
    if (input.scrollWidth > input.clientWidth) return null;
    const rect = input.getBoundingClientRect();
    style = getComputedStyle(input);
    const lineHeight =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    box = {
      left:
        rect.left +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.paddingLeft),
      top: rect.top + (rect.height - lineHeight) / 2,
      height: lineHeight,
    };
  } else {
    // The chip's text box, without its border and padding.
    const range = document.createRange();
    range.selectNodeContents(source);
    const rect = range.getBoundingClientRect();
    style = getComputedStyle(source);
    box = { left: rect.left, top: rect.top, height: rect.height };
  }
  if (!box.height) return null;

  const proxy = document.createElement("div");
  proxy.className = "topic-proxy";
  proxy.setAttribute("aria-hidden", "true");
  Object.assign(proxy.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    height: `${box.height}px`,
    lineHeight: `${box.height}px`,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
  });
  const text = document.createElement("span");
  text.textContent = topic;
  text.style.viewTransitionName = "la-topic";
  proxy.append(text);
  document.body.append(proxy);
  // The old snapshot would otherwise show the text twice.
  const hiddenText = input ?? source;
  hiddenText.style.color = "transparent";
  return { proxy, hiddenText };
}

// Names the new heading's parts. A named part that wraps aborts the whole
// transition, so a part with more than one line box just crossfades.
function nameHeading(topic) {
  const heading = document.querySelector("#main-content .title-topic");
  if (
    !heading ||
    heading.textContent.trim().toLowerCase() !== topic.trim().toLowerCase() ||
    heading.getClientRects().length !== 1
  ) {
    return [];
  }
  heading.style.viewTransitionName = "la-topic";
  const named = [heading];
  // "learning path" follows the topic in only when the topic itself flies.
  const rest = heading.parentElement?.querySelector(".title-rest");
  if (rest && rest.getClientRects().length === 1) {
    rest.style.viewTransitionName = "la-title-rest";
    named.push(rest);
  }
  return named;
}
