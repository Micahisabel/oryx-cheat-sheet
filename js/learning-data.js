// ============================================================================
// AI Learning — centralized configuration
// ============================================================================
// Everything that shapes the assessment, scoring, learning paths, lessons, XP
// and badges lives in this one file. To change what the assessment asks, how
// levels are scored, or what a level's lessons cover, edit the data below —
// nothing elsewhere in js/learning.js should need to change.
// ============================================================================

// ---- Levels -----------------------------------------------------------------
const LEARNING_LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

const LEVEL_META = {
  beginner:     { label: 'Beginner',     emoji: '🌱', color: '#3FA34D', blurb: "You're ready to start with the AI fundamentals!" },
  intermediate: { label: 'Intermediate', emoji: '🔵', color: '#1C7ED6', blurb: 'You already have a good understanding of AI. Let\'s build on what you know.' },
  advanced:     { label: 'Advanced',     emoji: '🟣', color: '#7048E8', blurb: "You're comfortable with AI — let's get into workflows and automation." },
  expert:       { label: 'Expert',       emoji: '🟠', color: '#E8590C', blurb: "You know your way around AI — let's build real AI systems." }
};

// Score thresholds (0-100, weighted — see scoreAssessment() in learning.js).
// Edit min/max here to rebalance level placement without touching any logic.
const LEVEL_THRESHOLDS = [
  { level: 'beginner',     min: 0,  max: 25 },
  { level: 'intermediate', min: 26, max: 50 },
  { level: 'advanced',     min: 51, max: 75 },
  { level: 'expert',       min: 76, max: 100 }
];

function levelFromScore(score){
  const hit = LEVEL_THRESHOLDS.find(t => score >= t.min && score <= t.max);
  return (hit || LEVEL_THRESHOLDS[0]).level;
}

// ---- Adaptive assessment question bank --------------------------------------
// tier 1 = basic, 2 = prompting/practical, 3 = workflows/tools, 4 = advanced
// (automation/agents/integrations). `weight` is how much this tier counts
// toward the final score — advanced tiers count for more, per the brief.
// Each option carries a 0-3 quality score (not just right/wrong), so partial
// credit reflects real answer quality on judgment-call questions.
const TIER_WEIGHT = { 1: 1, 2: 2, 3: 3, 4: 4 };
const ASSESSMENT_LENGTH = 9; // how many questions a single assessment run asks

