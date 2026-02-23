import { useState } from "react";

import Button from "../../components/Button/Button";
import { apiUrl } from "../../config/api";
import { SITE_URL, SITE_NAME } from "../../config/site";
import Seo from "../../seo/Seo";

import "./FeedbackPage.scss";

const MAX_LENGTH = 2000;

const feedbackJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "Feedback",
      item: `${SITE_URL}/feedback`,
    },
  ],
};

export default function FeedbackPage() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | submitting | submitted
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!text.trim() || phase === "submitting") return;

    setPhase("submitting");
    setError("");

    try {
      const res = await fetch(apiUrl("/v1/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Request failed (${res.status})`);
      }

      setPhase("submitted");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setPhase("idle");
    }
  }

  return (
    <div className="feedback-page">
      <Seo
        title="Feedback"
        description={`Share your feedback about ${SITE_NAME} — tell us what you love or what we can improve.`}
        path="/feedback"
        jsonLd={feedbackJsonLd}
      />
      <div style={{ height: "100px" }} />
      <h1>Feedback</h1>
      <p className="feedback-subtitle">
        We'd love to hear from you! Share your thoughts, suggestions, or anything on your mind.
      </p>
      <div style={{ height: "20px" }} />

      {phase === "submitted" ? (
        <div className="feedback-thanks">
          <h2>Thank you!</h2>
          <p>Your feedback has been submitted. We really appreciate you taking the time.</p>
        </div>
      ) : (
        <div className="feedback-form">
          <textarea
            className="feedback-textarea"
            placeholder="What's on your mind?"
            maxLength={MAX_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={phase === "submitting"}
            rows={6}
          />
          <div className="feedback-meta">
            {error && <span className="feedback-error">{error}</span>}
            <span className="feedback-counter">
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
          <div style={{ height: "12px" }} />
          <Button
            label={phase === "submitting" ? "Submitting..." : "Submit"}
            onClick={handleSubmit}
            style={{
              maxWidth: "200px",
              opacity: !text.trim() || phase === "submitting" ? 0.6 : 1,
              pointerEvents: !text.trim() || phase === "submitting" ? "none" : "auto",
            }}
          />
        </div>
      )}

      <div style={{ height: "50px" }} />
    </div>
  );
}
