import { Link, useParams } from "react-router-dom";
import LearningPathView from "../../components/LearningPathView/LearningPathView";
import { SITE_URL } from "../../config/site";
import { publicTopicBySlug } from "../../data/publicTopics";
import Seo from "../../seo/Seo";
import { Page404 } from "../404/404";
import "./PublicLearningPath.scss";

export default function PublicLearningPath() {
  const { slug } = useParams();
  const topic = publicTopicBySlug.get(slug);
  if (!topic) return <Page404 />;
  const url = `${SITE_URL}/learn/${topic.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "LearningResource", name: `${topic.topic} Learning Path`, description: topic.excerpt, url, educationalLevel: ["Beginner", "Intermediate", "Advanced"], teaches: topic.outcomes },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Topics", item: `${SITE_URL}/topics` },
        { "@type": "ListItem", position: 3, name: topic.topic, item: url },
      ] },
    ],
  };
  return (
    <main className="public-learning-path">
      <Seo title={`${topic.topic} Learning Path`} description={topic.excerpt} path={`/learn/${topic.slug}`} jsonLd={jsonLd} />
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> / <Link to="/topics">Topics</Link> / {topic.topic}</nav>
      <p className="topic-category">{topic.category} · Reviewed {topic.reviewedDate}</p>
      <h1>{topic.topic} learning path</h1>
      <p className="introduction">{topic.introduction}</p>
      <div className="learning-meta">
        <section><h2>Prerequisites</h2><ul>{topic.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h2>What you will be able to do</h2><ul>{topic.outcomes.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
      <LearningPathView levels={topic.levels} graph={topic.graph} defaultView="list" />
      <section className="resources"><h2>Authoritative resources</h2><ul>{topic.resources.map((resource) => <li key={resource.url}><a href={resource.url}>{resource.title}</a></li>)}</ul></section>
      <section className="related-paths"><h2>Related learning paths</h2><div>{topic.relatedSlugs.map((relatedSlug) => { const related = publicTopicBySlug.get(relatedSlug); return <Link key={relatedSlug} to={`/learn/${relatedSlug}`}>{related.topic}</Link>; })}</div></section>
    </main>
  );
}
