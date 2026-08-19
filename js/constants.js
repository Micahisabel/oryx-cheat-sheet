// ============= Knowledge Base (Firestore-backed) =============
const CATEGORY_LABELS = {
  skills: 'Skill',
  commands: 'Command',
  agents: 'Assistant',
  mcps: 'Connection',
  plugins: 'Plugin',
  instructions: 'Instruction',
  discoveries: 'Video',
  'other-tools': 'Other AI Tool',
  'other-writing': 'Writing',
  'other-video': 'Video',
  'other-images': 'Images',
  'other-research': 'Research',
  'other-design': 'Design',
  'other-audio': 'Audio',
  'other-automation': 'Automation',
  'shortcut-desktop': 'Claude Desktop',
  'shortcut-code': 'Claude Code',
  'shortcut-slash': 'Quick Command',
  'shortcut-prompts': 'Claude Prompt',
  'chatgpt-shortcut-desktop': 'ChatGPT Desktop',
  'chatgpt-shortcut-code': 'ChatGPT Code',
  'chatgpt-shortcut-slash': 'Quick Command',
  'chatgpt-shortcut-prompts': 'ChatGPT Prompt',
  // legacy labels kept so older entries still display a clean tag
  prompting: 'Prompting Technique',
  resources: 'Resource'
};

// Real technical term for categories renamed to plain language, shown as a small "learn" tag
// beside the friendly label (nav tabs, entry detail) so staff still pick up the real vocabulary.
const CATEGORY_TECH_TERMS = {
  agents: 'AI Agent',
  mcps: 'MCP',
  'shortcut-slash': 'Slash Command',
  'chatgpt-shortcut-slash': 'Slash Command'
};

const CATEGORY_PLURAL_LABELS = {
  skills: 'Skills',
  commands: 'Commands',
  agents: 'Assistants',
  mcps: 'Connections',
  plugins: 'Plugins',
  instructions: 'Instructions',
  discoveries: 'Video',
  'other-tools': 'Other AI Tools',
  'other-writing': 'Writing',
  'other-video': 'Video',
  'other-images': 'Images',
  'other-research': 'Research',
  'other-design': 'Design',
  'other-audio': 'Audio',
  'other-automation': 'Automation',
  'shortcut-desktop': 'Claude Shortcuts',
  'shortcut-code': 'Claude Shortcuts',
  'shortcut-slash': 'Claude Shortcuts',
  'shortcut-prompts': 'Claude Shortcuts',
  'chatgpt-shortcut-desktop': 'ChatGPT Shortcuts',
  'chatgpt-shortcut-code': 'ChatGPT Shortcuts',
  'chatgpt-shortcut-slash': 'ChatGPT Shortcuts',
  'chatgpt-shortcut-prompts': 'ChatGPT Shortcuts'
};

// Short, plain-English explanation shown at the top of a category view.
// Keyed by platform, then category. The "All Platforms" view falls back to the Claude wording.
const CATEGORY_EXPLAINERS = {
  claude: {
    skills: 'A Claude Skill is like a helper that already knows how to do a specific job. You give it the instructions once, and Claude can use them whenever you need that job done.',
    agents: 'A Claude AI Agent is like a worker that can handle a task for you. You give it a goal, and it can work through the steps needed to complete it.',
    mcps: 'A Claude MCP is like a bridge that connects Claude to other tools or systems. It allows Claude to access information or use tools outside of the chat.',
    plugins: 'A Claude Plugin is like an extra tool for Claude. It adds new abilities or makes it easier to connect Claude with other tools and services.',
    instructions: 'Simple, step-by-step guides that show you how to do things here. Follow them one step at a time — written in plain words so anyone can follow along.',
    discoveries: 'Short and useful videos that help the team learn new Claude features, tips, shortcuts, and ways to use Claude at work.'
  },
  chatgpt: {
    skills: 'A ChatGPT Skill is like a helper that knows how to handle a specific type of task. It gives ChatGPT instructions or knowledge that helps it perform that task more effectively.',
    agents: 'A ChatGPT AI Agent is like a worker that can handle a task for you. You give it a goal, and it can take several steps to work toward completing it.',
    mcps: 'A ChatGPT MCP is like a bridge that connects ChatGPT to other tools or systems. It allows ChatGPT to work with information and services outside of the chat.',
    plugins: 'A ChatGPT Plugin is like an extra tool that gives ChatGPT additional abilities or connects it to other services.',
    instructions: 'Simple, step-by-step guides that show you how to do things here. Follow them one step at a time — written in plain words so anyone can follow along.',
    discoveries: 'Short and useful videos that help the team learn new ChatGPT features, tips, shortcuts, and ways to use ChatGPT at work.'
  },
  other: {
    'other-writing': 'AI tools that help you write, rewrite, summarise, and improve text, emails, documents, and other written content.',
    'other-video': 'AI tools that help you create, edit, and improve videos using simple instructions, images, or text.',
    'other-images': 'AI tools that help you create, edit, and improve images, graphics, and visual content using AI.',
    'other-research': 'AI tools that help you find, understand, summarise, and organise information quickly.',
    'other-design': 'AI tools that help you create presentations, layouts, graphics, marketing materials, and other designs.',
    'other-audio': 'AI tools that help you create, edit, improve, or work with voice, music, and other audio content.',
    'other-automation': 'AI tools that help you automate repetitive tasks, connect different apps, and make work happen automatically with less manual effort.'
  }
};

