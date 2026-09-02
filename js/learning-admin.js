// ============= Company AI Capability Dashboard (admin only) =============
// Mirrors js/analytics.js's shape (whole-collection read + client-side
// aggregation + bar-row rendering), applied to learningProgress docs instead
// of entries — a separate view/file, not a merge with the existing resource-
// usage Analytics tab. Requires the learningProgress/{uid} Firestore rule
// (admin read-all) added alongside this feature — see docs/ for the rule.
const learningAdminView = document.getElementById('learningAdminView');
const openLearningAdminNavBtn = document.getElementById('openLearningAdminNav');
let learningAdminDocs = null; // cached once per open, refreshed via the Refresh button
let learningAdminDept = 'all'; // 'all' or one of LIBRARY_DEPARTMENTS ('Unassigned' for null/blank)

// ---- Report & reminder settings (adminState/learningReportSettings) — read by
// the scheduled Apps Script job on every run, so changes here take effect on
// the next nightly/monthly run without redeploying anything. ----
let learningReportSettings = null; // null until first loaded
const LEARNING_REPORT_SETTINGS_DEFAULTS = {
  reportEmail: '',
  reportDay: 1,
  inactivityThresholdDays: 14,
  reminderFrequencyDays: 14,
  rankingEnabled: true,
  leaderboardVisible: false
};

async function loadLearningReportSettings(){
  const snap = await adminStateCollection.doc('learningReportSettings').get();
  learningReportSettings = Object.assign({}, LEARNING_REPORT_SETTINGS_DEFAULTS, snap.exists ? snap.data() : {});
}

async function saveLearningReportSettings(patch){
  learningReportSettings = Object.assign({}, learningReportSettings, patch);
  await adminStateCollection.doc('learningReportSettings').set(learningReportSettings, { merge: true });
}

function reportSettingsHtml(){
  if(!learningReportSettings) return '<div class="s-empty">Loading settings…</div>';
  const s = learningReportSettings;
  return `
    <div class="lrn-admin-settings">
      <label class="lrn-admin-settings-row">
        <span>Monthly report recipient email</span>
        <input type="email" class="lrn-admin-search" id="lrnSettingReportEmail" placeholder="name@oryxdoors.com" value="${escapeHtml(s.reportEmail || '')}">
      </label>
      <label class="lrn-admin-settings-row">
        <span>Day of month the report is sent</span>
        <input type="number" min="1" max="28" class="lrn-admin-search" id="lrnSettingReportDay" value="${s.reportDay}">
      </label>
      <label class="lrn-admin-settings-row">
        <span>Inactive after (days with no activity)</span>
        <input type="number" min="1" class="lrn-admin-search" id="lrnSettingInactivityDays" value="${s.inactivityThresholdDays}">
      </label>
      <label class="lrn-admin-settings-row">
        <span>Don't remind again for (days)</span>
        <input type="number" min="1" class="lrn-admin-search" id="lrnSettingReminderFrequency" value="${s.reminderFrequencyDays}">
      </label>
      <label class="lrn-admin-settings-row lrn-admin-settings-row--check">
        <span>Ranking enabled</span>
        <input type="checkbox" class="lrn-admin-checkbox" id="lrnSettingRankingEnabled" ${s.rankingEnabled ? 'checked' : ''}>
      </label>
      <label class="lrn-admin-settings-row lrn-admin-settings-row--check">
        <span>Show a public leaderboard to all staff</span>
        <input type="checkbox" class="lrn-admin-checkbox" id="lrnSettingLeaderboardVisible" ${s.leaderboardVisible ? 'checked' : ''}>
      </label>
      <p class="lrn-admin-settings-note">Rankings, achievements, and reminders update overnight — not instantly. Settings saved here apply on the next scheduled run.</p>
      <div id="lrnSettingsSaveStatus" class="lrn-admin-settings-status"></div>
    </div>`;
}

