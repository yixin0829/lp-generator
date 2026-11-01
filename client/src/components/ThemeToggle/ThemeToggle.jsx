import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { useTheme } from "../../context/ThemeContext";
import {
  EASE_DRAWER,
  SPRING,
  SPRING_MS,
  play,
  prefersReducedMotion,
} from "../../motion/motion";
import {
  canViewTransition,
  startViewTransition,
} from "../../motion/viewTransition";
import "./ThemeToggle.scss";

let fadeTimer = 0;

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const icon = useRef(null);
  const shownTheme = useRef(theme);

  // The sun and moon swap with a turn; inside a theme transition this runs in
  // the live new view, so the circle reveals it first.
  useLayoutEffect(() => {
    if (shownTheme.current === theme) return;
    shownTheme.current = theme;
    if (prefersReducedMotion()) return;
    const turn = theme === "dark" ? -90 : 90;
    const animation = play(
      icon.current,
      [
        { transform: `rotate(${turn}deg) scale(0.55)`, opacity: 0 },
        { transform: "rotate(0deg) scale(1)", opacity: 1 },
      ],
      { duration: SPRING_MS, easing: SPRING },
    );
    return () => animation?.cancel();
  }, [theme]);

  // The new theme opens as a circle from the click; the change happens inside
  // the transition's update so the new snapshot already has it.
  const switchTheme = (event) => {
    const toggle = () => flushSync(toggleTheme);
    const reduced = prefersReducedMotion();
    if (!canViewTransition()) {
      if (reduced) {
        toggleTheme();
        return;
      }
      const root = document.documentElement;
      root.classList.add("theme-fading");
      toggle();
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove("theme-fading"), 300);
      return;
    }
    if (reduced) {
      startViewTransition("theme-fade", toggle);
      return;
    }
    let x = event.clientX;
    let y = event.clientY;
    // Keyboard clicks carry no point; open from the button's centre.
    if (event.detail === 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    startViewTransition("theme", toggle, {
      onReady: () =>
        play(
          document.documentElement,
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: EASE_DRAWER,
            pseudoElement: "::view-transition-new(root)",
          },
        ),
    });
  };

  return (
    <button
      className="theme-toggle"
      onClick={switchTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <svg
        ref={icon}
        className="theme-toggle-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  );
}
