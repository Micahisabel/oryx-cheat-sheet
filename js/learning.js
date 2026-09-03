// ============================================================================
// AI Learning — gamified skill assessment + personalized training
// ============================================================================
// State machine: onboarding -> assessment (adaptive) -> results -> dashboard
// -> lesson (learn/practice/quiz) -> back to dashboard. All content/scoring
// config lives in js/learning-data.js — this file is rendering + flow only.
// ============================================================================

// Pre-multi-account fix, progress was saved under this one shared key for
// every signed-in user on the browser — migrated into the uid-scoped key
// below the first time any account loads with nothing under its own key yet.
const LEARNING_LEGACY_STORAGE_KEY = 'oryx-ai-learning-progress';
const LEARNING_STORAGE_PREFIX = 'oryx-ai-learning-progress:';
const learningRoot = document.getElementById('learningRoot');
const viewLearning = document.getElementById('view-learning');
const viewNotes = document.getElementById('view-notes');
const openLearningNavBtn = document.getElementById('openLearningNav');

let learningScreen = 'onboarding'; // onboarding | department | assessment | results | dashboard | lesson
let progress = null;              // the learner's saved progress object
let learningUnsub = null;         // Firestore snapshot unsubscribe
let learningLastUid = null;       // uid the in-memory `progress` currently belongs to

// ---- Assessment run state (not persisted — only the final result is saved) ----
let assessment = null; // { index, answers:[], selected:[] } — selected is the in-progress multi-select state

// ---- Dashboard sub-navigation ----
let dashboardTab = 'overview'; // overview | path | achievements
let reviewLevel = null;        // level being viewed in the Learning Path tab

// ---- Active lesson session ----
let activeLesson = null; // { levelKey, lessonId, step: 'learn'|'practice'|'quiz'|'done', wrongAttempt:false }

// ---- Active level-up challenge session (transient — only the submitted attempt is persisted) ----
let activeChallenge = null; // { levelKey, evidenceType:'file'|'link', file:null, link:'', explanation:'' }

// ---------------------------------------------------------------------------
// Progress persistence (localStorage always; Firestore best-effort per user)
// ---------------------------------------------------------------------------
function defaultProgress(){
  return {
    assessmentResult: null,       // { level, score, known:[], gaps:[], gapCategories:[] }
    assessmentDate: null,         // ISO date string of the most recent assessment
    assessmentHistory: [],        // [{ level, score, date, gaps, gapCategories }] — appended, never overwritten
    currentLevel: null,
    xp: 0,
    completedLessons: [],
    pathCompleted: {},
    badges: [],
    perfectQuizzes: 0,
    streak: 0,
    lastActiveDate: null,
    resourceProgress: {},         // { [entryId]: { status:'in-progress'|'completed', startedAt, completedAt, quizPassed } }
    department: null,             // one of LIBRARY_DEPARTMENTS, or null until self-selected
    userEmail: null,              // mirrored from firebase.auth() so the admin dashboard can label rows
    userName: null,               // mirrored from firebase.auth() (display name, if set) so reports can show a real name
    levelChallenges: {},          // { [levelKey]: { status:'submitted'|'passed'|'needs_improvement', attempts:[{submittedAt,evidenceType,evidenceUrl,evidenceFileName,explanation,reviewedAt,reviewedBy,reviewStatus,reviewNote}] } } — see CHALLENGE_LIBRARY in learning-data.js
    activityDates: [],            // rolling log of 'YYYY-MM-DD' days the learner was active, trimmed to the last 90 — powers the ranking system's consistency score (see bumpStreak())
    progressHistory: [],          // [{date, xp, completedLessonsCount, score}] — capped snapshot log powering the personal progress graph
    rankingScore: null,           // 0-100, written only by the scheduled ranking job — null/"Not available" until enough data exists. Never set this from client code.
    rank: null,                   // "#N of Total" position, written only by the scheduled ranking job
    rankTotal: null,
    currentAchievements: [],      // comparative achievement IDs (Champion, Most Improved, etc.) for the current period — written only by the scheduled ranking job
    lastReminderSentAt: null      // ISO date — written only by the scheduled ranking job, prevents duplicate inactivity reminders
  };
}

// Appends today (if not already the most recent entry) to the rolling activity
// log used by the ranking system's consistency score, trimmed to the last 90
// days so the array never grows unbounded for long-tenured users.
function logActivityDate(dateStr){
  progress.activityDates = progress.activityDates || [];
  if(progress.activityDates[progress.activityDates.length - 1] !== dateStr){
    progress.activityDates = progress.activityDates.concat(dateStr).slice(-90);
  }
}

// Appends a snapshot to the personal progress graph, capped at 52 points
// (roughly a year of weekly-ish activity) so the array stays small.
function logProgressSnapshot(){
  progress.progressHistory = progress.progressHistory || [];
  progress.progressHistory = progress.progressHistory.concat({
    date: new Date().toISOString(),
    xp: progress.xp || 0,
    completedLessonsCount: (progress.completedLessons || []).length,
    score: progress.assessmentResult ? progress.assessmentResult.score : null
  }).slice(-52);
}

// Every signed-in user gets their own localStorage key (oryx-ai-learning-progress:{uid})
// so two accounts signed into the same browser never see each other's assessment
// result, XP, or lessons — only Firestore (per-uid by design) is shared infrastructure.
function learningStorageKey(uid){
  return uid ? (LEARNING_STORAGE_PREFIX + uid) : null;
}