function bindReportSettings(){
  const fieldMap = [
    ['lrnSettingReportEmail', 'reportEmail', v => v.trim()],
    ['lrnSettingReportDay', 'reportDay', v => Math.min(28, Math.max(1, Number(v) || 1))],
    ['lrnSettingInactivityDays', 'inactivityThresholdDays', v => Math.max(1, Number(v) || 1)],
    ['lrnSettingReminderFrequency', 'reminderFrequencyDays', v => Math.max(1, Number(v) || 1)],
    ['lrnSettingRankingEnabled', 'rankingEnabled', (v, el) => el.checked],
    ['lrnSettingLeaderboardVisible', 'leaderboardVisible', (v, el) => el.checked]
  ];
  fieldMap.forEach(([id, key, transform]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const eventName = el.type === 'checkbox' ? 'change' : 'blur';
    el.addEventListener(eventName, async () => {
      const value = transform(el.value, el);
      const status = document.getElementById('lrnSettingsSaveStatus');
      if(status) status.textContent = 'Saving…';
      try{
        await saveLearningReportSettings({ [key]: value });
        if(status) status.textContent = 'Saved.';
      }catch(e){
        if(status) status.textContent = 'Could not save — check your connection and try again.';
      }
    });
  });
}

// ---- Employee table state (search/filter/sort) ----
let learningAdminSearch = '';
let learningAdminStatusFilter = 'all'; // all | active | inactive | top | improved | encourage
let learningAdminSort = { key: 'score', dir: 'desc' };
const INACTIVE_DAYS_THRESHOLD = 14; // local display-only threshold for the "Inactive" status column — separate from the admin-configurable reminder threshold used by the scheduled ranking/reminder job

// Every path total in one place — the ranking formula and the employee table
// both need "how many lessons exist across all 5 levels" (currently 40).
function totalLessonCount(){
  return LEARNING_LEVEL_ORDER.reduce((sum, lv) => sum + ((LEARNING_PATHS[lv] || []).length), 0);
}

