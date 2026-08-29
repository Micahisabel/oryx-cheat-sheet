// ============================================================================
// AI Learning — gamified skill assessment + personalized training
// ============================================================================
// State machine: onboarding -> assessment (adaptive) -> results -> dashboard
// -> lesson (learn/practice/quiz) -> back to dashboard. All content/scoring
// config lives in js/learning-data.js — this file is rendering + flow only.
// ============================================================================

const LEARNING_STORAGE_KEY = 'oryx-ai-learning-progress';
const learningRoot = document.getElementById('learningRoot');
const viewLearning = document.getElementById('view-learning');
const viewNotes = document.getElementById('view-notes');
const openLearningBtn = document.getElementById('openLearning');

let learningScreen = 'onboarding'; // onboarding | assessment | results | dashboard | lesson
let progress = null;              // the learner's saved progress object
let learningUnsub = null;         // Firestore snapshot unsubscribe

// ---- Assessment run state (not persisted — only the final result is saved) ----
let assessment = null; // { tier, askedIds:[], answers:[] }

// ---- Dashboard sub-navigation ----
let dashboardTab = 'overview'; // overview | path | achievements
let reviewLevel = null;        // level being viewed in the Learning Path tab

// ---- Active lesson session ----
let activeLesson = null; // { levelKey, lessonId, step: 'learn'|'practice'|'quiz'|'done', wrongAttempt:false }

// ---------------------------------------------------------------------------
// Progress persistence (localStorage always; Firestore best-effort per user)
// ---------------------------------------------------------------------------
function defaultProgress(){
  return {
    assessmentResult: null,       // { level, score, strengths:[], improve:[] }
    assessmentDate: null,         // ISO date string of the most recent assessment
    currentLevel: null,
    xp: 0,
    completedLessons: [],
    pathCompleted: {},
    badges: [],
    perfectQuizzes: 0,
    streak: 0,
    lastActiveDate: null
  };
}

function loadLocalProgress(){
  try{
    const raw = localStorage.getItem(LEARNING_STORAGE_KEY);
    if(!raw) return defaultProgress();
    return Object.assign(defaultProgress(), JSON.parse(raw));
  }catch(e){ return defaultProgress(); }
}

function saveProgress(){
  try{ localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(progress)); }catch(e){}
  const user = firebase.auth().currentUser;
  if(user && typeof learningCollection !== 'undefined'){
    learningCollection.doc(user.uid).set(progress, { merge: false }).catch(() => {
      // Likely no Firestore rule yet for learningProgress/{uid} — localStorage still works.
    });
  }
}

function bumpStreak(){
  const today = new Date().toISOString().slice(0, 10);
  if(progress.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  progress.streak = (progress.lastActiveDate === yesterday) ? (progress.streak || 0) + 1 : 1;
  progress.lastActiveDate = today;
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
async function enterLearning(){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  viewNotes.classList.remove('active');
  viewLearning.classList.add('active');

  if(!progress){
    progress = loadLocalProgress();
    subscribeLearningProgress();
  }
  bumpStreak();
  applyNewBadges();
  saveProgress();
  learningScreen = progress.assessmentResult ? 'dashboard' : 'onboarding';
  renderLearning();
}

function exitLearningView(){
  viewLearning.classList.remove('active');
  viewNotes.classList.add('active');
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
      try{ localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(progress)); }catch(e){}
      if(learningScreen !== 'assessment') renderLearning();
    }
  }, () => { /* no rule yet, or offline — keep using localStorage silently */ });
}

if(openLearningBtn) openLearningBtn.addEventListener('click', enterLearning);

// ---------------------------------------------------------------------------
// Render dispatch
// ---------------------------------------------------------------------------
function renderLearning(){
  if(learningScreen === 'onboarding') return renderOnboarding();
  if(learningScreen === 'assessment') return renderAssessment();
  if(learningScreen === 'results') return renderResults();
  if(learningScreen === 'dashboard') return renderDashboard();
  if(learningScreen === 'lesson') return renderLesson();
}

