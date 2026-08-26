// ============= Knowledge Base (Firestore-backed) =============
const CATEGORY_LABELS = {
  skills: 'Skill',
  commands: 'Command',
  agents: 'Assistant',
  mcps: 'Connector',
  plugins: 'Plugin',
  instructions: 'Instruction',
  discoveries: 'Video',
  'other-tools': 'Other AI Tool',
  'other-general': 'General',
  'other-hr': 'HR',
  'other-marketing': 'Marketing',
  'other-sales': 'Sales',
  'other-business-support': 'Business Support',
  'other-fabrication': 'Fabrication',
  'other-finance': 'Finance',
  'other-installation': 'Installation Operation',
  'other-supply-chain': 'Supply Chain',
  'other-projects': 'Projects',
  'other-quartermaster': 'Quarter Master',
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
  mcps: 'Connectors',
  plugins: 'Plugins',
  instructions: 'Instructions',
  discoveries: 'Video',
  'other-tools': 'Other AI Tools',
  'other-general': 'General',
  'other-hr': 'HR',
  'other-marketing': 'Marketing',
  'other-sales': 'Sales',
  'other-business-support': 'Business Support',
  'other-fabrication': 'Fabrication',
  'other-finance': 'Finance',
  'other-installation': 'Installation Operation',
  'other-supply-chain': 'Supply Chain',
  'other-projects': 'Projects',
  'other-quartermaster': 'Quarter Master',
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
    instructions: 'Ready-made instructions you can give Claude so it works the way you need. Open one, copy the text (or its file), and paste it into the Claude instructions box.',
    discoveries: 'Short and useful videos that help the team learn new Claude features, tips, shortcuts, and ways to use Claude at work.'
  },
  chatgpt: {
    skills: 'A ChatGPT Skill is like a helper that knows how to handle a specific type of task. It gives ChatGPT instructions or knowledge that helps it perform that task more effectively.',
    agents: 'A ChatGPT AI Agent is like a worker that can handle a task for you. You give it a goal, and it can take several steps to work toward completing it.',
    mcps: 'A ChatGPT MCP is like a bridge that connects ChatGPT to other tools or systems. It allows ChatGPT to work with information and services outside of the chat.',
    plugins: 'A ChatGPT Plugin is like an extra tool that gives ChatGPT additional abilities or connects it to other services.',
    instructions: 'Ready-made instructions you can give ChatGPT so it works the way you need. Open one, copy the text (or its file), and paste it into the ChatGPT instructions box.',
    discoveries: 'Short and useful videos that help the team learn new ChatGPT features, tips, shortcuts, and ways to use ChatGPT at work.'
  },
  other: {
    'other-general': 'AI tools and files for everyone — anything that isn’t tied to one team. Share whatever helps the whole company here.',
    'other-hr': 'AI tools that help the HR team with hiring, staff records, training, and everyday people tasks.',
    'other-marketing': 'AI tools that help the Marketing team create content, campaigns, social posts, and brand materials.',
    'other-sales': 'AI tools that help the Sales team with quotes, follow-ups, proposals, and winning new business.',
    'other-business-support': 'AI tools that help the Business Support team with admin, coordination, and day-to-day office work.',
    'other-fabrication': 'AI tools that help the Fabrication team plan, measure, and manage production work.',
    'other-finance': 'AI tools that help the Finance team with numbers, reports, invoices, and budgets.',
    'other-installation': 'AI tools that help the Installation team plan jobs, schedules, and on-site work.',
    'other-supply-chain': 'AI tools that help the Supply Chain team source, compare, and order materials and supplies.',
    'other-projects': 'AI tools that help the Projects team plan, track, and deliver projects on time.',
    'other-quartermaster': 'AI tools that help the Quarter Master team manage stock, tools, and equipment.'
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
  'other-general': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  'other-hr': '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M17.5 14a6 6 0 0 1 3.5 6"/>',
  'other-marketing': '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  'other-sales': '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  'other-business-support': '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2" y="13" width="4" height="7" rx="1"/><rect x="18" y="13" width="4" height="7" rx="1"/>',
  'other-fabrication': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  'other-finance': '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.3a2.4 2.4 0 0 1 5 0c0 3-5 1-5 4a2.4 2.4 0 0 0 5 0"/>',
  'other-installation': '<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r="1"/>',
  'other-supply-chain': '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12h11l2-8H6"/>',
  'other-projects': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M8 12h8M8 16h5"/>',
  'other-quartermaster': '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/>'
};
function cardPlaceholderHtml(category){
  const path = CATEGORY_ICON_PATHS[category];
  if(!path) return '';
  return `<div class="card-placeholder"><svg viewBox="0 0 24 24">${path}</svg></div>`;
}

// Categories that use the full detail template (Purpose, Best For, Sample Prompts, etc.)
const RICH_CATEGORIES = ['skills', 'commands', 'agents', 'mcps', 'plugins'];
function isRichCategory(cat){ return RICH_CATEGORIES.includes(cat); }

const OTHER_TOOLS_CATS = ['other-hr', 'other-marketing', 'other-sales', 'other-business-support', 'other-fabrication', 'other-finance', 'other-installation', 'other-supply-chain', 'other-projects', 'other-quartermaster', 'other-general'];
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
// Now that Other AI Tools are grouped by department (not use-case), there's no fixed
// code-list of "known used" tools — cards show normally by default, and admins can flag a
// card as "not used yet" per entry via the toggle (stored in adminState/otherToolsUsage).
const USED_OTHER_TOOLS = {};
function normalizeToolName(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
// Other AI Tools and Connectors (MCPs) can both be flagged "still exploring" this way —
// everything else (Skills, Commands, Instructions, etc.) is always "used" (unaffected).
function usesUsageStatus(category){ return isOtherToolsCategory(category) || category === 'mcps'; }
// Returns true when a card should render normally; false when it needs the glass effect.
function isOtherToolUsed(entry){
  if(!entry || !usesUsageStatus(entry.category)) return true;
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
const LIBRARY_DEPARTMENTS = ['HR', 'Marketing', 'Sales', 'Business Support', 'Fabrication', 'Finance', 'Installation Operation', 'Supply Chain', 'Projects', 'Quarter Master'];

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
