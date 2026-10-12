import "./LoadingSpinner.scss";
export default function LoadingSpinner() {
  return (
    <div className="loading-spinner-container" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p>Loading your learning path...</p>
    </div>
  );
}
