import { useState } from "react";
import { Link } from "react-router-dom";

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
    } catch {
      setError("Your feedback didn't go through. Please try again.");
      setPhase("idle");
    }
  }

  return (
    <main className="feedback-page">
      <Seo
        title="Feedback"
        description={`Share your feedback about ${SITE_NAME}. Tell us what you like or what we can improve.`}
        path="/feedback"
        noindex
        jsonLd={feedbackJsonLd}
      />

      <h1>Feedback</h1>
      <p className="feedback-subtitle">
        Have a suggestion or found a bug? We'd love to hear from you!
      </p>
      <div style={{ height: "20px" }} />

      {phase === "submitted" ? (
        <div className="feedback-thanks" role="status">
          <h2>Thank you!</h2>
          <p>We got your feedback. Thanks for taking the time!</p>
          <Link to="/">Back to home</Link>
        </div>
      ) : (
        <form
          className="feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          aria-busy={phase === "submitting"}
        >
          <label htmlFor="feedback-text">Your feedback</label>
          <textarea
            id="feedback-text"
            aria-describedby="feedback-limit feedback-error"
            className="feedback-textarea"
            placeholder="What's on your mind?"
            maxLength={MAX_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={phase === "submitting"}
            rows={6}
          />
          <div className="feedback-meta">
            <span id="feedback-error" className="feedback-error" role="alert">
              {error}
            </span>
            <span id="feedback-limit" className="feedback-counter">
              {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}{" "}
              characters
            </span>
          </div>
          <div style={{ height: "12px" }} />
          <Button
            label={phase === "submitting" ? "Sending..." : "Send feedback"}
            type="submit"
            disabled={!text.trim() || phase === "submitting"}
          />
        </form>
      )}

      <div style={{ height: "50px" }} />
    </main>
  );
}