function loadLocalProgress(){
  const user = firebase.auth().currentUser;
  const key = learningStorageKey(user && user.uid);
  if(!key) return defaultProgress();
  try{
    let raw = localStorage.getItem(key);
    if(!raw){
      // One-time migration: adopt whatever was under the old shared key, then
      // clear it so no other account can inherit it after this.
      const legacy = localStorage.getItem(LEARNING_LEGACY_STORAGE_KEY);
      if(legacy){
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEARNING_LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    if(!raw) return defaultProgress();
    return Object.assign(defaultProgress(), JSON.parse(raw));
  }catch(e){ return defaultProgress(); }
}

function saveProgress(){
  const user = firebase.auth().currentUser;
  if(user && progress){
    progress.userEmail = user.email || null;
    progress.userName = user.displayName || null; // mirrored so the admin table/reports can show a real name instead of just an email
  }
  const key = learningStorageKey(user && user.uid);
  if(key){ try{ localStorage.setItem(key, JSON.stringify(progress)); }catch(e){} }
  if(user && typeof learningCollection !== 'undefined'){
    learningCollection.doc(user.uid).set(progress, { merge: false }).catch(() => {
      // Best-effort — if the learningProgress/{uid} Firestore rule isn't published yet,
      // localStorage still works as the fallback source of truth for this browser.
    });
  }
}

// Makes sure the in-memory `progress` object actually belongs to whoever is
// currently signed in — reloads it whenever the signed-in account changes.
function ensureProgressForCurrentUser(){
  const user = firebase.auth().currentUser;
  if(!user){ learningLastUid = null; progress = null; return; }
  if(progress && learningLastUid === user.uid) return;
  learningLastUid = user.uid;
  progress = loadLocalProgress();
  subscribeLearningProgress();
}

function bumpStreak(){
  const today = new Date().toISOString().slice(0, 10);
  if(progress.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  progress.streak = (progress.lastActiveDate === yesterday) ? (progress.streak || 0) + 1 : 1;
  progress.lastActiveDate = today;
  logActivityDate(today);
}

function awardXp(amount){
  progress.xp = (progress.xp || 0) + amount;
}

function applyNewBadges(){
  const fresh = checkNewBadges(progress);
  if(fresh.length){
    progress.badges = (progress.badges || []).concat(fresh);
  }
  return fresh;
}

// ---------------------------------------------------------------------------
// Entry / exit
// ---------------------------------------------------------------------------
// Resolves once the Hub's entries have loaded (needed for recommendations),
// or after a short timeout so a genuinely empty/slow Hub never blocks entry.
function waitForEntries(maxWaitMs = 4000){
  return new Promise((resolve) => {
    const start = (typeof performance !== 'undefined' ? performance.now() : 0);
    (function check(){
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : 0) - start;
      if((typeof entries !== 'undefined' && entries.length > 0) || elapsed > maxWaitMs) return resolve();
      setTimeout(check, 150);
    })();
  });
}

function renderLearningLoading(){
  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-loading">
      <div class="lrn-loading-badge"><img src="assets/images/mascot/cat-sleepy.png" alt="Ginger sleeping"></div>
      <div class="lrn-loading-text">Just a moment — getting things ready…</div>
    </div>`;
}

async function enterLearning(){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitLearningAdminMode === 'function') exitLearningAdminMode();
  if(typeof exitSettingsMode === 'function') exitSettingsMode();
  document.querySelectorAll('.platform-item.active, .sidebar-analytics-item.active').forEach(b => b.classList.remove('active'));
  if(openLearningNavBtn) openLearningNavBtn.classList.add('active');
  viewNotes.classList.remove('active');
  viewLearning.classList.add('active');

  if(typeof entries === 'undefined' || entries.length === 0){
    renderLearningLoading();
    await waitForEntries();
  }

  ensureProgressForCurrentUser();
  bumpStreak();
  applyNewBadges();
  saveProgress();
  learningScreen = progress.assessmentResult ? 'dashboard' : 'onboarding';
  renderLearning();
}

function exitLearningView(){
  viewLearning.classList.remove('active');
  viewNotes.classList.add('active');
  if(openLearningNavBtn) openLearningNavBtn.classList.remove('active');
  if(typeof repositionAllTabIndicators === 'function') repositionAllTabIndicators();
}

function subscribeLearningProgress(){
  const user = firebase.auth().currentUser;
  if(!user || typeof learningCollection === 'undefined') return;
  if(learningUnsub) learningUnsub();
  learningUnsub = learningCollection.doc(user.uid).onSnapshot((doc) => {
    if(doc.exists){
      // Firestore is the cross-device source of truth once the rule allows it;
      // merge onto defaults so a partially-shaped remote doc never breaks the UI.
      progress = Object.assign(defaultProgress(), doc.data());
      const key = learningStorageKey(user.uid);
      if(key){ try{ localStorage.setItem(key, JSON.stringify(progress)); }catch(e){} }
      if(learningScreen !== 'assessment') renderLearning();
    }
  }, () => { /* no rule yet, or offline — keep using localStorage silently */ });
}

if(openLearningNavBtn) openLearningNavBtn.addEventListener('click', enterLearning);

const headerLogo = document.getElementById('headerLogo');
if(headerLogo) headerLogo.addEventListener('click', () => {
  if(viewLearning.classList.contains('active')) exitLearningView();
});

// ---------------------------------------------------------------------------
// Render dispatch
// ---------------------------------------------------------------------------
function renderLearning(){
  if(learningScreen === 'onboarding') return renderOnboarding();
  if(learningScreen === 'department') return renderDepartmentScreen();
  if(learningScreen === 'assessment') return renderAssessment();
  if(learningScreen === 'results') return renderResults();
  if(learningScreen === 'dashboard') return renderDashboard();
  if(learningScreen === 'lesson') return renderLesson();
  if(learningScreen === 'challenge') return renderChallenge();
}

function topbar({ showProgress = null, showBackToApp = true } = {}){
  const xp = (progress && progress.xp) || 0;
  const lvl = learnerLevelFromXp(xp);
  const streakHtml = progress && progress.streak > 1
    ? `<span class="lrn-streak" title="You've come back to learn ${progress.streak} days in a row.">🔥 ${progress.streak}-day streak</span>` : '';
  return `
    <div class="lrn-topbar">
      ${showBackToApp ? `<button class="lrn-icon-btn" id="lrnExitBtn" aria-label="Back to Knowledge Hub">&larr;</button>` : '<span></span>'}
      ${showProgress !== null ? `<div class="lrn-progress-track"><div class="lrn-progress-fill" style="width:${showProgress}%"></div></div>` : '<div></div>'}
      <div class="lrn-topbar-stats">${streakHtml}<span class="lrn-xp-pill" title="You earn points by finishing lessons. Every 200 points, your level goes up.">⭐ ${xp} points · Level ${lvl}</span></div>
    </div>`;
}

function bindTopbar(onBack){
  const exitBtn = document.getElementById('lrnExitBtn');
  if(exitBtn) exitBtn.addEventListener('click', onBack || exitLearningView);
}

// ---------------------------------------------------------------------------
// 1. Onboarding
// ---------------------------------------------------------------------------
function renderOnboarding(){
  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-onboarding">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-hero">
        <div class="lrn-greeting-bubble">Hi there! I'm Ginger 👋</div>
        <div class="lrn-hero-badge"><img src="assets/images/mascot/cat-sunglasses.png" alt="Ginger the cat"></div>
        <h2>Let's find your AI level</h2>
        <p class="lrn-hero-sub">Answer a few quick questions to discover where you are on your AI learning journey. Don't worry — there are no wrong answers.</p>
        <button class="lrn-btn-primary" id="lrnStartAssessment">Start Assessment</button>
      </div>
    </div>`;
  bindTopbar();
  document.getElementById('lrnStartAssessment').addEventListener('click', startAssessment);
}

// ---------------------------------------------------------------------------
// 2. Assessment — fixed 5 questions (2 of them multi-select), not adaptive.
// Level is never decided by question 1 alone: every question is weighted
// (see ASSESSMENT_QUESTIONS[].weight in learning-data.js) and combined into
// one 0-100 score, with "what can you actually do" counting for the most.
// ---------------------------------------------------------------------------
function startAssessment(){
  // Ask which department someone's in before the assessment itself, so both
  // the assessment's framing and the resources/topics recommended afterward
  // can be tailored to their role — asked once, then reused on every retake.
  if(!progress.department){
    learningScreen = 'department';
    renderLearning();
    return;
  }
  beginAssessmentQuestions();
}

function beginAssessmentQuestions(){
  assessment = { index: 0, answers: [], selected: [] };
  learningScreen = 'assessment';
  renderLearning();
}

// ---------------------------------------------------------------------------
// 1b. Department (asked once, before the first assessment)
// ---------------------------------------------------------------------------
function renderDepartmentScreen(){
  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-onboarding">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-hero">
        <div class="lrn-greeting-bubble">One quick thing first 👋</div>
        <div class="lrn-hero-badge"><img src="assets/images/mascot/cat-sunglasses.png" alt="Ginger the cat"></div>
        <h2>Which department are you in?</h2>
        <p class="lrn-hero-sub">This helps us show you AI resources and learning topics that are actually relevant to your role, instead of a generic list.</p>
        <div class="lrn-dept-picker">
          <select class="filter-select" id="lrnDeptSelectPre">
            <option value="">Choose your department…</option>
            ${LIBRARY_DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
          </select>
        </div>
        <button class="lrn-btn-primary" id="lrnDeptContinue" disabled>Continue</button>
        <button class="lrn-btn-text" id="lrnDeptSkip">Skip for now</button>
      </div>
    </div>`;
  bindTopbar();
  const select = document.getElementById('lrnDeptSelectPre');
  const continueBtn = document.getElementById('lrnDeptContinue');
  select.addEventListener('change', () => { continueBtn.disabled = !select.value; });
  continueBtn.addEventListener('click', () => {
    progress.department = select.value;
    saveProgress();
    beginAssessmentQuestions();
  });
  document.getElementById('lrnDeptSkip').addEventListener('click', beginAssessmentQuestions);
}

// Retaking keeps XP, completed lessons, and badges — only the assessment result
// (and the current level it points to) gets overwritten once the retake finishes.
function retakeAssessment(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitLearningAdminMode === 'function') exitLearningAdminMode();
  viewNotes.classList.remove('active');
  viewLearning.classList.add('active');
  startAssessment();
}

function renderAssessment(){
  const total = ASSESSMENT_QUESTIONS.length;
  if(assessment.index >= total){ return finishAssessment(); }
  const question = ASSESSMENT_QUESTIONS[assessment.index];

  // If they've been here before (came back via the back arrow), restore
  // whatever they'd picked so a stray click is easy to see and fix, instead
  // of wiping it and forcing them to redo the question from scratch.
  const prevAnswer = assessment.answers.find(a => a.questionId === question.id);
  assessment.selected = prevAnswer ? prevAnswer.optionIndexes.slice() : [];
  assessment.otherDetail = (prevAnswer && typeof prevAnswer.otherDetail === 'string') ? prevAnswer.otherDetail : '';

  const detailOpt = question.options.find(o => o.requiresDetail);
  const detailIndex = detailOpt ? question.options.indexOf(detailOpt) : -1;
  const detailNeeded = detailIndex !== -1 && assessment.selected.includes(detailIndex);
  const detailFilled = !detailNeeded || assessment.otherDetail.trim().length > 0;
  const initialDisabled = assessment.selected.length === 0 || !detailFilled;

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-assessment">
      ${topbar({ showProgress: Math.round((assessment.index / total) * 100) })}
      <div class="lrn-q-meta">Question ${assessment.index + 1} of ${total}</div>
      <div class="lrn-q-card">
        <div class="lrn-q-mascot"><img src="assets/images/mascot/cat-sunglasses.png" alt="Ginger the cat"></div>
        <div class="lrn-q-bubble">
          ${escapeHtml(question.prompt)}
          ${question.helper ? `<div class="lrn-q-helper">${escapeHtml(question.helper)}</div>` : ''}
        </div>
      </div>
      <div class="lrn-options ${question.multi ? 'lrn-options-multi' : ''}">
        ${question.options.map((opt, i) => `
          <button class="lrn-option-btn ${assessment.selected.includes(i) ? 'selected' : ''}" data-i="${i}">${escapeHtml(opt.text)}</button>
        `).join('')}
      </div>
      ${detailOpt ? `
        <div class="lrn-other-detail" id="lrnOtherDetail" style="display:${detailNeeded ? 'block' : 'none'};">
          <label for="lrnOtherDetailInput">Please specify</label>
          <input type="text" id="lrnOtherDetailInput" class="lrn-other-detail-input" placeholder="e.g. Perplexity, Grok…" value="${escapeHtml(assessment.otherDetail)}">
        </div>` : ''}
      ${question.multi ? `<button class="lrn-btn-primary" id="lrnMultiContinue" ${initialDisabled ? 'disabled' : ''}>Continue</button>` : ''}
    </div>`;
  bindTopbar(() => goToPreviousAssessmentQuestion());

  if(question.multi){
    const continueBtn = document.getElementById('lrnMultiContinue');
    learningRoot.querySelectorAll('.lrn-option-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleMultiOption(question, Number(btn.dataset.i), continueBtn));
    });
    const detailInput = document.getElementById('lrnOtherDetailInput');
    if(detailInput){
      detailInput.addEventListener('input', () => {
        assessment.otherDetail = detailInput.value;
        updateMultiContinueState(question, continueBtn);
      });
    }
    continueBtn.addEventListener('click', () => answerAssessmentQuestion(question, assessment.selected));
  }else{
    learningRoot.querySelectorAll('.lrn-option-btn').forEach(btn => {
      btn.addEventListener('click', () => answerAssessmentQuestion(question, [Number(btn.dataset.i)]));
    });
  }
}

// Steps back one question so an accidental click can be corrected — the
// answer already given for that question (if any) is restored on re-render
// (see renderAssessment's prevAnswer lookup), not just cleared. On question 1
// there's nothing to go back to, so it returns to the onboarding screen instead.
function goToPreviousAssessmentQuestion(){
  if(assessment.index === 0){
    learningScreen = 'onboarding';
    renderLearning();
    return;
  }
  assessment.index -= 1;
  renderLearning();
}

function toggleMultiOption(question, i, continueBtn){
  const opt = question.options[i];
  const isSelected = assessment.selected.includes(i);

  if(opt.selectAll){
    // "All of the above" is a shortcut that selects every real, named option
    // (not "Other" — that still needs its own detail — and not "None").
    const realIndexes = question.options
      .map((o, idx) => idx)
      .filter(idx => question.options[idx].isTool && !question.options[idx].requiresDetail);
    assessment.selected = isSelected ? [] : realIndexes.concat([i]);
  }else if(opt.exclusive){
    // Selecting an exclusive option (e.g. "None" / "I'm not sure yet") clears everything else.
    assessment.selected = isSelected ? [] : [i];
  }else{
    assessment.selected = assessment.selected.filter(idx => !question.options[idx].exclusive);
    if(isSelected) assessment.selected = assessment.selected.filter(idx => idx !== i);
    else assessment.selected.push(i);

    // Keep "All of the above" in sync: checked only while every real, named
    // option it represents is still individually selected.
    const selectAllIndex = question.options.findIndex(o => o.selectAll);
    if(selectAllIndex !== -1){
      const realIndexes = question.options
        .map((o, idx) => idx)
        .filter(idx => question.options[idx].isTool && !question.options[idx].requiresDetail);
      const allStillSelected = realIndexes.every(idx => assessment.selected.includes(idx));
      assessment.selected = assessment.selected.filter(idx => idx !== selectAllIndex);
      if(allStillSelected) assessment.selected.push(selectAllIndex);
    }
  }

  learningRoot.querySelectorAll('.lrn-option-btn').forEach((b, idx) => {
    b.classList.toggle('selected', assessment.selected.includes(idx));
  });

  const detailOpt = question.options.find(o => o.requiresDetail);
  if(detailOpt){
    const detailIndex = question.options.indexOf(detailOpt);
    const detailBlock = document.getElementById('lrnOtherDetail');
    if(detailBlock) detailBlock.style.display = assessment.selected.includes(detailIndex) ? 'block' : 'none';
  }

  updateMultiContinueState(question, continueBtn);
}

// Continue is blocked until at least one option is picked, and — if "Other"
// is one of them — until the learner has actually typed what it is.
function updateMultiContinueState(question, continueBtn){
  const detailOpt = question.options.find(o => o.requiresDetail);
  const detailIndex = detailOpt ? question.options.indexOf(detailOpt) : -1;
  const needsDetail = detailIndex !== -1 && assessment.selected.includes(detailIndex);
  const detailFilled = !needsDetail || (assessment.otherDetail || '').trim().length > 0;
  continueBtn.disabled = assessment.selected.length === 0 || !detailFilled;
}

function answerAssessmentQuestion(question, optionIndexes){
  const detailOpt = question.options.find(o => o.requiresDetail);
  const answer = { questionId: question.id, kind: question.kind || 'single', optionIndexes };
  if(detailOpt && optionIndexes.includes(question.options.indexOf(detailOpt))){
    answer.otherDetail = (assessment.otherDetail || '').trim();
  }
  assessment.answers.push(answer);
  assessment.index += 1;
  renderLearning();
}

// Combines every answer into a single 0-100 score, then works out what the
// person already demonstrated ("known") vs. what's a step above that they
// haven't claimed yet ("gaps") — driven entirely by the `capabilities`
// question, since that's the clearest signal of real demonstrated ability.
function finishAssessment(){
  const byId = {};
  assessment.answers.forEach(a => { byId[a.questionId] = a; });

  let weightedSum = 0, weightTotal = 0;
  ASSESSMENT_QUESTIONS.forEach(q => {
    const answer = byId[q.id];
    if(!answer) return;
    let questionScore = 0;
    if(q.id === 'tools-used'){
      const realTools = answer.optionIndexes.filter(i => q.options[i].isTool);
      questionScore = Math.min(100, realTools.length * 25);
    }else if(q.kind === 'capabilities'){
      const levelIndexes = answer.optionIndexes.map(i => q.options[i].levelIndex).filter(li => li >= 0);
      questionScore = levelIndexes.length ? Math.max(...levelIndexes) * 25 : 0;
    }else{
      questionScore = q.options[answer.optionIndexes[0]].points;
    }
    weightedSum += questionScore * q.weight;
    weightTotal += q.weight;
  });
  const score = Math.round(weightedSum / weightTotal);
  const level = levelFromScore(score);
  const levelIndex = LEARNING_LEVEL_ORDER.indexOf(level);

  // "What you already know" / "What you can learn next" — from the
  // capabilities question. Known = selected (real) capabilities. Gaps =
  // capabilities not selected, closest to (at-or-above) their own level first.
  const capQuestion = ASSESSMENT_QUESTIONS.find(q => q.kind === 'capabilities');
  const capAnswer = byId[capQuestion.id];
  const selectedCapIds = capAnswer ? capAnswer.optionIndexes.map(i => capQuestion.options[i].id) : [];
  const known = capQuestion.options
    .filter(o => selectedCapIds.includes(o.id) && !o.exclusive)
    .map(o => o.text);
  const gapOptions = capQuestion.options
    .filter(o => !selectedCapIds.includes(o.id) && !o.exclusive)
    .sort((a, b) => {
      const da = Math.abs(a.levelIndex - levelIndex), db = Math.abs(b.levelIndex - levelIndex);
      if(da !== db) return da - db;
      // Tie-break: prefer the next step forward over one that's actually behind them.
      return (a.levelIndex >= levelIndex ? 0 : 1) - (b.levelIndex >= levelIndex ? 0 : 1);
    });

  // Archive the previous result (if any) before overwriting it, so a retake can
  // show a before/after comparison. progress.assessmentResult itself is always
  // just "the current/latest result" — assessmentHistory is the append-only log.
  if(progress.assessmentResult){
    progress.assessmentHistory = (progress.assessmentHistory || []).concat({
      level: progress.assessmentResult.level,
      score: progress.assessmentResult.score,
      date: progress.assessmentDate,
      gaps: progress.assessmentResult.gaps,
      gapCategories: progress.assessmentResult.gapCategories
    });
  }

  const toolsAnswer = byId['tools-used'];
  progress.assessmentResult = {
    level, score,
    known: known.length ? known : ['Just getting started — no worries, that\'s what this path is for'],
    gaps: gapOptions.slice(0, 3).map(o => o.gapLabel),
    gapCategories: gapOptions.slice(0, 3).map(o => o.gapCategory).filter(Boolean),
    otherToolDetail: (toolsAnswer && toolsAnswer.otherDetail) || null
  };
  progress.currentLevel = level;
  progress.assessmentDate = new Date().toISOString();
  applyNewBadges();
  logProgressSnapshot();
  saveProgress();
  learningScreen = 'results';
  renderLearning();
}

// ---------------------------------------------------------------------------
// 3. Results
// ---------------------------------------------------------------------------
// Shown on the results screen only after a retake (assessmentHistory has at
// least one prior entry) — a plain, always-positive-or-neutral comparison
// against the immediately previous assessment. Never frames a lower score as
// a "decrease", per the org's positive-framing house style.
function assessmentCompareHtml(r){
  const history = progress.assessmentHistory || [];
  if(!history.length) return '';
  const prev = history[history.length - 1];
  const prevIndex = LEARNING_LEVEL_ORDER.indexOf(prev.level);
  const newIndex = LEARNING_LEVEL_ORDER.indexOf(r.level);
  const prevMeta = LEVEL_META[prev.level];
  const leveledUp = newIndex > prevIndex;
  return `
    <div class="lrn-compare${leveledUp ? ' lrn-compare-up' : ''}">
      ${leveledUp ? '<div class="lrn-compare-banner">🎉 Level increased!</div>' : ''}
      <div class="lrn-compare-row">
        <span class="lrn-compare-prev">${prevMeta.emoji} ${escapeHtml(prevMeta.label)} (${prev.score}%)</span>
        <span class="lrn-compare-arrow">→</span>
        <span class="lrn-compare-now">${escapeHtml(LEVEL_META[r.level].emoji)} ${escapeHtml(LEVEL_META[r.level].label)} (${r.score}%)</span>
      </div>
      ${!leveledUp ? `<p class="lrn-compare-note">Still ${escapeHtml(LEVEL_META[r.level].label)} — keep going.</p>` : ''}
    </div>`;
}

function renderResults(){
  const r = progress.assessmentResult;
  const meta = LEVEL_META[r.level];
  const firstLessonTitle = LESSON_LIBRARY[LEARNING_PATHS[r.level][0]].title;
  const cg = currentGaps();

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-results">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-results-card" style="--lrn-accent:${meta.color}">
        <div class="lrn-results-emoji">${meta.emoji}</div>
        <div class="lrn-results-label">Your AI Level</div>
        <h2>${escapeHtml(meta.label)}</h2>
        <p class="lrn-results-blurb">${escapeHtml(meta.blurb)}</p>
        <div class="lrn-score-row">
          <div class="lrn-score-track"><div class="lrn-score-fill" style="width:${r.score}%"></div></div>
          <span class="lrn-score-num">${r.score}%</span>
        </div>
      </div>
      ${assessmentCompareHtml(r)}
      <div class="lrn-results-grid">
        <div class="lrn-results-col">
          <h3>What you already know</h3>
          <ul>${r.known.map(s => `<li>✅ ${escapeHtml(s)}</li>`).join('')}</ul>
        </div>
        <div class="lrn-results-col">
          <h3>What you can learn next</h3>
          <ul>${(r.gaps && r.gaps.length ? r.gaps : ['You\'re covering a lot already — keep practicing to go deeper']).map(s => `<li>🎯 ${escapeHtml(s)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="lrn-recommend">
        <div class="lrn-recommend-label">Recommended next step</div>
        <div class="lrn-recommend-lesson">Start with <strong>${escapeHtml(firstLessonTitle)}</strong></div>
      </div>
      ${renderRecommendationsHtml(r.level, cg.gapCategories, cg.gapLabels)}
      ${!progress.department ? `
        <div class="lrn-dept-picker">
          <div class="lrn-dept-picker-label">Which department are you in? <span class="optional-tag">(optional — helps your team see how it's doing with AI)</span></div>
          <select class="filter-select" id="lrnDeptSelect">
            <option value="">Skip for now</option>
            ${LIBRARY_DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
          </select>
        </div>` : ''}
      <button class="lrn-btn-primary" id="lrnStartLearning">Start My Learning Journey</button>
    </div>`;
  bindTopbar();
  bindRecommendations(learningRoot);
  const deptSelect = document.getElementById('lrnDeptSelect');
  if(deptSelect) deptSelect.addEventListener('change', () => {
    if(deptSelect.value){ progress.department = deptSelect.value; saveProgress(); }
  });
  document.getElementById('lrnStartLearning').addEventListener('click', () => {
    learningScreen = 'dashboard';
    dashboardTab = 'overview';
    renderLearning();
  });
}

// ---------------------------------------------------------------------------
// Recommended Hub resources — real Instructions/Video/Assistants/Connectors/
// etc. entries (not the built-in lessons), matched to the learner's level via
// LEVEL_RECOMMENDED_CATEGORIES in learning-data.js. Clicking one opens the
// same entry detail page as the rest of the Knowledge Hub.
// ---------------------------------------------------------------------------
// Picks one real Hub entry per knowledge gap (see finishAssessment) so the
// recommendations don't just repeat the same level-wide list for everyone —
// they specifically try to fill in what THIS person hasn't shown yet.
// A learner's own department (if set) — entries tagged for it via entryDepartments()
// get priority within a category, but nothing is ever excluded on department grounds.
function learnerDepartmentMatch(e){
  const dept = progress && progress.department;
  if(!dept || typeof entryDepartments !== 'function') return 0;
  return entryDepartments(e).includes(dept) ? 1 : 0;
}

function getGapEntries(gapCategories){
  const seenCats = new Set();
  const picks = [];
  (gapCategories || []).forEach(cat => {
    if(!cat || seenCats.has(cat)) return;
    seenCats.add(cat);
    const pool = (typeof entries !== 'undefined' ? entries : [])
      .filter(e => e.category === cat)
      .sort((a, b) => {
        const dm = learnerDepartmentMatch(b) - learnerDepartmentMatch(a);
        if(dm !== 0) return dm;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    if(pool[0]) picks.push(Object.assign({}, pool[0], { isGapPick: true }));
  });
  return picks;
}

function getRecommendedEntries(level, gapCategories){
  const gapPicks = getGapEntries(gapCategories).slice(0, RECOMMENDATIONS_COUNT);
  const pickedIds = new Set(gapPicks.map(e => e.id));
  const picked = gapPicks.slice();

  const cats = (LEVEL_RECOMMENDED_CATEGORIES[level] || []).slice();
  // Fold in the learner's own department's "Other AI Tools" bucket (e.g. HR sees
  // other-hr) so role-relevant tools show up at every level, not just when a
  // matching gap happens to point there.
  const deptCat = progress && progress.department && DEPARTMENT_OTHER_CATEGORY[progress.department];
  if(deptCat && !cats.includes(deptCat)) cats.push(deptCat);
  // Blank difficulty always matches (most of the existing 72 entries have none set) —
  // a resource tagged for a DIFFERENT level is the only thing excluded here.
  const pool = (typeof entries !== 'undefined' ? entries : [])
    .filter(e => cats.includes(e.category) && (!e.difficulty || e.difficulty === level));
  // Round-robin across categories so one category can't crowd out the others.
  // Within a category, entries tagged for the learner's own department come first,
  // then entries tagged for this exact level, then both fall back to recency.
  const byCategory = cats.map(cat => pool.filter(e => e.category === cat).sort((a, b) => {
    const dm = learnerDepartmentMatch(b) - learnerDepartmentMatch(a);
    if(dm !== 0) return dm;
    const aMatch = a.difficulty === level ? 1 : 0;
    const bMatch = b.difficulty === level ? 1 : 0;
    if(aMatch !== bMatch) return bMatch - aMatch;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }));

  let round = 0;
  while(picked.length < RECOMMENDATIONS_COUNT){
    let addedThisRound = false;
    for(const list of byCategory){
      if(picked.length >= RECOMMENDATIONS_COUNT) break;
      const candidate = list[round];
      if(candidate && !pickedIds.has(candidate.id)){
        picked.push(candidate); pickedIds.add(candidate.id); addedThisRound = true;
      }
    }
    round++;
    if(!addedThisRound) break;
  }
  return picked;
}

// A gap the assessment found stops being shown once the learner has actually
// completed a real Hub resource on that topic — so the dashboard doesn't keep
// nagging about something they've demonstrably worked on. This is purely a
// display-layer filter: progress.assessmentResult itself is never modified,
// it stays the immutable record of what that assessment run actually found.
// Not a re-assessment (that's retakeAssessment/finishAssessment) — just an
// honest "you've done something about this" adjustment to what's shown.
function currentGaps(){
  const result = progress && progress.assessmentResult;
  if(!result) return { gapCategories: [], gapLabels: [] };
  const origCats = result.gapCategories || [];
  const origLabels = result.gaps || [];
  const allEntries = typeof entries !== 'undefined' ? entries : [];
  const completedIds = Object.keys((progress && progress.resourceProgress) || {})
    .filter(id => progress.resourceProgress[id] && progress.resourceProgress[id].status === 'completed');
  const completedCats = new Set(
    completedIds
      .map(id => { const e = allEntries.find(x => x.id === id); return e && e.category; })
      .filter(Boolean)
  );
  const gapCategories = [], gapLabels = [];
  origCats.forEach((cat, i) => {
    if(!completedCats.has(cat)){ gapCategories.push(cat); gapLabels.push(origLabels[i]); }
  });
  return { gapCategories, gapLabels };
}

function recommendationSnippet(e){
  const raw = (isRichCategory(e.category) ? (e.purpose || e.body) : e.body) || '';
  const clean = String(raw).replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? clean.slice(0, 90) + '…' : clean;
}

function renderRecommendationsHtml(level, gapCategories, gapLabels){
  const items = getRecommendedEntries(level, gapCategories);
  if(!items.length) return '';
  const topGap = (items.some(e => e.isGapPick) && gapLabels && gapLabels[0]) ? gapLabels[0] : '';
  return `
    <div class="lrn-reco">
      <div class="lrn-reco-heading">Recommended for you</div>
      ${topGap ? `<div class="lrn-reco-gap-note">Because you're working on: <strong>${escapeHtml(topGap)}</strong></div>` : ''}
      <div class="lrn-reco-list">
        ${items.map(e => `
          <button class="lrn-reco-item" data-id="${e.id}">
            <span class="lrn-reco-tags">
              <span class="lrn-reco-cat">${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</span>
              ${e.isGapPick ? `<span class="lrn-reco-gap-tag">Fills a gap</span>` : ''}
            </span>
            <span class="lrn-reco-title">${escapeHtml(e.title || 'Untitled')}</span>
            ${recommendationSnippet(e) ? `<span class="lrn-reco-desc">${escapeHtml(recommendationSnippet(e))}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>`;
}

function bindRecommendations(container){
  container.querySelectorAll('.lrn-reco-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = entries.find(e => e.id === btn.dataset.id);
      if(entry) openNoteDetail(entry);
    });
  });
}

// ---------------------------------------------------------------------------
// 4/6/9. Dashboard (Overview / Learning Path / Achievements)
// ---------------------------------------------------------------------------
function pathProgressFor(levelKey){
  const path = LEARNING_PATHS[levelKey];
  const done = path.filter(id => (progress.completedLessons || []).includes(id)).length;
  return { done, total: path.length, pct: Math.round((done / path.length) * 100) };
}

function nextLessonFor(levelKey){
  const path = LEARNING_PATHS[levelKey];
  return path.find(id => !(progress.completedLessons || []).includes(id)) || null;
}

function renderDashboard(){
  const level = progress.currentLevel || 'beginner';
  const meta = LEVEL_META[level];
  const user = firebase.auth().currentUser;
  const name = (user && (user.displayName || user.email)) || 'there';
  const { done, total, pct } = pathProgressFor(level);
  const nextId = nextLessonFor(level);
  const xpInfo = xpProgressInLevel(progress.xp || 0);

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-dashboard">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-welcome">
        <h2>Welcome back, ${escapeHtml(name.split('@')[0])}!</h2>
        <div class="lrn-welcome-meta">
          <span class="lrn-level-chip" style="--lrn-accent:${meta.color}">${meta.emoji} ${escapeHtml(meta.label)}</span>
          <span>Progress: ${pct}%</span>
          <span title="Points you've earned from finishing lessons.">Points: ${progress.xp || 0}</span>
        </div>
      </div>

      <div class="lrn-tabs">
        <button class="lrn-tab-btn ${dashboardTab === 'overview' ? 'active' : ''}" data-tab="overview">Continue Learning</button>
        <button class="lrn-tab-btn ${dashboardTab === 'path' ? 'active' : ''}" data-tab="path">Learning Path</button>
        <button class="lrn-tab-btn ${dashboardTab === 'achievements' ? 'active' : ''}" data-tab="achievements">Achievements</button>
      </div>

      <div id="lrnTabBody"></div>
    </div>`;
  bindTopbar();
  learningRoot.querySelectorAll('.lrn-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { dashboardTab = btn.dataset.tab; if(dashboardTab === 'path' && !reviewLevel) reviewLevel = level; renderDashboard(); });
  });

  const body = document.getElementById('lrnTabBody');
  if(dashboardTab === 'overview'){
    body.innerHTML = renderOverviewTab(level, meta, done, total, nextId, xpInfo);
    const contBtn = document.getElementById('lrnContinueBtn');
    if(contBtn) contBtn.addEventListener('click', () => openLesson(level, nextId));
    bindOverviewLevelUp();
    bindRecommendations(body);
  }else if(dashboardTab === 'path'){
    if(!reviewLevel) reviewLevel = level;
    body.innerHTML = renderPathTab();
    bindPathTab();
  }else if(dashboardTab === 'achievements'){
    body.innerHTML = renderAchievementsTab();
  }
}

function renderOverviewTab(level, meta, done, total, nextId, xpInfo){
  const nextLessonHtml = nextId
    ? `<div class="lrn-next-lesson">
         <div class="lrn-next-label">Next lesson</div>
         <div class="lrn-next-title">${escapeHtml(LESSON_LIBRARY[nextId].title)}</div>
         <button class="lrn-btn-primary" id="lrnContinueBtn">CONTINUE</button>
       </div>`
    : `<div class="lrn-next-lesson lrn-path-done">
         <div class="lrn-next-label">🎉 Path complete!</div>
         <div class="lrn-next-title">You've finished the ${escapeHtml(meta.label)} path.</div>
         ${level !== 'expert' ? (() => {
           const state = progress.levelChallenges && progress.levelChallenges[level];
           const nextLabel = escapeHtml(LEVEL_META[LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(level) + 1]].label);
           let label = `Practical Challenge: ${nextLabel}`;
           let statusPill = '';
           if(state && state.status === 'submitted'){ label = 'View Submission'; statusPill = '<span class="lrn-challenge-status pending">Submitted — awaiting review</span>'; }
           else if(state && state.status === 'needs_improvement'){ label = 'Resubmit Challenge'; statusPill = '<span class="lrn-challenge-status needs-improvement">Needs Improvement</span>'; }
           else if(state && state.status === 'passed'){ label = `Continue to ${nextLabel}`; statusPill = '<span class="lrn-challenge-status passed">Passed</span>'; }
           return `${statusPill}<button class="lrn-btn-primary" id="lrnLevelUpBtn">${label}</button>`;
         })() : ''}
       </div>`;

  return `
    <div class="lrn-card">
      <div class="lrn-level-block">
        <div class="lrn-level-title">AI LEVEL ${LEARNING_LEVEL_ORDER.indexOf(level) + 1} · ${escapeHtml(meta.label)}</div>

        <div class="lrn-progress-row">
          <div class="lrn-progress-row-label">Lessons: ${done}/${total} (${Math.round((done/total)*100)}%)</div>
          <div class="lrn-progress-track lrn-progress-track-lg"><div class="lrn-progress-fill" style="width:${Math.round((done/total)*100)}%"></div></div>
        </div>

        <div class="lrn-progress-row">
          <div class="lrn-progress-row-label" title="Every 200 points, your level goes up.">Points to next level: ${xpInfo.into}/${xpInfo.needed} (${xpInfo.pct}%)</div>
          <div class="lrn-progress-track lrn-progress-track-lg"><div class="lrn-progress-fill" style="width:${xpInfo.pct}%"></div></div>
        </div>

        <div class="lrn-level-sub">${progress.xp || 0} points total</div>
      </div>
      ${nextLessonHtml}
    </div>
    ${(() => { const cg = currentGaps(); return renderRecommendationsHtml(level, cg.gapCategories, cg.gapLabels); })()}`;
}

// Advancing a level now requires a passed practical challenge, not just
// finishing the lessons — see CHALLENGE_LIBRARY/levelChallenges. A level's
// challenge state gates here: no attempt yet, or 'needs_improvement', opens
// the challenge screen; 'submitted' opens it read-only pending review;
// 'passed' is the only case that still advances immediately, exactly as before.
function bindOverviewLevelUp(){
  const btn = document.getElementById('lrnLevelUpBtn');
  if(btn) btn.addEventListener('click', () => {
    const level = progress.currentLevel;
    const state = progress.levelChallenges && progress.levelChallenges[level];
    if(state && state.status === 'passed'){
      const nextLevel = LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(level) + 1];
      progress.currentLevel = nextLevel;
      saveProgress();
      renderDashboard();
      return;
    }
    openChallenge(level);
  });
}

// A level is unlocked once the learner has actually reached it (via the
// assessment or a passed practical challenge) — it can't be browsed ahead of
// that just by clicking the tab, so people can't shortcut past levels they
// haven't earned. `currentLevel` only ever moves forward (see
// bindOverviewLevelUp()), so this is always "reached level, or earlier".
// Every level tab is always browsable — the "no shortcuts" gate lives on the
// LESSONS inside a level, not the tab itself (see renderPathTab). Beginner
// has no prerequisite; every other level (including Expert) requires the
// one before it to be fully completed before its lessons unlock.
function prevLevelDone(lv){
  if(lv === 'beginner') return true;
  const prevLevel = LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(lv) - 1];
  return !!(progress.pathCompleted && progress.pathCompleted[prevLevel]);
}

function renderPathTab(){
  const done = progress.completedLessons || [];
  const levelReady = prevLevelDone(reviewLevel);
  return `
    <div class="lrn-level-switch">
      ${LEARNING_LEVEL_ORDER.map(lv => `<button class="lrn-level-switch-btn ${reviewLevel === lv ? 'active' : ''}" data-lv="${lv}">${LEVEL_META[lv].emoji} ${LEVEL_META[lv].label}</button>`).join('')}
    </div>
    ${!levelReady ? `<div class="lrn-level-locked-note">🔒 Finish the ${escapeHtml(LEVEL_META[LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(reviewLevel) - 1]].label)} path first to unlock these lessons.</div>` : ''}
    <div class="lrn-path-list">
      ${LEARNING_PATHS[reviewLevel].map((id, i) => {
        const lesson = LESSON_LIBRARY[id];
        const isDone = done.includes(id);
        const prevDone = (i === 0 ? levelReady : done.includes(LEARNING_PATHS[reviewLevel][i - 1]));
        const locked = !isDone && !prevDone;
        return `
          <button class="lrn-path-item ${isDone ? 'done' : ''} ${locked ? 'locked' : ''}" data-id="${id}" ${locked ? 'disabled' : ''}>
            <span class="lrn-path-num">${isDone ? '✓' : locked ? '🔒' : i + 1}</span>
            <span class="lrn-path-title">${escapeHtml(lesson.title)}</span>
          </button>`;
      }).join('')}
    </div>`;
}

function bindPathTab(){
  learningRoot.querySelectorAll('.lrn-level-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => { reviewLevel = btn.dataset.lv; renderDashboard(); });
  });
  learningRoot.querySelectorAll('.lrn-path-item:not(.locked)').forEach(btn => {
    btn.addEventListener('click', () => openLesson(reviewLevel, btn.dataset.id));
  });
  bindOverviewLevelUp();
}

function renderAchievementsTab(){
  const earned = new Set(progress.badges || []);
  return `
    <div class="lrn-badge-grid">
      ${BADGE_LIBRARY.map(b => `
        <div class="lrn-badge ${earned.has(b.id) ? 'earned' : ''}">
          <div class="lrn-badge-emoji">${b.emoji}</div>
          <div class="lrn-badge-label">${escapeHtml(b.label)}</div>
          <div class="lrn-badge-desc">${escapeHtml(b.desc)}</div>
        </div>`).join('')}
    </div>`;
}

// ---------------------------------------------------------------------------
// 7. Lesson runner — Learn -> Practice -> Quiz -> Complete
// ---------------------------------------------------------------------------
function openLesson(levelKey, lessonId){
  activeLesson = { levelKey, lessonId, step: 'learn', wrongAttempt: false, practiceAttempt: '', practiceRevealed: false, quizSelected: null };
  learningScreen = 'lesson';
  renderLearning();
}

function renderLesson(){
  const lesson = LESSON_LIBRARY[activeLesson.lessonId];
  const step = activeLesson.step;

  let body = '';
  if(step === 'learn'){
    const paragraphs = Array.isArray(lesson.learn) ? lesson.learn : [lesson.learn];
    body = `
      <div class="lrn-lesson-section">
        <h3>Learn</h3>
        ${lesson.whatYoullLearn ? `<div class="lrn-whatyoullearn"><span>What you'll learn</span>${escapeHtml(lesson.whatYoullLearn)}</div>` : ''}
        ${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        ${lesson.example ? `
          <div class="lrn-example">
            ${lesson.example.bad ? `<div class="lrn-example-bad"><span>Bad:</span> ${escapeHtml(lesson.example.bad)}</div>` : ''}
            <div class="lrn-example-good"><span>${lesson.example.bad ? 'Better:' : escapeHtml(lesson.example.label) + ':'}</span> ${escapeHtml(lesson.example.good)}</div>
          </div>` : ''}
        ${lesson.keyTakeaways && lesson.keyTakeaways.length ? `
          <div class="lrn-key-takeaways">
            <div class="lrn-key-takeaways-label">Key takeaways</div>
            <ul>${lesson.keyTakeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
      <button class="lrn-btn-primary" id="lrnNextStep">Continue</button>`;
  }else if(step === 'practice'){
    const hasExample = !!lesson.practiceExample;
    const canContinue = !hasExample || activeLesson.practiceRevealed;
    body = `
      <div class="lrn-lesson-section">
        <h3>Practice</h3>
        <p>${escapeHtml(lesson.practice)}</p>
        ${lesson.practiceChecklist && lesson.practiceChecklist.length ? `
          <ul class="lrn-practice-checklist">${lesson.practiceChecklist.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
        <textarea class="lrn-practice-input" id="lrnPracticeInput" placeholder="Type your attempt here — a prompt, a note, whatever fits this task…">${escapeHtml(activeLesson.practiceAttempt || '')}</textarea>
        ${hasExample ? `
          <button class="lrn-btn-text lrn-reveal-btn" id="lrnRevealExample">Show me a strong example</button>
          ${activeLesson.practiceRevealed ? `
            <div class="lrn-practice-example">
              <div class="lrn-practice-example-label">Here's a strong example</div>
              <p>${escapeHtml(lesson.practiceExample)}</p>
            </div>` : ''}
        ` : `<p class="lrn-practice-hint">Try it now in Claude or ChatGPT, then come back and continue.</p>`}
      </div>
      <button class="lrn-btn-primary" id="lrnNextStep" ${canContinue ? '' : 'disabled'}>${hasExample ? 'Continue' : 'I tried it — continue'}</button>`;
  }else if(step === 'quiz'){
    const hasAnswered = activeLesson.quizSelected !== null && activeLesson.quizSelected !== undefined;
    const selectedOpt = hasAnswered ? lesson.quiz.options[activeLesson.quizSelected] : null;
    body = `
      <div class="lrn-lesson-section">
        <h3>Quick check</h3>
        <p>${escapeHtml(lesson.quiz.question)}</p>
        <div class="lrn-options">
          ${lesson.quiz.options.map((opt, i) => {
            let cls = 'lrn-option-btn';
            if(hasAnswered && i === activeLesson.quizSelected) cls += opt.correct ? ' lrn-option-correct' : ' lrn-option-incorrect';
            return `<button class="${cls}" data-i="${i}" ${hasAnswered ? 'disabled' : ''}>${escapeHtml(opt.text)}</button>`;
          }).join('')}
        </div>
        ${hasAnswered ? `
          <div class="lrn-quiz-feedback ${selectedOpt.correct ? 'lrn-quiz-feedback--correct' : 'lrn-quiz-feedback--incorrect'}">
            <span class="lrn-quiz-feedback-label">${selectedOpt.correct ? 'Correct' : 'Not quite'}</span>
            ${escapeHtml(selectedOpt.feedback || (selectedOpt.correct ? "Well done — that's the best answer." : 'Look again at what you just read, then try again.'))}
          </div>` : ''}
      </div>
      ${hasAnswered ? (selectedOpt.correct
        ? `<button class="lrn-btn-primary" id="lrnQuizContinue">Continue</button>`
        : `<button class="lrn-btn-primary" id="lrnQuizRetry">Try again</button>`) : ''}`;
  }else if(step === 'done'){
    body = `
      <div class="lrn-lesson-complete">
        <div class="lrn-complete-emoji"><img src="assets/images/mascot/cat-yawn.png" alt="Ginger celebrating"> 🎉</div>
        <h2>Lesson Complete!</h2>
        <p title="Points you earn for finishing a lesson.">+${XP_PER_LESSON + (activeLesson.wrongAttempt ? 0 : XP_PER_QUIZ_CORRECT)} points</p>
        ${activeLesson.newBadges && activeLesson.newBadges.length ? `
          <div class="lrn-new-badges">
            ${activeLesson.newBadges.map(id => {
              const b = BADGE_LIBRARY.find(x => x.id === id);
              return `<div class="lrn-new-badge" title="${escapeHtml(b.desc)}">${b.emoji} ${escapeHtml(b.label)} (new award!)</div>`;
            }).join('')}
          </div>` : ''}
        <button class="lrn-btn-primary" id="lrnBackToDashboard">Continue</button>
      </div>`;
  }

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-lesson">
      ${topbar({ showBackToApp: true })}
      ${step !== 'done' ? `<div class="lrn-lesson-title">${escapeHtml(lesson.title)}</div>
        <div class="lrn-lesson-steps">
          <span class="${step === 'learn' ? 'active' : (step === 'practice' || step === 'quiz' ? 'past' : '')}">Learn</span>
          <span class="${step === 'practice' ? 'active' : (step === 'quiz' ? 'past' : '')}">Practice</span>
          <span class="${step === 'quiz' ? 'active' : ''}">Quiz</span>
        </div>` : ''}
      ${body}
    </div>`;
  bindTopbar(() => {
    reviewLevel = activeLesson.levelKey;
    dashboardTab = 'path';
    learningScreen = 'dashboard';
    renderLearning();
  });

  const nextBtn = document.getElementById('lrnNextStep');
  if(nextBtn) nextBtn.addEventListener('click', advanceLessonStep);

  if(step === 'practice'){
    const practiceInput = document.getElementById('lrnPracticeInput');
    const revealBtn = document.getElementById('lrnRevealExample');
    if(practiceInput){
      practiceInput.addEventListener('input', () => {
        activeLesson.practiceAttempt = practiceInput.value;
      });
    }
    if(revealBtn){
      revealBtn.addEventListener('click', () => {
        activeLesson.practiceAttempt = practiceInput ? practiceInput.value : activeLesson.practiceAttempt;
        activeLesson.practiceRevealed = true;
        renderLesson();
      });
    }
  }

  if(step === 'quiz'){
    const hasAnswered = activeLesson.quizSelected !== null && activeLesson.quizSelected !== undefined;
    if(!hasAnswered){
      learningRoot.querySelectorAll('.lrn-option-btn').forEach(btn => {
        btn.addEventListener('click', () => selectQuizOption(lesson, Number(btn.dataset.i)));
      });
    }else if(lesson.quiz.options[activeLesson.quizSelected].correct){
      document.getElementById('lrnQuizContinue').addEventListener('click', () => completeLesson());
    }else{
      document.getElementById('lrnQuizRetry').addEventListener('click', () => {
        activeLesson.quizSelected = null;
        renderLearning();
      });
    }
  }
  if(step === 'done'){
    document.getElementById('lrnBackToDashboard').addEventListener('click', () => {
      dashboardTab = 'overview';
      learningScreen = 'dashboard';
      renderLearning();
    });
  }
}

function advanceLessonStep(){
  if(activeLesson.step === 'learn') activeLesson.step = 'practice';
  else if(activeLesson.step === 'practice') activeLesson.step = 'quiz';
  renderLearning();
}

function selectQuizOption(lesson, optionIndex){
  const opt = lesson.quiz.options[optionIndex];
  if(!opt.correct) activeLesson.wrongAttempt = true;
  activeLesson.quizSelected = optionIndex;
  renderLearning();
}

function completeLesson(){
  const { levelKey, lessonId, wrongAttempt } = activeLesson;
  const already = (progress.completedLessons || []).includes(lessonId);
  if(!already){
    progress.completedLessons = (progress.completedLessons || []).concat(lessonId);
    awardXp(XP_PER_LESSON + (wrongAttempt ? 0 : XP_PER_QUIZ_CORRECT));
    if(!wrongAttempt) progress.perfectQuizzes = (progress.perfectQuizzes || 0) + 1;

    const path = LEARNING_PATHS[levelKey];
    if(path.every(id => progress.completedLessons.includes(id))){
      progress.pathCompleted = Object.assign({}, progress.pathCompleted, { [levelKey]: true });
      awardXp(XP_PER_PATH_COMPLETE);
    }
  }
  const newBadges = applyNewBadges();
  activeLesson.newBadges = newBadges;
  activeLesson.step = 'done';
  logProgressSnapshot();
  saveProgress();
  renderLearning();
}

// ---------------------------------------------------------------------------
// 8. Level-up challenge — practical demonstration + evidence, required before
// advancing past a level. See CHALLENGE_LIBRARY/challengeFor() in
// learning-data.js and bindOverviewLevelUp() above, which routes here instead
// of advancing the level directly once all of a level's lessons are done.
// ---------------------------------------------------------------------------
function openChallenge(levelKey){
  activeChallenge = { levelKey, evidenceType: 'file', file: null, link: '', explanation: '' };
  learningScreen = 'challenge';
  renderLearning();
}

function latestChallengeAttempt(levelKey){
  const state = progress.levelChallenges && progress.levelChallenges[levelKey];
  if(!state || !state.attempts || !state.attempts.length) return null;
  return state.attempts[state.attempts.length - 1];
}

// Plain-English, step-by-step walkthrough shown on every active challenge —
// written for someone who has never used this kind of system before (not
// everyone at Oryx is technical). Purely explanatory: adds no new state and
// changes nothing about how evidence/explanation/submission actually work.
const CHALLENGE_HOWTO_STEPS = [
  { icon: '📖', title: '1. Read', text: 'Read the challenge above and make sure you understand what you need to do.' },
  { icon: '🤖', title: '2. Use AI', text: 'Open Claude, ChatGPT, or the AI tool mentioned in the challenge and complete the task.' },
  { icon: '📸', title: '3. Show your work', text: 'Take a screenshot or save the file you created — you\'ll need it in the next step.' },
  { icon: '✍️', title: '4. Explain', text: 'Write a short explanation of what you did and how you used AI.' },
  { icon: '✅', title: '5. Submit', text: 'Upload your evidence, add your explanation, then click "Submit challenge."' }
];

function challengeHowToHtml(){
  return `
    <div class="lrn-challenge-card lrn-howto">
      <h3>How to complete this challenge</h3>
      <div class="lrn-howto-steps">
        ${CHALLENGE_HOWTO_STEPS.map(s => `
          <div class="lrn-howto-step">
            <span class="lrn-howto-icon">${s.icon}</span>
            <div>
              <div class="lrn-howto-title">${escapeHtml(s.title)}</div>
              <div class="lrn-howto-text">${escapeHtml(s.text)}</div>
            </div>
          </div>`).join('')}
      </div>
      <p class="lrn-practice-hint"><strong>Important:</strong> you must provide evidence and a short explanation before you can submit.</p>
      <div class="lrn-howto-help">
        <strong>Need help?</strong> Not sure what to do? Read the steps above first. If you're still unsure, ask your manager or the AI Knowledge Hub administrator for help.
      </div>
    </div>`;
}

function renderChallenge(){
  const { levelKey } = activeChallenge;
  const meta = LEVEL_META[levelKey];
  const challenge = challengeFor(levelKey, progress.department);
  const state = progress.levelChallenges && progress.levelChallenges[levelKey];
  const pastAttempts = (state && state.attempts) || [];
  const isPending = state && state.status === 'submitted';

  if(!challenge){
    learningRoot.innerHTML = `
      <div class="lrn-screen lrn-challenge">
        ${topbar({ showBackToApp: true })}
        <div class="lrn-challenge-card">
          <div class="lrn-level-title">${meta.emoji} ${escapeHtml(meta.label)} — Practical Challenge</div>
          <p>Set your department in <strong>My AI Progress</strong> to see this level's challenge.</p>
        </div>
        <button class="lrn-btn-primary" id="lrnChallengeBack">Back to dashboard</button>
      </div>`;
    bindTopbar();
    document.getElementById('lrnChallengeBack').addEventListener('click', () => {
      learningScreen = 'dashboard'; renderLearning();
    });
    return;
  }

  const historyHtml = pastAttempts.length > 1 ? `
    <div class="lrn-challenge-history">
      <div class="lrn-challenge-history-label">Previous attempts</div>
      ${pastAttempts.slice(0, -1).map(a => `
        <div class="lrn-challenge-history-row">
          <span>${escapeHtml(new Date(a.submittedAt).toLocaleDateString())}</span>
          <span class="lrn-challenge-status ${a.reviewStatus === 'passed' ? 'passed' : 'needs-improvement'}">${a.reviewStatus === 'passed' ? 'Passed' : 'Needs Improvement'}</span>
        </div>`).join('')}
    </div>` : '';

  if(isPending){
    const attempt = latestChallengeAttempt(levelKey);
    learningRoot.innerHTML = `
      <div class="lrn-screen lrn-challenge">
        ${topbar({ showBackToApp: true })}
        <div class="lrn-challenge-card">
          <div class="lrn-level-title">${meta.emoji} ${escapeHtml(meta.label)} — Practical Challenge</div>
          <p>${escapeHtml(challenge.prompt)}</p>
          <span class="lrn-challenge-status pending">Submitted — waiting on review</span>
          <div class="lrn-challenge-history-row" style="margin-top:12px;">
            <span>Submitted ${escapeHtml(new Date(attempt.submittedAt).toLocaleDateString())}</span>
          </div>
          <p class="lrn-practice-hint">${escapeHtml(attempt.explanation)}</p>
          ${attempt.evidenceUrl ? `<a class="lrn-btn-text" href="${escapeHtml(attempt.evidenceUrl)}" target="_blank" rel="noopener">View submitted evidence</a>` : ''}
        </div>
        ${historyHtml}
        <button class="lrn-btn-primary" id="lrnChallengeBack">Back to dashboard</button>
      </div>`;
    bindTopbar();
    document.getElementById('lrnChallengeBack').addEventListener('click', () => {
      learningScreen = 'dashboard'; renderLearning();
    });
    return;
  }

  const needsImprovementNote = state && state.status === 'needs_improvement' ? latestChallengeAttempt(levelKey) : null;

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-challenge">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-challenge-card">
        <div class="lrn-level-title">${meta.emoji} ${escapeHtml(meta.label)} — Practical Challenge</div>
        <p>${escapeHtml(challenge.prompt)}</p>
        ${challenge.guidance ? `<p class="lrn-practice-hint">${escapeHtml(challenge.guidance)}</p>` : ''}
        ${needsImprovementNote ? `
          <div class="lrn-challenge-status needs-improvement">Needs Improvement</div>
          ${needsImprovementNote.reviewNote ? `<p class="lrn-practice-hint"><strong>Reviewer note:</strong> ${escapeHtml(needsImprovementNote.reviewNote)}</p>` : ''}
        ` : ''}
      </div>

      ${challengeHowToHtml()}

      <div class="lrn-challenge-card">
        <h3>Your submission <span class="lrn-required-mark">*</span></h3>
        <div class="lrn-evidence-picker">
          <button class="lrn-evidence-picker-btn ${activeChallenge.evidenceType === 'file' ? 'active' : ''}" data-type="file">Upload file/screenshot</button>
          <button class="lrn-evidence-picker-btn ${activeChallenge.evidenceType === 'link' ? 'active' : ''}" data-type="link">Link</button>
        </div>
        ${activeChallenge.evidenceType === 'file' ? `
          <div class="lrn-evidence-upload">
            <input type="file" id="lrnChallengeFile" accept="image/*,.pdf,.doc,.docx,.txt">
            ${activeChallenge.file ? `<span class="lrn-file-chip">${escapeHtml(activeChallenge.file.name)}</span>` : ''}
          </div>` : ''}
        ${activeChallenge.evidenceType === 'link' ? `
          <input type="url" class="lrn-explanation-input" id="lrnChallengeLink" placeholder="https://…" value="${escapeHtml(activeChallenge.link || '')}">` : ''}
        <div id="lrnEvidenceError" class="lrn-field-error" style="display:none;"></div>

        <h3>Explanation <span class="lrn-required-mark">*</span></h3>
        <p class="lrn-practice-hint">Briefly explain what you did and how you used AI.</p>
        <textarea class="lrn-explanation-input" id="lrnChallengeExplanation" placeholder="Explain what you did and how you used AI…">${escapeHtml(activeChallenge.explanation || '')}</textarea>
        <div id="lrnExplanationError" class="lrn-field-error" style="display:none;"></div>

        <button class="lrn-btn-primary" id="lrnChallengeSubmit">Submit challenge</button>
      </div>
      ${historyHtml}
    </div>`;
  bindTopbar();
  bindChallenge();
}

function bindChallenge(){
  const backBtn = document.getElementById('lrnChallengeBack');
  if(backBtn) backBtn.addEventListener('click', () => { learningScreen = 'dashboard'; renderLearning(); });

  learningRoot.querySelectorAll('.lrn-evidence-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeChallenge.evidenceType = btn.dataset.type;
      renderChallenge();
    });
  });

  const fileInput = document.getElementById('lrnChallengeFile');
  if(fileInput) fileInput.addEventListener('change', () => {
    activeChallenge.file = fileInput.files[0] || null;
    renderChallenge();
  });

  const linkInput = document.getElementById('lrnChallengeLink');
  if(linkInput) linkInput.addEventListener('input', () => { activeChallenge.link = linkInput.value; });

  const explanationInput = document.getElementById('lrnChallengeExplanation');
  if(explanationInput) explanationInput.addEventListener('input', () => { activeChallenge.explanation = explanationInput.value; });

  const submitBtn = document.getElementById('lrnChallengeSubmit');
  if(submitBtn) submitBtn.addEventListener('click', submitChallenge);
}

async function submitChallenge(){
  const evidenceError = document.getElementById('lrnEvidenceError');
  const explanationError = document.getElementById('lrnExplanationError');
  evidenceError.style.display = 'none';
  explanationError.style.display = 'none';

  const explanation = (activeChallenge.explanation || '').trim();
  if(explanation.length < 20){
    explanationError.textContent = 'Please explain briefly how you completed the task.';
    explanationError.style.display = 'block';
    return;
  }

  if(activeChallenge.evidenceType === 'file' && !activeChallenge.file){
    evidenceError.textContent = 'Please upload evidence of your completed task.';
    evidenceError.style.display = 'block';
    return;
  }
  if(activeChallenge.evidenceType === 'link'){
    try{ new URL((activeChallenge.link || '').trim()); }
    catch(e){
      evidenceError.textContent = 'Enter a valid link (must start with http:// or https://).';
      evidenceError.style.display = 'block';
      return;
    }
  }

  const submitBtn = document.getElementById('lrnChallengeSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try{
    let evidenceUrl = null, evidenceFileName = null;
    if(activeChallenge.evidenceType === 'file'){
      const user = firebase.auth().currentUser;
      evidenceUrl = await uploadChallengeEvidence(activeChallenge.file, user.uid);
      evidenceFileName = activeChallenge.file.name;
    }else if(activeChallenge.evidenceType === 'link'){
      evidenceUrl = activeChallenge.link.trim();
    }

    const levelKey = activeChallenge.levelKey;
    const attempt = {
      submittedAt: new Date().toISOString(),
      evidenceType: activeChallenge.evidenceType,
      evidenceUrl, evidenceFileName,
      explanation,
      reviewedAt: null, reviewedBy: null, reviewStatus: null, reviewNote: null
    };
    progress.levelChallenges = progress.levelChallenges || {};
    const existing = progress.levelChallenges[levelKey] || { status: 'submitted', attempts: [] };
    existing.attempts = existing.attempts.concat(attempt);
    existing.status = 'submitted';
    progress.levelChallenges[levelKey] = existing;
    saveProgress();
    renderChallenge();
  }catch(e){
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit challenge';
    evidenceError.textContent = 'Could not submit — check your connection and try again.';
    evidenceError.style.display = 'block';
  }
}

// ---------------------------------------------------------------------------
// Real Hub resource completion — a parallel, additive system to the built-in
// lesson mechanic above. Tracks progress on actual entries/{id} documents
// (progress.resourceProgress), never touching completedLessons. If the entry
// has a knowledgeCheck, a short quiz gates completion (wrong answers just
// retry the same question in place — no "back to learn" penalty, since this
// is meant to feel light, not exam-like). If it has none, a single button
// marks it complete — so the whole existing library works today with zero
// seeded quiz content.
// ---------------------------------------------------------------------------
function markResourceInProgress(entryId){
  const user = firebase.auth().currentUser;
  if(!user) return;
  ensureProgressForCurrentUser();
  if(!progress) return;
  progress.resourceProgress = progress.resourceProgress || {};
  if(progress.resourceProgress[entryId]) return; // already started or completed
  progress.resourceProgress[entryId] = { status: 'in-progress', startedAt: new Date().toISOString(), completedAt: null, quizPassed: null };
  saveProgress();
}

function completeResource(entryId, quizPassed){
  if(!progress) return;
  progress.resourceProgress = progress.resourceProgress || {};
  const existing = progress.resourceProgress[entryId];
  if(existing && existing.status === 'completed') return; // no double-award
  progress.resourceProgress[entryId] = {
    status: 'completed',
    startedAt: (existing && existing.startedAt) || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    quizPassed: quizPassed == null ? null : quizPassed
  };
  awardXp(XP_PER_RESOURCE);
  applyNewBadges();
  logProgressSnapshot();
  saveProgress();
}

// Renders the completion control for an entry detail page: the knowledge-check
// quiz (if the entry has one) or a plain "Mark as complete" button (if not).
// Signed-out visitors see nothing here — there's no progress to track for them.
function resourceProgressSectionHtml(entry){
  if(!firebase.auth().currentUser) return '';
  const state = (progress && progress.resourceProgress && progress.resourceProgress[entry.id]) || null;
  const isDone = state && state.status === 'completed';
  if(isDone){
    return `<div class="res-progress res-progress-done"><span class="res-progress-check">✓</span> Marked complete${state.quizPassed ? ' — knowledge check passed' : ''}</div>`;
  }
  const quiz = entry.knowledgeCheck || [];
  if(quiz.length){
    return `<div class="res-progress res-quiz" id="resQuiz" data-entry-id="${entry.id}" data-qi="0"></div>`;
  }
  return `<div class="res-progress"><button class="lrn-btn-primary" id="resMarkComplete" data-entry-id="${entry.id}">Mark as complete</button></div>`;
}

function renderResourceQuizQuestion(entry, qIndex){
  const container = document.getElementById('resQuiz');
  if(!container) return;
  const quiz = entry.knowledgeCheck || [];
  const q = quiz[qIndex];
  container.dataset.qi = qIndex;
  container.innerHTML = `
    <div class="res-quiz-meta">Quick knowledge check — question ${qIndex + 1} of ${quiz.length}</div>
    <div class="res-quiz-question">${escapeHtml(q.question)}</div>
    <div class="res-quiz-options">
      ${q.options.map((opt, i) => `<button class="lrn-option-btn" data-oi="${i}">${escapeHtml(opt.text)}</button>`).join('')}
    </div>
    <div class="res-quiz-feedback" id="resQuizFeedback"></div>`;
  container.querySelectorAll('.res-quiz-options .lrn-option-btn').forEach(btn => {
    btn.addEventListener('click', () => answerResourceQuiz(entry, qIndex, Number(btn.dataset.oi)));
  });
}

function answerResourceQuiz(entry, qIndex, optIndex){
  const quiz = entry.knowledgeCheck || [];
  const q = quiz[qIndex];
  const correct = !!(q.options[optIndex] && q.options[optIndex].correct);
  const feedback = document.getElementById('resQuizFeedback');
  if(!correct){
    // Retry the SAME question in place — no penalty, no sending the user away.
    if(feedback) feedback.textContent = 'Not quite — give it another go.';
    return;
  }
  if(qIndex + 1 < quiz.length){
    renderResourceQuizQuestion(entry, qIndex + 1);
  }else{
    completeResource(entry.id, true);
    const container = document.getElementById('resQuiz');
    if(container) container.outerHTML = `<div class="res-progress res-progress-done"><span class="res-progress-check">✓</span> Marked complete — knowledge check passed</div>`;
  }
}

function bindResourceProgressSection(container, entry){
  const quizEl = container.querySelector('#resQuiz');
  if(quizEl) renderResourceQuizQuestion(entry, 0);
  const btn = container.querySelector('#resMarkComplete');
  if(btn) btn.addEventListener('click', () => {
    completeResource(entry.id, null);
    btn.closest('.res-progress').outerHTML = `<div class="res-progress res-progress-done"><span class="res-progress-check">✓</span> Marked complete</div>`;
  });
}

// ---------------------------------------------------------------------------
// My AI Progress — the learner's saved record, opened from the account menu
// (the app's existing "Profile" surface — see My Components / My Favorites).
// Always reflects the same `progress` object the Learning view itself uses.
// ---------------------------------------------------------------------------
const myAiProgressOverlay = document.getElementById('myAiProgressOverlay');
const myAiProgressBody = document.getElementById('myAiProgressBody');
const openMyAiProgressBtn = document.getElementById('openMyAiProgress');

function formatAssessmentDate(iso){
  if(!iso) return '—';
  try{ return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch(e){ return '—'; }
}

// "Your Rank" card — rankingScore/rank/rankTotal are only ever written by the
// scheduled ranking job (see plan), never by client code, so this is always
// read-only display. Shows a plain "not enough data yet" state until that job
// has run at least once for this account.
function rankCardHtml(){
  if(progress.rankingScore == null || progress.rank == null){
    return `
      <div class="lrn-profile-rank lrn-profile-rank--pending">
        <span class="lrn-profile-rank-label">Your Rank</span>
        <strong>Not enough data yet</strong>
        <p>Keep learning — your rank appears here once there's enough activity to compare.</p>
      </div>`;
  }
  return `
    <div class="lrn-profile-rank">
      <span class="lrn-profile-rank-label">Your Rank</span>
      <strong>#${progress.rank} of ${progress.rankTotal}</strong>
      <p title="Rankings are based on progress, consistency, and improvement — not your starting level. Updated overnight.">How is this calculated?</p>
    </div>`;
}

// Simple inline SVG line chart from progress.progressHistory (no charting
// library — this app has no build step, so anything client-side stays
// dependency-free). Plots XP over time; falls back to a plain message when
// there's fewer than 2 points to draw a meaningful line.
function progressGraphSvg(){
  const points = progress.progressHistory || [];
  if(points.length < 2){
    return `<div class="s-empty">Your progress graph will appear here after a bit more learning activity.</div>`;
  }
  const w = 560, h = 140, pad = 12;
  const xs = points.map((p, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const maxXp = Math.max(...points.map(p => p.xp), 1);
  const ys = points.map(p => h - pad - (p.xp / maxXp) * (h - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1];
  return `
    <svg viewBox="0 0 ${w} ${h}" class="lrn-progress-graph-svg" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="var(--oryx-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="var(--oryx-blue)"></circle>
    </svg>`;
}

function renderMyAiProgressPanel(){
  if(typeof closeAccountMenu === 'function') closeAccountMenu();
  const user = firebase.auth().currentUser;
  if(!user) return;
  ensureProgressForCurrentUser();

  if(!progress.assessmentResult){
    myAiProgressBody.innerHTML = `
      <div class="s-empty">You haven't taken the AI skill assessment yet.</div>
      <button class="lrn-btn-primary" id="lrnProfileStartBtn">Start Assessment</button>`;
    myAiProgressOverlay.classList.add('open');
    document.getElementById('lrnProfileStartBtn').addEventListener('click', () => {
      myAiProgressOverlay.classList.remove('open');
      retakeAssessment();
    });
    return;
  }

  const level = progress.currentLevel || progress.assessmentResult.level;
  const meta = LEVEL_META[level];
  const { done, total, pct } = pathProgressFor(level);
  const nextId = nextLessonFor(level);

  myAiProgressBody.innerHTML = `
    <div class="lrn-profile-level" style="--lrn-accent:${meta.color}">
      <span class="lrn-profile-emoji">${meta.emoji}</span>
      <div>
        <div class="lrn-profile-level-label">AI Level</div>
        <div class="lrn-profile-level-value">${escapeHtml(meta.label)}</div>
      </div>
    </div>
    <div class="lrn-profile-stats">
      <div class="lrn-profile-stat"><span>Assessment score</span><strong>${progress.assessmentResult.score}%</strong></div>
      <div class="lrn-profile-stat"><span>Assessment date</span><strong>${formatAssessmentDate(progress.assessmentDate)}</strong></div>
      <div class="lrn-profile-stat"><span>Overall progress</span><strong>${pct}%</strong></div>
      <div class="lrn-profile-stat" title="Points you earn by finishing lessons."><span>Points earned</span><strong class="lrn-profile-stat-accent">${progress.xp || 0}</strong></div>
      <div class="lrn-profile-stat"><span>Lessons completed</span><strong>${(progress.completedLessons || []).length}</strong></div>
      <div class="lrn-profile-stat" title="Little awards you unlock for reaching a milestone, like a learning streak."><span>Badges (awards)</span><strong class="lrn-profile-stat-accent">${(progress.badges || []).length}</strong></div>
    </div>
    ${rankCardHtml()}
    <div class="lrn-profile-graph">
      <span class="lrn-profile-graph-label">Your progress over time</span>
      ${progressGraphSvg()}
    </div>
    <div class="lrn-profile-course">
      <span>Current course</span>
      <strong>${escapeHtml(meta.label)}${nextId ? ` · Next: ${escapeHtml(LESSON_LIBRARY[nextId].title)}` : ' · Path complete'}</strong>
    </div>
    <div class="lrn-profile-dept">
      <span>Department</span>
      <select class="filter-select" id="lrnProfileDeptSelect">
        <option value="">Not set</option>
        ${LIBRARY_DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}"${progress.department === d ? ' selected' : ''}>${escapeHtml(d)}</option>`).join('')}
      </select>
    </div>
    <div class="lrn-profile-actions">
      <button class="lrn-btn-primary" id="lrnProfileContinueBtn">Continue Learning</button>
      <button class="lrn-btn-text" id="lrnProfileRetakeBtn">Retake AI Assessment</button>
    </div>`;
  myAiProgressOverlay.classList.add('open');

  document.getElementById('lrnProfileContinueBtn').addEventListener('click', async () => {
    myAiProgressOverlay.classList.remove('open');
    await enterLearning();
  });
  document.getElementById('lrnProfileRetakeBtn').addEventListener('click', () => {
    myAiProgressOverlay.classList.remove('open');
    retakeAssessment();
  });
  const profileDeptSelect = document.getElementById('lrnProfileDeptSelect');
  if(profileDeptSelect) profileDeptSelect.addEventListener('change', () => {
    progress.department = profileDeptSelect.value || null;
    saveProgress();
  });
}

if(openMyAiProgressBtn) openMyAiProgressBtn.addEventListener('click', renderMyAiProgressPanel);
document.getElementById('closeMyAiProgress').addEventListener('click', () => myAiProgressOverlay.classList.remove('open'));
myAiProgressOverlay.addEventListener('click', (ev) => { if(ev.target === myAiProgressOverlay) myAiProgressOverlay.classList.remove('open'); });

// ---------------------------------------------------------------------------
// Mandatory first-time assessment: the moment a first-time user signs in
// (and only then — never on every reload once they've been assessed), send
// them straight into onboarding instead of waiting for them to find the
// "AI Learning" button. Skipped if another panel is already open (e.g. they
// signed in specifically to submit a resource) so it never hijacks a
// different in-flight task.
//
// Keyed off the actual signed-in uid (not a one-shot flag) so switching
// accounts on the same browser — including creating a new account while
// already signed in, which swaps the Firebase user with no intermediate
// signed-out state — always reloads that account's own progress instead of
// silently keeping the previous user's in memory.
// ---------------------------------------------------------------------------
// Swaps straight into the assessment's welcome screen — the "entrance" a
// brand-new account lands on instead of ever seeing the main library page.
// Shared by the account-creation success handler (suggest.js, immediate, no
// delay) and the sign-in auto-prompt below (delayed, skippable) so both
// paths land on the exact same screen the exact same way.
function enterLearningAsEntrance(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitLearningAdminMode === 'function') exitLearningAdminMode();
  viewNotes.classList.remove('active');
  viewLearning.classList.add('active');
  bumpStreak();
  saveProgress();
  learningScreen = 'onboarding';
  renderLearning();
}

firebase.auth().onAuthStateChanged((user) => {
  if(!user){
    learningLastUid = null;
    if(learningUnsub){ learningUnsub(); learningUnsub = null; }
    progress = null;
    return;
  }
  if(user.uid === learningLastUid) return; // same account re-firing (e.g. token refresh)

  ensureProgressForCurrentUser();
  if(progress.assessmentResult) return; // already assessed — never force it again

  setTimeout(() => {
    const otherOverlayOpen = Array.from(document.querySelectorAll('.overlay.open'))
      .some(el => el.id !== 'staffAuthOverlay');
    // Also backs off if the entrance already ran synchronously for this same
    // sign-in (see enterLearningAsEntrance() called directly on account
    // creation) — viewLearning will already be active by the time this fires.
    if(otherOverlayOpen || viewLearning.classList.contains('active')) return;
    enterLearningAsEntrance();
  }, 300); // let any in-flight UI (e.g. the sign-in modal closing) settle first
});
