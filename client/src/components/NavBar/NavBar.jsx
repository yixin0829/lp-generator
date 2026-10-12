import { Link, useLocation } from "react-router-dom";
import { pages } from "../../util/pages";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import { useOnboarding } from "../Onboarding/Onboarding";
import "./NavBar.scss";
export default function Navbar() {
  const { pathname } = useLocation();
  const { replay } = useOnboarding();
  return (
    <header className="navbar-container">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Link className="navbar-brand" to="/">
        LearnAnything
      </Link>
      <nav aria-label="Main navigation">
        {pages.main.map((page) => {
          const selected =
            pathname === page.path ||
            (page.path === "/topics" && pathname.startsWith("/learn/"));
          return (
            <Link
              key={page.path}
              to={page.path}
              aria-current={selected ? "page" : undefined}
              className={
                selected ? "navbar-link navbar-link-selected" : "navbar-link"
              }
            >
              {page.label}
            </Link>
          );
        })}
        <div className="navbar-tools">
          <button
            type="button"
            className="navbar-link navbar-help"
            onClick={replay}
          >
            How to use
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
