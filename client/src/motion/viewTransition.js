import { onReducedMotion } from "./motion";

// One View Transition at a time, never queued: a new start (or reduced motion
// turning on) completes the pending one's DOM update now and skips its animation.
// Callers' updates must change the DOM synchronously (flushSync for React), and
// start or flush only from event handlers, microtasks or browser callbacks.

let active = null;
let flushesOnReducedMotion = false;

export function canViewTransition() {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

// kind names the html class (vt-<kind>) that scopes every name and pseudo rule.
export function startViewTransition(kind, update, { onReady, onFinish } = {}) {
  flushViewTransition();
  if (!flushesOnReducedMotion) {
    flushesOnReducedMotion = true;
    onReducedMotion(flushViewTransition);
  }
  const record = { kind, updated: false, className: `vt-${kind}`, onFinish };
  // The browser's callback and a flush may both call it; the update runs once.
  record.run = () => {
    if (record.updated) return;
    record.updated = true;
    update();
  };
  if (!canViewTransition()) {
    record.run();
    onFinish?.();
    return null;
  }
  const root = document.documentElement;
  root.classList.add(record.className);
  let transition;
  try {
    transition = document.startViewTransition(record.run);
  } catch {
    root.classList.remove(record.className);
    record.run();
    onFinish?.();
    return null;
  }
  record.transition = transition;
  active = record;
  const settle = () => {
    if (active !== record) return;
    active = null;
    root.classList.remove(record.className);
    onFinish?.();
  };
  transition.finished.then(settle, settle);
  // Skipped transitions reject these; never leave unhandled rejections.
  transition.updateCallbackDone.catch(() => {});
  transition.ready.then(() => {
    if (active === record) onReady?.(transition);
  }, () => {});
  return transition;
}

export function flushViewTransition() {
  const record = active;
  if (!record) return;
  active = null;
  try {
    record.run();
  } finally {
    try {
      record.transition.skipTransition();
    } catch {
      /* Already finished. */
    }
    document.documentElement.classList.remove(record.className);
    record.onFinish?.();
  }
}

export function activeViewTransition() {
  return active ? { kind: active.kind, updated: active.updated } : null;
}
