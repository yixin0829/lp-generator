// Explicit learning dependencies, separate from the suggested reading order.
// Each entry names the prerequisite, the dependent concept, and the reason.
export const publicTopicDependencies = {
  "programming-fundamentals": [
    [
      "Variables and Data",
      "Control Flow",
      "Conditions and loops read and update program values.",
    ],
    [
      "Variables and Data",
      "Functions",
      "Parameters and return values build on representing data.",
    ],
    [
      "Control Flow",
      "Debugging",
      "Tracing branches and loops helps locate incorrect behavior.",
    ],
    [
      "Functions",
      "Debugging",
      "Function boundaries help isolate where a program goes wrong.",
    ],
    [
      "Variables and Data",
      "Data Structures",
      "Collections organize the values a program works with.",
    ],
    [
      "Control Flow",
      "Algorithms",
      "Algorithms use branches and repetition to carry out a procedure.",
    ],
    [
      "Data Structures",
      "Algorithms",
      "The organization of data affects how an algorithm accesses and changes it.",
    ],
    [
      "Functions",
      "Testing",
      "Function inputs and outputs provide units of behavior to test.",
    ],
    [
      "Debugging",
      "Testing",
      "Reproducing a bug provides a concrete regression test.",
    ],
    [
      "Functions",
      "Program Design",
      "Functions divide a larger program into responsibilities.",
    ],
    [
      "Data Structures",
      "Program Design",
      "A program's data model shapes its interfaces and operations.",
    ],
    [
      "Algorithms",
      "Program Design",
      "Choosing procedures is part of designing how a program solves its problem.",
    ],
    [
      "Program Design",
      "Capstone Project",
      "The project needs a plan for its components and their interfaces.",
    ],
    [
      "Testing",
      "Capstone Project",
      "Tests check that the completed project behaves as intended.",
    ],
  ],
  javascript: [
    [
      "Syntax and Values",
      "Variables and Scope",
      "Variable declarations bind names to JavaScript values.",
    ],
    [
      "Variables and Scope",
      "Functions",
      "Parameters and local variables follow scope rules.",
    ],
    [
      "Variables and Scope",
      "Arrays and Objects",
      "Variables hold references to collections and objects.",
    ],
    [
      "Functions",
      "The DOM",
      "Event handlers use functions to respond to page interactions.",
    ],
    [
      "Arrays and Objects",
      "The DOM",
      "DOM programming works with element objects and collections.",
    ],
    [
      "Functions",
      "Async JavaScript",
      "Callbacks and async functions build on function calls and return values.",
    ],
    [
      "Functions",
      "Modules",
      "Reusable functions can be exported and imported between files.",
    ],
    [
      "Variables and Scope",
      "Modules",
      "Modules introduce their own scope and explicit access to bindings.",
    ],
    [
      "Functions",
      "Testing",
      "Function inputs, outputs, and side effects define testable behavior.",
    ],
    [
      "Async JavaScript",
      "Testing",
      "Asynchronous tests must wait for results and handle failures.",
    ],
    [
      "Modules",
      "Application Architecture",
      "Module boundaries organize an application's responsibilities.",
    ],
    [
      "The DOM",
      "Application Architecture",
      "Browser applications coordinate their interface with application logic.",
    ],
    [
      "Async JavaScript",
      "Application Architecture",
      "Application design must account for delayed results and errors.",
    ],
    [
      "Testing",
      "Application Architecture",
      "Tests help check behavior across application boundaries.",
    ],
  ],
  react: [
    [
      "Modern JavaScript",
      "JSX",
      "JSX includes JavaScript expressions and is transformed into JavaScript.",
    ],
    [
      "JSX",
      "Components",
      "Components use JSX to describe their rendered interface.",
    ],
    [
      "Components",
      "Props and State",
      "Props and state describe a component's inputs and changing data.",
    ],
    [
      "Props and State",
      "Events and Forms",
      "Form events update state and pass values through props.",
    ],
    [
      "Components",
      "Hooks",
      "Hooks run within components and follow component lifecycle rules.",
    ],
    [
      "Props and State",
      "Hooks",
      "State and effect hooks depend on understanding changing component data.",
    ],
    [
      "Components",
      "Routing",
      "Routes select which components represent a page.",
    ],
    [
      "Events and Forms",
      "Testing React",
      "Interaction tests exercise form input and event behavior.",
    ],
    [
      "Hooks",
      "Testing React",
      "Tests need to account for state changes and effects.",
    ],
    [
      "Hooks",
      "Performance and Architecture",
      "Hook dependencies and state ownership affect rendering work.",
    ],
    [
      "Routing",
      "Performance and Architecture",
      "Page boundaries inform loading and application structure.",
    ],
    [
      "Testing React",
      "Performance and Architecture",
      "Behavioral tests help protect architectural changes.",
    ],
  ],
  "website-development": [
    [
      "How the Web Works",
      "HTML",
      "HTML is the document a browser receives and interprets.",
    ],
    ["HTML", "CSS", "CSS selectors target elements in the document."],
    [
      "CSS",
      "Responsive Design",
      "Responsive layouts use CSS sizing and layout rules.",
    ],
    [
      "HTML",
      "JavaScript",
      "Browser scripts interact with the document's elements and events.",
    ],
    [
      "HTML",
      "Accessibility",
      "Semantic HTML gives interfaces structure and meaning.",
    ],
    [
      "CSS",
      "Accessibility",
      "Focus visibility, contrast, and reflow depend on styling choices.",
    ],
    [
      "Version Control",
      "Deployment",
      "Versioned source makes releases traceable and recoverable.",
    ],
    [
      "How the Web Works",
      "Deployment",
      "Hosting requires understanding URLs, requests, and served assets.",
    ],
    [
      "Responsive Design",
      "Full Website Project",
      "The finished site must work at different screen sizes.",
    ],
    [
      "JavaScript",
      "Full Website Project",
      "Interactive site behavior uses scripting.",
    ],
    [
      "Accessibility",
      "Full Website Project",
      "The site needs usable navigation and content for different abilities.",
    ],
    [
      "Deployment",
      "Full Website Project",
      "Publishing makes the completed site available to others.",
    ],
  ],
  "mobile-app-development": [
    [
      "Product Scope",
      "Mobile UX",
      "The intended tasks determine the mobile interaction flow.",
    ],
    [
      "Product Scope",
      "Platform Choice",
      "Product requirements help determine which platforms to support.",
    ],
    [
      "Mobile UX",
      "Interface Building",
      "The interface implements the planned touch interactions.",
    ],
    [
      "Platform Choice",
      "Interface Building",
      "The platform determines available interface tools and conventions.",
    ],
    [
      "Interface Building",
      "State and Data",
      "Screens need a consistent model of the data they display.",
    ],
    [
      "Platform Choice",
      "Device APIs",
      "Device capabilities and permission models differ by platform.",
    ],
    [
      "State and Data",
      "Device APIs",
      "Device results must be integrated into application state.",
    ],
    [
      "Interface Building",
      "Testing",
      "Interface tests check the flows users can perform.",
    ],
    [
      "State and Data",
      "Testing",
      "Tests must cover data changes and persistence.",
    ],
    [
      "Device APIs",
      "Testing",
      "Device integrations need permission and failure-path checks.",
    ],
    ["Testing", "Release Process", "A release should use a validated build."],
    [
      "Release Process",
      "Production Maintenance",
      "Maintaining an app includes updating released versions.",
    ],
  ],
  "video-game-development": [
    [
      "Game Design Basics",
      "Engine and Tools",
      "The game concept helps determine the tools needed to build it.",
    ],
    [
      "Engine and Tools",
      "Input and Movement",
      "Input and movement use the engine's update and event systems.",
    ],
    [
      "Engine and Tools",
      "2D and 3D Worlds",
      "Scene tools define objects, coordinates, and environments.",
    ],
    [
      "Input and Movement",
      "Game Physics",
      "Physics changes how movement responds to forces and collisions.",
    ],
    [
      "2D and 3D Worlds",
      "Game Physics",
      "Collision and physical interaction depend on spatial relationships.",
    ],
    [
      "Input and Movement",
      "Audio and Feedback",
      "Actions need feedback that corresponds to the player's input.",
    ],
    [
      "2D and 3D Worlds",
      "Level Design",
      "Levels arrange objects and spaces into playable environments.",
    ],
    [
      "Game Design Basics",
      "Level Design",
      "Level challenges should support the intended game mechanics.",
    ],
    [
      "Game Physics",
      "Playtesting",
      "Playtesting checks how movement and collisions feel in use.",
    ],
    [
      "Audio and Feedback",
      "Playtesting",
      "Feedback helps players understand what happened during play.",
    ],
    [
      "Level Design",
      "Playtesting",
      "Players test the progression and challenges in a level.",
    ],
    [
      "Playtesting",
      "Publishing a Game",
      "Playtest findings guide fixes before publishing.",
    ],
  ],
  negotiation: [
    [
      "Goals and Interests",
      "Preparation",
      "Preparation needs a clear account of desired outcomes and underlying interests.",
    ],
    [
      "Active Listening",
      "Asking Questions",
      "Listening reveals which questions need clarification.",
    ],
    [
      "Goals and Interests",
      "Creating Options",
      "Useful options address the interests of the parties.",
    ],
    [
      "Asking Questions",
      "Creating Options",
      "Questions uncover constraints and possible alternatives.",
    ],
    [
      "Active Listening",
      "Handling Objections",
      "An objection needs to be understood before it can be addressed.",
    ],
    [
      "Preparation",
      "Handling Objections",
      "Preparation supplies relevant facts and alternatives.",
    ],
    [
      "Creating Options",
      "Making Trades",
      "Trades combine options that have different value to each party.",
    ],
    [
      "Handling Objections",
      "Making Trades",
      "Addressing concerns helps identify acceptable trade-offs.",
    ],
    [
      "Making Trades",
      "Closing Agreements",
      "Closing records the terms the parties have negotiated.",
    ],
    [
      "Preparation",
      "Practice and Review",
      "Practice can compare the initial plan with what happened.",
    ],
    [
      "Closing Agreements",
      "Practice and Review",
      "Reviewing outcomes helps improve the next negotiation.",
    ],
  ],
  "time-management": [
    [
      "Time Audit",
      "Priorities",
      "An audit shows where current time use differs from intended priorities.",
    ],
    [
      "Priorities",
      "Planning Systems",
      "A planning system needs criteria for choosing what to schedule.",
    ],
    [
      "Priorities",
      "Task Breakdown",
      "Breaking down work starts with identifying the outcome that matters.",
    ],
    [
      "Planning Systems",
      "Focus Blocks",
      "Focus blocks need a place in the schedule.",
    ],
    [
      "Task Breakdown",
      "Focus Blocks",
      "A defined task gives a focus block a workable scope.",
    ],
    [
      "Time Audit",
      "Energy Management",
      "Observing work patterns helps identify periods of better focus.",
    ],
    [
      "Focus Blocks",
      "Interruptions",
      "Protected work periods make interruptions and their costs visible.",
    ],
    [
      "Planning Systems",
      "Review Rituals",
      "Reviews compare the plan with completed and unfinished work.",
    ],
    [
      "Energy Management",
      "Review Rituals",
      "Reviews can adjust expectations to actual capacity.",
    ],
    [
      "Review Rituals",
      "Sustainable Habits",
      "Regular review helps adapt routines over time.",
    ],
    [
      "Interruptions",
      "Sustainable Habits",
      "Routines need ways to recover from everyday disruptions.",
    ],
  ],
  "team-leadership": [
    [
      "Leadership Foundations",
      "Clear Expectations",
      "A leader's responsibilities include defining what good work means.",
    ],
    [
      "Leadership Foundations",
      "Trust and Safety",
      "Leadership behavior influences whether people can raise concerns.",
    ],
    [
      "Clear Expectations",
      "Delegation",
      "Delegation needs an understood outcome and decision boundaries.",
    ],
    [
      "Trust and Safety",
      "Delegation",
      "Delegated work depends on people being able to ask for support.",
    ],
    [
      "Clear Expectations",
      "Feedback",
      "Feedback needs shared expectations against which to discuss work.",
    ],
    [
      "Trust and Safety",
      "Feedback",
      "People need to be able to discuss mistakes and uncertainty.",
    ],
    [
      "Feedback",
      "Conflict Resolution",
      "Specific observations support constructive conflict discussions.",
    ],
    [
      "Clear Expectations",
      "Decision Making",
      "Shared goals provide criteria for team decisions.",
    ],
    [
      "Feedback",
      "Coaching",
      "Coaching uses observations to identify development needs.",
    ],
    [
      "Trust and Safety",
      "Coaching",
      "Coaching requires candid discussion of difficulties.",
    ],
    [
      "Delegation",
      "Team Systems",
      "Team routines must support ownership and handoffs.",
    ],
    [
      "Decision Making",
      "Team Systems",
      "Team systems need clear ways to make and revisit decisions.",
    ],
    [
      "Conflict Resolution",
      "Team Systems",
      "Teams need a repeatable way to address disagreements.",
    ],
  ],
  "public-speaking": [
    [
      "Audience and Purpose",
      "Message Structure",
      "The audience and purpose determine how the message should be organized.",
    ],
    [
      "Audience and Purpose",
      "Story and Evidence",
      "Examples and evidence need to be relevant to the audience.",
    ],
    [
      "Message Structure",
      "Clear Language",
      "A clear outline helps turn ideas into understandable sentences.",
    ],
    [
      "Message Structure",
      "Visual Aids",
      "Visuals should support the structure of the talk.",
    ],
    [
      "Story and Evidence",
      "Visual Aids",
      "Evidence and examples determine which visuals are useful.",
    ],
    [
      "Clear Language",
      "Rehearsal",
      "Rehearsal needs a spoken version of the message.",
    ],
    [
      "Voice Control",
      "Rehearsal",
      "Rehearsal develops pacing, emphasis, and audible delivery.",
    ],
    [
      "Body Language",
      "Rehearsal",
      "Practising gestures and stance connects them to the talk.",
    ],
    [
      "Visual Aids",
      "Rehearsal",
      "Visual transitions need to be practised with the spoken message.",
    ],
    [
      "Rehearsal",
      "Live Delivery",
      "Rehearsal prepares the speaker to deliver and adapt the talk.",
    ],
    [
      "Audience and Purpose",
      "Live Delivery",
      "Live delivery must respond to the audience while maintaining the purpose.",
    ],
  ],
  "career-networking": [
    [
      "Networking Goals",
      "Personal Introduction",
      "The introduction should explain the interests relevant to a conversation.",
    ],
    [
      "Networking Goals",
      "Finding Communities",
      "Goals help identify relevant professional communities.",
    ],
    [
      "Personal Introduction",
      "Starting Conversations",
      "An introduction provides a starting point for meeting someone.",
    ],
    [
      "Finding Communities",
      "Starting Conversations",
      "Communities provide a context for relevant conversations.",
    ],
    [
      "Starting Conversations",
      "Following Up",
      "Follow-up refers back to a specific conversation.",
    ],
    [
      "Listening Well",
      "Following Up",
      "Listening helps make follow-up relevant to the other person.",
    ],
    [
      "Listening Well",
      "Giving Value",
      "Understanding someone's interests helps identify useful contributions.",
    ],
    [
      "Following Up",
      "Maintaining Relationships",
      "Relationships develop through continued contact.",
    ],
    [
      "Giving Value",
      "Maintaining Relationships",
      "Useful contributions make continued contact reciprocal.",
    ],
    [
      "Maintaining Relationships",
      "Network Strategy",
      "Existing relationships inform where to invest future attention.",
    ],
    [
      "Networking Goals",
      "Network Strategy",
      "Strategy should connect relationship-building to clear goals.",
    ],
  ],
  "sales-and-marketing": [
    [
      "Customer Problems",
      "Market Research",
      "Customer problems provide questions for market research.",
    ],
    [
      "Market Research",
      "Positioning",
      "Positioning uses evidence about customers and alternatives.",
    ],
    [
      "Customer Problems",
      "Value Propositions",
      "A value proposition explains how a problem is addressed.",
    ],
    [
      "Positioning",
      "Value Propositions",
      "Positioning clarifies why the offer differs from alternatives.",
    ],
    [
      "Market Research",
      "Channels",
      "Research helps identify where relevant customers can be reached.",
    ],
    [
      "Value Propositions",
      "Sales Conversations",
      "Sales conversations test whether the proposed value fits a customer's needs.",
    ],
    [
      "Channels",
      "Campaign Measurement",
      "Measurement must reflect how each channel reaches customers.",
    ],
    [
      "Value Propositions",
      "Campaign Measurement",
      "Campaign goals should test the offer's intended value.",
    ],
    [
      "Sales Conversations",
      "Retention",
      "Customer conversations reveal expectations that continued service must meet.",
    ],
    [
      "Campaign Measurement",
      "Go-to-Market Plan",
      "Measured results inform channel and campaign choices.",
    ],
    [
      "Retention",
      "Go-to-Market Plan",
      "A launch plan needs an approach to keeping customers after acquisition.",
    ],
  ],
  "creative-writing": [
    [
      "Observation and Ideas",
      "Character",
      "Observed behavior can become material for believable characters.",
    ],
    [
      "Observation and Ideas",
      "Setting",
      "Specific observations help establish the story's world.",
    ],
    [
      "Character",
      "Point of View",
      "Choosing a viewpoint determines whose experience the reader follows.",
    ],
    [
      "Character",
      "Scene and Structure",
      "Character goals and actions drive scenes.",
    ],
    [
      "Setting",
      "Scene and Structure",
      "Scenes need a concrete place in which events unfold.",
    ],
    [
      "Character",
      "Dialogue",
      "Dialogue expresses a character's intentions and voice.",
    ],
    [
      "Point of View",
      "Dialogue",
      "Viewpoint affects which speech and reactions reach the reader.",
    ],
    [
      "Scene and Structure",
      "Revision",
      "Revision examines how scenes contribute to the whole story.",
    ],
    [
      "Dialogue",
      "Revision",
      "Revising dialogue improves clarity, voice, and scene purpose.",
    ],
    [
      "Scene and Structure",
      "Feedback",
      "A draft of connected scenes gives readers something concrete to respond to.",
    ],
    [
      "Revision",
      "Finished Story",
      "Finishing requires revising the draft into a coherent whole.",
    ],
    [
      "Feedback",
      "Finished Story",
      "Reader feedback helps identify problems the writer may have missed.",
    ],
  ],
  podcasting: [
    [
      "Concept and Audience",
      "Episode Format",
      "The audience and premise determine a useful episode format.",
    ],
    [
      "Concept and Audience",
      "Research",
      "The podcast's purpose guides which material to investigate.",
    ],
    [
      "Research",
      "Interviewing",
      "Research provides informed questions and useful follow-ups.",
    ],
    [
      "Episode Format",
      "Interviewing",
      "The format determines the role and length of an interview.",
    ],
    [
      "Episode Format",
      "Recording",
      "The recording setup must support the chosen format.",
    ],
    [
      "Recording",
      "Editing",
      "Editing works with recorded speech and other audio.",
    ],
    [
      "Interviewing",
      "Editing",
      "Understanding the conversation helps retain its meaning during editing.",
    ],
    ["Editing", "Publishing", "Publishing needs a finished audio episode."],
    [
      "Music and Rights",
      "Publishing",
      "Publication requires permission for any music or other protected material used.",
    ],
    [
      "Publishing",
      "Audience Growth",
      "Audience growth needs episodes people can find and listen to.",
    ],
    [
      "Concept and Audience",
      "Audience Growth",
      "Promotion should reach people interested in the podcast's premise.",
    ],
  ],
  "short-filmmaking": [
    [
      "Story Concept",
      "Screenplay",
      "The screenplay develops the premise into scenes and actions.",
    ],
    [
      "Screenplay",
      "Shot Planning",
      "Shot choices must cover the actions and information in each scene.",
    ],
    [
      "Screenplay",
      "Production Design",
      "The script establishes the spaces and objects the film needs.",
    ],
    [
      "Shot Planning",
      "Camera and Lighting",
      "Camera placement and lighting implement the planned shots.",
    ],
    [
      "Screenplay",
      "Directing",
      "Directing interprets the characters' intentions and scene purposes.",
    ],
    [
      "Production Design",
      "Directing",
      "Performances and blocking must work within the prepared environment.",
    ],
    [
      "Shot Planning",
      "Sound Recording",
      "The shot plan helps determine how dialogue and scene sound can be recorded.",
    ],
    [
      "Camera and Lighting",
      "Editing",
      "Editing assembles the recorded images.",
    ],
    [
      "Sound Recording",
      "Editing",
      "Editing combines picture with dialogue and other recorded sound.",
    ],
    [
      "Directing",
      "Editing",
      "Performance and story intentions guide the choice of takes.",
    ],
    [
      "Editing",
      "Festival Release",
      "A festival submission requires a finished cut and deliverables.",
    ],
  ],
  "music-production": [
    [
      "Listening Skills",
      "Rhythm",
      "Listening develops awareness of pulse and rhythmic patterns.",
    ],
    [
      "Listening Skills",
      "Harmony and Melody",
      "Recognizing pitch relationships supports melodic and harmonic choices.",
    ],
    [
      "DAW Workflow",
      "Recording",
      "Recording requires routing, tracks, and editing tools in the DAW.",
    ],
    [
      "DAW Workflow",
      "Sound Design",
      "Sound design uses instruments, effects, and modulation tools.",
    ],
    [
      "Rhythm",
      "Arrangement",
      "Arrangement organizes rhythmic parts across the track.",
    ],
    [
      "Harmony and Melody",
      "Arrangement",
      "Arrangement develops the track's melodic and harmonic material.",
    ],
    [
      "Sound Design",
      "Arrangement",
      "Chosen sounds affect the roles and space of musical parts.",
    ],
    [
      "Recording",
      "Mixing",
      "Mixing balances and processes the recorded material.",
    ],
    [
      "Arrangement",
      "Mixing",
      "The arrangement determines which parts must work together in the mix.",
    ],
    [
      "Listening Skills",
      "Mixing",
      "Critical listening guides decisions about balance and clarity.",
    ],
    [
      "Mixing",
      "Master and Release",
      "Mastering and release preparation use the completed mix.",
    ],
  ],
  "digital-drawing": [
    [
      "Tools and Canvas",
      "Line Control",
      "Brush and canvas settings affect how marks are made.",
    ],
    [
      "Line Control",
      "Shape and Form",
      "Controlled marks help describe shapes and volumes.",
    ],
    [
      "Shape and Form",
      "Perspective",
      "Perspective places forms consistently in space.",
    ],
    [
      "Shape and Form",
      "Light and Value",
      "Light and shadow describe the planes of a form.",
    ],
    [
      "Light and Value",
      "Color",
      "Value relationships remain important when working with color.",
    ],
    [
      "Shape and Form",
      "Composition",
      "Composition organizes shapes into a readable image.",
    ],
    [
      "Perspective",
      "Rendering",
      "Rendering needs consistent spatial relationships.",
    ],
    [
      "Light and Value",
      "Rendering",
      "Shading uses light and value to describe surfaces.",
    ],
    ["Color", "Rendering", "Color choices affect material, light, and mood."],
    [
      "Composition",
      "Portfolio Piece",
      "A finished piece needs a deliberate arrangement of visual elements.",
    ],
    [
      "Rendering",
      "Portfolio Piece",
      "Rendering develops the chosen piece to its intended finish.",
    ],
  ],
  photography: [
    [
      "Camera Controls",
      "Exposure",
      "Exposure uses aperture, shutter speed, and ISO controls.",
    ],
    [
      "Camera Controls",
      "Focus",
      "Focus settings determine which parts of a scene are sharp.",
    ],
    [
      "Exposure",
      "Light",
      "Exposure knowledge helps assess and respond to available light.",
    ],
    ["Light", "Color", "The light source affects color and white balance."],
    [
      "Focus",
      "Portraits",
      "Portraits require deliberate focus on the subject.",
    ],
    [
      "Composition",
      "Portraits",
      "Framing and background choices affect how the subject is presented.",
    ],
    ["Light", "Portraits", "Lighting shapes the appearance of the subject."],
    [
      "Exposure",
      "Editing",
      "Editing starts with understanding the captured tones and exposure.",
    ],
    [
      "Color",
      "Editing",
      "Color knowledge helps guide white balance and color adjustments.",
    ],
    [
      "Composition",
      "Photo Series",
      "A series needs consistent visual choices across images.",
    ],
    [
      "Editing",
      "Photo Series",
      "Editing helps select and present images as a coherent series.",
    ],
  ],
  cooking: [
    [
      "Kitchen Safety",
      "Knife Skills",
      "Knife work starts with safe handling and a stable workspace.",
    ],
    [
      "Kitchen Safety",
      "Heat Control",
      "Working with heat requires safe handling of hot equipment.",
    ],
    [
      "Knife Skills",
      "Core Techniques",
      "Consistent preparation supports even cooking.",
    ],
    [
      "Heat Control",
      "Core Techniques",
      "Cooking techniques depend on controlling heat and time.",
    ],
    [
      "Seasoning",
      "Ingredient Pairing",
      "Understanding flavors helps choose ingredients that work together.",
    ],
    [
      "Core Techniques",
      "Timing a Meal",
      "Coordinating dishes requires knowing how each technique progresses.",
    ],
    [
      "Core Techniques",
      "Recipe Adaptation",
      "Adapting a recipe requires understanding the purpose of its steps.",
    ],
    [
      "Ingredient Pairing",
      "Recipe Adaptation",
      "Substitutions should account for how ingredients contribute flavor and texture.",
    ],
    [
      "Timing a Meal",
      "Menu Project",
      "A complete menu needs dishes to be ready at appropriate times.",
    ],
    [
      "Recipe Adaptation",
      "Menu Project",
      "The menu must account for available ingredients and constraints.",
    ],
  ],
  gardening: [
    [
      "Site Observation",
      "Plant Selection",
      "Light, space, and local conditions inform suitable plant choices.",
    ],
    [
      "Soil Health",
      "Plant Selection",
      "Soil conditions affect which plants can thrive.",
    ],
    [
      "Plant Selection",
      "Seeds and Transplants",
      "Different plants have different establishment needs.",
    ],
    [
      "Soil Health",
      "Watering",
      "Soil structure affects water retention and drainage.",
    ],
    [
      "Plant Selection",
      "Watering",
      "Water needs vary by plant and growing stage.",
    ],
    [
      "Soil Health",
      "Plant Nutrition",
      "Nutrition decisions depend on the soil's condition.",
    ],
    [
      "Plant Selection",
      "Pest Balance",
      "Knowing the plants helps identify likely pests and beneficial organisms.",
    ],
    [
      "Seeds and Transplants",
      "Season Planning",
      "Establishment methods and timing shape the planting calendar.",
    ],
    [
      "Site Observation",
      "Season Planning",
      "Seasonal conditions influence when garden tasks are practical.",
    ],
    [
      "Watering",
      "Garden Stewardship",
      "Long-term care requires adapting watering to changing conditions.",
    ],
    [
      "Plant Nutrition",
      "Garden Stewardship",
      "Ongoing care includes monitoring and supporting plant growth.",
    ],
    [
      "Pest Balance",
      "Garden Stewardship",
      "Stewardship includes observing and responding to the garden ecosystem.",
    ],
    [
      "Season Planning",
      "Garden Stewardship",
      "A seasonal plan coordinates continuing garden care.",
    ],
  ],
  chess: [
    [
      "Board and Moves",
      "Check and Mate",
      "Check and mate depend on legal moves and attacked squares.",
    ],
    [
      "Board and Moves",
      "Opening Principles",
      "Opening play uses legal development and control of squares.",
    ],
    [
      "Check and Mate",
      "Tactics",
      "Tactical sequences often use threats against the king.",
    ],
    [
      "Opening Principles",
      "Piece Coordination",
      "Development provides the pieces that must work together.",
    ],
    [
      "Tactics",
      "Piece Coordination",
      "Tactical patterns show how pieces support one another.",
    ],
    [
      "Board and Moves",
      "Pawn Structure",
      "Pawn movement rules create lasting structural features.",
    ],
    [
      "Check and Mate",
      "Endgames",
      "Endgame play includes converting advantages into checkmate.",
    ],
    [
      "Pawn Structure",
      "Endgames",
      "Pawn placement strongly affects endgame plans.",
    ],
    [
      "Tactics",
      "Game Analysis",
      "Analysis checks concrete threats and missed combinations.",
    ],
    [
      "Piece Coordination",
      "Game Analysis",
      "Analysis examines whether pieces supported the position's needs.",
    ],
    [
      "Endgames",
      "Tournament Practice",
      "Complete games require handling reduced-material positions.",
    ],
    [
      "Game Analysis",
      "Tournament Practice",
      "Reviewing games turns competition into targeted practice.",
    ],
  ],
  meditation: [
    [
      "Posture and Setting",
      "Attention to Breath",
      "A workable position and setting support attention practice.",
    ],
    [
      "Attention to Breath",
      "Noticing Distraction",
      "An attention anchor makes it easier to notice wandering.",
    ],
    [
      "Attention to Breath",
      "Body Awareness",
      "Attention practice can be extended to bodily sensations.",
    ],
    [
      "Noticing Distraction",
      "Working with Emotion",
      "Noticing mental activity helps distinguish emotions from automatic reactions.",
    ],
    [
      "Body Awareness",
      "Working with Emotion",
      "Bodily sensations can help identify emotional experience.",
    ],
    [
      "Working with Emotion",
      "Compassion Practice",
      "Awareness of emotional experience can support compassionate reflection.",
    ],
    [
      "Posture and Setting",
      "Daily Routine",
      "A repeatable setting makes practice easier to include in a routine.",
    ],
    [
      "Noticing Distraction",
      "Daily Routine",
      "Returning attention is a repeatable part of ordinary practice.",
    ],
    [
      "Daily Routine",
      "Longer Sits",
      "Familiarity with shorter regular practice prepares for longer sessions.",
    ],
    [
      "Body Awareness",
      "Longer Sits",
      "Awareness helps notice discomfort during longer practice.",
    ],
    [
      "Daily Routine",
      "Reflective Practice",
      "Repeated practice provides experiences to reflect on.",
    ],
    [
      "Compassion Practice",
      "Reflective Practice",
      "Compassion can inform how practice experiences are reviewed.",
    ],
  ],
  "learning-a-new-language": [
    [
      "Sound System",
      "Useful Phrases",
      "Pronunciation knowledge helps make practiced phrases understandable.",
    ],
    [
      "Core Vocabulary",
      "Useful Phrases",
      "Common words provide material for useful expressions.",
    ],
    [
      "Core Vocabulary",
      "Basic Grammar",
      "Familiar words make grammatical patterns easier to work with.",
    ],
    [
      "Sound System",
      "Listening Practice",
      "Recognizing sounds helps segment and identify spoken language.",
    ],
    [
      "Core Vocabulary",
      "Listening Practice",
      "Known words provide anchors when listening.",
    ],
    [
      "Useful Phrases",
      "Conversation",
      "Practiced expressions support common conversational tasks.",
    ],
    [
      "Listening Practice",
      "Conversation",
      "Conversation requires understanding the other speaker.",
    ],
    [
      "Core Vocabulary",
      "Reading",
      "Recognizing words supports understanding written material.",
    ],
    [
      "Basic Grammar",
      "Reading",
      "Grammar helps interpret relationships within sentences.",
    ],
    [
      "Basic Grammar",
      "Writing",
      "Writing requires arranging words into meaningful sentences.",
    ],
    ["Reading", "Writing", "Reading provides examples of written expression."],
    [
      "Conversation",
      "Immersion Plan",
      "Conversation skills help choose achievable real-world interactions.",
    ],
    [
      "Reading",
      "Immersion Plan",
      "Reading ability helps select suitable everyday materials.",
    ],
  ],
  "learning-a-musical-instrument": [
    [
      "Instrument Setup",
      "Posture and Technique",
      "Technique needs an instrument that is correctly prepared and positioned.",
    ],
    [
      "Posture and Technique",
      "Rhythm",
      "Controlled movements support consistent timing.",
    ],
    [
      "Posture and Technique",
      "Pitch and Notes",
      "Technique determines how notes are produced on the instrument.",
    ],
    [
      "Pitch and Notes",
      "Scales and Patterns",
      "Scales organize notes into repeatable pitch patterns.",
    ],
    [
      "Rhythm",
      "Scales and Patterns",
      "Patterns need to be practiced with deliberate timing.",
    ],
    [
      "Rhythm",
      "Reading Music",
      "Notation represents duration as well as pitch.",
    ],
    [
      "Pitch and Notes",
      "Reading Music",
      "Reading connects written pitch to notes on the instrument.",
    ],
    [
      "Pitch and Notes",
      "Ear Training",
      "Recognizing and reproducing pitch develops listening skills.",
    ],
    [
      "Scales and Patterns",
      "Repertoire",
      "Practiced patterns help with passages in pieces.",
    ],
    [
      "Reading Music",
      "Repertoire",
      "Reading supports learning pieces from notation.",
    ],
    [
      "Ear Training",
      "Repertoire",
      "Listening helps learn and refine musical phrases.",
    ],
    [
      "Repertoire",
      "Performance Practice",
      "Performance practice works with pieces that have been learned.",
    ],
    [
      "Posture and Technique",
      "Performance Practice",
      "Reliable technique supports playing through a complete performance.",
    ],
  ],
};
