import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  EASE_OUT,
  cancelAnimationsWithin,
  onDone,
  play,
  prefersReducedMotion,
  readOpacity,
} from "../../motion/motion";
import "./ViewSwap.scss";

// Crossfades between views. Each change mounts a fresh view; the outgoing one
// stays mounted, inert and out of flow, until its exit ends.
export default function ViewSwap({ ref, view, children }) {
  const containerRef = useRef(null);
  const [shownView, setShownView] = useState(view);
  const [entries, setEntries] = useState([{ id: 0, view, initial: true }]);
  useImperativeHandle(ref, () => containerRef.current, []);
  if (view !== shownView) {
    // An earlier leaving view is dropped at once; the current one starts leaving.
    const current = entries.find((entry) => !entry.leaving);
    setShownView(view);
    setEntries([
      { ...current, leaving: true },
      { id: current.id + 1, view, initial: false },
    ]);
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    const leavingEntry = entries.find((entry) => entry.leaving);
    if (!container || !leavingEntry) return;
    const leaving = container.querySelector(":scope > .is-leaving");
    const entering = container.querySelector(
      ":scope > .view-swap-item:not(.is-leaving)",
    );
    // It may still be fading in, so read before cancelling.
    const from = readOpacity(leaving);
    // Stops the reveal, handoff and share glide inside the old view.
    cancelAnimationsWithin(container);
    const reduced = prefersReducedMotion();
    const exit = play(
      leaving,
      reduced
        ? [{ opacity: from }, { opacity: 0 }]
        : [
            { opacity: from, filter: "blur(0px)" },
            { opacity: 0, filter: "blur(2px)" },
          ],
      { duration: reduced ? 100 : 130, easing: "ease", fill: "forwards" },
    );
    onDone(exit, () =>
      setEntries((list) =>
        list.filter((entry) => entry.id !== leavingEntry.id),
      ),
    );
    play(
      entering,
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, scale: "0.99" },
            { opacity: 1, scale: "1" },
          ],
      {
        duration: reduced ? 120 : 240,
        delay: reduced ? 0 : 80,
        easing: EASE_OUT,
        fill: "backwards",
      },
    );
  }, [shownView]);

  return (
    <div ref={containerRef} className="view-swap">
      {entries.map((entry) => (
        <div
          key={`${entry.view}:${entry.id}`}
          className={"view-swap-item" + (entry.leaving ? " is-leaving" : "")}
          inert={entry.leaving}
          aria-hidden={entry.leaving || undefined}
        >
          {children(entry.view, { initial: entry.initial })}
        </div>
      ))}
    </div>
  );
}