const ASSESSMENT_QUESTIONS = [
  // ---- Tier 1: basic ----
  {
    id: 'q-usage-frequency', tier: 1, topic: 'Basic AI understanding',
    prompt: 'How often do you use AI tools (like ChatGPT or Claude)?',
    options: [
      { text: "I'm completely new to AI", score: 0 },
      { text: "I've tried AI a few times", score: 1 },
      { text: 'I use AI regularly', score: 2 },
      { text: 'I use AI almost every day', score: 3 }
    ]
  },
  {
    id: 'q-what-is-ai', tier: 1, topic: 'Basic AI understanding',
    prompt: 'In your own words, what best describes what tools like ChatGPT or Claude actually do?',
    options: [
      { text: "I'm not really sure", score: 0 },
      { text: 'They search the internet and copy an answer for you', score: 1 },
      { text: 'They predict and generate a helpful reply based on your message', score: 3 },
      { text: 'They follow a fixed script of pre-written answers', score: 1 }
    ]
  },
  {
    id: 'q-claude-vs-chatgpt', tier: 1, topic: 'Experience with AI assistants',
    prompt: 'Have you used Claude or ChatGPT for work before?',
    options: [
      { text: 'No, never', score: 0 },
      { text: 'A little, just to try it out', score: 1 },
      { text: 'Yes, for simple tasks like emails or summaries', score: 2 },
      { text: 'Yes, regularly for several types of tasks', score: 3 }
    ]
  },
  // ---- Tier 2: prompting / practical ----
  {
    id: 'q-better-prompt', tier: 2, topic: 'Writing prompts',
    prompt: 'Which of these prompts is more likely to get you a useful answer?',
    options: [
      { text: '"Write an email."', score: 0 },
      { text: '"Write something for a customer."', score: 1 },
      { text: '"Write a short, professional email telling a customer their order will be delayed by two days."', score: 3 },
      { text: '"Email."', score: 0 }
    ]
  },
  {
    id: 'q-too-formal', tier: 2, topic: 'Improving AI responses',
    prompt: 'You ask AI to write an email, but the reply is too formal. What would you do?',
    options: [
      { text: 'Give up and write it myself from scratch', score: 0 },
      { text: 'Ask again with the exact same prompt and hope for a better result', score: 0 },
      { text: 'Tell it: "Make this more casual and friendly" and let it revise', score: 3 },
      { text: 'Copy the reply anyway and send it as-is', score: 1 }
    ]
  },
  {
    id: 'q-ai-for-work', tier: 2, topic: 'Using AI for work',
    prompt: 'Which is a good everyday use of AI at Oryx?',
    options: [
      { text: 'Summarising a long supplier email into three key points', score: 3 },
      { text: 'Letting AI make a final decision on a customer complaint with no review', score: 0 },
      { text: 'Only using it for spelling checks', score: 1 },
      { text: "Nothing — it's not useful for daily work", score: 0 }
    ]
  },
  {
    id: 'q-documents', tier: 2, topic: 'Working with documents and files',
    prompt: "You need to pull the key terms out of a 10-page supplier contract. What's the best approach?",
    options: [
      { text: 'Read the whole thing manually — AI can\'t help with documents', score: 0 },
      { text: 'Upload or paste it and ask AI to summarise the key terms and flag anything unusual', score: 3 },
      { text: 'Ask AI to guess what the contract probably says without giving it the file', score: 0 },
      { text: 'Paste in a random paragraph and ask what it means', score: 1 }
    ]
  },
  // ---- Tier 3: workflows / tools ----
  {
    id: 'q-ai-tools-awareness', tier: 3, topic: 'AI tools',
    prompt: 'You need to turn messy meeting notes into a clean action list every week. What\'s the best habit to build?',
    options: [
      { text: 'Do it manually each time — it only takes a few minutes', score: 1 },
      { text: 'Save a reusable prompt/template that formats notes into action items consistently', score: 3 },
      { text: 'Ask a different tool each time and compare styles', score: 1 },
      { text: 'Skip the notes and rely on memory', score: 0 }
    ]
  },
  {
    id: 'q-context-instructions', tier: 3, topic: 'AI workflows',
    prompt: 'Why do custom instructions or "context" (like a company style guide) make AI responses better?',
    options: [
      { text: "They don't — every prompt is judged the same either way", score: 0 },
      { text: 'They give the AI standing background so it doesn\'t need to be repeated every time', score: 3 },
      { text: 'They make responses shorter, nothing else', score: 1 },
      { text: 'They\'re only useful for developers', score: 0 }
    ]
  },
  {
    id: 'q-double-check', tier: 3, topic: 'Responsible AI use',
    prompt: 'AI gives you a confident-sounding fact you\'re not sure is correct. What should you do?',
    options: [
      { text: 'Trust it completely — AI is always accurate', score: 0 },
      { text: 'Verify it against a reliable source before relying on it', score: 3 },
      { text: 'Ignore AI entirely from now on', score: 1 },
      { text: 'Pass it on to a colleague without checking', score: 0 }
    ]
  },
  {
    id: 'q-connectors-awareness', tier: 3, topic: 'AI tools',
    prompt: 'What is a "Connector" (also called an MCP) in tools like Claude?',
    options: [
      { text: 'A cable used to charge your laptop', score: 0 },
      { text: 'A bridge that lets the AI access another app or system, like Zoho or Google Drive', score: 3 },
      { text: 'A type of prompt template', score: 1 },
      { text: 'Not sure what this is', score: 0 }
    ]
  },
  // ---- Tier 4: advanced — automation / agents / integrations ----
  {
    id: 'q-automation', tier: 4, topic: 'AI automation',
    prompt: 'What best describes "AI automation" in a business setting?',
    options: [
      { text: 'Typing faster while using AI', score: 0 },
      { text: 'Setting up AI to handle a repeatable multi-step task automatically, with little manual input', score: 3 },
      { text: 'Using AI only once per project', score: 0 },
      { text: 'Turning off AI features to save time', score: 0 }
    ]
  },
  {
    id: 'q-ai-agents', tier: 4, topic: 'AI agents',
    prompt: 'How is an "AI agent" different from a normal chat with AI?',
    options: [
      { text: 'There is no real difference', score: 0 },
      { text: 'An agent can take multiple steps and use tools on its own to reach a goal, not just reply once', score: 3 },
      { text: 'An agent is just a chat with a different name', score: 1 },
      { text: 'An agent only works with images', score: 0 }
    ]
  },
  {
    id: 'q-integrations', tier: 4, topic: 'AI tool integrations',
    prompt: 'Your team wants AI to automatically log new customer enquiries into Zoho CRM. What\'s the right way to think about this?',
    options: [
      { text: 'It can\'t be done — AI can\'t connect to business systems', score: 0 },
      { text: 'Connect AI to Zoho CRM through an integration/connector, then design a workflow that triggers on new enquiries', score: 3 },
      { text: 'Manually retype every enquiry after asking AI to format it', score: 1 },
      { text: 'Ask AI to remember the enquiries in the chat forever', score: 0 }
    ]
  },
  {
    id: 'q-advanced-workflow', tier: 4, topic: 'Advanced AI workflows',
    prompt: 'You want to design a multi-step AI workflow: pull data, analyse it, then draft a report. What\'s the best approach?',
    options: [
      { text: 'Ask for everything in one giant prompt and hope it works', score: 1 },
      { text: 'Break it into clear steps, check the output at each stage, and chain them together', score: 3 },
      { text: 'Do each step manually since AI can\'t chain tasks', score: 0 },
      { text: 'Only do the last step (the report) and skip the rest', score: 0 }
    ]
  }
];

