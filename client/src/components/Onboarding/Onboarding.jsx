import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Onboarding.scss";

const PREFERENCE_KEY = "learnanything.onboarding.hidden.v1";
const OnboardingContext = createContext(null);

function readPreference() {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === "true";
  } catch {
    return null;
  }
}

const steps = [
  {
    title: "Start with something you want to learn",
    text: "Enter a topic on Home and choose Generate, or pick a reviewed path from Topics. Try a specific goal, like learning beginner guitar.",
    example: "Your topic → a path from beginner to advanced",
  },
  {
    title: "Find your starting point",
    text: "Use List for a clear sequence or Graph to see how concepts connect. Hover over a concept for an explanation and why it matters. Start with a beginner concept you do not know yet.",
    example: "Beginner → Intermediate → Advanced",
  },
  {
    title: "Turn one concept into a small next action",
    text: "Choose just one concept. Read its explanation, then try a small exercise or find a lesson about it. Reviewed paths include resource links. Return to the path when you are ready for the next concept.",
    example: "Choose one concept → learn it → practice it",
  },
];

export function OnboardingProvider({ children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);
  const [step, setStep] = useState(0);
  const [hideAgain, setHideAgain] = useState(() => readPreference() === true);
  const lastSavedPreference = useRef(hideAgain);
  const [storageError, setStorageError] = useState(false);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    const learningPage = location.pathname === "/" || location.pathname === "/learningpath" || location.pathname.startsWith("/learn/");
    if (!autoShown && learningPage) {
      setAutoShown(true);
      if (!readPreference()) {
        previousFocus.current = document.activeElement;
        setOpen(true);
      }
    }
  }, [autoShown, location.pathname]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) {
      dialog.close();
      previousFocus.current?.focus?.();
    }
  }, [open]);

  function replay() {
    previousFocus.current = document.activeElement;
    setStep(0);
    const saved = readPreference();
    if (saved !== null) lastSavedPreference.current = saved;
    setHideAgain(lastSavedPreference.current);
    setStorageError(false);
    setAutoShown(true);
    setOpen(true);
  }

  function finish() {
    const saved = readPreference();
    if (saved !== null) lastSavedPreference.current = saved;
    try {
      if (hideAgain) localStorage.setItem(PREFERENCE_KEY, "true");
      else localStorage.removeItem(PREFERENCE_KEY);
      lastSavedPreference.current = hideAgain;
    } catch {
      if (hideAgain || lastSavedPreference.current) {
        setStorageError(true);
        return;
      }
    }
    setOpen(false);
  }

  const current = steps[step];
  return (
    <OnboardingContext.Provider value={{ replay }}>
      {children}
      <dialog
        ref={dialogRef}
        className="onboarding-dialog"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        onCancel={(event) => { event.preventDefault(); finish(); }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }}
      >
        <div className="onboarding-header">
          <span>How to use LearnAnything</span>
          <button type="button" className="onboarding-close" aria-label="Close guide" onClick={finish}>×</button>
        </div>
        <p className="onboarding-progress" aria-live="polite">Step {step + 1} of {steps.length}</p>
        <h2 id="onboarding-title">{current.title}</h2>
        <p id="onboarding-description">{current.text}</p>
        <p className="onboarding-example" aria-hidden="true">{current.example}</p>
        <label className="onboarding-preference">
          <input type="checkbox" checked={hideAgain} onChange={(event) => { setHideAgain(event.target.checked); setStorageError(false); }} />
          Don’t show this again
        </label>
        <p className="onboarding-note">Leave this unchecked to see the guide on your next visit. You can always reopen it from “How to use”.</p>
        {storageError && <div className="onboarding-error" role="alert">
          <p>Your browser could not save this choice. Allow site storage to change your preference, or keep your previous setting.</p>
          <button type="button" className="onboarding-secondary" onClick={() => {
            setHideAgain(lastSavedPreference.current); setStorageError(false); setOpen(false);
          }}>Keep previous setting and close</button>
        </div>}
        <div className="onboarding-actions">
          <button type="button" className="onboarding-secondary" onClick={finish}>Skip for now</button>
          <div>
            {step > 0 && <button type="button" className="onboarding-secondary" onClick={() => setStep(step - 1)}>Back</button>}
            <button type="button" className="onboarding-primary" onClick={() => step < steps.length - 1 ? setStep(step + 1) : finish()}>
              {step < steps.length - 1 ? "Next" : "Start learning"}
            </button>
          </div>
        </div>
      </dialog>
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
