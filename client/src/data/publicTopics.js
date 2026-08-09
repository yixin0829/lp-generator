const reviewedDate = "2026-08-08";

const definitions = [
  ["programming-fundamentals", "Programming Fundamentals", "Technology", ["coding basics", "how to code"], ["Variables and Data", "Control Flow", "Functions", "Debugging", "Data Structures", "Algorithms", "Testing", "Program Design", "Capstone Project"]],
  ["javascript", "JavaScript", "Technology", ["js", "javascript programming", "react js prerequisites"], ["Syntax and Values", "Variables and Scope", "Functions", "Arrays and Objects", "The DOM", "Async JavaScript", "Modules", "Testing", "Application Architecture"]],
  ["react", "React", "Technology", ["react js", "reactjs", "learn react"], ["Modern JavaScript", "JSX", "Components", "Props and State", "Events and Forms", "Hooks", "Routing", "Testing React", "Performance and Architecture"]],
  ["website-development", "Website Development", "Technology", ["web development", "how to make a website", "building websites"], ["How the Web Works", "HTML", "CSS", "Responsive Design", "JavaScript", "Accessibility", "Version Control", "Deployment", "Full Website Project"]],
  ["mobile-app-development", "Mobile App Development", "Technology", ["app development", "how to create a mobile app"], ["Product Scope", "Mobile UX", "Platform Choice", "Interface Building", "State and Data", "Device APIs", "Testing", "Release Process", "Production Maintenance"]],
  ["video-game-development", "Video Game Development", "Technology", ["game development", "how to make a video game"], ["Game Design Basics", "Engine and Tools", "Input and Movement", "2D and 3D Worlds", "Game Physics", "Audio and Feedback", "Level Design", "Playtesting", "Publishing a Game"]],

  ["negotiation", "Negotiation", "Career", ["how to negotiate", "negotiation skills", "how to negotiate effectively"], ["Goals and Interests", "Preparation", "Active Listening", "Asking Questions", "Creating Options", "Handling Objections", "Making Trades", "Closing Agreements", "Practice and Review"]],
  ["time-management", "Time Management", "Career", ["productivity", "manage time", "how to manage time and be more productive"], ["Time Audit", "Priorities", "Planning Systems", "Focus Blocks", "Task Breakdown", "Energy Management", "Interruptions", "Review Rituals", "Sustainable Habits"]],
  ["team-leadership", "Team Leadership", "Career", ["leadership", "team management", "how to lead and manage a team"], ["Leadership Foundations", "Clear Expectations", "Trust and Safety", "Delegation", "Feedback", "Conflict Resolution", "Decision Making", "Coaching", "Team Systems"]],
  ["public-speaking", "Public Speaking", "Career", ["presentations", "how to give presentations", "speaking in public"], ["Audience and Purpose", "Message Structure", "Story and Evidence", "Clear Language", "Voice Control", "Body Language", "Visual Aids", "Rehearsal", "Live Delivery"]],
  ["career-networking", "Career Networking", "Career", ["professional networking", "how to network", "build professional relationships"], ["Networking Goals", "Personal Introduction", "Finding Communities", "Starting Conversations", "Listening Well", "Following Up", "Giving Value", "Maintaining Relationships", "Network Strategy"]],
  ["sales-and-marketing", "Sales and Marketing", "Career", ["marketing", "sales", "how to sell or market products"], ["Customer Problems", "Market Research", "Positioning", "Value Propositions", "Channels", "Sales Conversations", "Campaign Measurement", "Retention", "Go-to-Market Plan"]],

  ["creative-writing", "Creative Writing", "Creative", ["fiction writing", "how to write creative content", "write a novel"], ["Observation and Ideas", "Character", "Setting", "Point of View", "Scene and Structure", "Dialogue", "Revision", "Feedback", "Finished Story"]],
  ["podcasting", "Podcasting", "Creative", ["make a podcast", "how to make a podcast", "podcast production"], ["Concept and Audience", "Episode Format", "Research", "Interviewing", "Recording", "Editing", "Music and Rights", "Publishing", "Audience Growth"]],
  ["short-filmmaking", "Short Filmmaking", "Creative", ["short film", "how to make a short film", "filmmaking"], ["Story Concept", "Screenplay", "Shot Planning", "Production Design", "Camera and Lighting", "Directing", "Sound Recording", "Editing", "Festival Release"]],
  ["music-production", "Music Production", "Creative", ["produce music", "how to write and produce music"], ["Listening Skills", "DAW Workflow", "Rhythm", "Harmony and Melody", "Recording", "Sound Design", "Arrangement", "Mixing", "Master and Release"]],
  ["digital-drawing", "Digital Drawing", "Creative", ["digital art", "how to paint", "drawing digitally"], ["Tools and Canvas", "Line Control", "Shape and Form", "Perspective", "Light and Value", "Color", "Composition", "Rendering", "Portfolio Piece"]],
  ["photography", "Photography", "Creative", ["take professional photographs", "photo basics", "digital photography"], ["Camera Controls", "Exposure", "Focus", "Composition", "Light", "Color", "Portraits", "Editing", "Photo Series"]],

  ["cooking", "Cooking", "Everyday Learning", ["how to cook", "cooking basics"], ["Kitchen Safety", "Knife Skills", "Heat Control", "Seasoning", "Core Techniques", "Ingredient Pairing", "Timing a Meal", "Recipe Adaptation", "Menu Project"]],
  ["gardening", "Gardening", "Everyday Learning", ["how to garden", "garden basics"], ["Site Observation", "Soil Health", "Plant Selection", "Seeds and Transplants", "Watering", "Plant Nutrition", "Pest Balance", "Season Planning", "Garden Stewardship"]],
  ["chess", "Chess", "Everyday Learning", ["playing chess", "how to play chess", "learn chess"], ["Board and Moves", "Check and Mate", "Opening Principles", "Tactics", "Piece Coordination", "Pawn Structure", "Endgames", "Game Analysis", "Tournament Practice"]],
  ["meditation", "Meditation", "Everyday Learning", ["mindfulness", "how to meditate", "practice mindfulness"], ["Posture and Setting", "Attention to Breath", "Noticing Distraction", "Body Awareness", "Working with Emotion", "Compassion Practice", "Daily Routine", "Longer Sits", "Reflective Practice"]],
  ["learning-a-new-language", "Learning a New Language", "Everyday Learning", ["speak another language", "language learning", "speaking another language"], ["Sound System", "Core Vocabulary", "Useful Phrases", "Basic Grammar", "Listening Practice", "Conversation", "Reading", "Writing", "Immersion Plan"]],
  ["learning-a-musical-instrument", "Learning a Musical Instrument", "Everyday Learning", ["play an instrument", "playing a musical instrument", "learn music instrument"], ["Instrument Setup", "Posture and Technique", "Rhythm", "Pitch and Notes", "Scales and Patterns", "Reading Music", "Ear Training", "Repertoire", "Performance Practice"]],
];