// Explainers for the shortcut sub-categories, shown in the Claude/ChatGPT Shortcuts view.
// Keyed directly by the shortcut category id.
const SHORTCUT_EXPLAINERS = {
  'shortcut-prompts': 'Ready-made instructions you can give Claude to help you get the result you need.',
  'shortcut-desktop': 'Use Claude from your computer to help with your everyday work.',
  'shortcut-code': 'Use Claude to help create, change, or understand computer programs.',
  'shortcut-slash': 'Quick shortcuts that let you tell Claude what you want without typing the full instruction.',
  'chatgpt-shortcut-prompts': 'Ready-made instructions you can give ChatGPT to help you get the result you need.',
  'chatgpt-shortcut-desktop': 'Use ChatGPT from your computer to help with your everyday work.',
  'chatgpt-shortcut-code': 'Use ChatGPT to help create, change, or understand computer programs.',
  'chatgpt-shortcut-slash': 'Quick shortcuts that let you tell ChatGPT what you want without typing the full instruction.'
};

// Optional "learn more" link shown under an explainer. Same platform/category keys as above.
const CATEGORY_EXPLAINER_LINKS = {
  claude: {
    skills: { url: 'https://youtu.be/kS1MJFZWMq4?si=qSlIawPKHZP0YnqF', label: 'Click here to learn how to create a Skill in Claude' },
    agents: { url: 'https://youtu.be/I4mVeNKPqPc?si=jJYlzvK1bheDJ6OM', label: 'Click here to learn how to create an AI Agent in Claude' },
    mcps: { url: 'https://youtu.be/kkBFmwkDzdo?si=eSmnE2Wvy81WxDIi', label: 'Click here to learn how to set up an MCP in Claude' }
  },
  chatgpt: {
    skills: { url: 'https://youtu.be/qh93rLRPw80?si=jribn9jMDYo9KZOe', label: 'Click here to learn how to create a Skill in ChatGPT' },
    mcps: { url: 'https://youtu.be/G_AqysfbikA?si=izGMGdGKDeH_TcZn', label: 'Click here to learn how to set up an MCP in ChatGPT' }
  }
};

const CATEGORY_ICON_PATHS = {
  skills: '<path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z"/>',
  commands: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  agents: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  mcps: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
  instructions: '<path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/>',
  plugins: '<path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/>',
  discoveries: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  'other-tools': '<path d="M12 3l2.1 4.9L19 10l-4.9 2.1L12 17l-2.1-4.9L5 10l4.9-2.1z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
  'other-writing': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  'other-video': '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3z"/>',
  'other-images': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  'other-research': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  'other-design': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3c1.8 0 3.2-1.4 3.2-3.2C20.5 6.6 16.7 3 12 3z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/>',
  'other-audio': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'other-automation': '<path d="M12 2l1.5 3.6L17 7l-3.5 1.4L12 12l-1.5-3.6L7 7l3.5-1.4z"/><path d="M5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'
};
function cardPlaceholderHtml(category){
  const path = CATEGORY_ICON_PATHS[category];
  if(!path) return '';
  return `<div class="card-placeholder"><svg viewBox="0 0 24 24">${path}</svg></div>`;
}

