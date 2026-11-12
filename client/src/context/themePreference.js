// The theme follows the system until the reader picks one. Only a pick is saved.
//
//   system  nothing picked: the theme is the system's, and follows its changes
//   light   picked
//   dark    picked
//
// Earlier versions saved every visit's theme under "theme", picked or not, so
// that key cannot say who picked. It is left in place and never read.

export const THEME_CHOICE_KEY = "learnanything.theme.choice.v1";

const isTheme = (value) => value === "light" || value === "dark";

// storage is localStorage, or null when the browser blocks it.
export function readThemePreference(storage) {
  try {
    const choice = storage.getItem(THEME_CHOICE_KEY);
    return isTheme(choice) ? choice : "system";
  } catch {
    // Restricted storage should not prevent the app or guide from opening.
    return "system";
  }
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