const relatedBySlug = {
  "programming-fundamentals": ["javascript", "website-development", "mobile-app-development"],
  javascript: ["programming-fundamentals", "react", "website-development"],
  react: ["javascript", "website-development", "mobile-app-development"],
  "website-development": ["programming-fundamentals", "javascript", "react"],
  "mobile-app-development": ["programming-fundamentals", "react", "video-game-development"],
  "video-game-development": ["programming-fundamentals", "digital-drawing", "music-production"],
  negotiation: ["public-speaking", "team-leadership", "sales-and-marketing"],
  "time-management": ["team-leadership", "meditation", "career-networking"],
  "team-leadership": ["negotiation", "time-management", "public-speaking"],
  "public-speaking": ["negotiation", "career-networking", "podcasting"],
  "career-networking": ["public-speaking", "sales-and-marketing", "team-leadership"],
  "sales-and-marketing": ["negotiation", "career-networking", "public-speaking"],
  "creative-writing": ["short-filmmaking", "podcasting", "public-speaking"],
  podcasting: ["public-speaking", "creative-writing", "music-production"],
  "short-filmmaking": ["creative-writing", "photography", "music-production"],
  "music-production": ["podcasting", "short-filmmaking", "learning-a-musical-instrument"],
  "digital-drawing": ["photography", "short-filmmaking", "video-game-development"],
  photography: ["digital-drawing", "short-filmmaking", "website-development"],
  cooking: ["gardening", "time-management", "photography"],
  gardening: ["cooking", "meditation", "photography"],
  chess: ["time-management", "meditation", "programming-fundamentals"],
  meditation: ["time-management", "gardening", "learning-a-new-language"],
  "learning-a-new-language": ["public-speaking", "career-networking", "meditation"],
  "learning-a-musical-instrument": ["music-production", "time-management", "meditation"],
};