// Categories that use the full detail template (Purpose, Best For, Sample Prompts, etc.)
const RICH_CATEGORIES = ['skills', 'commands', 'agents', 'mcps', 'plugins'];
function isRichCategory(cat){ return RICH_CATEGORIES.includes(cat); }

const OTHER_TOOLS_CATS = ['other-writing', 'other-video', 'other-images', 'other-research', 'other-design', 'other-audio', 'other-automation'];
function isOtherToolsCategory(cat){ return cat === 'other-tools' || OTHER_TOOLS_CATS.includes(cat); }

const CLAUDE_SHORTCUT_CATS = ['shortcut-prompts', 'shortcut-desktop', 'shortcut-code', 'shortcut-slash'];
const CHATGPT_SHORTCUT_CATS = ['chatgpt-shortcut-desktop', 'chatgpt-shortcut-code', 'chatgpt-shortcut-slash', 'chatgpt-shortcut-prompts'];
const SHORTCUT_CATEGORIES = [...CLAUDE_SHORTCUT_CATS, ...CHATGPT_SHORTCUT_CATS];
function isShortcutCategory(cat){ return SHORTCUT_CATEGORIES.includes(cat); }
const PROMPT_SHORTCUT_CATS = ['shortcut-prompts', 'chatgpt-shortcut-prompts'];
function isPromptShortcutCategory(cat){ return PROMPT_SHORTCUT_CATS.includes(cat); }
function shortcutBadgeHtml(key){
  if(!key) return '';
  return `<div class="card-placeholder"><span class="shortcut-key-text">${escapeHtml(key)}</span></div>`;
}

// --- "Already used" reference for Other AI Tools ------------------------------
// Tools the team has actually used. Cards NOT listed here get a subtle frosted /
// glass treatment (see .card-unused in cards.css) so it's clear at a glance which
// tools are in use and which are not yet tried. Names are matched loosely
// (case-insensitive, punctuation/spacing ignored) so "NotebookLM" == "Notebook LM".
// An empty array means "none used yet" -> the whole category shows as unused.
const USED_OTHER_TOOLS = {
  'other-writing':    ['claude', 'chatgpt', 'gemini'],
  'other-video':      ['kling', 'higgsfield'],
  'other-images':     ['fal', 'nanobanana', 'chatgpt'],
  'other-research':   ['notebooklm'],
  'other-design':     ['canva', 'pomelli'],
  'other-audio':      ['elevenlabs'],
  'other-automation': []
};
function normalizeToolName(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
// Returns true when a card should render normally; false when it needs the glass effect.
// Only Other AI Tools cards are governed — everything else is always "used" (unaffected).
function isOtherToolUsed(entry){
  if(!entry || !isOtherToolsCategory(entry.category)) return true;
  // An admin toggle (stored in adminState/otherToolsUsage) always wins.
  if(typeof otherToolsUsage !== 'undefined' && typeof otherToolsUsage[entry.id] === 'boolean'){
    return otherToolsUsage[entry.id];
  }
  // Otherwise fall back to the code-list default.
  const list = USED_OTHER_TOOLS[entry.category];
  if(!list) return true;
  return list.includes(normalizeToolName(entry.title));
}

// --- Library department filter -----------------------------------------------
// The department options for the main library filter and the Add/Edit picker. These are the
// business departments an AI resource can be tagged with. Stored (comma-separated) in an
// entry's existing `department` field, so no new Firestore field is introduced.
const LIBRARY_DEPARTMENTS = ['HR', 'Sales', 'Marketing', 'Finance', 'Business Support', 'Operations'];

// Which of the known departments an entry belongs to. Matches whole words case-insensitively,
// so it reads both new comma lists ("HR, Finance") and legacy free text ("Sales and Marketing")
// without false hits like "IT" inside "digital".
function entryDepartments(entry){
  const text = (entry && entry.department ? String(entry.department) : '').toLowerCase();
  if(!text) return [];
  return LIBRARY_DEPARTMENTS.filter(d => {
    const needle = d.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z])' + needle + '([^a-z]|$)').test(text);
  });
}
