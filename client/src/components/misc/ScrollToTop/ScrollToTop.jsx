import { useLayoutEffect, useRef } from "react";
// Takes the shown page's location, and runs in a layout effect, so the scroll
// and focus land inside the route transition's update, after the old snapshot.
export default function ScrollToTop({ pathname, search }) {
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!firstRender.current)
      document.getElementById("main-content")?.focus({ preventScroll: true });
    firstRender.current = false;
  }, [pathname, search]);
  return null;
}
