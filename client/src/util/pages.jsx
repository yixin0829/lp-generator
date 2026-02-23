import { Page404 } from "../pages/404/404";
import AboutPage from "../pages/AboutPage/AboutPage";
import FeedbackPage from "../pages/FeedbackPage/FeedbackPage";
import HomePage from "../pages/HomePage/HomePage";
import LearningPath from "../pages/LearningPath/LearningPath";

export const pages = {
  404: {
    label: "404",
    component: Page404,
  },
  main: [
    { label: "Home", component: HomePage, path: "/" },
    { label: "About", component: AboutPage, path: "/about" },
    { label: "Feedback", component: FeedbackPage, path: "/feedback" },
  ],
  hidden: [
    { label: "Learning Path", component: LearningPath, path: "/learningpath" },
  ],
};
