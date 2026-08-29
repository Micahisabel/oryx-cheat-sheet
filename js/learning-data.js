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
      { id: 'other-tool', text: 'Other', isTool: true },
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

// ---- Learning paths (per level) --------------------------------------------
// Lesson ids must exist as keys in LESSON_LIBRARY below. Reorder, add, or
// remove lessons here to change a level's path — nothing else needs editing.
const LEARNING_PATHS = {
  beginner: [
    'what-is-ai', 'how-assistants-work', 'intro-chatgpt-claude', 'basic-prompt',
    'ask-better-questions', 'ai-everyday-work', 'working-with-documents', 'ai-safety'
  ],
  basic: [
    'ai-strengths-weaknesses', 'everyday-prompting', 'comparing-ai-assistants', 'refining-ai-answers',
    'ai-for-quick-tasks', 'intro-file-work', 'spotting-ai-mistakes', 'from-basic-to-practical'
  ],
  intermediate: [
    'better-prompting', 'prompt-structure', 'context-and-instructions', 'documents-intermediate',
    'ai-for-productivity', 'ai-for-business-tasks', 'ai-workflows', 'intro-automation'
  ],
  advanced: [
    'advanced-prompting', 'complex-workflows', 'ai-automation', 'ai-agents',
    'tool-integrations', 'data-analysis-ai', 'business-process-automation', 'building-ai-workflows'
  ],
  expert: [
    'advanced-architecture', 'ai-agents-expert', 'mcps', 'apis-integrations',
    'advanced-automation', 'multistep-workflows', 'ai-implementation', 'designing-ai-systems'
  ]
};

