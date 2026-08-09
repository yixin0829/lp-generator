import { Page404 } from "../pages/404/404";
import AboutPage from "../pages/AboutPage/AboutPage";
import FeedbackPage from "../pages/FeedbackPage/FeedbackPage";
import HomePage from "../pages/HomePage/HomePage";
import LearningPath from "../pages/LearningPath/LearningPath";
import PublicLearningPath from "../pages/PublicLearningPath/PublicLearningPath";
import SharePage from "../pages/SharePage/SharePage";
import TopicsPage from "../pages/TopicsPage/TopicsPage";

export const pages = {
  404: {
    label: "404",
    component: Page404,
  },
  main: [
    { label: "Home", component: HomePage, path: "/" },
    { label: "About", component: AboutPage, path: "/about" },
    { label: "Topics", component: TopicsPage, path: "/topics" },
    { label: "Feedback", component: FeedbackPage, path: "/feedback" },
  ],
  hidden: [
    { label: "Learning Path", component: LearningPath, path: "/learningpath" },
    { label: "Public Learning Path", component: PublicLearningPath, path: "/learn/:slug" },
    { label: "Shared Learning Path", component: SharePage, path: "/share/:shareId" },
  ],
};
