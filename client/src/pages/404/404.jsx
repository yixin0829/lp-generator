import { Link } from "react-router-dom";
import Seo from "../../seo/Seo";
export function Page404() {
  return (
    <main id="not-found-content" className="not-found-page">
      <Seo
        title="Page Not Found"
        description="This page does not exist on LearnAnything."
        path={null}
        noindex
      />
      <p className="stage-number">404</p>
      <h1>Page not found.</h1>
      <p>Check the address or head back to the home page.</p>
      <Link to="/">Back to home</Link>
    </main>
  );
}
