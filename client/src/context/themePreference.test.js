import { describe, expect, it } from "vitest";
import {
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
};

describe("theme preference", () => {
  it("is system on a first visit and saves nothing", () => {
    const storage = memoryStorage();
    expect(readThemePreference(storage)).toBe("system");
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

  it("returns a saved pick", () => {
    const storage = memoryStorage();
    saveThemeChoice(storage, "dark");
    expect(storage.dump()).toEqual({ [THEME_CHOICE_KEY]: "dark" });
    expect(readThemePreference(storage)).toBe("dark");
  });

  it("neither reads nor touches a theme saved by an earlier version", () => {
    const storage = memoryStorage({ theme: "dark" });
    expect(readThemePreference(storage)).toBe("system");
    expect(storage.dump()).toEqual({ theme: "dark" });
  });

  it("ignores a saved value that is not a theme", () => {
    const storage = memoryStorage({ [THEME_CHOICE_KEY]: "blue" });
    expect(readThemePreference(storage)).toBe("system");
  });

  it("is system when storage is blocked or missing", () => {
    expect(readThemePreference(blockedStorage)).toBe("system");
    expect(readThemePreference(null)).toBe("system");
    expect(() => saveThemeChoice(blockedStorage, "dark")).not.toThrow();
    expect(() => saveThemeChoice(null, "dark")).not.toThrow();
  });
});
