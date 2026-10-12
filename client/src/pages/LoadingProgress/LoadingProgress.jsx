import "./LoadingProgress.scss";

export default function LoadingProgress() {
  return (
    <div
      className="loading-progress-container"
      role="status"
      aria-live="polite"
    >
      <div
        className="preparing-progress"
        role="progressbar"
        aria-label="Preparing your learning path"
        aria-valuetext="In progress"
      >
        <div className="preparing-progress-fill" />
      </div>
      <p>Preparing your learning path...</p>
    </div>
  );
}