// ---- Learning paths (per level) --------------------------------------------
// Lesson ids must exist as keys in LESSON_LIBRARY below. Reorder, add, or
// remove lessons here to change a level's path — nothing else needs editing.
const LEARNING_PATHS = {
  beginner: [
    'what-is-ai', 'how-assistants-work', 'intro-chatgpt-claude', 'basic-prompt',
    'ask-better-questions', 'ai-everyday-work', 'working-with-documents', 'ai-safety'
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
  { id: 'path-complete-beginner', label: 'Fundamentals Graduate', emoji: '🌱', desc: 'Finish the Beginner path', check: p => p.pathCompleted && p.pathCompleted.beginner },
  { id: 'path-complete-intermediate', label: 'Skilled Up', emoji: '🔵', desc: 'Finish the Intermediate path', check: p => p.pathCompleted && p.pathCompleted.intermediate },
  { id: 'path-complete-advanced', label: 'Workflow Master', emoji: '🟣', desc: 'Finish the Advanced path', check: p => p.pathCompleted && p.pathCompleted.advanced },
  { id: 'path-complete-expert', label: 'AI Systems Architect', emoji: '🟠', desc: 'Finish the Expert path', check: p => p.pathCompleted && p.pathCompleted.expert },
  { id: 'streak-3', label: '3-Day Streak', emoji: '🔥', desc: 'Learn 3 days in a row', check: p => (p.streak || 0) >= 3 },
  { id: 'streak-7', label: '7-Day Streak', emoji: '🔥', desc: 'Learn 7 days in a row', check: p => (p.streak || 0) >= 7 },
  { id: 'assessment-done', label: 'Know Thyself', emoji: '🎯', desc: 'Complete the AI skill assessment', check: p => !!p.assessmentResult }
];

function checkNewBadges(progress){
  const already = new Set(progress.badges || []);
  return BADGE_LIBRARY.filter(b => !already.has(b.id) && b.check(progress)).map(b => b.id);
}
