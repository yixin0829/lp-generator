import { useSyncExternalStore } from "react";

// Shared motion foundations. Nothing touches window or document at module
// scope, so vitest (node) and the prerender script can import this file.

export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
export const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";
// The springs are linear() curves sampled over 600 ms; always pair them with SPRING_MS.
export const SPRING_MS = 600;
// 0.4 s spring, bounce 0.25. Byte-identical to App.css --spring.
export const SPRING =
  "linear(0, 0.042, 0.143, 0.273, 0.411, 0.543, 0.661, 0.761, 0.842, 0.905, 0.952, 0.985, 1.007, 1.02, 1.026, 1.028, 1.027, 1.025, 1.021, 1.017, 1.013, 1.01, 1.007, 1.005, 1.003, 1.001, 1.001, 1, 0.999, 0.999, 1)";
// 0.45 s spring, bounce 0.1. Byte-identical to App.css --spring-soft.
export const SPRING_SOFT =
  "linear(0, 0.033, 0.112, 0.214, 0.323, 0.431, 0.53, 0.619, 0.696, 0.761, 0.815, 0.859, 0.894, 0.922, 0.943, 0.96, 0.972, 0.981, 0.988, 0.993, 0.996, 0.998, 1, 1.001, 1.001, 1.001, 1.002, 1.001, 1.001, 1.001, 1)";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Returns (progress) => eased value for a CSS cubic-bezier, for JS-driven motion.
export function cubicBezier(x1, y1, x2, y2) {
  const curve = (a, b, t) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const slope = (a, b, t) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    // Newton's method first; bisection when the slope is too flat to trust.
    let t = progress;
    for (let i = 0; i < 8; i++) {
      const error = curve(x1, x2, t) - progress;
      if (Math.abs(error) < 1e-6) return curve(y1, y2, t);
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = progress;
    for (let i = 0; i < 40 && high - low > 1e-7; i++) {
      if (curve(x1, x2, t) < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(y1, y2, t);
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true
  );
}

function subscribeReducedMotion(onChange) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// For components that render differently under reduced motion.
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
}

const live = new Set();
const reduceCallbacks = new Set();
let listening = false;
let linearSupported;

function finishAll() {
  for (const callback of Array.from(reduceCallbacks)) callback();
  for (const animation of Array.from(live)) {
    try {
      animation.finish();
    } catch {
      animation.cancel();
    }
  }
  // CSS transitions and untracked animations too; finish() throws on infinite loops.
  for (const animation of document.getAnimations?.() ?? []) {
    const iterations = animation.effect?.getComputedTiming().iterations;
    if (animation.playState !== "running" || !Number.isFinite(iterations)) {
      continue;
    }
    try {
      animation.finish();
    } catch {
      /* Leave it to the global reduced-motion rule. */
    }
  }
}

function ensureReducedMotionListener() {
  if (listening || typeof window === "undefined" || !window.matchMedia) return;
  listening = true;
  // Turning reduce on mid-motion ends everything on its settled frame.
  subscribeReducedMotion((event) => {
    if (event.matches) finishAll();
  });
}

// Runs callback each time reduced motion turns on, before animations finish.
export function onReducedMotion(callback) {
  ensureReducedMotionListener();
  reduceCallbacks.add(callback);
  return () => reduceCallbacks.delete(callback);
}

function supportsLinearEasing() {
  linearSupported ??=
    typeof CSS !== "undefined" &&
    CSS.supports?.("transition-timing-function", "linear(0, 1)") === true;
  return linearSupported;
}

// element.animate() that route swaps and reduced motion can end. Returns null
// when there is nothing to animate. linear() springs fall back like the CSS tokens.
export function play(target, keyframes, options) {
  if (!target || typeof target.animate !== "function") return null;
  ensureReducedMotionListener();
  let timing = options;
  if (
    typeof options?.easing === "string" &&
    options.easing.startsWith("linear(") &&
    !supportsLinearEasing()
  ) {
    timing = { ...options, easing: EASE_OUT };
  }
  let animation;
  try {
    animation = target.animate(keyframes, timing);
  } catch {
    return null;
  }
  live.add(animation);
  onDone(animation, () => live.delete(animation));
  return animation;
}

// Runs callback once when the animation finishes or is cancelled; at once for null.
export function onDone(animation, callback) {
  if (!animation) {
    callback();
    return;
  }
  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    callback();
  };
  animation.finished.then(done, done);
}

// Cancels tracked animations on scope or inside it. Entrances fill backwards,
// so a cancelled entrance leaves its element settled.
export function cancelAnimationsWithin(scope) {
  if (!scope) return;
  for (const animation of Array.from(live)) {
    const target = animation.effect?.target;
    if (target && scope.contains(target)) animation.cancel();
  }
}

// Computed opacity to start an exit or retarget from.
export function readOpacity(element, fallback = 1) {
  if (!element || typeof getComputedStyle !== "function") return fallback;
  const opacity = parseFloat(getComputedStyle(element).opacity);
  return Number.isFinite(opacity) ? opacity : fallback;
}

let initialPage = true;
let prerendered;

// True until the first client-side page swap; a full page load resets it.
export function isInitialPage() {
  return initialPage;
}

// Called right before a new page commits.
export function noteRouteChange() {
  initialPage = false;
}

// Called once with #root before root.render, while prerendered markup is still there.
export function noteInitialMarkup(container) {
  if (prerendered !== undefined) return;
  prerendered =
    container?.querySelector(":scope > [data-prerendered]") != null;
}

// Prerendered HTML has already painted, so fading it in again would blank it.
export function playsFirstLoadEntrance() {
  return isInitialPage() && !prerendered;
}
