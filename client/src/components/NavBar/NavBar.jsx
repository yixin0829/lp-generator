import { Link, useLocation } from "react-router-dom";
import { pages } from "../../util/pages";
import "./NavBar.scss";

export default function Navbar() {
  const location = useLocation();

  return (
    <div className="navbar-container">
      <div style={{ width: "15px" }} />
      {pages.main.map((page) => {
        const selected = location.pathname === page.path;
        const linkClassName = selected
          ? "navbar-link navbar-link-selected"
          : "navbar-link";

        return (
          <Link key={page.path} to={page.path}>
            <div className={linkClassName}>{page.label}</div>
          </Link>
        );
      })}
    </div>
  );
}
