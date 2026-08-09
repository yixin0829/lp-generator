import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LearningPathView from "../../components/LearningPathView/LearningPathView";
import { apiUrl } from "../../config/api";
import Seo from "../../seo/Seo";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import "./SharePage.scss";

export default function SharePage() {
  const { shareId } = useParams();
  const [state, setState] = useState({ phase: "loading", snapshot: null, message: "" });
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/v1/shares/${encodeURIComponent(shareId)}`)).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) setState({ phase: "error", snapshot: null, message: response.status === 404 ? "This shared path was not found." : body.detail || "Sharing is temporarily unavailable." });
      else setState({ phase: "ready", snapshot: body.snapshot, message: "" });
    }).catch(() => !cancelled && setState({ phase: "error", snapshot: null, message: "Unable to load this shared path." }));
    return () => { cancelled = true; };
  }, [shareId]);
  return (
    <main className="share-page">
      <Seo title="Shared Learning Path" path={`/share/${shareId}`} robots="noindex,nofollow" />
      <p className="unlisted-notice">Anyone with this link can view this immutable snapshot. It is not listed publicly.</p>
      {state.phase === "loading" && <LoadingSpinner />}
      {state.phase === "error" && <h1>{state.message}</h1>}
      {state.snapshot && <><h1>{state.snapshot.topic} learning path</h1><LearningPathView levels={state.snapshot.levels} conceptDetails={state.snapshot.concept_details} graph={state.snapshot.graph} defaultView={state.snapshot.default_view} /></>}
      <Link className="create-own-link" to="/">Create your own path</Link>
    </main>
  );
}
