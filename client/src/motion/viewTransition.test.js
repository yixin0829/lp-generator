import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let manager;
beforeEach(async () => {
  vi.resetModules();
  manager = await import("./viewTransition");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// A document whose startViewTransition hands back transitions the test settles by hand.
function fakeDocument({ throws = false } = {}) {
  const classes = new Set();
  const transitions = [];
  const document = {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    startViewTransition: vi.fn((update) => {
      if (throws) throw new Error("InvalidStateError");
      const finished = deferred();
      const ready = deferred();
      const updateCallbackDone = deferred();
      const transition = {
        update,
        finished: finished.promise,
        ready: ready.promise,
        updateCallbackDone: updateCallbackDone.promise,
        skipTransition: vi.fn(),
        finish: finished,
        readied: ready,
        updated: updateCallbackDone,
      };
      transitions.push(transition);
      return transition;
    }),
  };
  vi.stubGlobal("document", document);
  return { document, classes, transitions };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("without the API", () => {
  it("runs the update and onFinish synchronously", () => {
    vi.stubGlobal("document", { documentElement: { classList: {} } });
    const update = vi.fn();
    const onFinish = vi.fn();
    expect(manager.canViewTransition()).toBe(false);
    expect(manager.startViewTransition("route", update, { onFinish })).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(manager.activeViewTransition()).toBeNull();
  });

  it("runs the update and onFinish when the call throws", () => {
    const { classes } = fakeDocument({ throws: true });
    const update = vi.fn();
    const onFinish = vi.fn();
    expect(manager.startViewTransition("theme", update, { onFinish })).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(classes.size).toBe(0);
    expect(manager.activeViewTransition()).toBeNull();
  });
});

describe("with the API", () => {
  it("scopes the transition with an html class and reports it", async () => {
    const { classes, transitions } = fakeDocument();
    const onReady = vi.fn();
    const onFinish = vi.fn();
    const update = vi.fn();
    const transition = manager.startViewTransition("route", update, {
      onReady,
      onFinish,
    });
    expect(transition).toBe(transitions[0]);
    expect(classes.has("vt-route")).toBe(true);
    expect(manager.activeViewTransition()).toEqual({
      kind: "route",
      updated: false,
    });
    transition.update();
    expect(manager.activeViewTransition()).toEqual({
      kind: "route",
      updated: true,
    });
    transition.readied.resolve();
    await settle();
    expect(onReady).toHaveBeenCalledWith(transition);
    transition.finish.resolve();
    await settle();
    expect(classes.size).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(manager.activeViewTransition()).toBeNull();
  });

  it("runs the update once across the browser callback and a flush", () => {
    const { transitions } = fakeDocument();
    const update = vi.fn();
    manager.startViewTransition("theme", update);
    transitions[0].update();
    manager.flushViewTransition();
    transitions[0].update();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("flushes the pending transition when a second one starts", async () => {
    const { classes, transitions } = fakeDocument();
    const first = vi.fn();
    const firstFinish = vi.fn();
    const firstReady = vi.fn();
    manager.startViewTransition("theme", first, {
      onFinish: firstFinish,
      onReady: firstReady,
    });
    manager.startViewTransition("route", vi.fn());
    expect(first).toHaveBeenCalledTimes(1);
    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1);
    expect(classes.has("vt-theme")).toBe(false);
    expect(classes.has("vt-route")).toBe(true);
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(manager.activeViewTransition()?.kind).toBe("route");

    // The skipped transition settling later changes nothing.
    transitions[0].readied.resolve();
    transitions[0].finish.resolve();
    await settle();
    expect(firstReady).not.toHaveBeenCalled();
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(classes.has("vt-route")).toBe(true);
  });

  it("settles when finished rejects", async () => {
    const { classes, transitions } = fakeDocument();
    const onFinish = vi.fn();
    manager.startViewTransition("route-fade", vi.fn(), { onFinish });
    transitions[0].finish.reject(new Error("AbortError"));
    await settle();
    expect(classes.size).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(manager.activeViewTransition()).toBeNull();
  });

  it("leaves no unhandled rejection when ready and the update are rejected", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const { transitions } = fakeDocument();
      const onReady = vi.fn();
      manager.startViewTransition("theme-fade", vi.fn(), { onReady });
      transitions[0].readied.reject(new Error("AbortError"));
      transitions[0].updated.reject(new Error("AbortError"));
      transitions[0].finish.resolve();
      await settle();
      expect(onReady).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("flushes on a no-op without a pending transition", () => {
    fakeDocument();
    expect(() => manager.flushViewTransition()).not.toThrow();
    expect(manager.activeViewTransition()).toBeNull();
  });
});

describe("reduced motion turning on", () => {
  it("flushes the pending transition", () => {
    const listeners = new Set();
    const query = {
      matches: false,
      addEventListener: (type, listener) => listeners.add(listener),
      removeEventListener: (type, listener) => listeners.delete(listener),
    };
    vi.stubGlobal("window", { matchMedia: () => query });
    const { transitions } = fakeDocument();
    const update = vi.fn();
    manager.startViewTransition("route", update);
    query.matches = true;
    listeners.forEach((listener) => listener({ matches: true }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1);
    expect(manager.activeViewTransition()).toBeNull();
  });
});