function topbar({ showProgress = null, showBackToApp = true } = {}){
  const xp = (progress && progress.xp) || 0;
  const lvl = learnerLevelFromXp(xp);
  const streakHtml = progress && progress.streak > 1
    ? `<span class="lrn-streak">🔥 ${progress.streak}</span>` : '';
  return `
    <div class="lrn-topbar">
      ${showBackToApp ? `<button class="lrn-icon-btn" id="lrnExitBtn" aria-label="Back to Knowledge Hub">&larr;</button>` : '<span></span>'}
      ${showProgress !== null ? `<div class="lrn-progress-track"><div class="lrn-progress-fill" style="width:${showProgress}%"></div></div>` : '<div></div>'}
      <div class="lrn-topbar-stats">${streakHtml}<span class="lrn-xp-pill">⭐ ${xp} XP · Lv.${lvl}</span></div>
    </div>`;
}

function bindTopbar(){
  const exitBtn = document.getElementById('lrnExitBtn');
  if(exitBtn) exitBtn.addEventListener('click', exitLearningView);
}

// ---------------------------------------------------------------------------
// 1. Onboarding
// ---------------------------------------------------------------------------
function renderOnboarding(){
  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-onboarding">
      ${topbar({ showBackToApp: true })}
      <div class="lrn-hero">
        <div class="lrn-hero-badge">🚀</div>
        <h2>Let's find your AI level</h2>
        <p class="lrn-hero-sub">Answer a few quick questions to discover where you are on your AI learning journey. Don't worry — there are no wrong answers.</p>
        <button class="lrn-btn-primary" id="lrnStartAssessment">Start Assessment</button>
      </div>
    </div>`;
  bindTopbar();
  document.getElementById('lrnStartAssessment').addEventListener('click', startAssessment);
}

// ---------------------------------------------------------------------------
// 2. Adaptive assessment
// ---------------------------------------------------------------------------
function startAssessment(){
  assessment = { tier: 2, askedIds: [], answers: [] };
  learningScreen = 'assessment';
  renderLearning();
}

// Retaking keeps XP, completed lessons, and badges — only the assessment result
// (and the current level it points to) gets overwritten once the retake finishes.
function retakeAssessment(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  viewNotes.classList.remove('active');
  viewLearning.classList.add('active');
  startAssessment();
}

function pickNextQuestion(tier){
  const pool = (t) => ASSESSMENT_QUESTIONS.filter(q => q.tier === t && !assessment.askedIds.includes(q.id));
  for(const t of [tier, tier - 1, tier + 1, tier - 2, tier + 2]){
    if(t < 1 || t > 4) continue;
    const candidates = pool(t);
    if(candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const anyLeft = ASSESSMENT_QUESTIONS.filter(q => !assessment.askedIds.includes(q.id));
  return anyLeft.length ? anyLeft[0] : null;
}

function renderAssessment(){
  const qNum = assessment.answers.length + 1;
  if(qNum > ASSESSMENT_LENGTH){ return finishAssessment(); }
  const question = pickNextQuestion(assessment.tier);
  if(!question){ return finishAssessment(); }
  assessment.currentQuestion = question;

  learningRoot.innerHTML = `
    <div class="lrn-screen lrn-assessment">
      ${topbar({ showProgress: Math.round(((qNum - 1) / ASSESSMENT_LENGTH) * 100) })}
      <div class="lrn-q-meta">Question ${qNum} of ${ASSESSMENT_LENGTH}</div>
      <div class="lrn-q-card">
        <div class="lrn-q-mascot">🤖</div>
        <div class="lrn-q-bubble">${escapeHtml(question.prompt)}</div>
      </div>
      <div class="lrn-options">
        ${question.options.map((opt, i) => `
          <button class="lrn-option-btn" data-i="${i}">${escapeHtml(opt.text)}</button>
        `).join('')}
      </div>
    </div>`;
  bindTopbar();
  learningRoot.querySelectorAll('.lrn-option-btn').forEach(btn => {
    btn.addEventListener('click', () => answerAssessmentQuestion(question, Number(btn.dataset.i)));
  });
}

function answerAssessmentQuestion(question, optionIndex){
  const opt = question.options[optionIndex];
  assessment.askedIds.push(question.id);
  assessment.answers.push({ questionId: question.id, tier: question.tier, topic: question.topic, score: opt.score });
  const ratio = opt.score / 3;
  if(ratio >= 0.66) assessment.tier = Math.min(4, assessment.tier + 1);
  else if(ratio <= 0.33) assessment.tier = Math.max(1, assessment.tier - 1);
  renderLearning();
}

function finishAssessment(){
  const answers = assessment.answers;
  const weightedSum = answers.reduce((sum, a) => sum + (a.score / 3) * TIER_WEIGHT[a.tier], 0);
  const weightTotal = answers.reduce((sum, a) => sum + TIER_WEIGHT[a.tier], 0);
  const score = Math.round((weightedSum / weightTotal) * 100);
  const level = levelFromScore(score);

  // Strengths / areas to improve — averaged per topic actually asked this run.
  const byTopic = {};
  answers.forEach(a => {
    if(!byTopic[a.topic]) byTopic[a.topic] = { total: 0, count: 0 };
    byTopic[a.topic].total += a.score / 3;
    byTopic[a.topic].count += 1;
  });
  const topicAverages = Object.keys(byTopic).map(topic => ({ topic, avg: byTopic[topic].total / byTopic[topic].count }));
  const strengths = topicAverages.filter(t => t.avg >= 0.66).sort((a, b) => b.avg - a.avg).slice(0, 3).map(t => t.topic);
  const improve = topicAverages.filter(t => t.avg <= 0.4).sort((a, b) => a.avg - b.avg).slice(0, 3).map(t => t.topic);

  progress.assessmentResult = {
    level, score,
    strengths: strengths.length ? strengths : ['Getting started with AI'],
    improve: improve.length ? improve : ['Keep practicing — you\'re off to a solid start']
  };
  progress.currentLevel = level;
  progress.assessmentDate = new Date().toISOString();
  applyNewBadges();
  saveProgress();
  learningScreen = 'results';
  renderLearning();
}

// ---------------------------------------------------------------------------
// 3. Results
// ---------------------------------------------------------------------------
function renderResults(){
  const r = progress.assessmentResult;
  const meta = LEVEL_META[r.level];
  const firstLessonTitle = LESSON_LIBRARY[LEARNING_PATHS[r.level][0]].title;

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
      <div class="lrn-results-grid">
        <div class="lrn-results-col">
          <h3>Your strengths</h3>
          <ul>${r.strengths.map(s => `<li>✅ ${escapeHtml(s)}</li>`).join('')}</ul>
        </div>
        <div class="lrn-results-col">
          <h3>Areas to improve</h3>
          <ul>${r.improve.map(s => `<li>🎯 ${escapeHtml(s)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="lrn-recommend">
        <div class="lrn-recommend-label">Recommended next step</div>
        <div class="lrn-recommend-lesson">Start with <strong>${escapeHtml(firstLessonTitle)}</strong></div>
      </div>
      ${renderRecommendationsHtml(r.level)}
      <button class="lrn-btn-primary" id="lrnStartLearning">Start My Learning Journey</button>
    </div>`;
  bindTopbar();
  bindRecommendations(learningRoot);
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
function getRecommendedEntries(level){
  const cats = LEVEL_RECOMMENDED_CATEGORIES[level] || [];
  const pool = (typeof entries !== 'undefined' ? entries : []).filter(e => cats.includes(e.category));
  // Round-robin across categories so one category can't crowd out the others.
  const byCategory = cats.map(cat => pool.filter(e => e.category === cat).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  const picked = [];
  for(let round = 0; picked.length < RECOMMENDATIONS_COUNT; round++){
    let addedThisRound = false;
    for(const list of byCategory){
      if(list[round]){ picked.push(list[round]); addedThisRound = true; }
      if(picked.length >= RECOMMENDATIONS_COUNT) break;
    }
    if(!addedThisRound) break;
  }
  return picked;
}

function recommendationSnippet(e){
  const raw = (isRichCategory(e.category) ? (e.purpose || e.body) : e.body) || '';
  const clean = String(raw).replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? clean.slice(0, 90) + '…' : clean;
}

function renderRecommendationsHtml(level){
  const items = getRecommendedEntries(level);
  if(!items.length) return '';
  return `
    <div class="lrn-reco">
      <div class="lrn-reco-heading">Recommended for you</div>
      <div class="lrn-reco-list">
        ${items.map(e => `
          <button class="lrn-reco-item" data-id="${e.id}">
            <span class="lrn-reco-cat">${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</span>
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
          <span>XP: ${progress.xp || 0}</span>
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
         ${level !== 'expert' ? `<button class="lrn-btn-primary" id="lrnLevelUpBtn">Try ${escapeHtml(LEVEL_META[LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(level) + 1]].label)} &rarr;</button>` : ''}
       </div>`;

  return `
    <div class="lrn-card">
      <div class="lrn-level-block">
        <div class="lrn-level-title">AI LEVEL ${LEARNING_LEVEL_ORDER.indexOf(level) + 1} · ${escapeHtml(meta.label)}</div>
        <div class="lrn-progress-track lrn-progress-track-lg"><div class="lrn-progress-fill" style="width:${Math.round((done/total)*100)}%"></div></div>
        <div class="lrn-level-sub">${done}/${total} lessons complete · ${progress.xp || 0} XP total (${xpInfo.into}/${xpInfo.needed} to next learner level)</div>
      </div>
      ${nextLessonHtml}
    </div>
    ${renderRecommendationsHtml(level)}`;
}

function bindOverviewLevelUp(){
  const btn = document.getElementById('lrnLevelUpBtn');
  if(btn) btn.addEventListener('click', () => {
    const level = progress.currentLevel;
    const nextLevel = LEARNING_LEVEL_ORDER[LEARNING_LEVEL_ORDER.indexOf(level) + 1];
    progress.currentLevel = nextLevel;
    saveProgress();
    renderDashboard();
  });
}

function renderPathTab(){
  const done = progress.completedLessons || [];
  return `
    <div class="lrn-level-switch">
      ${LEARNING_LEVEL_ORDER.map(lv => `<button class="lrn-level-switch-btn ${reviewLevel === lv ? 'active' : ''}" data-lv="${lv}">${LEVEL_META[lv].emoji} ${LEVEL_META[lv].label}</button>`).join('')}
    </div>
    <div class="lrn-path-list">
      ${LEARNING_PATHS[reviewLevel].map((id, i) => {
        const lesson = LESSON_LIBRARY[id];
        const isDone = done.includes(id);
        const prevDone = i === 0 || done.includes(LEARNING_PATHS[reviewLevel][i - 1]);
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
  activeLesson = { levelKey, lessonId, step: 'learn', wrongAttempt: false };
  learningScreen = 'lesson';
  renderLearning();
}

function renderLesson(){
  const lesson = LESSON_LIBRARY[activeLesson.lessonId];
  const step = activeLesson.step;

  let body = '';
  if(step === 'learn'){
    body = `
      <div class="lrn-lesson-section">
        <h3>Learn</h3>
        <p>${escapeHtml(lesson.learn)}</p>
        ${lesson.example ? `
          <div class="lrn-example">
            ${lesson.example.bad ? `<div class="lrn-example-bad"><span>Bad:</span> ${escapeHtml(lesson.example.bad)}</div>` : ''}
            <div class="lrn-example-good"><span>${lesson.example.bad ? 'Better:' : escapeHtml(lesson.example.label) + ':'}</span> ${escapeHtml(lesson.example.good)}</div>
          </div>` : ''}
      </div>
      <button class="lrn-btn-primary" id="lrnNextStep">Continue</button>`;
  }else if(step === 'practice'){
    body = `
      <div class="lrn-lesson-section">
        <h3>Practice</h3>
        <p>${escapeHtml(lesson.practice)}</p>
        <p class="lrn-practice-hint">Try it now in Claude or ChatGPT, then come back and continue.</p>
      </div>
      <button class="lrn-btn-primary" id="lrnNextStep">I tried it — continue</button>`;
  }else if(step === 'quiz'){
    body = `
      <div class="lrn-lesson-section">
        ${activeLesson.wrongAttempt ? `<div class="lrn-quiz-retry">Not quite — take another look at the Learn section above, then try again.</div>` : ''}
        <h3>Quick check</h3>
        <p>${escapeHtml(lesson.quiz.question)}</p>
        <div class="lrn-options">
          ${lesson.quiz.options.map((opt, i) => `<button class="lrn-option-btn" data-i="${i}">${escapeHtml(opt.text)}</button>`).join('')}
        </div>
      </div>`;
  }else if(step === 'done'){
    body = `
      <div class="lrn-lesson-complete">
        <div class="lrn-complete-emoji">🎉</div>
        <h2>Lesson Complete!</h2>
        <p>+${XP_PER_LESSON + (activeLesson.wrongAttempt ? 0 : XP_PER_QUIZ_CORRECT)} XP</p>
        ${activeLesson.newBadges && activeLesson.newBadges.length ? `
          <div class="lrn-new-badges">
            ${activeLesson.newBadges.map(id => {
              const b = BADGE_LIBRARY.find(x => x.id === id);
              return `<div class="lrn-new-badge">${b.emoji} ${escapeHtml(b.label)}</div>`;
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
  bindTopbar();

  const nextBtn = document.getElementById('lrnNextStep');
  if(nextBtn) nextBtn.addEventListener('click', advanceLessonStep);

  if(step === 'quiz'){
    learningRoot.querySelectorAll('.lrn-option-btn').forEach(btn => {
      btn.addEventListener('click', () => answerLessonQuiz(lesson, Number(btn.dataset.i)));
    });
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

function answerLessonQuiz(lesson, optionIndex){
  const correct = lesson.quiz.options[optionIndex].correct;
  if(!correct){
    activeLesson.wrongAttempt = true;
    activeLesson.step = 'learn';
    renderLearning();
    return;
  }
  completeLesson();
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
  saveProgress();
  renderLearning();
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

function renderMyAiProgressPanel(){
  if(typeof closeAccountMenu === 'function') closeAccountMenu();
  const user = firebase.auth().currentUser;
  if(!user) return;
  if(!progress) progress = loadLocalProgress();

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
      <div class="lrn-profile-stat"><span>XP earned</span><strong>${progress.xp || 0}</strong></div>
      <div class="lrn-profile-stat"><span>Lessons completed</span><strong>${(progress.completedLessons || []).length}</strong></div>
      <div class="lrn-profile-stat"><span>Badges</span><strong>${(progress.badges || []).length}</strong></div>
    </div>
    <div class="lrn-profile-course">
      <span>Current course</span>
      <strong>${escapeHtml(meta.label)}${nextId ? ` · Next: ${escapeHtml(LESSON_LIBRARY[nextId].title)}` : ' · Path complete'}</strong>
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
// ---------------------------------------------------------------------------
let learningAutoCheckDone = false;

firebase.auth().onAuthStateChanged((user) => {
  if(!user){
    learningAutoCheckDone = false;
    if(learningUnsub){ learningUnsub(); learningUnsub = null; }
    progress = null;
    return;
  }
  if(learningAutoCheckDone) return;
  learningAutoCheckDone = true;

  progress = loadLocalProgress();
  subscribeLearningProgress();
  if(progress.assessmentResult) return; // already assessed — never force it again

  setTimeout(() => {
    const otherOverlayOpen = Array.from(document.querySelectorAll('.overlay.open'))
      .some(el => el.id !== 'staffAuthOverlay');
    if(otherOverlayOpen || viewLearning.classList.contains('active')) return;
    if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
    viewNotes.classList.remove('active');
    viewLearning.classList.add('active');
    bumpStreak();
    saveProgress();
    learningScreen = 'onboarding';
    renderLearning();
  }, 300); // let any in-flight UI (e.g. the sign-in modal closing) settle first
});