// Average % progress across all 5 levels for one doc — rewards well-rounded
// progress rather than raw volume, matching the "Overall Learning Progress"
// ranking factor.
function docOverallProgressPct(doc){
  const pcts = LEARNING_LEVEL_ORDER.map(lv => {
    const path = LEARNING_PATHS[lv] || [];
    if(!path.length) return 0;
    const done = path.filter(id => (doc.completedLessons || []).includes(id)).length;
    return (done / path.length) * 100;
  });
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

// How many AI levels this employee has moved up since their first recorded
// assessment — never negative, never rewards a high starting level.
function docLevelImprovement(doc){
  const current = doc.currentLevel || (doc.assessmentResult && doc.assessmentResult.level);
  if(!current) return null;
  const history = doc.assessmentHistory || [];
  const firstLevel = history.length ? history[0].level : current;
  const delta = LEARNING_LEVEL_ORDER.indexOf(current) - LEARNING_LEVEL_ORDER.indexOf(firstLevel);
  return Math.max(0, delta);
}

// The official rankingScore is only ever written by the scheduled ranking job
// (see plan) — until that's run at least once for a doc, the admin table
// falls back to a client-side estimate using only the factors we can compute
// here (progress, lessons, assessment score, streak — reweighted to still sum
// to 100%). Consistency and level-improvement (25% of the real formula) are
// left to the real job since they need org-wide/day-log data this estimate
// doesn't have — so this is always labeled "(est.)" in the UI, never treated
// as the real score.
function docQuickScoreEstimate(doc){
  const progressPct = docOverallProgressPct(doc);
  const lessonsPct = Math.min(100, ((doc.completedLessons || []).length / totalLessonCount()) * 100);
  const scorePct = doc.assessmentResult ? doc.assessmentResult.score : 0;
  const streakPct = Math.min(100, ((doc.streak || 0) / 30) * 100);
  const weightSum = 0.30 + 0.20 + 0.20 + 0.05;
  const raw = progressPct * 0.30 + lessonsPct * 0.20 + scorePct * 0.20 + streakPct * 0.05;
  return Math.round(raw / weightSum);
}

function docDaysSinceActive(doc){
  if(!doc.lastActiveDate) return null;
  return Math.floor((Date.now() - new Date(doc.lastActiveDate).getTime()) / (24 * 60 * 60 * 1000));
}

function docStatusLabel(doc){
  const days = docDaysSinceActive(doc);
  if(days == null) return { key: 'inactive', label: 'Inactive' };
  return days <= INACTIVE_DAYS_THRESHOLD ? { key: 'active', label: 'Active' } : { key: 'inactive', label: 'Inactive' };
}

// Builds the row data every filter/sort/search operates on — computed once
// per render from whatever docs are already in scope (department-filtered).
function employeeRows(docs){
  return docs.map(d => {
    const hasOfficialScore = d.rankingScore != null;
    const score = hasOfficialScore ? d.rankingScore : docQuickScoreEstimate(d);
    const improvement = docLevelImprovement(d);
    const status = docStatusLabel(d);
    return {
      uid: d.uid,
      name: d.userName || null,
      email: d.userEmail || d.uid,
      department: d.department || 'Unassigned',
      level: d.currentLevel || (d.assessmentResult && d.assessmentResult.level) || null,
      lessons: (d.completedLessons || []).length,
      assessmentScore: d.assessmentResult ? d.assessmentResult.score : null,
      progressPct: Math.round(docOverallProgressPct(d)),
      lastActiveDate: d.lastActiveDate,
      daysSinceActive: docDaysSinceActive(d),
      streak: d.streak || 0,
      improvement,
      score,
      scoreIsEstimate: !hasOfficialScore,
      rank: d.rank,
      rankTotal: d.rankTotal,
      statusKey: status.key,
      statusLabel: status.label
    };
  });
}

function filterAndSortEmployeeRows(rows){
  let filtered = rows;
  const q = learningAdminSearch.trim().toLowerCase();
  if(q) filtered = filtered.filter(r => r.email.toLowerCase().includes(q) || (r.name && r.name.toLowerCase().includes(q)));

  if(learningAdminStatusFilter === 'active') filtered = filtered.filter(r => r.statusKey === 'active');
  else if(learningAdminStatusFilter === 'inactive') filtered = filtered.filter(r => r.statusKey === 'inactive');
  else if(learningAdminStatusFilter === 'top'){
    const sorted = filtered.slice().sort((a, b) => b.score - a.score);
    filtered = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1))); // top 10%
  }else if(learningAdminStatusFilter === 'improved'){
    filtered = filtered.filter(r => (r.improvement || 0) >= 1).sort((a, b) => (b.improvement || 0) - (a.improvement || 0));
  }else if(learningAdminStatusFilter === 'encourage'){
    filtered = filtered.filter(r => r.statusKey === 'inactive' || r.progressPct < 20);
  }

  const { key, dir } = learningAdminSort;
  const mult = dir === 'asc' ? 1 : -1;
  filtered = filtered.slice().sort((a, b) => {
    let av = a[key], bv = b[key];
    if(key === 'email' || key === 'level' || key === 'statusLabel'){
      av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase();
      return av < bv ? -mult : av > bv ? mult : 0;
    }
    av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
    return (av - bv) * mult;
  });
  return filtered;
}

