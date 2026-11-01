import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import NavBar from "./components/NavBar/NavBar";
import { OnboardingProvider } from "./components/Onboarding/Onboarding";
import { MotionSnackbarProvider } from "./components/SnackbarTransition/SnackbarTransition";
import ScrollToTop from "./components/misc/ScrollToTop/ScrollToTop";
import { useRouteTransition } from "./motion/routeTransition";
import "./App.css";
import "./motion/viewTransitions.scss";
import { pages } from "./util/pages";

const appRoutes = [...pages.main, ...pages.hidden];

export default function App() {
  return (
    <ThemeProvider>
      <MotionSnackbarProvider>
        <BrowserRouter>
          <Analytics />
          <OnboardingProvider>
            <TransitionRoutes />
          </OnboardingProvider>
        </BrowserRouter>
      </MotionSnackbarProvider>
    </ThemeProvider>
  );
}

function Page404Route() {
  const Component = pages["404"].component;
  return <Component />;
}

function TransitionRoutes() {
  const location = useLocation();
  // Pages render from the shown location, which trails the router's by one transition.
  const shown = useRouteTransition(location);
  const transitionKey = `${shown.pathname}${shown.search}`;

  return (
    <>
      <NavBar />
      <ScrollToTop pathname={shown.pathname} search={shown.search} />
      <Routes location={shown}>
        {appRoutes.map((page) => {
          const PageComponent = page.component;
          return (
            <Route
              path={page.path}
              key={page.path}
              element={
                <div
                  key={transitionKey}
                  id="main-content"
                  tabIndex={-1}
                  className="page"
                >
                  <PageComponent />
                </div>
              }
            />
          );
        })}
        <Route
          path="*"
          element={
            <div id="main-content" tabIndex={-1}>
              <Page404Route />
            </div>
          }
        />
      </Routes>
    </>
  );
}
