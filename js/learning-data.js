// ============================================================================
// AI Learning — centralized configuration
// ============================================================================
// Everything that shapes the assessment, scoring, learning paths, lessons, XP
// and badges lives in this one file. To change what the assessment asks, how
// levels are scored, or what a level's lessons cover, edit the data below —
// nothing elsewhere in js/learning.js should need to change.
// ============================================================================

// ---- Levels -----------------------------------------------------------------
const LEARNING_LEVEL_ORDER = ['beginner', 'basic', 'intermediate', 'advanced', 'expert'];

const LEVEL_META = {
  beginner:     { label: 'Beginner',     emoji: '🟢', color: '#3FA34D', desc: 'Little or no understanding of AI', blurb: "You're new to AI — this path builds your understanding from the ground up." },
  basic:        { label: 'Basic',        emoji: '🔵', color: '#1C7ED6', desc: 'Knows some things about AI and has used AI tools', blurb: 'You know some AI basics and have tried a few tools. Time to strengthen that and get practical.' },
  intermediate: { label: 'Intermediate', emoji: '🟡', color: '#8A5A00', desc: 'Understands AI and uses it regularly', blurb: 'You understand AI and use it regularly. Let\'s sharpen your prompting and workflow skills.' },
  advanced:     { label: 'Advanced',     emoji: '🟠', color: '#E8590C', desc: 'Understands AI well and uses it for different tasks', blurb: 'You know AI well and use it for different tasks. Time for techniques and tools you may not know yet.' },
  expert:       { label: 'Expert',       emoji: '🔴', color: '#C92A2A', desc: 'Deep AI knowledge and understanding of advanced AI concepts', blurb: 'You have deep AI knowledge. Let\'s explore specialized and emerging AI topics.' }
};

// Score thresholds (0-100, weighted — see finishAssessment() in learning.js).
// Edit min/max here to rebalance level placement without touching any logic.
const LEVEL_THRESHOLDS = [
  { level: 'beginner',     min: 0,  max: 20 },
  { level: 'basic',        min: 21, max: 40 },
  { level: 'intermediate', min: 41, max: 60 },
  { level: 'advanced',     min: 61, max: 80 },
  { level: 'expert',       min: 81, max: 100 }
];

function levelFromScore(score){
  const hit = LEVEL_THRESHOLDS.find(t => score >= t.min && score <= t.max);
  return (hit || LEVEL_THRESHOLDS[0]).level;
}

// ---- Assessment ---------------------------------------------------------------
// A short, fixed 5-question knowledge + habit check — not adaptive, and never
// decided by a single question. Each question has a `weight` (how much it
// counts toward the final 0-100 score); the last question (what you can
// actually DO with AI) counts for the most, since demonstrated capability is
// a stronger signal than self-rating alone. Single-select questions carry a
// `points` value per option (0/25/50/75/100). The two multi-select questions
// carry richer option metadata used for scoring, "what you know", and
// knowledge-gap recommendations — see scoreAssessment() in learning.js.
const ASSESSMENT_QUESTIONS = [
  {
    id: 'self-level', weight: 0.15,
    prompt: 'How would you describe your current AI knowledge?',
    options: [
      { text: "Beginner — I'm new to AI.", points: 0 },
      { text: 'Basic — I know some things about AI and have used AI tools.', points: 25 },
      { text: 'Intermediate — I understand AI and use it regularly.', points: 50 },
      { text: 'Advanced — I understand AI well and know how to use it for different tasks.', points: 75 },
      { text: 'Expert — I have strong knowledge of AI and understand advanced AI concepts.', points: 100 }
    ]
  },
  {
    id: 'usage-frequency', weight: 0.15,
    prompt: 'How often do you use AI tools?',
    options: [
      { text: 'Never', points: 0 },
      { text: 'Rarely', points: 25 },
      { text: 'Sometimes', points: 50 },
      { text: 'Often', points: 75 },
      { text: 'Every day', points: 100 }
    ]
  },
  {
    id: 'tools-used', weight: 0.15, multi: true, kind: 'tools',
    prompt: 'Which AI tools have you used before?',
    helper: 'Select all that apply.',
    options: [
      { id: 'chatgpt', text: 'ChatGPT', isTool: true },
      { id: 'claude', text: 'Claude', isTool: true },
      { id: 'copilot', text: 'Microsoft Copilot', isTool: true },
      { id: 'gemini', text: 'Gemini', isTool: true },
      { id: 'all-tools', text: 'All of the above', isTool: false, selectAll: true },
      { id: 'other-tool', text: 'Other', isTool: true, requiresDetail: true },
      { id: 'none', text: 'None', isTool: false, exclusive: true }
    ]
  },
  {
    id: 'confidence', weight: 0.15,
    prompt: 'How confident are you when using AI?',
    options: [
      { text: 'Not confident', points: 0 },
      { text: 'Slightly confident', points: 25 },
      { text: 'Somewhat confident', points: 50 },
      { text: 'Very confident', points: 75 },
      { text: 'Extremely confident', points: 100 }
    ]
  },
  {
    id: 'capabilities', weight: 0.40, multi: true, kind: 'capabilities',
    prompt: 'What can you currently do with AI?',
    helper: 'Select all that apply.',
    // levelIndex (0=beginner..4=expert) drives both scoring and gap-finding;
    // gapCategory/gapLabel are used when this capability ISN'T selected, to
    // recommend a real Hub resource that fills that specific gap.
    options: [
      { id: 'ask-questions', text: 'Ask AI simple questions', levelIndex: 0, gapCategory: 'instructions', gapLabel: 'asking AI clear, useful questions' },
      { id: 'write-text', text: 'Write or improve text', levelIndex: 1, gapCategory: 'instructions', gapLabel: 'writing and improving text with AI' },
      { id: 'summarize-docs', text: 'Summarize documents', levelIndex: 1, gapCategory: 'instructions', gapLabel: 'summarizing documents with AI' },
      { id: 'analyze-info', text: 'Analyze information', levelIndex: 2, gapCategory: 'commands', gapLabel: 'analyzing information with AI' },
      { id: 'create-content', text: 'Create images or other content', levelIndex: 2, gapCategory: 'commands', gapLabel: 'creating images or content with AI' },
      { id: 'automate-tasks', text: 'Automate tasks', levelIndex: 3, gapCategory: 'mcps', gapLabel: 'automating tasks with AI' },
      { id: 'build-agents', text: 'Build AI workflows or agents', levelIndex: 4, gapCategory: 'agents', gapLabel: 'building AI workflows or agents' },
      { id: 'not-sure', text: "I'm not sure yet", levelIndex: -1, exclusive: true }
    ]
  }
];

// ---- Recommended Hub resources, by level ------------------------------------
// After the assessment (and on the dashboard), we point people at real
// Knowledge Hub entries — not just the built-in lessons — matched to their
// level. Beginners/Basic get simple, foundational formats (Instructions,
// Video); Intermediate adds Commands; Advanced/Expert skip basic content for
// the more technical categories they may not have explored yet (Assistants/
// agents, Connectors/MCPs, Plugins), plus Video since a good video can teach
// a new concept fast at any level. 'skills' is deliberately excluded — that
// category is admin-only and not meant for staff. Edit this list to change
// what gets recommended. Knowledge-gap recommendations (see learning.js)
// layer on top of this general pool, not instead of it.
const LEVEL_RECOMMENDED_CATEGORIES = {
  beginner: ['instructions', 'discoveries'],
  basic: ['instructions', 'discoveries', 'commands'],
  intermediate: ['instructions', 'discoveries', 'commands'],
  advanced: ['commands', 'agents', 'mcps', 'discoveries'],
  expert: ['agents', 'mcps', 'plugins', 'discoveries']
};
const RECOMMENDATIONS_COUNT = 4; // how many entries to show at once

// Maps each LIBRARY_DEPARTMENTS value (constants.js) to its matching "Other AI
// Tools" category — content already organized by department in that tab. Used
// to fold department-relevant tools into every level's recommendation pool,
// and to prioritize entries tagged with the learner's own department (see
// entryDepartments() in constants.js) ahead of generic ones — see
// getRecommendedEntries()/getGapEntries() in learning.js. Nothing is excluded
// on department grounds — this only re-orders/adds, so no one's assessment or
// learning path is narrowed by their role, only made more relevant to it.
const DEPARTMENT_OTHER_CATEGORY = {
  'HR': 'other-hr',
  'Marketing': 'other-marketing',
  'Sales': 'other-sales',
  'Business Support': 'other-business-support',
  'Fabrication': 'other-fabrication',
  'Finance': 'other-finance',
  'Installation Operation': 'other-installation',
  'Supply Chain': 'other-supply-chain',
  'Projects': 'other-projects',
  'Quarter Master': 'other-quartermaster'
};

