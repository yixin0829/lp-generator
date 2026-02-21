import { Analytics } from "@vercel/analytics/react";
import { SnackbarProvider } from "notistack";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import NavBar from "./components/NavBar/NavBar";
import ScrollToTop from "./components/misc/ScrollToTop/ScrollToTop";
import "./App.css";
import { pages } from "./util/pages";

const appRoutes = [...pages.main, ...pages.hidden];

export default function App() {
  return (
    <SnackbarProvider>
      <BrowserRouter>
        <Analytics />
        <TransitionRoutes />
      </BrowserRouter>
    </SnackbarProvider>
  );
}

function Page404Route() {
  const Component = pages["404"].component;
  return <Component />;
}

function TransitionRoutes() {
  const location = useLocation();
  const transitionKey = `${location.pathname}${location.search}`;

  return (
    <>
      <NavBar />
      <ScrollToTop />
      <Routes location={location}>
        {appRoutes.map((page) => {
          const PageComponent = page.component;
          return (
            <Route
              path={page.path}
              key={page.path}
              element={
                <div key={transitionKey} className="page route-transition">
                  <PageComponent />
                </div>
              }
            />
          );
        })}
        <Route path="*" element={<Page404Route />} />
      </Routes>
    </>
  );
}