const resourcesByCategory = {
  Technology: [
    { title: "MDN Learn Web Development", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development" },
    { title: "freeCodeCamp curriculum", url: "https://www.freecodecamp.org/learn/" },
  ],
  Career: [
    { title: "Harvard Business Review skills library", url: "https://hbr.org/topic/subject/leadership" },
    { title: "MIT OpenCourseWare management", url: "https://ocw.mit.edu/search/?d=Sloan%20School%20of%20Management" },
  ],
  Creative: [
    { title: "Library of Congress digital collections", url: "https://www.loc.gov/collections/" },
    { title: "Smithsonian Open Access", url: "https://www.si.edu/openaccess" },
  ],
  "Everyday Learning": [
    { title: "OpenLearn free courses", url: "https://www.open.edu/openlearn/free-courses" },
    { title: "Khan Academy", url: "https://www.khanacademy.org/" },
  ],
};

const primaryResourceBySlug = {
  "programming-fundamentals": { title: "Python official tutorial", url: "https://docs.python.org/3/tutorial/" },
  javascript: { title: "MDN JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
  react: { title: "React official learning guide", url: "https://react.dev/learn" },
  "website-development": { title: "W3C Web Accessibility Initiative tutorials", url: "https://www.w3.org/WAI/tutorials/" },
  "mobile-app-development": { title: "Android Developers training", url: "https://developer.android.com/courses" },
  "video-game-development": { title: "Godot Engine documentation", url: "https://docs.godotengine.org/en/stable/getting_started/introduction/index.html" },
  negotiation: { title: "Harvard Program on Negotiation", url: "https://www.pon.harvard.edu/category/daily/negotiation-skills-daily/" },
  "time-management": { title: "UC Berkeley time management guide", url: "https://uhs.berkeley.edu/sites/default/files/time_management.pdf" },
  "team-leadership": { title: "Center for Creative Leadership resources", url: "https://www.ccl.org/articles/leading-effectively-articles/" },
  "public-speaking": { title: "Toastmasters public speaking tips", url: "https://www.toastmasters.org/resources/public-speaking-tips" },
  "career-networking": { title: "MIT Career Advising networking guide", url: "https://capd.mit.edu/resources/networking/" },
  "sales-and-marketing": { title: "U.S. Small Business Administration marketing guide", url: "https://www.sba.gov/business-guide/manage-your-business/marketing-sales" },
  "creative-writing": { title: "Purdue OWL creative writing", url: "https://owl.purdue.edu/owl/subject_specific_writing/creative_writing/index.html" },
  podcasting: { title: "Apple Podcasts for Creators", url: "https://podcasters.apple.com/support" },
  "short-filmmaking": { title: "BFI filmmaking resources", url: "https://www.bfi.org.uk/education-research/education" },
  "music-production": { title: "Ableton Learning Music", url: "https://learningmusic.ableton.com/" },
  "digital-drawing": { title: "Smithsonian Open Access", url: "https://www.si.edu/openaccess" },
  photography: { title: "Library of Congress photography collections", url: "https://www.loc.gov/pictures/" },
  cooking: { title: "USDA food safety basics", url: "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics" },
  gardening: { title: "USDA garden resources", url: "https://www.nal.usda.gov/plant-production-gardening" },
  chess: { title: "FIDE chess rules", url: "https://handbook.fide.com/chapter/E012023" },
  meditation: { title: "NIH meditation and mindfulness overview", url: "https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety" },
  "learning-a-new-language": { title: "ACTFL proficiency guidelines", url: "https://www.actfl.org/educator-resources/actfl-proficiency-guidelines" },
  "learning-a-musical-instrument": { title: "Berklee Online music resources", url: "https://online.berklee.edu/takenote/" },
};

function toNodeId(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeEntry([slug, topic, category, aliases, concepts]) {
  const nodes = concepts.map((label, index) => ({
    id: toNodeId(label),
    label,
    level: index < 3 ? "Beginner" : index < 6 ? "Intermediate" : "Advanced",
    summary: `${label} is a practical part of building reliable skill in ${topic.toLowerCase()}.`,
    why: `It gives you the foundation needed for the ${index === concepts.length - 1 ? "final project" : "next stage"} in this path.`,
  }));
  const edges = nodes.slice(0, -1).map((node, index) => ({
    source: node.id,
    target: nodes[index + 1].id,
    relationship: `${node.label} prepares you to work confidently with ${nodes[index + 1].label}.`,
  }));
  const levels = Object.fromEntries(["Beginner", "Intermediate", "Advanced"].map((level) => [
    level,
    nodes.filter((node) => node.level === level).map((node) => ({
      name: node.label,
      summary: node.summary,
      why: node.why,
      connection: edges.find((edge) => edge.source === node.id)?.relationship ?? "Use this stage to consolidate and reflect on the complete learning path.",
    })),
  ]));

  return {
    published: true,
    reviewedDate,
    slug,
    topic,
    aliases: [topic, ...aliases],
    category,
    excerpt: `A reviewed beginner-to-advanced ${topic.toLowerCase()} roadmap with nine practical stages, clear outcomes, and trusted resources.`,
    introduction: `This learning path turns ${topic.toLowerCase()} into a manageable sequence. Work through the stages in order, practise each idea in a small exercise, and keep evidence of what you can do. The final stages emphasize integration: use the earlier foundations together instead of treating each concept as an isolated fact.`,
    prerequisites: ["Curiosity and a regular weekly practice block", "A place to keep notes, exercises, and reflections"],
    outcomes: [`Explain the core ideas behind ${topic.toLowerCase()}`, `Apply the skill in a complete, self-directed project`, "Evaluate your work and choose a useful next step"],
    resources: [primaryResourceBySlug[slug], resourcesByCategory[category][0]],
    relatedSlugs: relatedBySlug[slug],
    graph: { nodes, edges },
    levels,
  };
}

export const publicTopics = definitions.map(makeEntry);
export const publicTopicBySlug = new Map(publicTopics.map((topic) => [topic.slug, topic]));

function normalizeAlias(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const publicTopicByAlias = new Map(
  publicTopics.flatMap((topic) => topic.aliases.map((alias) => [normalizeAlias(alias), topic])),
);

export function findPublicTopicByAlias(value) {
  return publicTopicByAlias.get(normalizeAlias(value));
}

export function validatePublicTopics(topics = publicTopics) {
  const errors = [];
  const slugs = new Set();
  const intents = new Set();
  for (const topic of topics) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug) || slugs.has(topic.slug)) errors.push(`Invalid or duplicate slug: ${topic.slug}`);
    slugs.add(topic.slug);
    if (!topic.published || !topic.reviewedDate || topic.introduction.length < 200 || topic.excerpt.length < 80) errors.push(`Incomplete editorial metadata: ${topic.slug}`);
    if (topic.resources.length < 2 || topic.resources.some((resource) => !resource?.title || !/^https:\/\//.test(resource.url))) errors.push(`Invalid authoritative resources: ${topic.slug}`);
    const ids = new Set(topic.graph.nodes.map((node) => node.id));
    if (ids.size !== topic.graph.nodes.length || topic.graph.edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) errors.push(`Invalid graph references: ${topic.slug}`);
    for (const alias of topic.aliases) {
      const intent = normalizeAlias(alias);
      if (intents.has(intent)) errors.push(`Duplicate topic intent: ${alias}`);
      intents.add(intent);
    }
  }
  for (const topic of topics) {
    if (topic.relatedSlugs.length < 3 || topic.relatedSlugs.length > 5 || topic.relatedSlugs.some((slug) => !slugs.has(slug))) errors.push(`Invalid related topics: ${topic.slug}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return true;
}