// ---- Level-up practical challenges ------------------------------------------
// Before advancing past beginner/basic/intermediate/advanced, a learner must
// complete a practical challenge relevant to their department and submit
// evidence for admin review — see levelChallenges on progress (learning.js
// defaultProgress()) and bindOverviewLevelUp()/openChallenge() in learning.js.
// No entry beyond 'advanced' — there's no level past Expert to gate into.
// `guidance` is optional supporting text shown under the prompt.
const CHALLENGE_LIBRARY = {
  beginner: {
    'HR': { prompt: 'Use Claude or ChatGPT to draft a short, friendly message to a candidate or employee — for example a job description, an offer of an interview, or a policy reminder.', guidance: 'Upload a screenshot of the chat or the final message, or paste a link to it.' },
    'Marketing': { prompt: 'Use Claude or ChatGPT to write a social media caption or short piece of marketing copy, then improve it with one follow-up prompt.', guidance: 'Upload a screenshot showing the original and improved versions.' },
    'Sales': { prompt: 'Use Claude or ChatGPT to draft a follow-up message to a customer enquiry.', guidance: 'Upload a screenshot of the message, or the message itself.' },
    'Business Support': { prompt: 'Use Claude or ChatGPT to clean up or rewrite a short internal note or email so it reads more clearly.', guidance: 'Upload a screenshot showing the before and after.' },
    'Fabrication': { prompt: 'Use Claude or ChatGPT to turn a set of rough production notes into a clear, short instruction for the workshop floor.', guidance: 'Upload a screenshot of the note before and after.' },
    'Finance': { prompt: 'Use Claude or ChatGPT to summarise a short document (e.g. an invoice or statement) in plain language.', guidance: 'Upload a screenshot of the summary AI gave you.' },
    'Installation Operation': { prompt: 'Use Claude or ChatGPT to turn a short list of site notes into a clear checklist for an installation team.', guidance: 'Upload a screenshot of the checklist.' },
    'Supply Chain': { prompt: 'Use Claude or ChatGPT to draft a short message to a supplier chasing a delivery update.', guidance: 'Upload a screenshot of the message.' },
    'Projects': { prompt: 'Use Claude or ChatGPT to turn a few rough project notes into a short, clear update you could send to a manager.', guidance: 'Upload a screenshot of the update.' },
    'Quarter Master': { prompt: 'Use Claude or ChatGPT to turn a short stock or inventory note into a clear message for the team.', guidance: 'Upload a screenshot of the message.' }
  },
  basic: {
    'HR': { prompt: 'Use AI to summarise a sample document (e.g. a CV or policy) and explain how you checked the result was accurate.', guidance: 'Include what you checked and why.' },
    'Marketing': { prompt: 'Use AI to create a social media caption for a real or sample post, and explain what you changed from AI’s first draft and why.', guidance: 'Upload the before/after and your explanation.' },
    'Sales': { prompt: 'Use AI to research a customer or product topic, then summarise the 3 most useful points for your own use.', guidance: 'Upload the AI conversation or a summary.' },
    'Business Support': { prompt: 'Use AI to turn a messy set of notes into a clear, formatted document (e.g. an agenda or checklist).', guidance: 'Upload the before and after.' },
    'Fabrication': { prompt: 'Use AI to draft a short quality or safety checklist for a production task, then check it against how the task is actually done.', guidance: 'Explain any changes you made after checking.' },
    'Finance': { prompt: 'Use AI to help analyse a small set of numbers (e.g. spot a trend in a sample spreadsheet) and explain what you asked it to look for.', guidance: 'Upload a screenshot of the analysis.' },
    'Installation Operation': { prompt: 'Use AI to draft a short report of a completed or upcoming installation, based on your own notes.', guidance: 'Upload the report and explain what you gave AI to work from.' },
    'Supply Chain': { prompt: 'Use AI to compare two supplier options or delivery timelines based on information you provide, and explain the recommendation it gave.', guidance: 'Upload a screenshot of the comparison.' },
    'Projects': { prompt: 'Use AI to turn a set of project notes into a short status report with clear next steps.', guidance: 'Upload the report.' },
    'Quarter Master': { prompt: 'Use AI to help organise or summarise a stock list into a clearer format, and explain what you asked for.', guidance: 'Upload the before and after.' }
  },
  intermediate: {
    'HR': { prompt: 'Design a short, reusable AI prompt for a recurring HR task (e.g. drafting interview questions or onboarding messages), and show it working on a real example.', guidance: 'Explain why you structured the prompt the way you did.' },
    'Marketing': { prompt: 'Use AI to plan a small content workflow — e.g. one prompt that generates a caption, another that suggests an image idea — and show the result.', guidance: 'Explain how the two steps connect.' },
    'Sales': { prompt: 'Use AI to prepare talking points for an upcoming customer call or meeting, based on real context you provide.', guidance: 'Upload the talking points and explain the context you gave AI.' },
    'Business Support': { prompt: 'Use AI to build a small repeatable workflow for a task you do often (e.g. a template prompt for meeting notes or a weekly summary).', guidance: 'Show the prompt and one example result.' },
    'Fabrication': { prompt: 'Use AI to help troubleshoot or improve a production process by describing an issue and asking for possible causes or improvements.', guidance: 'Explain which suggestions were useful and why.' },
    'Finance': { prompt: 'Use AI to help draft a short financial summary or report from raw figures you provide, and explain how you verified the numbers.', guidance: 'Upload the report.' },
    'Installation Operation': { prompt: 'Use AI to design a short, reusable checklist template for a type of installation you do regularly, and show it applied to one job.', guidance: 'Explain what makes it reusable.' },
    'Supply Chain': { prompt: 'Use AI to build a simple reusable prompt for chasing suppliers or checking delivery status, and show it used on a real (or sample) case.', guidance: 'Explain what you’d reuse it for.' },
    'Projects': { prompt: 'Use AI to turn a project plan into a structured update covering progress, risks, and next steps.', guidance: 'Upload the update.' },
    'Quarter Master': { prompt: 'Use AI to design a simple, reusable way to check and report stock levels, and show it applied to a real or sample stock list.', guidance: 'Explain what you’d reuse it for.' }
  },
  advanced: {
    'HR': { prompt: 'Describe (or set up) a simple AI-assisted workflow for a recurring HR process (e.g. screening applications or drafting onboarding packs) — trigger, steps, and where a human still checks the result.', guidance: 'A written plan is fine if you haven’t built it yet — explain each step.' },
    'Marketing': { prompt: 'Design a small AI-assisted content workflow covering more than one step (e.g. idea → draft → review), and explain where a human still checks the output before it’s published.', guidance: 'A written plan or real example both count.' },
    'Sales': { prompt: 'Describe or set up a simple AI-assisted workflow for handling a type of customer enquiry — from first message to reply — and explain where a human reviews it.', guidance: 'Explain the trigger and the steps.' },
    'Business Support': { prompt: 'Design a small automation or workflow idea that uses AI for a repetitive business support task, including where a human check happens.', guidance: 'A written plan is fine — explain the steps.' },
    'Fabrication': { prompt: 'Describe a workflow where AI helps flag or explain a production issue, including what triggers it and what a person does with the result.', guidance: 'Explain the trigger, steps, and human check.' },
    'Finance': { prompt: 'Design a workflow where AI helps process or summarise recurring financial data (e.g. monthly reports), including where a human verifies the output.', guidance: 'A written plan or real example both count.' },
    'Installation Operation': { prompt: 'Describe a workflow where AI helps prepare or check installation documentation across multiple jobs, including where a person reviews it.', guidance: 'Explain the trigger, steps, and human check.' },
    'Supply Chain': { prompt: 'Design a workflow where AI helps track or flag supplier/delivery issues automatically, including where a person steps in.', guidance: 'A written plan or real example both count.' },
    'Projects': { prompt: 'Design a workflow where AI helps turn raw project updates into a consistent report across multiple projects, including where a person reviews it.', guidance: 'Explain the trigger, steps, and human check.' },
    'Quarter Master': { prompt: 'Design a workflow where AI helps monitor or flag stock levels needing attention, including where a person reviews the result.', guidance: 'A written plan or real example both count.' }
  }
};

