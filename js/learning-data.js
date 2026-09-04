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

// ---- Expert Validation questions ---------------------------------------------
// A raw Expert score from ASSESSMENT_QUESTIONS isn't trusted on its own — see
// finishAssessment()/renderExpertValidation() in learning.js. One hard,
// single-correct-answer question per level, expert down to basic (no
// 'beginner' entry — it's the floor, nothing lower to test, same reasoning as
// CHALLENGE_LIBRARY having no entry past 'advanced'). Each tests applied
// understanding, not terminology, and every option carries plain-English
// feedback so a wrong guess still teaches something.
const LEVEL_VALIDATION_QUESTIONS = {
  expert: [
    {
      prompt: "You're designing an AI agent that can read customer accounts and issue refunds automatically. What's the most important safeguard to put in place before it goes live?",
      options: [
        { text: 'Give it access to every customer field so it never gets stuck', correct: false, feedback: 'Wider access than the task needs makes any mistake more costly — the opposite of a safeguard.' },
        { text: 'Require a person to approve any refund over a set amount before it goes through', correct: true, feedback: "Right — for real financial impact, a human approval step (and a record of what happened) matters more than how clever the AI's prompt is." },
        { text: 'Tell it in the prompt to double-check its own maths', correct: false, feedback: "An instruction to 'double-check' doesn't give the AI a real way to verify itself — it can still be confidently wrong." },
        { text: 'Skip logging so it runs faster', correct: false, feedback: 'Removing the record of what the agent did removes your ability to catch or undo a mistake.' }
      ]
    },
    {
      prompt: "You're setting up an AI agent that can browse the internet and send emails on your behalf. What's the biggest risk if you don't limit what it's allowed to do?",
      options: [
        { text: 'It might send too many emails and slow the system down', correct: false, feedback: "That's a minor inconvenience, not the real risk here." },
        { text: 'It could take an action you never intended — like sending information to the wrong person — with no one checking first', correct: true, feedback: "Exactly — an unlimited agent can act on its own judgement, and a wrong judgement call goes out before anyone catches it." },
        { text: 'It will simply refuse to work without limits set', correct: false, feedback: 'Agents do not refuse to run just because permissions are broad — if anything the opposite is true.' },
        { text: 'Nothing — AI agents are safe by default', correct: false, feedback: 'No AI agent is safe by default; safety comes from the limits and checks you design in.' }
      ]
    },
    {
      prompt: "You ask an AI to always use your company's latest pricing before answering customer questions. What's the most reliable way to make sure it actually does that?",
      options: [
        { text: "Tell it in the prompt to 'always be accurate about pricing'", correct: false, feedback: 'An instruction alone gives the AI no actual access to real, current prices.' },
        { text: 'Connect it to your live pricing data so it checks the real source, not what it remembers', correct: true, feedback: "Right — an AI can only be reliably accurate about changing facts if it's actually looking them up, not recalling them from memory." },
        { text: 'Ask it more firmly to get it right', correct: false, feedback: 'Tone of the instruction has no effect on whether the AI has the real data.' },
        { text: 'Type this month\'s prices into the prompt and hope nobody changes them', correct: false, feedback: 'This works only until prices change, and depends on someone remembering to update it every time.' }
      ]
    },
    {
      prompt: 'An AI agent completes 5 of the 6 steps in a task, then the 6th step fails silently with no output. What is the safest system design?',
      options: [
        { text: 'Assume the whole task succeeded since most steps worked', correct: false, feedback: 'A task that fails partway through is not the same as one that finished — assuming success hides the problem.' },
        { text: 'Have the agent report exactly which steps completed and flag the failed step so a person can check', correct: true, feedback: 'Right — clear reporting on what actually happened (and what did not) is what makes a multi-step agent trustworthy.' },
        { text: 'Automatically retry the whole task forever until it works', correct: false, feedback: 'Endless silent retries can repeat the same mistake, or take actions multiple times without anyone knowing.' },
        { text: 'Ignore the failure since AI usually gets it right', correct: false, feedback: '"Usually" is not good enough when a step can fail without any warning.' }
      ]
    }
  ],
  advanced: [
    {
      prompt: 'An AI tool gives you a confident, detailed, and completely wrong answer about a recent company policy. What most likely happened?',
      options: [
        { text: 'The AI is broken and needs to be reset', correct: false, feedback: "The AI isn't malfunctioning — this is normal behaviour for how it generates answers." },
        { text: "It generated a plausible-sounding answer from patterns it learned, not a verified company fact — sometimes called a 'hallucination'", correct: true, feedback: 'Exactly — AI can sound completely confident while being wrong, especially about specific facts it was never actually given.' },
        { text: 'You asked the question in the wrong order', correct: false, feedback: 'Question order can affect clarity, but it does not explain confidently wrong facts.' },
        { text: 'The AI needs a longer prompt to be accurate', correct: false, feedback: 'A longer prompt can help, but length alone does not stop an AI from stating something false with confidence.' }
      ]
    },
    {
      prompt: "You're comparing two AI chatbot answers to the same question, and one sounds far more confident than the other. What should you actually judge them on?",
      options: [
        { text: 'Whichever one sounds more confident is more likely correct', correct: false, feedback: 'Confidence in tone has nothing to do with whether an AI answer is actually accurate.' },
        { text: 'Whether the answer can be checked against a real source and is actually accurate', correct: true, feedback: "Right — how an answer sounds tells you nothing about whether it's true; checking it against a real source does." },
        { text: 'Whichever answer is longer', correct: false, feedback: 'Length has no bearing on accuracy.' },
        { text: 'Whichever answer uses more technical language', correct: false, feedback: 'Technical-sounding language can just as easily wrap around a wrong answer.' }
      ]
    },
    {
      prompt: 'You give an AI the exact same instruction twice, in two separate conversations, and get two different answers. What does this tell you?',
      options: [
        { text: 'The AI is broken', correct: false, feedback: 'Getting different answers to the same prompt is normal, not a sign of a fault.' },
        { text: 'AI responses can vary each time, even for an identical prompt — so anything important should be checked, not assumed consistent', correct: true, feedback: "Right — this variability is exactly why anything that matters needs a check, rather than trusting one output blindly." },
        { text: 'You must have typed the prompt differently the second time', correct: false, feedback: 'Even a truly identical prompt can produce a different answer — that is just how these tools work.' },
        { text: 'Only paid AI tools are reliable enough to trust', correct: false, feedback: 'Pricing tier has nothing to do with this kind of variation.' }
      ]
    },
    {
      prompt: "You want to compare two AI tools to decide which is better for writing customer emails. What's the fairest way to test them?",
      options: [
        { text: 'Try each one once and pick whichever sounds nicer to you', correct: false, feedback: 'One try each, judged only on feel, will not reliably tell you which is actually better.' },
        { text: 'Give both the same set of real example tasks, judge the results against clear criteria, and compare', correct: true, feedback: 'Right — the same real tasks and clear, consistent criteria are what make a comparison fair and useful.' },
        { text: "Just use whichever tool the company already pays for", correct: false, feedback: 'That answers a cost question, not which tool actually performs better.' },
        { text: 'Ask each AI tool which one is better', correct: false, feedback: 'An AI tool judging its own competition is not a reliable test.' }
      ]
    }
  ],
  intermediate: [
    {
      prompt: 'You want an AI tool to summarise a 40-page contract without missing key risks. What should you do first?',
      options: [
        { text: 'Paste the whole contract in and just ask it to "summarise this"', correct: false, feedback: "A vague instruction gets a vague summary — it won't know which risks matter to you." },
        { text: 'Tell it exactly what to look for first — for example payment terms, liability, and termination clauses', correct: true, feedback: 'Right — giving AI a clear goal and specific things to check produces a far more useful summary than a vague instruction.' },
        { text: 'Ask it to summarise the contract in one sentence', correct: false, feedback: 'A one-sentence summary of a 40-page contract will lose the detail you actually need.' },
        { text: 'Convert the file to a picture first', correct: false, feedback: 'This makes the text harder for the AI to read, not easier.' }
      ]
    },
    {
      prompt: 'You ask an AI to write a customer apology email, but the tone comes out too casual. What is the best next step?',
      options: [
        { text: 'Give up and write the whole thing yourself', correct: false, feedback: "The tone can be fixed with a clearer instruction — there's no need to start from scratch." },
        { text: "Tell the AI specifically what tone you want (for example 'formal, apologetic, no jokes') and ask it to rewrite", correct: true, feedback: 'Right — being specific about tone is usually all it takes to get a much better result on the next try.' },
        { text: 'Ask it a completely unrelated question to reset it', correct: false, feedback: "An unrelated question won't change how it approaches the email." },
        { text: 'Accept the casual version since tone cannot be controlled', correct: false, feedback: 'Tone is one of the easiest things to control with a clear instruction.' }
      ]
    },
    {
      prompt: "You're using AI to help draft a report, and it includes a statistic that sounds real but isn't in any of your source material. What should you do?",
      options: [
        { text: 'Keep it, since it sounds convincing', correct: false, feedback: 'How convincing something sounds says nothing about whether it is actually true.' },
        { text: 'Remove it and only keep facts you can trace back to your actual source material', correct: true, feedback: 'Right — anything you cannot trace back to a real source should not go in the report.' },
        { text: 'Ask the AI if it is sure, and trust whatever it says', correct: false, feedback: "Asking an AI to confirm its own made-up fact doesn't make it any more reliable." },
        { text: 'Round the number to make it sound more careful', correct: false, feedback: 'Rounding a made-up number does not make it a real one.' }
      ]
    },
    {
      prompt: "You want AI to help you compare three suppliers' quotes. What will get you the most useful comparison?",
      options: [
        { text: 'Paste all three quotes in and ask "what do you think?"', correct: false, feedback: 'A vague question like this gives the AI no criteria to compare against.' },
        { text: 'Tell it exactly what to compare — price, delivery time, and terms — and ask for the results side by side', correct: true, feedback: 'Right — naming the specific things to compare gets you a clear, useful side-by-side result.' },
        { text: 'Ask it to pick only the cheapest one', correct: false, feedback: 'Price alone ignores delivery time and terms, which usually matter too.' },
        { text: 'Ask it to summarise each quote in one word', correct: false, feedback: 'One word per quote loses the detail needed to actually compare them.' }
      ]
    }
  ],
  basic: [
    {
      prompt: 'Which of these is the safest way to use AI with sensitive customer information?',
      options: [
        { text: 'Paste customer names, emails and payment details in directly to save time', correct: false, feedback: 'Sensitive details can end up stored or used by the AI tool — this is the risky option, not the safe one.' },
        { text: 'Remove or replace sensitive details before pasting anything into an AI tool', correct: true, feedback: 'Correct — taking sensitive details out first is the safe approach, since you cannot always control what an AI tool does with what you type.' },
        { text: 'Only use AI with customer data on weekends', correct: false, feedback: 'The day of the week makes no difference to what happens to the data.' },
        { text: 'Ask the AI to "keep this confidential" in the prompt', correct: false, feedback: "Asking it to 'keep something confidential' doesn't actually control how the tool stores or uses what you typed." }
      ]
    },
    {
      prompt: "You're not sure whether something you typed into an AI tool could be seen or stored by that company. What's the safest approach?",
      options: [
        { text: 'Assume it stays private and type anything', correct: false, feedback: 'Assuming privacy without checking is exactly how sensitive details end up somewhere they should not be.' },
        { text: 'Treat anything you type as something that might be stored, and avoid putting in sensitive information', correct: true, feedback: 'Correct — treating everything you type as potentially stored is the safe default.' },
        { text: 'Only worry about it if you are using a free plan', correct: false, feedback: 'Plan tier is not a reliable guide to what happens with your data.' },
        { text: 'It does not matter, all AI tools work the same way', correct: false, feedback: 'Different tools have different data policies — it always matters.' }
      ]
    },
    {
      prompt: 'An AI gives you an answer that looks useful for a work task. What should you do before relying on it fully?',
      options: [
        { text: 'Use it immediately without checking anything', correct: false, feedback: 'Using it straight away skips the one step that catches mistakes.' },
        { text: 'Quickly check that it makes sense and is accurate for your situation', correct: true, feedback: 'Right — a quick sense-check before relying on it is the safe habit.' },
        { text: 'Only check it if it looks obviously wrong', correct: false, feedback: 'Not every mistake looks obviously wrong — some sound completely reasonable.' },
        { text: 'Assume it is correct because it sounds confident', correct: false, feedback: 'Confidence in an AI answer says nothing about whether it is actually correct.' }
      ]
    },
    {
      prompt: "What's the best reason to double-check an AI's output before sending it to a customer?",
      options: [
        { text: 'AI can sound confident even when it is inaccurate or has made something up', correct: true, feedback: 'Exactly — confident wording is not proof of accuracy, which is why a check matters.' },
        { text: 'AI always uses bad grammar', correct: false, feedback: 'Grammar is not usually the issue, and this is not a reliable reason.' },
        { text: 'Customers dislike anything written with AI', correct: false, feedback: "This isn't about how the email was written — it's about whether it's accurate." },
        { text: 'It takes too long to write without AI', correct: false, feedback: 'This is a reason to use AI, not a reason to double-check it.' }
      ]
    }
  ]
};

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
      question: 'AI gives a confident answer about Oryx\'s policy. Why might it still be wrong?',
      options: [
        { text: 'AI always knows our company policies', correct: false, feedback: 'AI has no automatic access to Oryx\'s real policies.' },
        { text: 'It has no access to real policies unless it\'s told them', correct: true, feedback: 'Right — a confident answer isn\'t proof it saw the real policy.' },
        { text: 'AI only knows about IT topics', correct: false, feedback: 'AI can be asked about anything — the issue is it wasn\'t given the real policy.' },
        { text: 'The question was asked rudely', correct: false, feedback: 'Tone doesn\'t affect accuracy — missing information does.' }
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
      question: 'AI answers instantly and confidently. What does that tell you?',
      options: [
        { text: 'The answer is definitely correct', correct: false, feedback: 'Confident wording doesn\'t guarantee accuracy.' },
        { text: 'Nothing about accuracy — it\'s just a fluent-sounding reply', correct: true, feedback: 'Right — checking still matters for facts you\'ll rely on.' },
        { text: 'The answer must be false', correct: false, feedback: 'Confidence isn\'t proof either way.' },
        { text: 'AI is joking with you', correct: false, feedback: 'AI is trying to help, not joke — but that doesn\'t mean it\'s accurate.' }
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
      question: 'AI\'s first reply is too long. What\'s the best next step?',
      options: [
        { text: 'Start a brand new conversation', correct: false, feedback: 'The current chat already has the context — no need to restart.' },
        { text: 'Reply and ask for a shorter version', correct: true, feedback: 'Right — you can keep refining the same conversation.' },
        { text: 'Accept it and just skim it', correct: false, feedback: 'Asking for a shorter version takes seconds and gets you what you need.' },
        { text: 'Assume AI can\'t do summaries', correct: false, feedback: 'AI handles summaries well — it just needed a follow-up.' }
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
      question: 'Which prompt is most likely to get a useful reply?',
      options: [
        { text: '"Write something."', correct: false, feedback: 'No task, audience, or tone — AI has to guess everything.' },
        { text: '"Email."', correct: false, feedback: 'One word gives AI nothing to work with.' },
        { text: '"Write a short, friendly thank-you email to a first-time customer."', correct: true, feedback: 'This gives the task, tone, length, and audience.' },
        { text: '"Do the email thing we discussed."', correct: false, feedback: 'AI has no memory of a chat you haven\'t shown it.' }
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
      question: 'AI gives an exact live warehouse stock count. What should you do?',
      options: [
        { text: 'Trust it completely', correct: false, feedback: 'AI has no live connection to your stock system.' },
        { text: 'Check it against the real stock system first', correct: true, feedback: 'Right — live, exact data needs verifying at the source.' },
        { text: 'Never use AI for anything again', correct: false, feedback: 'That overcorrects — AI is still great for drafting and brainstorming.' },
        { text: 'Ask AI the same question again', correct: false, feedback: 'Asking again won\'t fix it — AI still can\'t see the real system.' }
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
      question: 'You ask AI about some notes and get a long, unfocused reply. Why?',
      options: [
        { text: 'AI can\'t handle notes at all', correct: false, feedback: 'AI handles notes well — this is a prompting issue.' },
        { text: 'No audience or format was given', correct: true, feedback: 'Right — without that, AI has to guess and often over-explains.' },
        { text: 'The notes were too short', correct: false, feedback: 'Short notes can still get a clear answer with the right prompt.' },
        { text: 'The notes were handwritten', correct: false, feedback: 'That\'s not the issue — the notes were already typed.' }
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
      question: 'AI\'s reply is accurate but too formal for a quick message. What\'s best?',
      options: [
        { text: 'Send it as-is', correct: false, feedback: 'Tone matters too, and this is an easy fix.' },
        { text: 'Start a brand new prompt from scratch', correct: false, feedback: 'The conversation already has the context — a quick follow-up is faster.' },
        { text: 'Ask AI to make it more casual', correct: true, feedback: 'Right — one short follow-up fixes the tone.' },
        { text: 'Rewrite it yourself instead', correct: false, feedback: 'That throws away a useful draft — refining it is quicker.' }
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
      question: 'A colleague wants to paste a customer\'s bank details into AI for a quick draft. What should they do?',
      options: [
        { text: 'Paste it anyway — it\'s just a draft', correct: false, feedback: 'Private financial details need approval first, draft or not.' },
        { text: 'Draft the email without the sensitive details', correct: true, feedback: 'Right — AI can help with the wording without seeing private data.' },
        { text: 'Never use AI for anything customer-related', correct: false, feedback: 'That overcorrects — the issue is specifically private financial details.' },
        { text: 'Ask AI if it\'s safe to share', correct: false, feedback: 'AI can\'t confirm your company\'s own data rules.' }
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
      question: 'Which prompt has the strongest structure?',
      options: [
        { text: '"Write a short customer reply using these notes. Be warm and end with the next step."', correct: true, feedback: 'This covers task, background, rules, and format.' },
        { text: '"Reply."', correct: false, feedback: 'No background, rules, or format — AI has to guess.' },
        { text: '"Make this good."', correct: false, feedback: '"Good" isn\'t a rule AI can act on.' },
        { text: '"Customer email please."', correct: false, feedback: 'Names a topic only — far too little to work with.' }
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
      question: 'A colleague asks AI to "write a firm reminder email" with no other details. What\'s missing?',
      options: [
        { text: 'Nothing — it\'s already clear', correct: false, feedback: 'The instruction is clear, but there\'s no context about who or what.' },
        { text: 'Who it\'s for and what they\'re being reminded about', correct: true, feedback: 'Right — without that, AI has to invent a scenario.' },
        { text: 'A funnier tone', correct: false, feedback: 'Tone isn\'t the issue — background information is.' },
        { text: 'A longer word count', correct: false, feedback: 'Length isn\'t the problem — the missing background is.' }
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
      question: 'AI says a contract\'s payment deadline is "30 days." What should you do first?',
      options: [
        { text: 'Repeat it as fact straight away', correct: false, feedback: 'Numbers pulled by AI can be misread — check first.' },
        { text: 'Open the contract and confirm it yourself', correct: true, feedback: 'Right — always verify dates and numbers against the source.' },
        { text: 'Ask a different AI tool the same thing', correct: false, feedback: 'A second AI tool has the same limitation.' },
        { text: 'Ignore the summary and never use AI for documents', correct: false, feedback: 'That overcorrects — just verify the details that matter.' }
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
        { text: 'Letting AI approve spending on its own', correct: false, feedback: 'Spending decisions need a person\'s judgement and authority.' },
        { text: 'Using AI for a first draft, then checking it yourself', correct: true, feedback: 'Right — fast draft, person stays in control of the result.' },
        { text: 'Using AI for every task, even quick ones', correct: false, feedback: 'That adds a step rather than saving time.' },
        { text: 'Skipping checks to finish faster', correct: false, feedback: 'That trades accuracy for speed — not a safe trade.' }
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
      question: 'Your advanced prompt worked on the first test. What should you do next?',
      options: [
        { text: 'Assume it\'s finished', correct: false, feedback: 'One successful test doesn\'t confirm it\'s reliable.' },
        { text: 'Test it against a few more real examples', correct: true, feedback: 'Right — testing across situations catches hidden gaps.' },
        { text: 'Make the prompt even longer', correct: false, feedback: 'Length alone doesn\'t improve reliability.' },
        { text: 'Remove the rules so it answers faster', correct: false, feedback: 'The rules are what keep the output safe and consistent.' }
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
      question: 'Why break a large AI task into smaller steps?',
      options: [
        { text: 'To make the work take longer', correct: false, feedback: 'Smaller steps usually make problems faster to catch, not slower.' },
        { text: 'Each part is easier to guide, check, and fix', correct: true, feedback: 'Right — it\'s clear who owns each part and where to look.' },
        { text: 'To remove the need to check anything', correct: false, feedback: 'It actually makes checking easier and more targeted.' },
        { text: 'To hide which step caused a mistake', correct: false, feedback: 'The opposite — it makes mistakes easier to trace.' }
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
      question: 'AI sends complaint replies automatically with no review. What\'s the main risk?',
      options: [
        { text: 'It will be too slow', correct: false, feedback: 'Sending immediately is fast — that\'s actually the problem.' },
        { text: 'A bad reply could reach a customer with no chance to catch it', correct: true, feedback: 'Right — high-impact actions need a human check first.' },
        { text: 'AI can\'t draft complaint replies at all', correct: false, feedback: 'AI drafts these well — the issue is skipping review.' },
        { text: 'It will use too much electricity', correct: false, feedback: 'That\'s not the relevant risk here.' }
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
      question: 'A team wants an AI agent that\'s "fully automatic" with no human involved. What\'s the concern?',
      options: [
        { text: 'Agents can\'t handle orders at all', correct: false, feedback: 'Agents can handle this well — the concern is oversight.' },
        { text: 'No one can catch mistakes before they affect a real order', correct: true, feedback: 'Right — even a good agent needs a person checking important actions.' },
        { text: 'It will make the agent too slow', correct: false, feedback: 'A quick approval step isn\'t a speed problem.' },
        { text: 'Agents aren\'t allowed to use tools', correct: false, feedback: 'Using tools is the point — the issue is oversight.' }
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
      question: 'A supplier wants full access to Oryx\'s customer database "to make things easier." What\'s the concern?',
      options: [
        { text: 'Full access is always fine if it\'s convenient', correct: false, feedback: 'Convenience doesn\'t outweigh the risk of broader access.' },
        { text: 'Access should be scoped to only what\'s needed', correct: true, feedback: 'Right — limiting scope limits the impact of any problem.' },
        { text: 'APIs can only share one thing at a time', correct: false, feedback: 'That\'s not a real limit — scoping access is the real issue.' },
        { text: 'Suppliers should never get any access', correct: false, feedback: 'Scoped, appropriate access for a real need is fine.' }
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
      question: 'An automation only plans for the normal path, not missing information. What\'s the risk?',
      options: [
        { text: 'It will simply run slower', correct: false, feedback: 'Speed isn\'t the issue — the missing case is.' },
        { text: 'It may send an incorrect result when information is missing', correct: true, feedback: 'Right — a defined error path matters, not just the happy path.' },
        { text: 'AI can\'t be used in automations at all', correct: false, feedback: 'AI suits automations well — the design is missing an error path.' },
        { text: 'The automation will stop working entirely', correct: false, feedback: 'The bigger risk is pushing ahead with a wrong result, not stopping.' }
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
      question: 'A manager wants to "find a use" for a new AI tool across the department right away. What should happen first?',
      options: [
        { text: 'Roll it out to everyone immediately', correct: false, feedback: 'That skips the steps that catch issues early and cheaply.' },
        { text: 'Find a real problem it solves and test with a small group', correct: true, feedback: 'Right — start from a real need, then test small before scaling.' },
        { text: 'Buy more AI tools to compare', correct: false, feedback: 'That doesn\'t replace defining the actual problem first.' },
        { text: 'Ask AI whether it should be implemented', correct: false, feedback: 'That\'s a business decision, not one AI can make for you.' }
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
      question: 'A policy assistant is asked a question with no matching policy on file. What should it do?',
      options: [
        { text: 'Guess an answer so the user gets something', correct: false, feedback: 'A confident guess with no real policy behind it can mislead people.' },
        { text: 'Say no match was found and suggest checking with a person', correct: true, feedback: 'Right — a good system is honest about what it doesn\'t know.' },
        { text: 'Refuse to answer any more questions', correct: false, feedback: 'That overcorrects — it should still help where it can.' },
        { text: 'Make up a plausible-sounding policy', correct: false, feedback: 'This is exactly the risk a good design avoids.' }
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
