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
        return (
          <Link to={page.path}>
            <div
              className={`${
                selected ? "navbar-link-selected" : ""
              } navbar-link`}
            >
              {page.label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