// Looks up the challenge for a level + department. Returns null if the
// department isn't set yet, or isn't recognized — callers must handle this
// (e.g. prompt the learner to set their department first), never assume a result.
function challengeFor(levelKey, department){
  const row = CHALLENGE_LIBRARY[levelKey];
  return (row && department && row[department]) || null;
}

// ---- Learning paths (per level) --------------------------------------------
// Lesson ids must exist as keys in LESSON_LIBRARY below. Reorder, add, or
// remove lessons here to change a level's path — nothing else needs editing.
const LEARNING_PATHS = {
  beginner: ['what-is-ai', 'how-assistants-work', 'intro-chatgpt-claude', 'basic-prompt'],
  basic: ['ai-strengths-weaknesses', 'everyday-prompting', 'refining-ai-answers', 'ai-for-quick-tasks'],
  intermediate: ['prompt-structure', 'context-and-instructions', 'documents-intermediate', 'ai-for-productivity'],
  advanced: ['advanced-prompting', 'complex-workflows', 'ai-automation', 'ai-agents'],
  expert: ['apis-integrations', 'advanced-automation', 'ai-implementation', 'designing-ai-systems']
};

// ---- Lesson content ----------------------------------------------------------
// Structure per lesson: Learn -> Example -> Practice -> Quiz.
// `quiz` is a single scored check (array of options with one or more correct);
// keep it short — this is a comprehension check, not another assessment.
const LESSON_LIBRARY = {
  // ================= BEGINNER =================
  'what-is-ai': {
    title: 'What is AI?',
    whatYoullLearn: 'What an AI assistant actually does, and when it\'s a good fit for a task.',
    learn: [
      'AI (Artificial Intelligence) tools like Claude and ChatGPT are trained on huge amounts of text. Instead of looking up a fixed answer, they predict a helpful reply based on what you type — a bit like a fast, well-read colleague.',
      'Real-world example: a search engine points you to pages that already exist. An AI assistant writes something new for you, built from what you ask for.',
      'At work, this means AI can draft a reply, summarise a long email, or suggest ideas for a project name — as long as you explain clearly what you need.',
      'Common mistake: expecting AI to already know things about Oryx. It only knows what you type to it and what it learned during training — it can\'t see your inbox, your files, or company systems unless you paste the information in.'
    ],
    example: { label: 'Think of it like', good: 'A very fast, well-read assistant who has read millions of documents — but who still needs clear instructions from you to do the right task.' },
    keyTakeaways: [
      'AI predicts a helpful reply from what you type — it isn\'t searching the internet for an existing page.',
      'The clearer your request, the more useful the reply.',
      'AI has no automatic knowledge of Oryx or your work unless you share it.'
    ],
    practice: 'A colleague asks: "Can AI help me at all with my job?" Write a short reply explaining, in your own words, one real task AI could help with — and one thing it can\'t do without your help (like knowing private company details).',
    practiceExample: '"Yes — AI can help you draft messages, summarise long documents, or brainstorm ideas quickly. It won\'t automatically know things about Oryx or see your inbox, though — you\'d need to share the details it needs to work with."',
    quiz: {
      question: 'A colleague says: "I asked AI what our new delivery policy is, and it gave me a confident answer — so it must be right." What\'s the problem with this?',
      options: [
        { text: 'Nothing — AI always knows company policies', correct: false, feedback: 'AI has no automatic access to Oryx\'s policies — a confident-sounding answer isn\'t proof it saw the real policy.' },
        { text: 'AI has no automatic access to Oryx\'s policies, so it may have guessed a plausible-sounding answer', correct: true, feedback: 'Right — AI only knows what it\'s told or trained on, so a confident answer isn\'t proof it\'s accurate.' },
        { text: 'AI only answers questions about IT, not policy', correct: false, feedback: 'AI can be asked about any topic — the real issue is that it can\'t see Oryx\'s actual policy documents unless someone provides them.' },
        { text: 'The colleague should have asked in a ruder tone', correct: false, feedback: 'Tone doesn\'t affect accuracy — the real issue is that AI wasn\'t given Oryx\'s actual policy to work from.' }
      ]
    }
  },
  'how-assistants-work': {
    title: 'How AI assistants work',
    whatYoullLearn: 'How an AI assistant turns your instruction into an answer, and why checking matters.',
    learn: [
      'An AI assistant reads your message (called a "prompt"), then builds a reply word by word based on patterns it learned during training. It doesn\'t "know" facts the way a filing cabinet does — it generates the most likely helpful answer.',
      'Real-world example: ask it "How many public holidays does the UAE have in 2026?" and it will give a confident, specific-sounding list. That confidence doesn\'t guarantee accuracy.',
      'At work, this matters most for dates, numbers, and rules — the kind of details people rely on to make decisions.',
      'Common mistake: treating every AI answer as if it were a verified fact. Treat it as a first draft from a fast colleague, not a certified source.'
    ],
    example: { label: 'Good habit', good: 'Treat AI like a knowledgeable colleague drafting something for you — useful, fast, but worth a quick check before it goes out.' },
    keyTakeaways: [
      'AI generates a likely-sounding answer — it doesn\'t check a database of guaranteed facts.',
      'Confidence in the wording is not proof of accuracy.',
      'Always verify dates, numbers, and rules that matter before you rely on them.'
    ],
    practice: 'AI tells you: "Oryx\'s standard delivery time is 6 weeks." You don\'t actually know if that\'s correct. Write one sentence explaining what you\'d do next, before repeating that figure to a customer.',
    practiceExample: '"I\'d check this against the real delivery schedule or ask a colleague before quoting it to a customer — I wouldn\'t repeat an AI answer as fact without checking it first."',
    quiz: {
      question: 'You ask AI a factual question and it replies instantly and confidently. What does that confidence actually tell you?',
      options: [
        { text: 'The answer is definitely correct', correct: false, feedback: 'Confidence in the wording doesn\'t guarantee accuracy — AI can sound sure and still be wrong.' },
        { text: 'Nothing about accuracy — it just means AI generated a plausible-sounding reply', correct: true, feedback: 'Exactly — AI always replies in a confident, fluent way, whether or not the answer is accurate. Checking matters most for facts you\'ll rely on.' },
        { text: 'The answer must be false', correct: false, feedback: 'Confidence doesn\'t mean the answer is wrong either — it simply isn\'t a reliable signal of accuracy either way.' },
        { text: 'AI is guessing to entertain you', correct: false, feedback: 'AI isn\'t trying to entertain — it\'s generating the most likely helpful reply, but likely isn\'t the same as verified.' }
      ]
    }
  },
  'intro-chatgpt-claude': {
    title: 'Introduction to ChatGPT and Claude',
    whatYoullLearn: 'What ChatGPT and Claude are, and how trying more than one can help you.',
    learn: [
      'Claude and ChatGPT are both AI assistants you chat with in plain language. They can draft text, summarise documents, answer questions, and help with everyday tasks.',
      'Both work the same basic way: you write a prompt, they generate a reply, and you can keep the conversation going to refine it.',
      'Real-world example: you could ask either one "Summarise this email in two sentences" and get a similarly useful result — though the exact wording will differ.',
      'Common mistake: assuming the first reply is final. Both tools let you reply back and ask for changes — the conversation continues.'
    ],
    example: { label: 'Try this prompt', good: '"Summarise this email in two sentences."' },
    keyTakeaways: [
      'ChatGPT and Claude are both AI assistants you talk to in plain language.',
      'They work the same basic way: prompt in, reply out, and you can keep refining it.',
      'The first answer isn\'t final — you can always ask for changes.'
    ],
    practice: 'Here are rough meeting notes: "Team agreed to move launch to March. Sarah will update the client. Budget needs review by Friday. Ali to check supplier stock." Write a prompt asking AI to turn this into 3 clear action points.',
    practiceExample: '"Turn these meeting notes into 3 clear action points, with who\'s responsible for each: [paste notes]" — this tells AI exactly what format you want and what to include.',
    quiz: {
      question: 'You ask an AI assistant for a summary and the first reply is too long. What\'s the best next step?',
      options: [
        { text: 'Start a completely new conversation from scratch', correct: false, feedback: 'You don\'t need to start over — the current conversation already has the context, so refining it is faster.' },
        { text: 'Reply and ask for a shorter version', correct: true, feedback: 'Right — you can keep the conversation going and ask it to adjust length, tone, or detail without losing the context you\'ve already given it.' },
        { text: 'Accept the long reply and just skim it', correct: false, feedback: 'This wastes the chance to get exactly what you need — asking for a shorter version takes seconds.' },
        { text: 'Assume AI can\'t do summaries', correct: false, feedback: 'AI is well suited to summarising — the first attempt just needed refining, which is normal.' }
      ]
    }
  },
  'basic-prompt': {
    title: 'How to write a basic prompt',
    whatYoullLearn: 'What makes a prompt clear enough to get a genuinely useful reply.',
    learn: [
      'A good prompt is specific: say what you want, who it\'s for, and the tone. Vague prompts get vague answers.',
      'Real-world example: "Write an email" could mean almost anything. "Write a short, professional email to a customer explaining their order will be delayed by two days" tells AI exactly what to produce.',
      'At work, the fastest way to get a useless reply is to type the bare minimum and hope AI guesses the rest.',
      'Common mistake: writing a prompt so short that AI has to fill in every gap itself — often guessing wrong about tone, length, or audience.'
    ],
    example: { label: 'Bad vs. better', bad: '"Write an email."', good: '"Write a short, professional email to a customer explaining their order will be delayed by two days."' },
    keyTakeaways: [
      'Specific prompts (task + audience + tone) get specific, useful replies.',
      'Vague prompts force AI to guess — and it often guesses wrong.',
      'A few extra words of detail save several rounds of back-and-forth.'
    ],
    practice: 'Improve this weak prompt: "Write something for the team." Rewrite it so it says the task, who it\'s for, and the tone you want.',
    practiceExample: '"Write a short, upbeat message to the team announcing that Friday\'s target was hit — keep it under 3 sentences."',
    quiz: {
      question: 'Which of these prompts is most likely to get a genuinely useful reply?',
      options: [
        { text: '"Write something."', correct: false, feedback: 'This gives AI no task, no audience, and no tone — it has to guess everything.' },
        { text: '"Email."', correct: false, feedback: 'A single word gives AI nothing to work with beyond guessing the entire task.' },
        { text: '"Write a short, friendly thank-you email to a customer who just placed their first order."', correct: true, feedback: 'This says the task (thank-you email), the tone (friendly), the length (short), and who it\'s for — everything AI needs.' },
        { text: '"Do the email thing we discussed."', correct: false, feedback: 'AI has no memory of a conversation you haven\'t shown it — this assumes context it doesn\'t have.' }
      ]
    }
  },
  'ai-strengths-weaknesses': {
    title: "What AI Is Good At (and Not)",
    whatYoullLearn: 'Which tasks AI is naturally strong at, and which ones still need a person.',
    learn: [
      'AI is great at drafting, summarising, brainstorming, and answering general questions. It\'s weaker at precise maths, today\'s exact news, or live company data it isn\'t connected to.',
      'Real-world example: asking AI to draft a first version of a customer email is a strong fit. Asking it for today\'s exact live stock count in a system it can\'t see is a weak fit — it has no way to check that.',
      'At work, the safest approach is: use AI for the first draft or the thinking, then have a person check anything that must be exactly right.',
      'Common mistake: asking AI to make a final decision on something with real consequences (like approving a refund) without a person checking it first.'
    ],
    example: { label: 'Good fit vs. weak fit', good: 'Drafting a first version of an email is a good fit.', bad: 'Asking for exact live stock levels it has no access to is a weak fit.' },
    keyTakeaways: [
      'AI is strong at drafting, summarising, brainstorming, and general questions.',
      'AI is weak at exact live data, precise maths, and anything it has no access to.',
      'Use AI for the first draft; keep a person in charge of the final, important check.'
    ],
    practice: 'For each task below, decide: good fit for AI, or needs a person to check/decide? 1) Drafting a first reply to a customer complaint. 2) Approving a refund over AED 5,000. 3) Brainstorming three subject lines for an email. Write your answer for each.',
    practiceExample: '1) Good fit — AI can draft it fast, you review before sending. 2) Needs a person — this has real financial consequences and needs judgement + authority AI doesn\'t have. 3) Good fit — brainstorming ideas is exactly where AI is strong.',
    quiz: {
      question: 'Your manager asks AI to confirm today\'s exact warehouse stock count for a part, and AI gives a specific number. What should you do?',
      options: [
        { text: 'Trust the number completely — AI wouldn\'t make it up', correct: false, feedback: 'AI has no live connection to your warehouse system, so a specific-sounding number here is a weak fit, not a verified fact.' },
        { text: 'Check the number against the real stock system before relying on it', correct: true, feedback: 'Right — live, exact data like current stock levels is exactly the kind of thing AI can\'t see, so it needs to be verified at the source.' },
        { text: 'Ignore AI completely for every task', correct: false, feedback: 'That overcorrects — AI is still useful for drafting and brainstorming, just not for live data it has no access to.' },
        { text: 'Ask AI the same question again to double-check', correct: false, feedback: 'Asking again won\'t fix the problem — AI still has no access to the real system, so it may just repeat or vary its guess.' }
      ]
    }
  },
  'everyday-prompting': {
    title: 'Everyday Prompting Habits',
    whatYoullLearn: 'Three small habits that make everyday prompts noticeably more useful.',
    learn: [
      'A few small habits make prompts far more useful day to day: say the goal first, mention who it\'s for, and ask for a specific format — bullets, a table, or a short paragraph.',
      'Real-world example: "Turn these notes into 3 bullet points for my manager" gives the goal, the format, and the audience — all in one line.',
      'At work, this habit takes seconds to build into a prompt and saves a full round of back-and-forth.',
      'Common mistake: describing the topic but never saying what format you want the answer in — leaving AI to guess between a paragraph, a list, or a table.'
    ],
    example: { label: 'Everyday prompt', good: '"Turn these notes into 3 bullet points for my manager."' },
    keyTakeaways: [
      'Say the goal, the audience, and the format you want, ideally in one line.',
      'Format matters — a list, table, or short paragraph all read very differently.',
      'This habit takes seconds but avoids a full round of back-and-forth.'
    ],
    practice: 'You have these notes: "client called, wants price match on order 4521, said competitor quoted 10% less, needs answer by Thursday." Write a prompt asking AI to turn this into a short internal message for your manager, in a specific format.',
    practiceExample: '"Turn these notes into a 3-line internal update for my manager, ending with what decision is needed by Thursday: [paste notes]"',
    quiz: {
      question: 'You ask AI: "Tell me about the client call notes." The reply is a long, unfocused paragraph. What\'s the most likely cause?',
      options: [
        { text: 'AI can\'t handle notes at all', correct: false, feedback: 'AI handles notes well — the issue here is the prompt, not the tool.' },
        { text: 'The prompt didn\'t say who the reply is for or what format to use', correct: true, feedback: 'Exactly — without an audience or format, AI has to guess, and a long unfocused paragraph is a common result.' },
        { text: 'The notes were too short', correct: false, feedback: 'Short notes aren\'t the problem — even short notes can be turned into a clear format if the prompt asks for one.' },
        { text: 'AI only works well with typed, not handwritten notes', correct: false, feedback: 'This isn\'t about handwriting — the notes were already typed. It\'s about what the prompt asked AI to do with them.' }
      ]
    }
  },
  'refining-ai-answers': {
    title: 'Refining AI Answers',
    whatYoullLearn: 'How to improve an AI answer with a quick, specific follow-up instead of starting over.',
    learn: [
      'Your first reply from AI doesn\'t have to be your last. If it\'s too long, too formal, missing something, or off-target, just say so in plain words and ask it to adjust.',
      'Real-world example: "Shorter please, and make it sound friendlier" takes an over-formal draft and fixes it in one line — no need to explain the whole task again.',
      'At work, refining is often faster than writing a long, perfect prompt from the start — get a rough first draft, then shape it.',
      'Common mistake: giving up on AI after one unhelpful reply, instead of just telling it what to change.'
    ],
    example: { label: 'Refining', good: '"Shorter please, and make it sound friendlier."' },
    keyTakeaways: [
      'The first reply is a starting point, not the final answer.',
      'One specific instruction (shorter, friendlier, add X) is usually enough to fix a reply.',
      'Refining is often faster than writing one long, perfect prompt.'
    ],
    practice: 'AI gave you this reply to "write a reply to this complaint": a long, very formal paragraph. Write the one-line follow-up you\'d send to make it shorter and warmer.',
    practiceExample: '"Make this shorter — under 4 sentences — and warmer in tone, like you\'re genuinely sorry for the trouble."',
    quiz: {
      question: 'An AI reply is accurate but far too formal for a quick message to a colleague. What\'s the best next step?',
      options: [
        { text: 'Send it as-is since it\'s accurate', correct: false, feedback: 'Accuracy isn\'t the only thing that matters — tone fitting the audience matters too, and this is an easy fix.' },
        { text: 'Start a brand new prompt explaining the whole task again', correct: false, feedback: 'That\'s more work than needed — the conversation already has the context, so a short follow-up is faster.' },
        { text: 'Ask AI to make it sound more casual, in one short follow-up', correct: true, feedback: 'Right — a quick, specific follow-up like "make this more casual" fixes the tone without losing the useful content already there.' },
        { text: 'Rewrite it completely yourself instead of using AI', correct: false, feedback: 'That throws away a useful starting draft — refining it is quicker than starting from a blank page.' }
      ]
    }
  },
  'ai-for-quick-tasks': {
    title: 'AI for Quick, Everyday Tasks',
    whatYoullLearn: 'How to spot a genuinely safe, quick win for AI in your day.',
    learn: [
      'AI can save time on small, common tasks: drafting a message, making a list, cleaning up notes, or suggesting ideas.',
      'Real-world example: turning short, messy meeting notes into a clear task list takes AI seconds and saves you the effort of organising it yourself.',
      'At work, always check the result before you rely on it, and never share private customer or financial information unless your company says it\'s approved.',
      'Common mistake: pasting sensitive information (like a customer\'s private details) into AI for a "quick" task without checking whether that\'s allowed.'
    ],
    example: { label: 'Quick win', good: '"Clean up this message and make the tone more polite."' },
    keyTakeaways: [
      'Small, everyday tasks — lists, tone checks, tidy-ups — are a great fit for AI.',
      'Always check the result before using it, even for quick tasks.',
      'Never paste private customer or financial details into AI unless it\'s approved.'
    ],
    practice: 'Pick one of these two quick tasks and write the prompt you\'d use: (a) turning a messy note into a clean message, or (b) checking the tone of a message before sending it.',
    practiceExample: '"Clean up this message and make the tone more polite, keeping the same meaning: \'need this asap cant wait any longer\'"',
    quiz: {
      question: 'A colleague wants a fast AI "quick win" and considers pasting a customer\'s full bank details into AI so it can draft a refund confirmation email. What should they do instead?',
      options: [
        { text: 'Paste it anyway — it\'s just for a draft', correct: false, feedback: 'Private financial details shouldn\'t be pasted into AI tools unless your company has approved that specific use — "just a draft" doesn\'t remove the risk.' },
        { text: 'Draft the email without including the sensitive details, and add them separately afterwards', correct: true, feedback: 'Right — AI can still help with the wording of the email without ever needing to see the customer\'s private financial details.' },
        { text: 'Don\'t use AI for anything related to customers', correct: false, feedback: 'This overcorrects — plenty of customer-related drafting is fine, the issue is specifically sharing private financial details.' },
        { text: 'Ask AI if it\'s safe to share the details first', correct: false, feedback: 'AI can\'t verify your company\'s own data rules — that\'s a question for your own policy, not something to ask the AI tool itself.' }
      ]
    }
  },
  'prompt-structure': {
    title: 'Prompt Structure',
    whatYoullLearn: 'How to build a prompt from four clear parts so AI has everything it needs in one go.',
    learn: [
      'A strong prompt has clear parts: the task, the background/context, any rules to follow, and the form you want the answer in.',
      'Real-world example: "Write a reply to this customer. Be warm. Use fewer than 80 words. End with the next step." gives all four parts in two short sentences.',
      'At work, this structure matters most for anything you\'ll send externally or rely on for a decision — it removes guesswork.',
      'Common mistake: giving AI the task but leaving out the rules (like a word limit or a required ending) — then being surprised the reply doesn\'t fit.'
    ],
    example: { label: 'Strong structure', good: '"Write a reply to this customer. Be warm. Use fewer than 80 words. End with the next step."' },
    keyTakeaways: [
      'Four parts make a prompt strong: task, background, rules, answer format.',
      'Missing rules (length, tone, required ending) is the most common reason a reply doesn\'t fit.',
      'This structure takes one extra sentence but saves a round of edits.'
    ],
    practiceChecklist: ['Task — what do you want AI to produce?', 'Background — what does it need to know?', 'Rules — any limits (length, tone, must-includes)?', 'Answer format — list, email, table, short paragraph?'],
    practice: 'Build a full four-part prompt for this situation: a customer\'s order is delayed by 3 days and you need to tell them. Cover task, background, rules, and format.',
    practiceExample: '"Write a reply to a customer whose order (#4521) is delayed by 3 days due to a supplier issue. Be apologetic but confident. Keep it under 100 words. End with the new expected delivery date."',
    quiz: {
      question: 'Which of these prompts has the strongest structure?',
      options: [
        { text: '"Write a short customer reply using these notes. Be warm and end with the next step."', correct: true, feedback: 'This gives a task (customer reply), a background source (the notes), a rule (be warm), and a required ending — all four parts.' },
        { text: '"Reply."', correct: false, feedback: 'This has a task word but no background, rules, or format — AI has to guess everything else.' },
        { text: '"Make this good."', correct: false, feedback: '"Good" isn\'t a rule AI can act on — it needs something specific like tone, length, or must-include content.' },
        { text: '"Customer email please."', correct: false, feedback: 'This names a topic but gives no background, rules, or format — far too little for a strong reply.' }
      ]
    }
  },
  'context-and-instructions': {
    title: 'Context and Instructions',
    whatYoullLearn: 'The difference between context and instructions, and why both improve AI\'s answer.',
    learn: [
      'Context means useful background information — who the reader is, what already happened, what matters here. Instructions tell AI what to do and what rules to follow.',
      'Real-world example: "Write a reply" with no context forces AI to guess the situation. Adding "the customer is frustrated about a second delay" changes the tone AI should use.',
      'At work, only give information that\'s actually needed and safe to share — more isn\'t always better if it includes something private or irrelevant.',
      'Common mistake: giving instructions without context (AI knows what to do but not the real situation), or context without instructions (AI knows the situation but not what you want from it).'
    ],
    example: { label: 'Context + instruction', good: '"The customer is frustrated about a second delay (context). Write a calming, apologetic reply that offers a small goodwill gesture (instruction)."' },
    keyTakeaways: [
      'Context = the background AI needs. Instructions = what you want it to do with it.',
      'Missing context makes replies generic; missing instructions makes them unfocused.',
      'Only share context that\'s needed and safe to share — skip anything private or irrelevant.'
    ],
    practice: 'Add useful context to this bare prompt: "Write a reply." Say who the reader is, what happened, and what the reply needs to achieve — without including anything private that isn\'t needed.',
    practiceExample: '"A long-standing customer\'s delivery is late for the first time in two years. Write a reply that acknowledges this is unusual for us, apologises, and confirms the new delivery date."',
    quiz: {
      question: 'A colleague asks AI to "write a firm reminder email" with no other information. What is this prompt missing?',
      options: [
        { text: 'Nothing — the instruction is already clear enough', correct: false, feedback: 'The instruction (write a firm reminder) is clear, but there\'s no context — who is this to, and reminding them of what?' },
        { text: 'Context about who the email is for and what they\'re being reminded about', correct: true, feedback: 'Right — without context, AI has to invent a scenario, which likely won\'t match the real situation.' },
        { text: 'A funnier tone', correct: false, feedback: 'Tone isn\'t the issue here — the missing piece is the background information, not humour.' },
        { text: 'A longer word count', correct: false, feedback: 'Length isn\'t the problem — even a short reminder needs to know who it\'s for and what it\'s about.' }
      ]
    }
  },
  'documents-intermediate': {
    title: 'Working with Documents',
    whatYoullLearn: 'How to get reliable results from AI when working with a real document.',
    learn: [
      'AI can help you work with a document you provide: summarising it, finding key points, comparing sections, or turning information into a list.',
      'Real-world example: tell AI which document to use and what to look for — "using this contract, list all the payment deadlines" — rather than a vague "what does this say?"',
      'At work, always check the answer against the actual document, especially for dates, numbers, and rules — these are the details most likely to matter and easiest to get subtly wrong.',
      'Common mistake: accepting a document summary without opening the source to check the key details it mentions.'
    ],
    example: { label: 'Try this', good: '"Using this document, list the three main points and flag any dates or numbers mentioned."' },
    keyTakeaways: [
      'Give AI a clear task and the actual document — don\'t ask it to guess contents it hasn\'t seen.',
      'Always check dates, numbers, and rules against the real document.',
      'A clear task plus a check against the source makes the result far more reliable.'
    ],
    practice: 'You have a supplier contract to review. Write a prompt asking AI to pull out the three most important points, plus any dates or numbers you should double-check yourself.',
    practiceExample: '"Using this contract, list the 3 most important points for our team, and separately flag every date or amount so I can check them myself."',
    quiz: {
      question: 'AI summarises a contract and states a payment deadline of "30 days". What should you do before treating this as fact?',
      options: [
        { text: 'Repeat the figure immediately in your own report', correct: false, feedback: 'Numbers pulled from a document by AI can be misread or misplaced — this should be checked before it\'s repeated as fact.' },
        { text: 'Open the actual contract and confirm the 30-day figure yourself', correct: true, feedback: 'Right — dates and numbers are exactly the details worth checking against the source document before you rely on them.' },
        { text: 'Ask a different AI tool the same question', correct: false, feedback: 'A second AI tool has the same limitation — neither has guaranteed accuracy on a specific figure unless you check the actual document.' },
        { text: 'Ignore the summary completely and never use AI for documents', correct: false, feedback: 'This overcorrects — AI summaries are still useful for finding key points quickly; you just verify the details that matter.' }
      ]
    }
  },
  'ai-for-productivity': {
    title: 'AI for Productivity',
    whatYoullLearn: 'How to use AI to genuinely save time, not just add another step.',
    learn: [
      'Productivity means getting useful work done well and on time. AI can help with repeat tasks, first drafts, meeting notes, and planning.',
      'Real-world example: turning a messy set of project notes into a clear status update is a repeat task AI can draft in seconds, leaving you to check and finish it.',
      'At work, choose tasks that take real time but still let you check the result — that\'s where AI adds the most value with the least risk.',
      'Common mistake: using AI for every task regardless of whether it actually saves time, or skipping your own check to save a few more seconds.'
    ],
    example: { label: 'Good habit', good: 'Use AI for a first draft, then check and finish it yourself.' },
    keyTakeaways: [
      'AI helps most with repeat tasks, first drafts, and planning.',
      'Pick tasks where a person can still check the result — that\'s the safest productivity gain.',
      'A good AI habit should make work clearer, not just faster.'
    ],
    practice: 'Pick one repeat task you do most weeks. Write down: the old way you do it, where AI could help, and what you\'d still check yourself before it\'s done.',
    practiceExample: 'Old way: manually writing a weekly status update from scattered notes. AI could help: draft the update from my notes in seconds. I\'d still check: that figures and names are correct before sending.',
    quiz: {
      question: 'Which use of AI is most likely to improve productivity safely?',
      options: [
        { text: 'Letting AI approve spending requests on its own', correct: false, feedback: 'Approving spending has real consequences and needs a person\'s judgement and authority — this isn\'t a safe use of AI.' },
        { text: 'Using AI for a first draft, then checking and finishing it yourself', correct: true, feedback: 'Right — this captures the time saving of a fast first draft while keeping a person in control of the final, accurate result.' },
        { text: 'Using AI for every task, even ones that already take less time to do yourself', correct: false, feedback: 'This doesn\'t add real productivity — using AI where it doesn\'t save time just adds an extra step.' },
        { text: 'Skipping checks to finish tasks faster', correct: false, feedback: 'Skipping checks trades speed for accuracy — not a safe way to gain productivity.' }
      ]
    }
  },
  'advanced-prompting': {
    title: 'Advanced Prompting',
    whatYoullLearn: 'How to write a prompt that reliably handles a bigger, more complex task.',
    learn: [
      'Advanced prompting helps AI handle a bigger task reliably. Give it a clear role, goal, steps, rules, examples, and the exact form you need.',
      'Real-world example: ask AI to flag any missing information before it starts, rather than letting it quietly guess gaps — this surfaces problems early instead of hiding them in the output.',
      'At work, test an advanced prompt with more than one example situation, and refine it if the output isn\'t consistent.',
      'Common mistake: writing one long, complicated instruction and assuming it will work perfectly first time — advanced prompts usually need at least one round of testing and adjustment.'
    ],
    example: { label: 'Advanced structure', good: 'Role + goal + steps + rules + examples + required format, plus an instruction to flag anything missing before answering.' },
    keyTakeaways: [
      'Advanced prompts combine role, goal, steps, rules, examples, and format.',
      'Ask AI to flag missing information rather than guess it silently.',
      'Test with more than one example and refine — don\'t expect it perfect first time.'
    ],
    practice: 'Write a prompt for AI to act as a first-line customer support assistant: it should check what information is missing from an enquiry, follow a rule that it never promises a refund, and return its answer as a short table (issue / missing info / suggested reply).',
    practiceExample: '"You are a first-line support assistant. For this enquiry, list: the issue, any missing information needed to resolve it, and a suggested reply. Never promise a refund — flag that as needing manager approval instead. Return this as a table with those 3 columns."',
    quiz: {
      question: 'You\'ve written a long, detailed advanced prompt and it works well on your first test case. What should you do next?',
      options: [
        { text: 'Assume it\'s finished, since it worked once', correct: false, feedback: 'One successful test doesn\'t confirm reliability — different real situations can expose gaps the first test case didn\'t.' },
        { text: 'Test it against a few different, realistic examples before relying on it', correct: true, feedback: 'Right — advanced prompts need testing across multiple situations to catch cases where the instructions don\'t hold up.' },
        { text: 'Make the prompt even longer to be safe', correct: false, feedback: 'Length alone doesn\'t improve reliability — testing against real examples is what actually reveals problems.' },
        { text: 'Remove the rules so it answers faster', correct: false, feedback: 'Removing rules increases risk rather than reducing it — the rules are what keep the output safe and consistent.' }
      ]
    }
  },
  'complex-workflows': {
    title: 'Complex AI Workflows',
    whatYoullLearn: 'How to break a large task into smaller steps AI can help with safely.',
    learn: [
      'A workflow is a set of steps used to finish a task. A complex AI workflow breaks a large task into smaller steps — for example: collect information, check it, draft an answer, review it, approve it.',
      'Real-world example: a customer-reply process might be: read the enquiry, check the order system, draft a reply, and have a person approve it before it\'s sent.',
      'At work, each step should have a clear input, a clear output, and a clear owner — a person or AI responsible for that step.',
      'Common mistake: combining everything into one giant step, making it hard to tell where a mistake happened or who\'s responsible for catching it.'
    ],
    example: { label: 'Why break it up', good: 'Small steps make the work easier to understand, test, and check — each one has a clear input, output, and owner.' },
    keyTakeaways: [
      'A workflow breaks a big task into smaller, clearly owned steps.',
      'Each step needs a clear input, output, and owner (person or AI).',
      'Smaller steps are easier to test, check, and fix when something goes wrong.'
    ],
    practice: 'Break a customer-reply process into 4 clear steps. For each step, note whether AI or a person owns it.',
    practiceExample: '1) Read enquiry — AI drafts a summary. 2) Check order details — person confirms. 3) Draft reply — AI. 4) Approve and send — person.',
    quiz: {
      question: 'Why is it usually better to break a large AI-assisted task into smaller steps, rather than one big step?',
      options: [
        { text: 'To make the overall work take longer', correct: false, feedback: 'Smaller steps aren\'t about adding time — they usually make problems easier and faster to catch.' },
        { text: 'To make each part easier to guide, check, and fix if something goes wrong', correct: true, feedback: 'Right — smaller steps mean it\'s clear who owns each part and where to look if something goes wrong.' },
        { text: 'To remove the need for anyone to check the work', correct: false, feedback: 'Breaking a task into steps doesn\'t remove the need to check — it actually makes checking easier and more targeted.' },
        { text: 'To hide which step caused a mistake', correct: false, feedback: 'The opposite is true — smaller, clearly owned steps make it easier to trace exactly where a mistake happened.' }
      ]
    }
  },
  'ai-automation': {
    title: 'AI Automation',
    whatYoullLearn: 'What makes an AI-assisted automation safe rather than risky.',
    learn: [
      'Automation means a system does a repeat task automatically when something happens. AI automation adds AI to read, write, sort, or decide between simple choices within that process.',
      'Real-world example: a new customer enquiry could automatically start a draft reply for a person to review, rather than requiring someone to start from a blank page.',
      'At work, any automation with real consequences needs limits, checks, and a clear way to pause or stop it if something looks wrong.',
      'Common mistake: setting up an automation to take an important action (like sending a refund) with no human check and no way to stop it mid-process.'
    ],
    example: { label: 'Safe automation', good: 'A new enquiry starts a draft reply automatically — but a person reviews and approves it before it\'s sent.' },
    keyTakeaways: [
      'Automation runs a repeat task when a trigger happens; AI can help with the reading/writing/sorting inside it.',
      'Important actions need a human check before anything with real consequences happens.',
      'Every automation needs a clear way to pause or stop it.'
    ],
    practice: 'Design a simple automation idea for one repeat task in your role. Name: the trigger (what starts it), what AI does, and the point where a person checks it before anything important happens.',
    practiceExample: 'Trigger: new supplier invoice arrives. AI does: drafts a summary and flags any mismatched amounts. Person checks: confirms the summary and approves payment — AI never approves payment itself.',
    quiz: {
      question: 'A team wants to automate replies to customer complaints, with AI sending the reply immediately with no review. What\'s the main risk?',
      options: [
        { text: 'It will be too slow', correct: false, feedback: 'Speed isn\'t the concern here — sending immediately is actually the fast option, which is the problem, not the fix.' },
        { text: 'An inaccurate or poorly-toned reply could be sent to a real customer with no chance to catch it first', correct: true, feedback: 'Right — high-impact actions like replying to complaints need a human check before anything goes out, so mistakes can be caught.' },
        { text: 'AI can\'t draft complaint replies at all', correct: false, feedback: 'AI can draft this kind of reply well — the issue is sending it automatically without anyone reviewing it first.' },
        { text: 'It will use too much electricity', correct: false, feedback: 'This isn\'t the relevant risk here — the real concern is sending an unchecked reply to a real customer.' }
      ]
    }
  },
  'ai-agents': {
    title: 'AI Agents',
    whatYoullLearn: 'What an AI agent is, and what it needs to work safely.',
    learn: [
      'An AI agent is a system that can plan steps and use tools to reach a goal — for example, searching approved information, updating a system, or preparing a draft on its own.',
      'Real-world example: an agent handling new enquiries might read the message, check an approved knowledge base, and prepare a draft reply — all without a person doing each step manually.',
      'At work, an agent needs a clear goal, safe tools, limits on what it can do, and human oversight — someone who watches, checks, or approves its work.',
      'Common mistake: giving an agent access to more tools or actions than the task actually needs, or removing human oversight to make it "fully automatic".'
    ],
    example: { label: 'Safe agent design', good: 'A clear goal, safe tools, limits on what it can do, and a person who checks or approves its actions.' },
    keyTakeaways: [
      'An agent plans steps and uses tools to reach a goal, rather than just replying once.',
      'It needs a clear goal, safe tools, and limits on what it\'s allowed to do.',
      'Human oversight — someone checking or approving — is essential, not optional.'
    ],
    practice: 'Design an agent that helps with new customer enquiries. List: one tool it may use, one limit on what it can do, and one action a person must approve before it happens.',
    practiceExample: 'Tool: search the approved product knowledge base. Limit: it can only draft replies, never send them. Person approves: sending the final reply to the customer.',
    quiz: {
      question: 'A team is designing an AI agent to handle supplier orders and wants it to be "fully automatic" with no human involved at any point. What\'s the concern?',
      options: [
        { text: 'Agents can\'t handle orders at all', correct: false, feedback: 'Agents can be well suited to this kind of task — the concern is specifically the lack of any human oversight.' },
        { text: 'Removing all human oversight removes the ability to catch mistakes before they affect a real order', correct: true, feedback: 'Right — even a well-designed agent needs a person watching, checking, or approving important actions, especially ones with real business consequences.' },
        { text: 'It will make the agent too slow', correct: false, feedback: 'Oversight doesn\'t have to be slow — a quick approval step is the point, not a speed problem.' },
        { text: 'Agents are not allowed to use any tools', correct: false, feedback: 'Agents are meant to use tools to reach a goal — the issue here is oversight, not tool use.' }
      ]
    }
  },
  'apis-integrations': {
    title: 'APIs and Integrations',
    whatYoullLearn: 'What an API does in an AI solution, and why access should be limited.',
    learn: [
      'An API is a safe way for two computer systems to talk to each other. An integration is the link between systems that uses this.',
      'Real-world example: an approved integration might let AI read a customer record or create a draft task — without needing a person to manually copy information between systems.',
      'At work, the link should only give AI the specific information and actions it actually needs — never full, unrestricted access "just in case".',
      'Common mistake: connecting AI to a system with broader access than the task requires, increasing the impact if something goes wrong.'
    ],
    example: { label: 'Scoped access', good: 'An integration that lets AI read only the customer fields it needs, and create draft tasks — not full account or payment access.' },
    keyTakeaways: [
      'An API lets approved systems share specific information or actions.',
      'Integrations should be scoped to only what\'s needed, not full access by default.',
      'Broader access than necessary increases the impact of any mistake or misuse.'
    ],
    practice: 'Choose two Oryx systems that could usefully share information (e.g. CRM and a scheduling tool). State exactly what data should be allowed to move, and what must stay out of that link.',
    practiceExample: 'CRM to scheduling tool: share customer name, order reference, and requested installation date. Keep out: payment details and internal notes — not needed for scheduling.',
    quiz: {
      question: 'A supplier asks to connect their system directly to Oryx\'s full customer database "to make things easier", instead of a specific integration for order status only. What\'s the concern?',
      options: [
        { text: 'Full access is always more convenient, so this is fine', correct: false, feedback: 'Convenience doesn\'t outweigh the risk — broader access than needed increases what could go wrong if something is misused or breached.' },
        { text: 'The integration should be scoped to only what\'s needed (e.g. order status), not full database access', correct: true, feedback: 'Right — a good integration gives only the specific information or actions required for the task, limiting the impact of any problem.' },
        { text: 'APIs can only share one piece of data at a time', correct: false, feedback: 'This isn\'t a technical limit of APIs — the real issue is that access should be deliberately scoped to what\'s needed, whatever that includes.' },
        { text: 'Suppliers should never be given any system access', correct: false, feedback: 'Scoped, appropriate access for a real business need is fine — the issue is the scope being too broad, not that access exists at all.' }
      ]
    }
  },
  'advanced-automation': {
    title: 'Advanced Automation',
    whatYoullLearn: 'What makes an advanced, multi-step automation safe and resilient.',
    learn: [
      'Simple automation may do one task. Advanced automation joins many tasks together, using triggers, choices, checks, approvals, and error steps.',
      'Real-world example: an enquiry arrives, AI reads it, a customer record is checked, a reply is drafted, and a person approves it before it sends — several linked steps, not one.',
      'At work, the process must also know what to do when information is missing or something goes wrong — not just the "everything works" path.',
      'Common mistake: designing only for the successful path and leaving no defined behaviour for errors or missing information.'
    ],
    example: { label: 'Complete design', good: 'Enquiry arrives → AI drafts reply → record checked → person approves → sent. Plus: a defined error step if information is missing.' },
    keyTakeaways: [
      'Advanced automation links multiple steps: triggers, checks, approvals, error handling.',
      'A good design plans for what goes wrong, not just what goes right.',
      'Checks catch problems before an important action is taken.'
    ],
    practice: 'Take this process: enquiry arrives → AI drafts a reply → email is sent. Add one safety check and one error step (what happens if key information is missing).',
    practiceExample: 'Safety check: a person reviews the draft before it sends. Error step: if the customer\'s order number is missing from the enquiry, AI flags it for a person instead of guessing.',
    quiz: {
      question: 'An automation is designed for the normal, successful path only — arrival, draft, send — with nothing defined for when information is missing. What\'s the risk?',
      options: [
        { text: 'The automation will simply run slower', correct: false, feedback: 'Speed isn\'t the issue — the real risk is what happens when the unplanned case (missing information) actually occurs.' },
        { text: 'When information is missing, the system has no defined safe behaviour and may send an incorrect or incomplete result', correct: true, feedback: 'Right — advanced automations need a defined error path, not just a plan for when everything goes smoothly.' },
        { text: 'AI cannot be used in automations at all', correct: false, feedback: 'AI is well suited to automations — the issue is the design missing an error path, not AI\'s suitability.' },
        { text: 'The automation will stop working entirely', correct: false, feedback: 'The bigger risk usually isn\'t a stoppage — it\'s the system pushing ahead with an incorrect or incomplete result when something doesn\'t fit the expected path.' }
      ]
    }
  },
  'ai-implementation': {
    title: 'AI Implementation for Business',
    whatYoullLearn: 'Where to start when planning a real business AI solution.',
    learn: [
      'Implementation means putting an idea into real use. Start with the business problem, not the AI tool — pick the problem first, then decide if and how AI helps.',
      'Real-world example: a team spending two hours a day sorting simple enquiries is a real, measurable problem — the starting point, not "let\'s use AI somewhere".',
      'At work, ask what information AI will use, who will check its work, and how you\'ll know it\'s actually working before rolling it out widely.',
      'Common mistake: buying or building an AI tool first, then trying to find a problem for it to solve, instead of starting from a real need.'
    ],
    example: { label: 'Right starting point', good: 'Start with: what business problem are we solving? Then: what information is needed, who checks it, how do we measure success?' },
    keyTakeaways: [
      'Start with the business problem, not the AI tool.',
      'Plan who checks the AI\'s work and what information it needs, before building anything.',
      'Test with a small, safe group first, and define how you\'ll measure success.'
    ],
    practice: 'Your team spends two hours a day sorting simple customer enquiries by type. Write: what AI could do here, what a person should still check, and how you\'d measure whether it worked.',
    practiceExample: 'AI could: read each enquiry and suggest a category and a draft reply. A person still checks: the category and reply before sending. Measure success: time saved per day, and how often the person needed to change AI\'s suggestion.',
    quiz: {
      question: 'A manager is excited about a new AI tool and wants to "find a use for it" across the department immediately. What should happen first?',
      options: [
        { text: 'Roll it out to the whole department straight away, since it\'s ready', correct: false, feedback: 'Starting with a wide rollout, before a real problem and a small test, skips the steps that catch issues early and cheaply.' },
        { text: 'Identify a specific business problem it would solve, and test it with a small, safe group first', correct: true, feedback: 'Right — starting from a real problem, and testing small before scaling, is what makes an implementation more likely to actually work.' },
        { text: 'Buy more AI tools to see which one fits best', correct: false, feedback: 'Buying more tools doesn\'t replace defining the actual problem first — that step has to come before choosing (or testing) any tool.' },
        { text: 'Ask AI itself whether it should be implemented', correct: false, feedback: 'This isn\'t a decision AI can make for the business — it requires understanding the real problem, the risks, and how success will be measured.' }
      ]
    }
  },
  'designing-ai-systems': {
    title: 'Designing AI Systems',
    whatYoullLearn: 'What makes an AI system reliable and safe, not just impressive.',
    learn: [
      'An AI system can have several parts working together: a user request, approved information, AI itself, tools, and human checks.',
      'Retrieval means finding the right information before AI answers — for example, checking the correct company policy document instead of letting AI guess from general knowledge.',
      'Real-world example: an assistant answering company policy questions should look up the actual current policy, not generate a plausible-sounding answer from general training.',
      'A good AI system should be useful, safe, easy to check, and clear when it doesn\'t know something — rather than confidently guessing.'
    ],
    example: { label: 'Safer design', good: 'Let the system find the right policy document and answer from it — and say clearly when no matching policy is found.', bad: 'Letting AI guess an answer about company policy from general knowledge.' },
    keyTakeaways: [
      'A full AI system includes the request, approved information, AI, tools, and human checks — not just AI alone.',
      'Retrieval means finding the right real information before answering, rather than guessing.',
      'A good system says clearly when it doesn\'t know, instead of confidently guessing.'
    ],
    practice: 'Design a company-policy assistant. Choose the safer design and explain why: (a) let it guess from general knowledge, or (b) make it find the right policy document and say clearly when no answer is found.',
    practiceExample: 'Option (b) is safer: the assistant should search real, approved policy documents first, answer from what it finds, and say plainly "I couldn\'t find a matching policy — please check with HR" when nothing matches, rather than guessing.',
    quiz: {
      question: 'A company policy assistant is asked a question with no matching policy on file. What should a well-designed system do?',
      options: [
        { text: 'Generate its best guess so the user always gets an answer', correct: false, feedback: 'A confident guess with no real policy behind it can mislead someone into relying on incorrect information.' },
        { text: 'Clearly say no matching policy was found, and suggest checking with a person', correct: true, feedback: 'Right — a well-designed system is clear about the limits of what it actually knows, rather than filling the gap with a guess.' },
        { text: 'Refuse to answer any further questions at all', correct: false, feedback: 'This overcorrects — the system should still help with questions it can answer from real policy, just be honest when it can\'t.' },
        { text: 'Make up a plausible-sounding policy so the process keeps moving', correct: false, feedback: 'This is the exact risk a good system design avoids — inventing an answer that sounds real but isn\'t.' }
      ]
    }
  }
};

