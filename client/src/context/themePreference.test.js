import { describe, expect, it } from "vitest";
import {
  LEGACY_THEME_KEY,
  THEME_CHOICE_KEY,
  readThemePreference,
  resolveTheme,
  saveThemeChoice,
  toggledTheme,
} from "./themePreference";

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    dump: () => Object.fromEntries(items),
  };
}

const blockedStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

describe("theme preference", () => {
  it("is system on a first visit and saves nothing", () => {
    const storage = memoryStorage();
    expect(readThemePreference(storage, "dark")).toBe("system");
    expect(storage.dump()).toEqual({});
  });

  it("follows the system until a theme is picked", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("light", "dark")).toBe("light");
  });

  it("the toggle picks the theme that is not showing", () => {
    expect(toggledTheme("system", "dark")).toBe("light");
    expect(toggledTheme("system", "light")).toBe("dark");
    expect(toggledTheme("dark", "light")).toBe("light");
  });

  it("returns a saved pick whatever the system says", () => {
    const storage = memoryStorage();
    saveThemeChoice(storage, "dark");
    expect(readThemePreference(storage, "light")).toBe("dark");
    expect(readThemePreference(storage, "dark")).toBe("dark");
  });

  it("drops a legacy theme that matches the system", () => {
    const storage = memoryStorage({ [LEGACY_THEME_KEY]: "dark" });
    expect(readThemePreference(storage, "dark")).toBe("system");
    expect(storage.dump()).toEqual({});
  });

  it("keeps a legacy theme that differs from the system as a pick", () => {
    const storage = memoryStorage({ [LEGACY_THEME_KEY]: "dark" });
    expect(readThemePreference(storage, "light")).toBe("dark");
    expect(storage.dump()).toEqual({ [THEME_CHOICE_KEY]: "dark" });
    // The next visit reads the pick, even after the system catches up.
    expect(readThemePreference(storage, "dark")).toBe("dark");
  });

  it("ignores values that are not themes", () => {
    const storage = memoryStorage({
      [THEME_CHOICE_KEY]: "blue",
      [LEGACY_THEME_KEY]: "sepia",
    });
    expect(readThemePreference(storage, "light")).toBe("system");
  });

  it("is system when storage is blocked or missing", () => {
    expect(readThemePreference(blockedStorage, "dark")).toBe("system");
    expect(readThemePreference(null, "dark")).toBe("system");
    expect(() => saveThemeChoice(blockedStorage, "dark")).not.toThrow();
    expect(() => saveThemeChoice(null, "dark")).not.toThrow();
  });
});