function employeeTableHtml(rows){
  if(!rows.length) return '<div class="s-empty">No employees match this search/filter.</div>';
  const col = (key, label) => {
    const active = learningAdminSort.key === key;
    const arrow = active ? (learningAdminSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th data-sort-key="${key}" class="${active ? 'sorted' : ''}">${label}${arrow}</th>`;
  };
  return `
    <div class="lrn-admin-table-wrap">
      <table class="lrn-admin-table">
        <thead>
          <tr>
            ${col('email', 'Employee')}
            ${col('level', 'AI Level')}
            ${col('lessons', 'Lessons')}
            ${col('assessmentScore', 'Assessment')}
            ${col('progressPct', 'Progress')}
            ${col('lastActiveDate', 'Last Activity')}
            ${col('streak', 'Streak')}
            ${col('improvement', 'Improvement')}
            ${col('rank', 'Rank')}
            ${col('score', 'Score')}
            ${col('statusLabel', 'Status')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const meta = r.level ? LEVEL_META[r.level] : null;
            return `
              <tr>
                <td>${r.name ? `${escapeHtml(r.name)}<div class="lrn-admin-table-dim">${escapeHtml(r.email)}</div>` : escapeHtml(r.email)}<div class="lrn-admin-table-dept">${escapeHtml(r.department)}</div></td>
                <td>${meta ? `${meta.emoji} ${escapeHtml(meta.label)}` : '—'}</td>
                <td>${r.lessons}</td>
                <td>${r.assessmentScore != null ? r.assessmentScore + '%' : '—'}</td>
                <td>${r.progressPct}%</td>
                <td>${r.lastActiveDate ? new Date(r.lastActiveDate).toLocaleDateString() : '—'}${r.daysSinceActive != null ? ` <span class="lrn-admin-table-dim">(${r.daysSinceActive}d ago)</span>` : ''}</td>
                <td>${r.streak}</td>
                <td>${r.improvement != null ? '+' + r.improvement : '—'}</td>
                <td>${r.rank != null ? '#' + r.rank + (r.rankTotal ? ' of ' + r.rankTotal : '') : '—'}</td>
                <td>${r.score}${r.scoreIsEstimate ? ' <span class="lrn-admin-table-dim" title="Official ranking not computed yet — this is a rough estimate from what we can see today.">(est.)</span>' : ''}</td>
                <td><span class="lrn-admin-status lrn-admin-status--${r.statusKey}">${escapeHtml(r.statusLabel)}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function exitLearningAdminMode(){
  if(!hubMainEl.classList.contains('learning-admin-mode')) return;
  hubMainEl.classList.remove('learning-admin-mode');
  openLearningAdminNavBtn.classList.remove('active');
}

async function fetchLearningAdminDocs(){
  const snap = await learningCollection.get();
  return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
}

// A doc's "current" gaps, same logic as the per-user currentGaps() in
// learning.js, just applied to an arbitrary fetched doc rather than the
// signed-in user's own `progress` global.
function docCurrentGapLabels(doc){
  const result = doc.assessmentResult;
  if(!result) return [];
  const origCats = result.gapCategories || [];
  const origLabels = result.gaps || [];
  const completedCats = new Set(
    Object.keys(doc.resourceProgress || {})
      .filter(id => doc.resourceProgress[id] && doc.resourceProgress[id].status === 'completed')
      .map(id => { const e = entries.find(x => x.id === id); return e && e.category; })
      .filter(Boolean)
  );
  const labels = [];
  origCats.forEach((cat, i) => { if(!completedCats.has(cat)) labels.push(origLabels[i] || cat); });
  return labels;
}

function computeLearningStats(docs){
  const assessed = docs.filter(d => d.assessmentResult);
  const total = assessed.length;

  const byLevel = {};
  LEARNING_LEVEL_ORDER.forEach(lv => { byLevel[lv] = 0; });
  assessed.forEach(d => {
    const lv = d.currentLevel || d.assessmentResult.level;
    if(byLevel[lv] != null) byLevel[lv]++;
  });

  const resourceCompletions = [];
  docs.forEach(d => {
    Object.entries(d.resourceProgress || {}).forEach(([entryId, rp]) => {
      if(rp && rp.status === 'completed') resourceCompletions.push({ uid: d.uid, entryId });
    });
  });
  const usersWithCompletion = new Set(resourceCompletions.map(r => r.uid));
  const completionRate = total ? Math.round((usersWithCompletion.size / total) * 100) : 0;

  const now = Date.now();
  const activeRecent = docs.filter(d => d.lastActiveDate && (now - new Date(d.lastActiveDate).getTime()) <= 7 * 24 * 60 * 60 * 1000).length;
  const activeMonth = docs.filter(d => d.lastActiveDate && (now - new Date(d.lastActiveDate).getTime()) <= 30 * 24 * 60 * 60 * 1000).length;

  const avgProgress = total
    ? Math.round(assessed.reduce((sum, d) => {
        const lv = d.currentLevel || d.assessmentResult.level;
        const path = LEARNING_PATHS[lv];
        if(!path || !path.length) return sum;
        const done = path.filter(id => (d.completedLessons || []).includes(id)).length;
        return sum + (done / path.length) * 100;
      }, 0) / total)
    : 0;

  const gapTally = {};
  assessed.forEach(d => {
    docCurrentGapLabels(d).forEach(label => { gapTally[label] = (gapTally[label] || 0) + 1; });
  });
  const sortedGaps = Object.entries(gapTally).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const usageTally = {};
  resourceCompletions.forEach(r => { usageTally[r.entryId] = (usageTally[r.entryId] || 0) + 1; });
  const sortedUsage = Object.entries(usageTally)
    .map(([id, count]) => ({ id, count, title: ((entries.find(e => e.id === id) || {}).title) || 'Untitled' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { total, byLevel, completionRate, resourcesCompletedTotal: resourceCompletions.length, activeRecent, activeMonth, avgProgress, sortedGaps, sortedUsage };
}

// Every submitted (not yet reviewed) level-up challenge across all fetched
// docs, newest first. Respects whatever department scope the caller already
// filtered `docs` to — no separate fetch, reuses learningAdminDocs.
function pendingChallengeSubmissions(docs){
  const rows = [];
  docs.forEach(d => {
    Object.entries(d.levelChallenges || {}).forEach(([levelKey, state]) => {
      if(state && state.status === 'submitted' && state.attempts && state.attempts.length){
        const attemptIndex = state.attempts.length - 1;
        rows.push({ uid: d.uid, userEmail: d.userEmail, department: d.department, levelKey, attempt: state.attempts[attemptIndex], attemptIndex });
      }
    });
  });
  return rows.sort((a, b) => new Date(b.attempt.submittedAt) - new Date(a.attempt.submittedAt));
}

function pendingChallengesHtml(rows){
  if(!rows.length) return '<div class="s-empty">No challenges awaiting review.</div>';
  return rows.map(r => {
    const meta = LEVEL_META[r.levelKey];
    const challenge = challengeFor(r.levelKey, r.department);
    return `
      <div class="suggestion-item" data-uid="${escapeHtml(r.uid)}" data-level="${escapeHtml(r.levelKey)}" data-attempt="${r.attemptIndex}">
        <div class="s-meta">${escapeHtml(r.userEmail || r.uid)} · ${escapeHtml(r.department || 'Unassigned')} · ${meta.emoji} ${escapeHtml(meta.label)} · ${escapeHtml(new Date(r.attempt.submittedAt).toLocaleDateString())}</div>
        <div class="s-text">${escapeHtml(challenge ? challenge.prompt : 'Challenge prompt unavailable')}</div>
        <div class="s-text"><strong>Evidence:</strong> ${
          r.attempt.evidenceUrl
            ? `<a href="${escapeHtml(r.attempt.evidenceUrl)}" target="_blank" rel="noopener">${escapeHtml(r.attempt.evidenceFileName || 'View link')}</a>`
            : 'No evidence submitted'
        }</div>
        <div class="s-text"><strong>Explanation:</strong> ${escapeHtml(r.attempt.explanation)}</div>
        <textarea placeholder="Optional note back to the employee…" style="width:100%;min-height:60px;margin-bottom:10px;"></textarea>
        <div class="s-actions">
          <button class="btn-small solid" data-decision="passed">Passed</button>
          <button class="btn-small ghost" data-decision="needs_improvement">Needs Improvement</button>
        </div>
      </div>`;
  }).join('');
}

// Admin-only: marks another user's challenge attempt reviewed. Requires the
// scoped Firestore rule allowing admin writes limited to the levelChallenges
// field (see setup notes) — fails harmlessly with an inline message if that
// rule isn't published yet.
async function reviewChallengeSubmission(uid, levelKey, attemptIndex, decision, note){
  const docRef = learningCollection.doc(uid);
  const snap = await docRef.get();
  const data = snap.data() || {};
  const state = (data.levelChallenges && data.levelChallenges[levelKey]) || { status: 'submitted', attempts: [] };
  const attempt = state.attempts[attemptIndex];
  if(!attempt) throw new Error('attempt-not-found');
  attempt.reviewedAt = new Date().toISOString();
  attempt.reviewedBy = (firebase.auth().currentUser && firebase.auth().currentUser.email) || null;
  attempt.reviewStatus = decision;
  attempt.reviewNote = note || null;
  state.status = decision;
  await docRef.update({ [`levelChallenges.${levelKey}`]: state });
}

function bindPendingChallenges(container){
  container.querySelectorAll('.suggestion-item[data-uid]').forEach(card => {
    card.querySelectorAll('button[data-decision]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = card.dataset.uid, levelKey = card.dataset.level, attemptIndex = Number(card.dataset.attempt);
        const note = card.querySelector('textarea').value.trim();
        card.querySelectorAll('button').forEach(b => b.disabled = true);
        try{
          await reviewChallengeSubmission(uid, levelKey, attemptIndex, btn.dataset.decision, note);
          learningAdminDocs = null;
          renderLearningAdmin();
        }catch(e){
          card.insertAdjacentHTML('beforeend', '<div class="s-text" style="color:var(--danger);">Could not save review — check the Firestore rules have been updated (see setup notes).</div>');
          card.querySelectorAll('button').forEach(b => b.disabled = false);
        }
      });
    });
  });
}

function levelBarRowsHtml(byLevel, total){
  const max = Math.max(1, ...LEARNING_LEVEL_ORDER.map(lv => byLevel[lv] || 0));
  return LEARNING_LEVEL_ORDER.map(lv => {
    const meta = LEVEL_META[lv];
    const count = byLevel[lv] || 0;
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="analytics-cat-row">
        <div class="analytics-cat-top"><span>${meta.emoji} ${escapeHtml(meta.label)}</span><span>${count} (${pct}%)</span></div>
        <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round((count / max) * 100)}%;background:${meta.color};"></div></div>
      </div>`;
  }).join('');
}

function renderLearningAdmin(){
  if(!learningAdminDocs){
    learningAdminView.innerHTML = `<div class="analytics-page-head"><h2>AI Capability</h2><p class="analytics-page-sub">Loading…</p></div>`;
    fetchLearningAdminDocs().then(docs => { learningAdminDocs = docs; renderLearningAdmin(); }).catch(() => {
      learningAdminView.innerHTML = `<div class="analytics-page-head"><h2>AI Capability</h2><p class="analytics-page-sub">Could not load learning data. Check your connection and try again.</p></div>`;
    });
    return;
  }
  if(!learningReportSettings){
    loadLearningReportSettings().then(renderLearningAdmin).catch(() => {
      learningReportSettings = Object.assign({}, LEARNING_REPORT_SETTINGS_DEFAULTS);
      renderLearningAdmin();
    });
  }

  const scopedDocs = learningAdminDept === 'all'
    ? learningAdminDocs
    : learningAdminDocs.filter(d => (d.department || 'Unassigned') === learningAdminDept);
  const stats = computeLearningStats(scopedDocs);
  const maxGap = Math.max(1, ...stats.sortedGaps.map(([, c]) => c));
  const maxUsage = Math.max(1, ...stats.sortedUsage.map(u => u.count));
  const pendingChallenges = pendingChallengeSubmissions(scopedDocs);

  const deptOptions = ['all', ...LIBRARY_DEPARTMENTS, 'Unassigned'];
  const deptLabel = (d) => d === 'all' ? 'All Departments' : d;
  const deptSelectHtml = `
    <select class="filter-select" id="learningAdminDeptSelect">
      ${deptOptions.map(d => `<option value="${escapeHtml(d)}"${d === learningAdminDept ? ' selected' : ''}>${escapeHtml(deptLabel(d))}</option>`).join('')}
    </select>`;

  learningAdminView.innerHTML = `
    <div class="analytics-page-head">
      <h2>AI Capability</h2>
      <p class="analytics-page-sub">How ${learningAdminDept === 'all' ? 'the whole company is' : escapeHtml(learningAdminDept) + ' is'} progressing in AI knowledge</p>
    </div>
    <div class="analytics-section-head" style="margin-bottom:16px;">
      <h3>Department</h3>
      ${deptSelectHtml}
    </div>
    <div class="analytics-kpis analytics-kpis--wide">
      <div class="analytics-kpi"><span class="analytics-kpi-label">Employees Assessed</span><span class="analytics-kpi-value">${stats.total}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Completion Rate</span><span class="analytics-kpi-value">${stats.completionRate}%</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Avg Progress</span><span class="analytics-kpi-value">${stats.avgProgress}%</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Resources Completed</span><span class="analytics-kpi-value">${stats.resourcesCompletedTotal}</span></div>
    </div>
    <div class="analytics-kpis analytics-kpis--wide" style="margin-top:10px;">
      <div class="analytics-kpi"><span class="analytics-kpi-label">Active (7 days)</span><span class="analytics-kpi-value">${stats.activeRecent}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Active (30 days)</span><span class="analytics-kpi-value">${stats.activeMonth}</span></div>
    </div>

    <h3 class="analytics-section-head" style="margin-top:28px;">Employee Learning Progress</h3>
    <div class="lrn-admin-table-controls">
      <input type="search" class="lrn-admin-search" id="learningAdminSearch" placeholder="Search by email…" value="${escapeHtml(learningAdminSearch)}">
      <select class="filter-select" id="learningAdminStatusFilter">
        <option value="all"${learningAdminStatusFilter === 'all' ? ' selected' : ''}>All employees</option>
        <option value="active"${learningAdminStatusFilter === 'active' ? ' selected' : ''}>Active (last ${INACTIVE_DAYS_THRESHOLD} days)</option>
        <option value="inactive"${learningAdminStatusFilter === 'inactive' ? ' selected' : ''}>Inactive</option>
        <option value="top"${learningAdminStatusFilter === 'top' ? ' selected' : ''}>Top performers</option>
        <option value="improved"${learningAdminStatusFilter === 'improved' ? ' selected' : ''}>Most improved</option>
        <option value="encourage"${learningAdminStatusFilter === 'encourage' ? ' selected' : ''}>Needs encouragement</option>
      </select>
    </div>
    ${employeeTableHtml(filterAndSortEmployeeRows(employeeRows(scopedDocs)))}

    <h3 class="analytics-section-head" style="margin-top:28px;">Challenges Awaiting Review${pendingChallenges.length ? ` (${pendingChallenges.length})` : ''}</h3>
    <div id="learningAdminPendingChallenges">${pendingChallengesHtml(pendingChallenges)}</div>

    <h3 class="analytics-section-head" style="margin-top:28px;">AI Knowledge Levels</h3>
    <div class="analytics-cats">${levelBarRowsHtml(stats.byLevel, stats.total)}</div>

    <h3 class="analytics-section-head" style="margin-top:28px;">Most Common Knowledge Gaps</h3>
    <div class="analytics-cats">
      ${stats.sortedGaps.length ? stats.sortedGaps.map(([label, count]) => `
        <div class="analytics-cat-row">
          <div class="analytics-cat-top"><span>${escapeHtml(label)}</span><span>${count}</span></div>
          <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round(count / maxGap * 100)}%;"></div></div>
        </div>
      `).join('') : '<div class="s-empty">No gaps recorded yet.</div>'}
    </div>

    <h3 class="analytics-section-head" style="margin-top:28px;">Most-Used Resources</h3>
    <div class="analytics-cats">
      ${stats.sortedUsage.length ? stats.sortedUsage.map(u => `
        <div class="analytics-cat-row">
          <div class="analytics-cat-top"><span>${escapeHtml(u.title)}</span><span>${u.count}</span></div>
          <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round(u.count / maxUsage * 100)}%;"></div></div>
        </div>
      `).join('') : '<div class="s-empty">No resources completed yet.</div>'}
    </div>

    <h3 class="analytics-section-head" style="margin-top:28px;">Report &amp; Reminder Settings</h3>
    ${reportSettingsHtml()}

    <p class="analytics-footnote">
      <button class="lrn-btn-text" id="learningAdminRefresh">Refresh data</button>
    </p>
  `;

  const refreshBtn = document.getElementById('learningAdminRefresh');
  if(refreshBtn) refreshBtn.addEventListener('click', () => { learningAdminDocs = null; renderLearningAdmin(); });

  bindReportSettings();
  bindPendingChallenges(learningAdminView);

  const deptSelect = document.getElementById('learningAdminDeptSelect');
  if(deptSelect) deptSelect.addEventListener('change', () => {
    learningAdminDept = deptSelect.value;
    renderLearningAdmin();
  });

  const searchInput = document.getElementById('learningAdminSearch');
  if(searchInput){
    searchInput.addEventListener('input', () => {
      learningAdminSearch = searchInput.value;
      renderLearningAdmin();
      const el = document.getElementById('learningAdminSearch');
      if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }
  const statusFilter = document.getElementById('learningAdminStatusFilter');
  if(statusFilter) statusFilter.addEventListener('change', () => {
    learningAdminStatusFilter = statusFilter.value;
    renderLearningAdmin();
  });
  learningAdminView.querySelectorAll('.lrn-admin-table th[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if(learningAdminSort.key === key){
        learningAdminSort.dir = learningAdminSort.dir === 'asc' ? 'desc' : 'asc';
      }else{
        learningAdminSort = { key, dir: 'desc' };
      }
      renderLearningAdmin();
    });
  });
}

function enterLearningAdminMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitDeptFilesMode === 'function') exitDeptFilesMode();
  if(typeof exitSettingsMode === 'function') exitSettingsMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active').forEach(b => b.classList.remove('active'));
  openLearningAdminNavBtn.classList.add('active');
  hubMainEl.classList.add('learning-admin-mode');
  repositionAllTabIndicators();
  learningAdminDocs = null; // always fetch fresh on entry
  learningAdminDept = 'all';
  learningReportSettings = null; // always fetch fresh on entry
  renderLearningAdmin();
}

openLearningAdminNavBtn.addEventListener('click', enterLearningAdminMode);

// ---------------------------------------------------------------------------
// Settings page (admin only) — a full page like AI Capability/Analytics, not
// a slide-in panel. A category list on the left, the selected category's form
// on the right. Reuses the same reportSettingsHtml()/bindReportSettings() as
// the Report & Reminder section used to show inline on the AI Capability
// dashboard, so there's only one place that settings form's markup/logic lives.
// ---------------------------------------------------------------------------
const settingsView = document.getElementById('settingsView');
const openSettingsNavBtn = document.getElementById('openSettingsNav');
let activeSettingsCategory = 'reportReminder';

const SETTINGS_CATEGORIES = [
  { key: 'reportReminder', label: 'Report & Reminder' }
];