// ---- Lesson content ----------------------------------------------------------
// Structure per lesson: Learn -> Example -> Practice -> Quiz.
// `quiz` is a single scored check (array of options with one or more correct);
// keep it short — this is a comprehension check, not another assessment.
const LESSON_LIBRARY = {
  // ================= BEGINNER =================
  'what-is-ai': {
    title: 'What is AI?',
    learn: 'AI (Artificial Intelligence) tools like Claude and ChatGPT are programs trained on huge amounts of text. Instead of following a fixed script, they predict a helpful reply based on what you type — the way a very well-read colleague might. The more clearly you explain what you want, the more useful the reply.',
    example: { label: 'Think of it like', good: 'A very fast, very well-read assistant who has read millions of documents — but who still needs clear instructions from you to do the right task.' },
    practice: 'Open Claude or ChatGPT and ask it: "In simple terms, what can you help me with at work?" Read the reply.',
    quiz: {
      question: 'What is the best way to think of an AI assistant?',
      options: [
        { text: 'A search engine that copies web pages', correct: false },
        { text: 'An assistant that generates helpful replies based on your instructions', correct: true },
        { text: 'A robot that only follows fixed menu options', correct: false }
      ]
    }
  },
  'how-assistants-work': {
    title: 'How AI assistants work',
    learn: 'AI assistants read your message (the "prompt"), then generate a reply word by word based on patterns learned from training. They don\'t "know" facts the way a database does — they generate the most likely helpful answer, which is why checking important facts still matters.',
    example: { label: 'Good habit', good: 'Treat AI like a knowledgeable colleague drafting something for you — useful, fast, but worth a quick check before it goes out.' },
    practice: 'Ask AI a factual question about your own department, then verify the answer with a colleague or document.',
    quiz: {
      question: 'Why should you double-check important facts from AI?',
      options: [
        { text: 'Because AI generates likely answers, which can occasionally be wrong', correct: true },
        { text: 'Because AI never gives useful answers', correct: false },
        { text: 'Because AI charges more for correct answers', correct: false }
      ]
    }
  },
  'intro-chatgpt-claude': {
    title: 'Introduction to ChatGPT and Claude',
    learn: 'Claude and ChatGPT are both AI assistants you chat with in plain language. They can draft text, summarise documents, answer questions, and help with everyday tasks. Both work the same basic way: you write a prompt, they generate a reply, and you can keep the conversation going to refine it.',
    example: { label: 'Try this prompt', good: '"Summarise this email in two sentences."' },
    practice: 'Open the AI Knowledge Hub\'s Claude or ChatGPT tab and try one existing Instruction or Skill entry.',
    quiz: {
      question: 'What can you do if an AI reply isn\'t quite right the first time?',
      options: [
        { text: 'Start over completely — you can\'t improve on a reply', correct: false },
        { text: 'Reply back and ask it to adjust — the conversation continues', correct: true },
        { text: 'Nothing — the first answer is final', correct: false }
      ]
    }
  },
  'basic-prompt': {
    title: 'How to write a basic prompt',
    learn: 'A good prompt is specific: say what you want, who it\'s for, and the tone. Vague prompts get vague answers.',
    example: { label: 'Bad vs. better', bad: '"Write an email."', good: '"Write a short, professional email to a customer explaining their order will be delayed by two days."' },
    practice: 'Write a prompt asking AI to draft a message to a colleague about a schedule change — include who it\'s for and the tone you want.',
    quiz: {
      question: 'What makes a prompt more likely to get a useful reply?',
      options: [
        { text: 'Keeping it as short and vague as possible', correct: false },
        { text: 'Being specific about the task, audience, and tone', correct: true },
        { text: 'Only ever asking one-word questions', correct: false }
      ]
    }
  },
  'ask-better-questions': {
    title: 'How to ask better questions',
    learn: 'If the first reply isn\'t useful, don\'t give up — refine it. Add missing detail, correct a wrong assumption, or ask AI to try a different angle. Good prompting is often a short back-and-forth, not one perfect message.',
    example: { label: 'Refining', good: 'First: "Write a message about the delay." Then: "Make it shorter and less formal, and mention the new date."' },
    practice: 'Ask AI a question, then reply with one specific correction to improve the answer.',
    quiz: {
      question: 'If an AI reply misses the point, what\'s the best next step?',
      options: [
        { text: 'Clarify or correct it in a follow-up message', correct: true },
        { text: 'Assume AI can\'t help and stop', correct: false },
        { text: 'Repeat the exact same prompt again', correct: false }
      ]
    }
  },
  'ai-everyday-work': {
    title: 'Using AI for everyday work',
    learn: 'AI is great for repetitive writing and thinking tasks: summarising emails, drafting replies, brainstorming, checking tone. It\'s not meant to make final decisions on its own — you stay in charge of what goes out.',
    example: { label: 'Good use', good: 'Ask AI to draft a reply to a customer enquiry, then you review and send it.' },
    practice: 'Pick one repetitive task you do weekly and ask AI to help draft it.',
    quiz: {
      question: 'What\'s the right role for AI in daily work tasks?',
      options: [
        { text: 'A helpful drafting assistant you review before sending', correct: true },
        { text: 'A replacement for making your own decisions', correct: false },
        { text: 'Only useful for spelling checks', correct: false }
      ]
    }
  },
  'working-with-documents': {
    title: 'Working with documents',
    learn: 'You can paste or upload text — like an email, contract, or report — and ask AI to summarise it, pull out key points, or answer questions about it. This saves time reading long documents.',
    example: { label: 'Try this', good: '"Summarise this document in 3 bullet points and flag any dates or numbers."' },
    practice: 'Paste a long email or document into AI and ask for a 3-bullet summary.',
    quiz: {
      question: 'What\'s a good use of AI with a long document?',
      options: [
        { text: 'Asking it to guess the contents without seeing the document', correct: false },
        { text: 'Pasting or uploading it and asking for a summary or key points', correct: true },
        { text: 'Reading the whole thing yourself every time, regardless', correct: false }
      ]
    }
  },
  'ai-safety': {
    title: 'AI safety and responsible use',
    learn: 'Never paste confidential customer, financial, or password information into AI tools unless your company has approved that use. Always double-check important facts, and remember you\'re responsible for what you send — AI is a draft, not a decision.',
    example: { label: 'Rule of thumb', good: 'If you wouldn\'t post it publicly, don\'t paste it into AI without checking it\'s approved.' },
    practice: 'Review one recent AI conversation you had — was anything sensitive shared that shouldn\'t have been?',
    quiz: {
      question: 'What should you avoid pasting into an AI tool?',
      options: [
        { text: 'Confidential customer or financial information, unless approved', correct: true },
        { text: 'Any text at all — AI tools should never be used', correct: false },
        { text: 'Nothing — everything is safe to share', correct: false }
      ]
    }
  },

  // ================= BASIC =================
  'ai-strengths-weaknesses': {
    title: "What AI Is Good At (and Not)",
    learn: 'AI is great at drafting, summarising, brainstorming, and answering general questions. It\'s weaker at precise maths, today\'s exact news, or live company data it isn\'t connected to. Knowing this helps you pick the right task for AI.',
    example: { label: 'Good fit vs. weak fit', good: 'Drafting a first version of an email is a good fit. Asking for exact live stock levels it has no access to is a weak fit.' },
    practice: 'List two tasks you\'d trust AI with, and one you wouldn\'t — and why.',
    quiz: {
      question: 'Which task is AI naturally weaker at?',
      options: [
        { text: 'Giving today\'s exact live stock count from a system it isn\'t connected to', correct: true },
        { text: 'Drafting a first version of an email', correct: false },
        { text: 'Brainstorming ideas for a project name', correct: false }
      ]
    }
  },
  'everyday-prompting': {
    title: 'Everyday Prompting Habits',
    learn: 'A few small habits make prompts far more useful day to day: say the goal first, mention who it\'s for, and ask for a specific format — bullets, a table, or a short paragraph.',
    example: { label: 'Everyday prompt', good: '"Turn these notes into 3 bullet points for my manager."' },
    practice: 'Take one task you do this week and write a one-line prompt with goal + audience + format.',
    quiz: {
      question: 'What\'s a good everyday prompting habit?',
      options: [
        { text: 'Say the goal, audience, and format you want', correct: true },
        { text: 'Keep every prompt exactly the same, regardless of the task', correct: false },
        { text: 'Never mention who the output is for', correct: false }
      ]
    }
  },
  'comparing-ai-assistants': {
    title: 'Comparing AI Assistants',
    learn: 'Claude, ChatGPT, Copilot, and Gemini all work in a similar way — you chat, they generate a reply — but each has its own strengths and fits into different tools (Copilot, for example, works inside Microsoft apps). Trying more than one helps you see what fits your workflow best.',
    example: { label: 'Why it helps', good: 'Copilot can work directly inside Word or Outlook, while Claude or ChatGPT are often used in a separate chat window.' },
    practice: 'If you\'ve only used one AI tool, try asking the same question to a second one and compare the replies.',
    quiz: {
      question: 'Why might it help to try more than one AI assistant?',
      options: [
        { text: 'Each has its own strengths and fits differently into your workflow', correct: true },
        { text: 'They are all identical with no real differences', correct: false },
        { text: 'Only one AI assistant is allowed to exist', correct: false }
      ]
    }
  },
  'refining-ai-answers': {
    title: 'Refining AI Answers',
    learn: 'Your first reply from AI doesn\'t have to be your last. If it\'s too long, too formal, missing something, or off-target, just say so in plain words and ask it to adjust — that\'s normal and expected, not a failure.',
    example: { label: 'Refining', good: '"Shorter please, and make it sound friendlier."' },
    practice: 'Ask AI for something, then give it one round of feedback to improve the reply.',
    quiz: {
      question: 'What should you do if an AI reply isn\'t quite right?',
      options: [
        { text: 'Tell it what to change and ask again', correct: true },
        { text: 'Assume it can\'t be fixed', correct: false },
        { text: 'Never use AI for that task again', correct: false }
      ]
    }
  },
  'ai-for-quick-tasks': {
    title: 'AI for Quick, Everyday Tasks',
    learn: 'Small, quick wins build the habit: turning a messy note into a clean message, checking spelling and tone, or listing pros and cons before a decision. These take seconds and build confidence for bigger tasks later.',
    example: { label: 'Quick win', good: '"Clean up this message and make the tone more polite."' },
    practice: 'Use AI for one quick task today — a message, a list, or a tone check.',
    quiz: {
      question: 'What\'s a good "quick win" use of AI?',
      options: [
        { text: 'Cleaning up a message or checking its tone', correct: true },
        { text: 'Something that requires a whole day of setup first', correct: false },
        { text: 'Nothing — quick tasks aren\'t worth using AI for', correct: false }
      ]
    }
  },
  'intro-file-work': {
    title: 'Getting Started with Files and Documents',
    learn: 'You can share a document or a block of text with AI and ask simple questions about it — like "what are the main points?" This is one of the most useful basic skills once you\'re comfortable chatting with AI.',
    example: { label: 'Try this', good: '"Here\'s an email — what are the 3 key points?"' },
    practice: 'Paste a short document or email into AI and ask for the 3 main points.',
    quiz: {
      question: 'What\'s a simple way to start working with documents in AI?',
      options: [
        { text: 'Paste or share the text and ask a simple question about it', correct: true },
        { text: 'Only ever describe the document from memory', correct: false },
        { text: 'Documents can\'t be used with AI at all', correct: false }
      ]
    }
  },
  'spotting-ai-mistakes': {
    title: 'Spotting AI Mistakes',
    learn: 'AI can sound confident even when it\'s wrong — sometimes called a "hallucination." A good habit is to double-check any fact, number, or name that really matters before you rely on it.',
    example: { label: 'Good habit', good: 'Quickly checking a name, date, or number AI gives you against a real source before using it.' },
    practice: 'Next time AI gives you a specific fact or number, take 10 seconds to verify it.',
    quiz: {
      question: 'What should you do with an important fact or number AI gives you?',
      options: [
        { text: 'Quickly double-check it before relying on it', correct: true },
        { text: 'Always trust it completely, no matter what', correct: false },
        { text: 'Ignore anything AI ever says', correct: false }
      ]
    }
  },
  'from-basic-to-practical': {
    title: 'From Basic to Practical AI Use',
    learn: 'You\'ve got the fundamentals — now it\'s about making AI a regular habit: for messages, summaries, quick research, and decisions. The next step is structure — building prompts and simple workflows that get consistently good results.',
    example: { label: 'Next step', good: 'Instead of one-off prompts, start thinking about a repeatable structure you can reuse.' },
    practice: 'Pick one task you now do with AI regularly, and write down the prompt you use so you can reuse it.',
    quiz: {
      question: 'What\'s the natural next step after building basic AI habits?',
      options: [
        { text: 'Learning more structure, like reusable prompts and simple workflows', correct: true },
        { text: 'Stopping using AI altogether', correct: false },
        { text: 'Only ever using AI for one single task forever', correct: false }
      ]
    }
  },

  // ================= INTERMEDIATE =================
  'better-prompting': {
    title: 'Better Prompting',
    learn: 'Beyond being specific, strong prompts often include: the goal, the audience, the format you want (bullet points? a table? an email?), and any constraints (length, tone). The more of these you give up front, the fewer rounds of back-and-forth you\'ll need.',
    example: { label: 'Stronger prompt', good: '"Write a 3-bullet summary for my manager, in a neutral tone, no more than 60 words."' },
    practice: 'Rewrite one of your recent prompts to include goal, audience, format, and length.',
    quiz: {
      question: 'Which detail is NOT usually needed in a strong prompt?',
      options: [
        { text: 'The desired format (email, bullets, table)', correct: false },
        { text: 'The audience it\'s for', correct: false },
        { text: 'The exact model version number', correct: true }
      ]
    }
  },
  'prompt-structure': {
    title: 'Prompt Structure',
    learn: 'A reusable structure helps: Role ("You are helping a sales coordinator...") + Task ("...draft a follow-up email...") + Context (details specific to this case) + Format (how you want it delivered). This structure works for almost any request.',
    example: { label: 'Structured prompt', good: '"You are helping me write for a customer. Task: follow-up email about a delayed order. Context: order #4521, delayed 2 days due to shipping. Format: short, friendly, 3 sentences max."' },
    practice: 'Write one prompt using the Role + Task + Context + Format structure.',
    quiz: {
      question: 'What does adding "Context" to a prompt do?',
      options: [
        { text: 'Gives AI the specific details it needs for this exact case', correct: true },
        { text: 'Makes the AI reply slower', correct: false },
        { text: 'Has no real effect on the answer', correct: false }
      ]
    }
  },
  'context-and-instructions': {
    title: 'Context and Instructions',
    learn: 'Standing instructions (like "always reply in a friendly but professional tone" or a company style guide) save you from repeating yourself every time. Many AI tools let you save custom instructions once so every future chat follows them automatically.',
    example: { label: 'Standing instruction', good: '"Always write in UK spelling, keep emails under 150 words, sign off with \'Kind regards\'."' },
    practice: 'Write one standing instruction you\'d want AI to always follow for your role.',
    quiz: {
      question: 'What\'s the benefit of saving standing instructions?',
      options: [
        { text: 'You don\'t have to repeat the same preferences every single time', correct: true },
        { text: 'It makes every reply exactly the same length', correct: false },
        { text: 'It stops you from being able to ask follow-up questions', correct: false }
      ]
    }
  },
  'documents-intermediate': {
    title: 'Working with Documents',
    learn: 'For longer or more complex documents, ask AI targeted questions rather than one giant "summarise everything" request — e.g. "What are the payment terms?" or "List any deadlines mentioned." Targeted questions get sharper, more useful answers.',
    example: { label: 'Targeted question', good: '"What are the cancellation terms in this contract, and by when do we need to give notice?"' },
    practice: 'Take a document you work with and ask AI 2-3 targeted questions instead of one broad summary.',
    quiz: {
      question: 'Why ask targeted questions about a document instead of one broad summary?',
      options: [
        { text: 'Targeted questions usually get sharper, more useful answers', correct: true },
        { text: 'Broad summaries are always better', correct: false },
        { text: 'AI can only answer one question per document', correct: false }
      ]
    }
  },
  'ai-for-productivity': {
    title: 'AI for Productivity',
    learn: 'Use AI to speed up recurring work: turning meeting notes into action items, drafting first-pass replies to common questions, or creating checklists. Save prompts that work well so you (or your team) can reuse them.',
    example: { label: 'Reusable prompt', good: '"Turn these meeting notes into a bullet list of action items, each with an owner if mentioned."' },
    practice: 'Save one prompt you use often as a note so you can reuse it next time.',
    quiz: {
      question: 'What\'s a good productivity habit with AI prompts?',
      options: [
        { text: 'Save and reuse prompts that work well for recurring tasks', correct: true },
        { text: 'Write a brand-new prompt from scratch every single time', correct: false },
        { text: 'Avoid using AI for anything recurring', correct: false }
      ]
    }
  },
  'ai-for-business-tasks': {
    title: 'AI for Business Tasks',
    learn: 'AI can help draft quotes, summarise supplier terms, prepare talking points for meetings, or check a document\'s tone before it goes to a client. Always keep a human review step for anything customer- or finance-facing.',
    example: { label: 'Good use', good: 'Ask AI to draft talking points for a supplier call, then you review and adjust before the call.' },
    practice: 'Pick one upcoming business task and ask AI to help you prepare for it.',
    quiz: {
      question: 'What should always happen before a customer- or finance-facing AI draft is sent?',
      options: [
        { text: 'A human review step', correct: true },
        { text: 'Nothing — send it straight away', correct: false },
        { text: 'Translate it twice', correct: false }
      ]
    }
  },
  'ai-workflows': {
    title: 'AI Workflows',
    learn: 'A "workflow" is a repeatable sequence of steps: e.g. Step 1 — summarise the enquiry; Step 2 — draft a reply; Step 3 — check tone. Breaking work into steps like this makes AI more reliable than one giant request.',
    example: { label: 'Simple workflow', good: '1) Summarise the enquiry. 2) Draft a reply using our tone guide. 3) List anything that needs manager approval.' },
    practice: 'Break one task you do into 3 clear steps you could ask AI to help with one at a time.',
    quiz: {
      question: 'Why break a task into steps for AI instead of one big request?',
      options: [
        { text: 'Each step gets clearer attention, making the overall result more reliable', correct: true },
        { text: 'It uses fewer words overall', correct: false },
        { text: 'AI can only handle one sentence at a time', correct: false }
      ]
    }
  },
  'intro-automation': {
    title: 'Introduction to Automation',
    learn: 'Automation means setting up AI (or AI plus other tools) to run a repeatable task with little or no manual effort each time — for example, automatically drafting a reply template whenever a certain type of enquiry comes in. This is the bridge between "using AI" and "AI working for you in the background."',
    example: { label: 'Simple automation idea', good: 'A saved template that auto-drafts a reply whenever a delivery-delay enquiry comes in, which staff then just review and send.' },
    practice: 'Think of one repeatable task in your role that could become a saved template or simple automation.',
    quiz: {
      question: 'What best describes automation?',
      options: [
        { text: 'A one-off task done manually', correct: false },
        { text: 'A repeatable task set up to run with little manual effort each time', correct: true },
        { text: 'Turning off AI tools to save time', correct: false }
      ]
    }
  },

  // ================= ADVANCED =================
  'advanced-prompting': {
    title: 'Advanced Prompting',
    learn: 'Advanced prompting includes giving AI examples of the style you want ("few-shot" examples), asking it to think step-by-step before answering, or asking it to critique its own draft before finalising. These techniques improve accuracy and consistency on harder tasks.',
    example: { label: 'Advanced technique', good: '"Here are two examples of our email style: [example 1] [example 2]. Now write a new email in the same style about X."' },
    practice: 'Give AI two examples of a style you want, then ask it to write something new in that style.',
    quiz: {
      question: 'What does giving AI style examples ("few-shot" prompting) help with?',
      options: [
        { text: 'Getting output that matches a specific style more consistently', correct: true },
        { text: 'Making AI slower', correct: false },
        { text: 'Preventing AI from answering at all', correct: false }
      ]
    }
  },
  'complex-workflows': {
    title: 'Complex AI Workflows',
    learn: 'Complex workflows chain multiple AI steps together, where the output of one step becomes the input to the next — e.g. extract data → analyse it → draft a report. Checking the result at each stage prevents small errors from compounding.',
    example: { label: 'Chained workflow', good: 'Step 1: Extract key numbers from a report. Step 2: Ask AI to spot trends in those numbers. Step 3: Draft a summary for management based on the trends.' },
    practice: 'Design a 3-step chained workflow for a task you do that involves data and a written summary.',
    quiz: {
      question: 'Why check output at each stage of a chained workflow?',
      options: [
        { text: 'To stop a small early error from affecting every later step', correct: true },
        { text: 'It\'s not necessary — only the final step matters', correct: false },
        { text: 'To make the workflow take longer on purpose', correct: false }
      ]
    }
  },
  'ai-automation': {
    title: 'AI Automation',
    learn: 'Real automation connects AI to a trigger (like a new form submission or email) and an action (like updating a spreadsheet or CRM record), so the task runs without someone starting it manually each time. This is where AI moves from "a tool you use" to "a system that works for you."',
    example: { label: 'Automation shape', good: 'Trigger: new customer enquiry email arrives → AI drafts a categorised summary → Action: adds it to the CRM automatically.' },
    practice: 'Identify a trigger and action in your own work that could plug into an automation like this.',
    quiz: {
      question: 'What two things does a real automation typically need?',
      options: [
        { text: 'A trigger and an action', correct: true },
        { text: 'A password and a username', correct: false },
        { text: 'Two separate AI chats running at once', correct: false }
      ]
    }
  },
  'ai-agents': {
    title: 'AI Agents',
    learn: 'An AI agent can take multiple steps on its own to reach a goal — searching, using tools, checking its own results — rather than just replying once to a single message. Agents are useful for open-ended tasks, but need clear goals and guardrails.',
    example: { label: 'Agent vs. chat', good: 'Chat: you ask one question, get one reply. Agent: you give a goal ("research this supplier"), and it plans and takes several steps to get there.' },
    practice: 'Think of one open-ended task in your role you\'d trust an agent to attempt with a clear goal.',
    quiz: {
      question: 'What makes an AI agent different from a single chat reply?',
      options: [
        { text: 'It can take multiple steps toward a goal, not just answer once', correct: true },
        { text: 'It only works with spreadsheets', correct: false },
        { text: 'There is no real difference', correct: false }
      ]
    }
  },
  'tool-integrations': {
    title: 'AI Tool Integrations',
    learn: 'Integrations (often called Connectors or MCPs) let AI read from or act on other systems — like Zoho CRM, Google Drive, or Microsoft 365 — instead of only working inside the chat window. This is what makes AI genuinely useful for real business systems.',
    example: { label: 'Integration example', good: 'Connecting Claude to Zoho CRM so it can look up a customer record directly, instead of you copy-pasting the details in.' },
    practice: 'Check the Knowledge Hub\'s Connectors tab for one integration relevant to your team.',
    quiz: {
      question: 'What do AI integrations (Connectors/MCPs) let AI do?',
      options: [
        { text: 'Read from or act on other business systems, not just chat', correct: true },
        { text: 'Only change the AI\'s reply colour', correct: false },
        { text: 'Nothing — they\'re decorative', correct: false }
      ]
    }
  },
  'data-analysis-ai': {
    title: 'Data Analysis with AI',
    learn: 'AI can spot patterns, summarise trends, and flag outliers in data you provide — e.g. a sales spreadsheet or a set of survey responses. It works best when you tell it exactly what question you want answered, not just "analyse this."',
    example: { label: 'Good ask', good: '"Looking at this sales data, which month had the biggest drop, and what changed compared to the month before?"' },
    practice: 'Take a small dataset you work with and ask AI one specific analytical question about it.',
    quiz: {
      question: 'What gets the best results when asking AI to analyse data?',
      options: [
        { text: 'A specific question, not just "analyse this"', correct: true },
        { text: 'Uploading the data with no question at all', correct: false },
        { text: 'Asking it to guess without seeing any data', correct: false }
      ]
    }
  },
  'business-process-automation': {
    title: 'Business Process Automation',
    learn: 'Look for processes that are repetitive, rule-based, and high-volume — these are the best automation candidates. Map the current manual steps first, then decide which steps AI or an integration can take over, and which still need a human check.',
    example: { label: 'Good candidate', good: 'A weekly report that always follows the same format and pulls from the same sources — ideal for automating the draft, with a human doing a final check.' },
    practice: 'Map out the steps of one repetitive process you run, and mark which steps could be automated.',
    quiz: {
      question: 'What kind of process is the best automation candidate?',
      options: [
        { text: 'Repetitive, rule-based, and high-volume', correct: true },
        { text: 'One-off and highly unpredictable', correct: false },
        { text: 'Something that changes completely every single time', correct: false }
      ]
    }
  },
  'building-ai-workflows': {
    title: 'Building AI-powered workflows',
    learn: 'Putting it together: define the goal, break it into steps, decide which steps need AI, which need an integration, and which need a human check — then document it so others can repeat it. A written-down workflow is what turns a one-off trick into a real business tool.',
    example: { label: 'Documented workflow', good: 'A short written guide: "1) New enquiry arrives. 2) AI drafts a categorised summary. 3) Staff review and forward to the right department."' },
    practice: 'Write down one AI-assisted workflow you already use informally, so a teammate could follow it.',
    quiz: {
      question: 'Why document an AI-assisted workflow?',
      options: [
        { text: 'So it becomes repeatable and others on the team can follow it', correct: true },
        { text: 'Documentation has no real benefit here', correct: false },
        { text: 'To make the process harder to follow on purpose', correct: false }
      ]
    }
  },

  // ================= EXPERT =================
  'advanced-architecture': {
    title: 'Advanced AI Architecture',
    learn: 'Modern AI systems are often more than one model call — they combine retrieval (pulling in relevant documents), tools (actions the AI can take), and memory (context carried across a session). Understanding these pieces helps you design more reliable systems instead of relying on a single prompt to do everything.',
    example: { label: 'Architecture piece', good: 'Retrieval: searching your company\'s documents for the relevant policy before answering, instead of relying on the model\'s general knowledge alone.' },
    practice: 'Identify one task where pulling in a specific document first (retrieval) would make the AI\'s answer more accurate.',
    quiz: {
      question: 'What does "retrieval" add to an AI system?',
      options: [
        { text: 'The ability to pull in specific, relevant documents before answering', correct: true },
        { text: 'A way to make replies shorter', correct: false },
        { text: 'Nothing measurable', correct: false }
      ]
    }
  },
  'ai-agents-expert': {
    title: 'AI Agents (Expert)',
    learn: 'At an expert level, designing agents means defining clear goals, the tools they\'re allowed to use, guardrails (what they must never do), and how their work gets checked. A well-designed agent is scoped narrowly enough to be reliable, not given unlimited freedom.',
    example: { label: 'Good agent scope', good: 'An agent allowed to draft and categorise support tickets, but not allowed to send a final reply without a human approving it.' },
    practice: 'Define a goal, allowed tools, and one guardrail for an agent you\'d want to build for your team.',
    quiz: {
      question: 'What makes an agent design reliable?',
      options: [
        { text: 'A clear goal, defined tools, and guardrails on what it must not do', correct: true },
        { text: 'Giving it unlimited freedom with no checks', correct: false },
        { text: 'Removing all goals so it can decide everything itself', correct: false }
      ]
    }
  },
  'mcps': {
    title: 'MCPs (Connectors)',
    learn: 'MCP (Model Context Protocol) is the technical standard behind what the Hub calls "Connectors" — it defines how an AI assistant securely connects to an external system\'s data and actions. Knowing the standard helps you evaluate new connectors and understand what they can and can\'t do.',
    example: { label: 'Why it matters', good: 'Understanding MCP means you can judge whether a new connector genuinely gives AI safe, useful access — not just a marketing claim.' },
    practice: 'Look at one Connector entry in the Hub and identify what system it connects to and what actions it allows.',
    quiz: {
      question: 'What does MCP define?',
      options: [
        { text: 'How an AI assistant securely connects to external data and actions', correct: true },
        { text: 'A file format for images', correct: false },
        { text: 'A pricing plan for AI tools', correct: false }
      ]
    }
  },
  'apis-integrations': {
    title: 'APIs and Integrations',
    learn: 'An API is how software systems talk to each other programmatically. Understanding basic API concepts (requests, responses, authentication) helps you scope realistic integration projects and communicate clearly with developers or vendors building them.',
    example: { label: 'Plain terms', good: 'An API request is like filling out a very specific form and getting a structured reply back — not a free-form chat.' },
    practice: 'Look up one system your team uses and check whether it has an API or Connector already available.',
    quiz: {
      question: 'Why is basic API knowledge useful at an expert level?',
      options: [
        { text: 'It helps you scope integration projects and talk to developers clearly', correct: true },
        { text: 'It has no practical use for non-developers', correct: false },
        { text: 'It replaces the need for any AI knowledge', correct: false }
      ]
    }
  },
  'advanced-automation': {
    title: 'Advanced Automation',
    learn: 'Advanced automation includes conditional logic (different actions depending on the situation), error handling (what happens when a step fails), and monitoring (knowing when something breaks). These are what separate a fragile one-off automation from one that runs reliably for months.',
    example: { label: 'Conditional logic', good: 'If an enquiry mentions "urgent," route it to a priority queue; otherwise, add it to the standard queue.' },
    practice: 'Add one "if this, then that" condition to an automation idea from an earlier lesson.',
    quiz: {
      question: 'What helps an automation stay reliable long-term?',
      options: [
        { text: 'Error handling and monitoring for when something breaks', correct: true },
        { text: 'Assuming it will never fail', correct: false },
        { text: 'Running it once and never checking again', correct: false }
      ]
    }
  },
  'multistep-workflows': {
    title: 'Multi-step AI Workflows',
    learn: 'At expert level, workflows often branch and loop: an AI step might trigger different follow-up steps depending on its output, or repeat until a condition is met. Designing these well means mapping every branch, not just the "happy path."',
    example: { label: 'Branching example', good: 'If AI\'s draft passes a quality check, send it; if not, loop back for a revision before trying again.' },
    practice: 'Sketch one branch point ("if X, do Y; otherwise, do Z") for a workflow you\'ve designed.',
    quiz: {
      question: 'What should you map when designing a branching workflow?',
      options: [
        { text: 'Every likely branch, not just the ideal path', correct: true },
        { text: 'Only the best-case scenario', correct: false },
        { text: 'Nothing — branches sort themselves out automatically', correct: false }
      ]
    }
  },
  'ai-implementation': {
    title: 'AI Implementation for Business',
    learn: 'Rolling out AI across a business involves more than picking a tool: it needs a clear use case, staff training, a review process, and a way to measure whether it\'s actually helping. Expert-level thinking means planning the rollout, not just the prompt.',
    example: { label: 'Rollout checklist', good: 'Use case defined → staff trained → review process in place → success measured after 30 days.' },
    practice: 'Pick one AI use case from this course and sketch a simple 4-step rollout plan for your team.',
    quiz: {
      question: 'What does a proper AI rollout need beyond picking a tool?',
      options: [
        { text: 'A clear use case, training, review process, and a way to measure success', correct: true },
        { text: 'Nothing else — the tool does all the work', correct: false },
        { text: 'Just a bigger budget', correct: false }
      ]
    }
  },
  'designing-ai-systems': {
    title: 'Designing AI Systems',
    learn: 'Designing a full AI system means combining everything: the right model, retrieval where needed, tools/integrations, guardrails, and a feedback loop so the system improves over time. This is the capstone skill — thinking in systems, not single prompts.',
    example: { label: 'Systems thinking', good: 'Instead of "write me a good prompt," ask "what\'s the full system — data in, AI processing, human check, action out — that solves this problem end to end?"' },
    practice: 'Sketch the full system (data in → AI steps → human check → action out) for one real problem at Oryx.',
    quiz: {
      question: 'What\'s the shift expert-level AI thinking makes?',
      options: [
        { text: 'From single prompts to designing complete end-to-end systems', correct: true },
        { text: 'From using AI to never using AI', correct: false },
        { text: 'From written prompts to only spoken prompts', correct: false }
      ]
    }
  }
};

// ---- XP & levelling -----------------------------------------------------------
const XP_PER_LESSON = 40;
const XP_PER_QUIZ_CORRECT = 10; // quiz here is a single check, so this is a pass/fail bonus
const XP_PER_PATH_COMPLETE = 100; // bonus for finishing all 8 lessons in a level's path
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
  { id: 'assessment-done', label: 'Know Thyself', emoji: '🎯', desc: 'Complete the AI skill assessment', check: p => !!p.assessmentResult }
];

function checkNewBadges(progress){
  const already = new Set(progress.badges || []);
  return BADGE_LIBRARY.filter(b => !already.has(b.id) && b.check(progress)).map(b => b.id);
}
