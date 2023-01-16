import { BrowserRouter, useLocation, Route, Routes } from "react-router-dom";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import ScrollToTop from "./components/misc/ScrollToTop/ScrollToTop";
import "./App.css";
import { pages } from "./util/pages";
import NavBar from "./components/NavBar/NavBar";
import { SnackbarProvider } from "notistack";

export default function App() {
  return (
    <>
      <SnackbarProvider>
        <BrowserRouter>
          <TransitionRoutes />
        </BrowserRouter>
      </SnackbarProvider>
    </>
  );
}

const TransitionRoutes = () => {
  const location = useLocation();
  return (
    <TransitionGroup>
      <NavBar />
      <ScrollToTop />
      <CSSTransition key={location.key} classNames="page" timeout={300}>
        <Routes location={location}>
          {[...pages.main, ...pages.hidden].map((page) => {
            return (
              <Route
                path={page.path}
                key={page.path}
                element={
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      left: 0,
                      bottom: 0,
                      top: 0,
                    }}
                  >
                    {page.component}
                  </div>
                }
              />
            );
          })}
          <Route path="*" element={pages["404"].component} />
        </Routes>
      </CSSTransition>
    </TransitionGroup>
  );
};