const SETTINGS_CATEGORY_RENDERERS = {
  reportReminder: (container) => {
    container.innerHTML = reportSettingsHtml();
    bindReportSettings();
  }
};

function settingsCategoryNavHtml(){
  return SETTINGS_CATEGORIES.map(c => `
    <button class="settings-cat-btn${c.key === activeSettingsCategory ? ' active' : ''}" data-cat="${c.key}">${escapeHtml(c.label)}</button>
  `).join('');
}

function renderSettingsPage(){
  settingsView.innerHTML = `
    <div class="analytics-page-head">
      <h2>Settings</h2>
      <p class="analytics-page-sub">Hub configuration</p>
    </div>
    <div class="settings-layout">
      <nav class="settings-categories" id="settingsCategories">${settingsCategoryNavHtml()}</nav>
      <div class="settings-content" id="settingsContent"><div class="s-empty">Loading settings…</div></div>
    </div>`;
  settingsView.querySelectorAll('.settings-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => renderSettingsCategory(btn.dataset.cat));
  });
  renderSettingsCategory(activeSettingsCategory);
}

function renderSettingsCategory(cat){
  activeSettingsCategory = cat;
  settingsView.querySelectorAll('.settings-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  const container = document.getElementById('settingsContent');
  const renderer = SETTINGS_CATEGORY_RENDERERS[cat];
  if(!renderer){ container.innerHTML = '<div class="s-empty">Nothing here yet.</div>'; return; }
  if(learningReportSettings){ renderer(container); return; }
  container.innerHTML = '<div class="s-empty">Loading settings…</div>';
  loadLearningReportSettings()
    .then(() => renderer(container))
    .catch(() => { container.innerHTML = '<div class="s-empty">Could not load settings. Check your connection and try again.</div>'; });
}

function exitSettingsMode(){
  if(!hubMainEl.classList.contains('settings-mode')) return;
  hubMainEl.classList.remove('settings-mode');
  openSettingsNavBtn.classList.remove('active');
}

function enterSettingsMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitLearningAdminMode === 'function') exitLearningAdminMode();
  if(typeof exitDeptFilesMode === 'function') exitDeptFilesMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active, .sidebar-analytics-item.active').forEach(b => b.classList.remove('active'));
  openSettingsNavBtn.classList.add('active');
  hubMainEl.classList.add('settings-mode');
  if(typeof repositionAllTabIndicators === 'function') repositionAllTabIndicators();
  learningReportSettings = null; // always fetch fresh on entry
  renderSettingsPage();
}

if(openSettingsNavBtn) openSettingsNavBtn.addEventListener('click', enterSettingsMode);
