import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";

import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { noteInitialMarkup } from "./motion/motion";

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);
// Read before render replaces it: first-load entrances skip prerendered HTML.
noteInitialMarkup(container);
root.render(<App />);

reportWebVitals();
