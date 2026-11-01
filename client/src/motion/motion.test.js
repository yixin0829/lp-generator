import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module state (tracked animations, the listener, first-load flags) is fresh per test.
let motion;
beforeEach(async () => {
  vi.resetModules();
  motion = await import("./motion");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// SPEC 1.1: an Apple-style spring sampled every 20 ms over 600 ms.
function springCurve({ d, bounce }) {
  const w = (2 * Math.PI) / d;
  const z = 1 - bounce;
  const wd = w * Math.sqrt(1 - z * z);
  const at = (t) =>
    1 -
    Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  const stops = [];
  for (let i = 0; i <= 30; i++) stops.push(i === 30 ? 1 : at((i / 30) * 0.6));
  return `linear(${stops.map((v) => +v.toFixed(3)).join(", ")})`;
}

function fakeAnimation(target) {
  let resolve;
  let reject;
  const finished = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  finished.catch(() => {});
  return {
    effect: { target },
    finished,
    playState: "running",
    finish: vi.fn(() => resolve()),
    cancel: vi.fn(() => reject(new Error("AbortError"))),
  };
}

function fakeElement(animation) {
  return { animate: vi.fn(() => animation), contains: () => false };
}

function fakeMatchMedia(matches = false) {
  const listeners = new Set();
  const query = {
    matches,
    addEventListener: vi.fn((type, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((type, listener) => listeners.delete(listener)),
  };
  return {
    matchMedia: vi.fn(() => query),
    listeners,
    turnOn() {
      query.matches = true;
      listeners.forEach((listener) => listener({ matches: true }));
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("curves", () => {
  it("regenerates both springs from their physics", () => {
    expect(motion.SPRING).toBe(springCurve({ d: 0.4, bounce: 0.25 }));
    expect(motion.SPRING_SOFT).toBe(springCurve({ d: 0.45, bounce: 0.1 }));
    expect(motion.SPRING_MS).toBe(600);
  });

  it("declares the same springs in App.css, falling back to the ease-out curve", () => {
    const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
    const supports = css.match(
      /@supports \(transition-timing-function: linear\(0, 1\)\) \{([\s\S]*?)\n\}/,
    );
    expect(supports).not.toBeNull();
    expect(supports[1]).toContain(`--spring: ${motion.SPRING};`);
    expect(supports[1]).toContain(`--spring-soft: ${motion.SPRING_SOFT};`);
    expect(css).toContain(`--ease-out: ${motion.EASE_OUT};`);
    expect(css).toContain(`--ease-in-out: ${motion.EASE_IN_OUT};`);
    expect(css).toContain(`--ease-drawer: ${motion.EASE_DRAWER};`);
    expect(css).toContain("--spring: var(--ease-out);");
    expect(css).toContain("--spring-soft: var(--ease-out);");
  });

  it("evaluates cubic-bezier curves", () => {
    const easeOut = motion.cubicBezier(0.23, 1, 0.32, 1);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const value = easeOut(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(motion.cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
    expect(motion.cubicBezier(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5, 5);
    expect(motion.cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 5);
  });
});

describe("play", () => {
  it("returns null when there is nothing to animate", () => {
    expect(motion.play(null, [], {})).toBeNull();
    expect(motion.play({}, [], {})).toBeNull();
    const throwing = {
      animate: () => {
        throw new Error("Invalid keyframes");
      },
    };
    expect(motion.play(throwing, [], {})).toBeNull();
  });

  it("maps linear() to the ease-out curve when linear() is unsupported", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const element = fakeElement(fakeAnimation());
    motion.play(element, [], { duration: 600, easing: motion.SPRING });
    expect(element.animate.mock.calls[0][1]).toEqual({
      duration: 600,
      easing: motion.EASE_OUT,
    });
  });

  it("maps linear() when CSS.supports is missing, and keeps other curves", () => {
    const element = fakeElement(fakeAnimation());
    motion.play(element, [], { easing: motion.SPRING_SOFT });
    motion.play(element, [], { easing: "ease" });
    expect(element.animate.mock.calls[0][1].easing).toBe(motion.EASE_OUT);
    expect(element.animate.mock.calls[1][1].easing).toBe("ease");
  });

  it("keeps linear() when it is supported", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const element = fakeElement(fakeAnimation());
    motion.play(element, [], { easing: motion.SPRING });
    expect(element.animate.mock.calls[0][1].easing).toBe(motion.SPRING);
  });

  it("tracks animations until they finish or are cancelled", async () => {
    const scope = { contains: () => true };
    const finished = fakeAnimation(scope);
    const cancelled = fakeAnimation(scope);
    const running = fakeAnimation(scope);
    for (const animation of [finished, cancelled, running]) {
      motion.play(fakeElement(animation), [], {});
    }
    finished.finish();
    cancelled.cancel();
    await settle();
    motion.cancelAnimationsWithin(scope);
    expect(finished.cancel).not.toHaveBeenCalled();
    expect(cancelled.cancel).toHaveBeenCalledTimes(1);
    expect(running.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("cancelAnimationsWithin", () => {
  it("cancels only animations on or inside the scope", () => {
    const inside = {};
    const outside = {};
    const scope = { contains: (node) => node === scope || node === inside };
    const onScope = fakeAnimation(scope);
    const onChild = fakeAnimation(inside);
    const elsewhere = fakeAnimation(outside);
    for (const animation of [onScope, onChild, elsewhere]) {
      motion.play(fakeElement(animation), [], {});
    }
    motion.cancelAnimationsWithin(null);
    motion.cancelAnimationsWithin(scope);
    expect(onScope.cancel).toHaveBeenCalledTimes(1);
    expect(onChild.cancel).toHaveBeenCalledTimes(1);
    expect(elsewhere.cancel).not.toHaveBeenCalled();
  });
});

describe("onDone", () => {
  it("runs at once without an animation", () => {
    const callback = vi.fn();
    motion.onDone(null, callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs once on finish or on cancel", async () => {
    const onFinish = vi.fn();
    const onCancel = vi.fn();
    const finished = fakeAnimation();
    const cancelled = fakeAnimation();
    motion.onDone(finished, onFinish);
    motion.onDone(cancelled, onCancel);
    expect(onFinish).not.toHaveBeenCalled();
    finished.finish();
    cancelled.cancel();
    await settle();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("reads", () => {
  it("reads opacity and falls back on non-finite values", () => {
    expect(motion.readOpacity({}, 0.5)).toBe(0.5);
    vi.stubGlobal("getComputedStyle", (element) => ({ opacity: element.opacity }));
    expect(motion.readOpacity({ opacity: "0.25" })).toBe(0.25);
    expect(motion.readOpacity({ opacity: "" })).toBe(1);
    expect(motion.readOpacity({ opacity: "NaN" }, 0)).toBe(0);
    expect(motion.readOpacity(null)).toBe(1);
  });

  it("does not prefer reduced motion without a window", () => {
    expect(motion.prefersReducedMotion()).toBe(false);
    vi.stubGlobal("window", fakeMatchMedia(true));
    expect(motion.prefersReducedMotion()).toBe(true);
  });
});

describe("reduced motion turning on", () => {
  it("is a no-op without a window", () => {
    const unsubscribe = motion.onReducedMotion(vi.fn());
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });

  it("installs one listener without play() and finishes finite motion", () => {
    const media = fakeMatchMedia();
    vi.stubGlobal("window", media);
    const css = fakeAnimation();
    css.effect.getComputedTiming = () => ({ iterations: 1 });
    const loop = fakeAnimation();
    loop.effect.getComputedTiming = () => ({ iterations: Infinity });
    const idle = fakeAnimation();
    idle.playState = "finished";
    idle.effect.getComputedTiming = () => ({ iterations: 1 });
    vi.stubGlobal("document", { getAnimations: () => [css, loop, idle] });

    const order = [];
    const callback = vi.fn(() => order.push("callback"));
    const unsubscribe = motion.onReducedMotion(callback);
    motion.onReducedMotion(() => {});
    expect(media.listeners.size).toBe(1);

    const tracked = fakeAnimation();
    tracked.finish.mockImplementation(() => order.push("finish"));
    motion.play(fakeElement(tracked), [], {});
    expect(media.listeners.size).toBe(1);

    media.turnOn();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["callback", "finish"]);
    expect(css.finish).toHaveBeenCalledTimes(1);
    expect(loop.finish).not.toHaveBeenCalled();
    expect(idle.finish).not.toHaveBeenCalled();

    unsubscribe();
    media.turnOn();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe("first load", () => {
  const container = (prerendered) => ({
    querySelector: (selector) =>
      prerendered && selector === ":scope > [data-prerendered]" ? {} : null,
  });

  it("is the initial page until the first route change", () => {
    expect(motion.isInitialPage()).toBe(true);
    motion.noteRouteChange();
    expect(motion.isInitialPage()).toBe(false);
  });

  it("skips the entrance after prerendered markup", () => {
    motion.noteInitialMarkup(container(true));
    expect(motion.playsFirstLoadEntrance()).toBe(false);
  });

  it("plays the entrance after an empty container or none", async () => {
    motion.noteInitialMarkup(container(false));
    expect(motion.playsFirstLoadEntrance()).toBe(true);
    vi.resetModules();
    motion = await import("./motion");
    motion.noteInitialMarkup(null);
    expect(motion.playsFirstLoadEntrance()).toBe(true);
    motion.noteRouteChange();
    expect(motion.playsFirstLoadEntrance()).toBe(false);
  });

  it("ignores a second call", () => {
    motion.noteInitialMarkup(container(false));
    motion.noteInitialMarkup(container(true));
    expect(motion.playsFirstLoadEntrance()).toBe(true);
  });
});
