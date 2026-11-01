import { useLayoutEffect, useRef } from "react";
import "./ViewToggle.scss";

const VIEWS = [
  ["graph", "Graph"],
  ["list", "List"],
];

// Clips the pill's surface and labels to the pressed button's box.
function placePill(toggle, instant) {
  const active = toggle?.querySelector(':scope > button[aria-pressed="true"]');
  const pill = toggle?.querySelector(":scope > .view-toggle-pill");
  if (!active || !pill) return;
  const top = active.offsetTop;
  const left = active.offsetLeft;
  const right = toggle.clientWidth - left - active.offsetWidth;
  const bottom = toggle.clientHeight - top - active.offsetHeight;
  const clip = `inset(${top}px ${right}px ${bottom}px ${left}px round 8px)`;
  if (instant) pill.classList.add("is-instant");
  for (const layer of pill.querySelectorAll(
    ".view-toggle-pill-surface, .view-toggle-pill-labels",
  ))
    layer.style.clipPath = clip;
  if (instant) {
    void pill.offsetWidth;
    pill.classList.remove("is-instant");
  }
}

export default function ViewToggle({ view, onChange }) {
  const toggleRef = useRef(null);
  const placedRef = useRef(false);

  // The first placement is instant; later view changes slide on the spring.
  useLayoutEffect(() => {
    placePill(toggleRef.current, !placedRef.current);
    placedRef.current = true;
  }, [view]);

  useLayoutEffect(() => {
    const toggle = toggleRef.current;
    const resize = new ResizeObserver(() => placePill(toggle, true));
    resize.observe(toggle);
    return () => resize.disconnect();
  }, []);

  return (
    <div
      ref={toggleRef}
      className="view-toggle has-pill"
      role="group"
      aria-label="Learning path view"
    >
      {VIEWS.map(([value, label]) => (
        <button
          key={value}
          aria-pressed={view === value}
          className={view === value ? "active" : ""}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
      {/* The active surface; its clip reveals active-colour label copies. */}
      <span className="view-toggle-pill" aria-hidden="true" inert>
        <span className="view-toggle-pill-shadow">
          <span className="view-toggle-pill-surface" />
        </span>
        <span className="view-toggle-pill-labels">
          {VIEWS.map(([value, label]) => (
            <button key={value} tabIndex={-1}>
              {label}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}
