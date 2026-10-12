import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!firstRender.current)
      document.getElementById("main-content")?.focus({ preventScroll: true });
    firstRender.current = false;
  }, [pathname, search]);
  return null;
}
