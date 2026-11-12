// The theme follows the system until the reader picks one. Only a pick is saved.
//
//   system  nothing picked: the theme is the system's, and follows its changes
//   light   picked
//   dark    picked

export const THEME_CHOICE_KEY = "learnanything.theme.choice.v1";
// Before the choice key, every visit saved its theme here, picked or not.
export const LEGACY_THEME_KEY = "theme";

const isTheme = (value) => value === "light" || value === "dark";

// storage is localStorage, or null when the browser blocks it.
export function readThemePreference(storage, systemTheme) {
  let legacy;
  try {
    const choice = storage.getItem(THEME_CHOICE_KEY);
    if (isTheme(choice)) return choice;
    legacy = storage.getItem(LEGACY_THEME_KEY);
  } catch {
    // Restricted storage should not prevent the app or guide from opening.
    return "system";
  }
  if (legacy === null) return "system";
  // A legacy theme that differs from the system's was most likely picked.
  // Keeping only those means nobody's theme changes on the upgrade.
  const preference = isTheme(legacy) && legacy !== systemTheme ? legacy : "system";
  try {
    if (preference !== "system") storage.setItem(THEME_CHOICE_KEY, preference);
    storage.removeItem(LEGACY_THEME_KEY);
  } catch {
    /* The legacy value is read again on the next visit. */
  }
  return preference;
}

export function saveThemeChoice(storage, theme) {
  try {
    storage.setItem(THEME_CHOICE_KEY, theme);
  } catch {
    /* Keep the choice for this visit. */
  }
}

export function resolveTheme(preference, systemTheme) {
  return preference === "system" ? systemTheme : preference;
}

// The toggle always picks the theme that is not showing.
export function toggledTheme(preference, systemTheme) {
  return resolveTheme(preference, systemTheme) === "dark" ? "light" : "dark";
}