// ---- XP & levelling -----------------------------------------------------------
const XP_PER_LESSON = 40;
const XP_PER_QUIZ_CORRECT = 10; // quiz here is a single check, so this is a pass/fail bonus
const XP_PER_PATH_COMPLETE = 100; // bonus for finishing all 4 lessons in a level's path
const XP_PER_RESOURCE = 20; // completing a real Hub resource (with or without a knowledge check)
const XP_PER_CHALLENGE_PASSED = 150; // awarded once, the first time a level's practical challenge is marked Passed
const XP_PER_LEARNER_LEVEL = 200; // XP needed per "AI LEVEL" (gamification level, distinct from skill level)

function learnerLevelFromXp(xp){
  return Math.floor(xp / XP_PER_LEARNER_LEVEL) + 1;
}
function xpProgressInLevel(xp){
  const into = xp % XP_PER_LEARNER_LEVEL;
  return { into, needed: XP_PER_LEARNER_LEVEL, pct: Math.round((into / XP_PER_LEARNER_LEVEL) * 100) };
}

// ---- Badges -------------------------------------------------------------------
// `check(progress)` receives the learner's progress object (see learning.js) and
// returns true/false. Evaluated after every save, so new badges just need an
// entry here — no other code changes required.
const BADGE_LIBRARY = [
  { id: 'first-steps', label: 'First Steps', emoji: '🥾', desc: 'Complete your first lesson', check: p => (p.completedLessons || []).length >= 1 },
  { id: 'quiz-whiz', label: 'Quiz Whiz', emoji: '🧠', desc: 'Pass a quiz on your first try', check: p => p.perfectQuizzes > 0 },
  { id: 'five-lessons', label: 'Building Momentum', emoji: '⚡', desc: 'Complete 5 lessons', check: p => (p.completedLessons || []).length >= 5 },
  { id: 'path-complete-beginner', label: 'Fundamentals Graduate', emoji: '🟢', desc: 'Finish the Beginner path', check: p => p.pathCompleted && p.pathCompleted.beginner },
  { id: 'path-complete-basic', label: 'Practical Starter', emoji: '🔵', desc: 'Finish the Basic path', check: p => p.pathCompleted && p.pathCompleted.basic },
  { id: 'path-complete-intermediate', label: 'Skilled Up', emoji: '🟡', desc: 'Finish the Intermediate path', check: p => p.pathCompleted && p.pathCompleted.intermediate },
  { id: 'path-complete-advanced', label: 'Workflow Master', emoji: '🟠', desc: 'Finish the Advanced path', check: p => p.pathCompleted && p.pathCompleted.advanced },
  { id: 'path-complete-expert', label: 'AI Systems Architect', emoji: '🔴', desc: 'Finish the Expert path', check: p => p.pathCompleted && p.pathCompleted.expert },
  { id: 'streak-3', label: '3-Day Streak', emoji: '🔥', desc: 'Learn 3 days in a row', check: p => (p.streak || 0) >= 3 },
  { id: 'streak-7', label: '7-Day Streak', emoji: '🔥', desc: 'Learn 7 days in a row', check: p => (p.streak || 0) >= 7 },
  { id: 'assessment-done', label: 'Know Thyself', emoji: '🎯', desc: 'Complete the AI skill assessment', check: p => !!p.assessmentResult },
  { id: 'first-challenge-passed', label: 'Proven', emoji: '✅', desc: 'Pass your first practical challenge', check: p => Object.values(p.levelChallenges || {}).some(c => c.status === 'passed') }
];

function checkNewBadges(progress){
  const already = new Set(progress.badges || []);
  return BADGE_LIBRARY.filter(b => !already.has(b.id) && b.check(progress)).map(b => b.id);
}
