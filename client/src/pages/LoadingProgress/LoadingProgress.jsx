import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiUrl } from "../../config/api";
import "./LoadingProgress.scss";

function validEstimate(value) {
  return (
    value &&
    value.sample_count >= 5 &&
    [value.median_seconds, value.lower_seconds, value.upper_seconds].every(
      (seconds) => Number.isFinite(seconds) && seconds > 0,
    ) &&
    value.upper_seconds > value.lower_seconds
  );
}

export default function LoadingProgress({
  estimateGeneration = false,
  complete = false,
  onComplete,
}) {
  const fillRef = useRef(null);
  const [estimate, setEstimate] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!estimateGeneration) return;
    const controller = new AbortController();
    const started = performance.now();
    const timer = setInterval(
      () => setElapsed((performance.now() - started) / 1000),
      250,
    );
    // An optional estimate must never delay or fail the generation request.
    fetch(apiUrl("/v1/stats"), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (
          !controller.signal.aborted &&
          validEstimate(data?.generation_estimate)
        ) {
          setEstimate(data.generation_estimate);
        }
      })
      .catch(() => {});
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [estimateGeneration]);

  useLayoutEffect(() => {
    if (!complete) return;
    const element = fillRef.current;
    const track = element.parentElement.getBoundingClientRect();
    const current = Math.min(
      1,
      Math.max(
        0,
        (element.getBoundingClientRect().right - track.left) / track.width,
      ),
    );
    element.style.setProperty("animation", "none", "important");
    element.style.transition = "none";
    element.style.width = "100%";
    const animation = element.animate(
      [
        { transform: `scaleX(${current})`, opacity: 1 },
        { transform: "scaleX(1)", opacity: 1 },
      ],
      {
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 200,
        easing: "linear",
        fill: "forwards",
      },
    );
    let cancelled = false;
    let frame;
    animation.finished
      .then(() => {
        if (cancelled) return;
        // Paint the full bar before replacing it with the learning path.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (!cancelled) onComplete?.();
          });
        });
      })
      .catch(() => {}); // Unmounting cancels the animation on navigation.
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      animation.cancel();
      element.style.removeProperty("animation");
      element.style.removeProperty("transition");
      element.style.removeProperty("width");
    };
  }, [complete, onComplete]);

  const overdue = estimate && elapsed > estimate.upper_seconds;
  // This is an elapsed-time estimate, not a measurement of completed work.
  // Stop advancing at the usual upper bound; keep activity visible on overruns.
  const fill = estimate
    ? 90 *
      (1 -
        Math.exp(
          -Math.min(elapsed, estimate.upper_seconds) / estimate.median_seconds,
        ))
    : null;

  return (
    <div
      className="loading-progress-container"
      role="status"
      aria-live="polite"
    >
      <div
        className={`preparing-progress${estimate ? " is-estimated" : ""}${overdue ? " is-overdue" : ""}`}
        role="progressbar"
        aria-label="Preparing your learning path"
        aria-valuetext={
          complete
            ? "Complete"
            : estimate
              ? "Estimated progress; preparing your learning path"
              : "In progress"
        }
      >
        <div
          ref={fillRef}
          className="preparing-progress-fill"
          style={estimate ? { transform: `scaleX(${fill / 100})` } : undefined}
        />
      </div>
      <p>Preparing your learning path...</p>
      {overdue && !complete && (
        <p className="preparing-estimate">Taking longer than usual...</p>
      )}
    </div>
  );
}
