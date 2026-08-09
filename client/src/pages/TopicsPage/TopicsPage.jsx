import { Link } from "react-router-dom";
import { SITE_URL } from "../../config/site";
import { publicTopics } from "../../data/publicTopics";
import Seo from "../../seo/Seo";
import "./TopicsPage.scss";

const categories = ["Technology", "Career", "Creative", "Everyday Learning"];

export default function TopicsPage() {
  return (
    <main className="topics-page">
      <Seo title="Learning Path Topics" description="Browse 24 reviewed learning paths across technology, career, creative, and everyday skills." path="/topics" jsonLd={{
        "@context": "https://schema.org", "@type": "CollectionPage", name: "Learning Path Topics", url: `${SITE_URL}/topics`,
      }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> / Topics</nav>
      <h1>Explore reviewed learning paths</h1>
      <p>Choose a curated roadmap with a clear sequence, practical outcomes, and trusted resources.</p>
      {categories.map((category) => (
        <section key={category}>
          <h2>{category}</h2>
          <div className="topic-grid">
            {publicTopics.filter((topic) => topic.category === category).map((topic) => (
              <article key={topic.slug}><h3><Link to={`/learn/${topic.slug}`}>{topic.topic}</Link></h3><p>{topic.excerpt}</p></article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
