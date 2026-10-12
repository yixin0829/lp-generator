import { useEffect, useState } from "react";
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

export default function LoadingProgress({ estimateGeneration = false }) {
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
          estimate
            ? "Estimated progress; preparing your learning path"
            : "In progress"
        }
      >
        <div
          className="preparing-progress-fill"
          style={estimate ? { width: `${fill}%` } : undefined}
        />
      </div>
      <p>Preparing your learning path...</p>
      {estimate && (
        <p className="preparing-estimate">
          {overdue
            ? "Taking longer than usual..."
            : `Usually ${estimate.lower_seconds}–${estimate.upper_seconds} seconds`}
        </p>
      )}
    </div>
  );
}
