// Why a learning path could not be generated, and what the page offers next.
//
// The backend and the proxy send the reason as `code` beside `detail`. A response
// without a known code (the platform's own 504, an older backend) falls back to
// its status.

// reason -> screen
const SCREENS = {
  moderated: "flagged",
  topic_too_long: "fixTopic",
  topic_invalid: "fixTopic",
  rate_limited: "wait",
  upstream_down: "retry",
  timeout: "retry",
  offline: "retry",
  generation_failed: "retry",
  upstream_rejected: "outOfOrder",
  misconfigured: "outOfOrder",
};

const STATUS_REASONS = {
  400: "topic_invalid",
  401: "misconfigured",
  403: "misconfigured",
  429: "rate_limited",
  502: "upstream_down",
  503: "upstream_down",
  504: "timeout",
};

const GENERIC_HEADING = "Couldn't generate this learning path.";

const SCREEN_COPY = {
  flagged: {
    heading:
      "This topic cannot be generated because it was flagged by content moderation.",
    body: "Please try a safer, educational phrasing (for example, focus on history, prevention, ethics, or legal context).",
  },
  fixTopic: {
    heading: GENERIC_HEADING,
    body: "Try a shorter topic or a different phrase.",
  },
  wait: {
    heading: GENERIC_HEADING,
    body: "Too many requests in a short time. Wait a minute, then try again.",
  },
  retry: {
    heading: GENERIC_HEADING,
    body: "Try again with the same topic, or enter something else.",
  },
  outOfOrder: {
    heading: GENERIC_HEADING,
    body: "Something is wrong on our side, so trying again won't help right now. Please come back later, or try another topic.",
  },
};

const REASON_BODY = {
  timeout: "The request timed out. Please try again.",
  offline: "Couldn't reach the server. Check your connection and try again.",
};

// status is the HTTP status; code is the response body's `code`, if any.
export function failureReason(status, code) {
  if (typeof code === "string" && Object.hasOwn(SCREENS, code)) return code;
  return STATUS_REASONS[status] ?? "generation_failed";
}

// "flagged", "fixTopic", "wait", "retry" or "outOfOrder".
export function failureScreen(reason) {
  return SCREENS[reason] ?? "retry";
}

// Whether asking for the same topic again can succeed.
export function canRetry(reason) {
  const screen = failureScreen(reason);
  return screen === "retry" || screen === "wait";
}

export function failureCopy(reason) {
  const copy = SCREEN_COPY[failureScreen(reason)];
  return { heading: copy.heading, body: REASON_BODY[reason] ?? copy.body };
}
