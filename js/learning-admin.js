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
let learningAdminDetailUid = null; // uid of the employee whose detail view is showing, or null for the dashboard
let learningAdminPage = 1; // 1-based — reset to 1 whenever search/filter/sort/department changes
const LEARNING_ADMIN_PAGE_SIZE = 5;
const INACTIVE_DAYS_THRESHOLD = 14; // local display-only threshold for the "Inactive" status column — separate from the admin-configurable reminder threshold used by the scheduled ranking/reminder job

// Every path total in one place — the ranking formula and the employee table
// both need "how many lessons exist across all 5 levels" (currently 20).
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
// Surfaces an in-progress Level-Up challenge next to the AI Level column so
// an admin isn't confused by a level that looks "stuck" (e.g. lessons done
// but level unchanged) without knowing a challenge is awaiting review/redo.
function docPendingChallengeInfo(doc){
  const entries = Object.entries(doc.levelChallenges || {});
  for(const [levelKey, state] of entries){
    if(state && state.status === 'submitted') return { levelKey, status: 'submitted' };
  }
  for(const [levelKey, state] of entries){
    if(state && state.status === 'needs_improvement') return { levelKey, status: 'needs_improvement' };
  }
  return null;
}

// Falls back to a readable name derived from the email's local part when no
// userName is set, so the table never shows a bare email as the primary
// label — e.g. "leveluptest@oryxdoors.com" -> "Leveluptest".
function displayNameFromEmail(email){
  const local = (email || '').split('@')[0];
  if(!local) return email;
  return local.split(/[._-]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function employeeRows(docs){
  return docs.map(d => {
    const hasOfficialScore = d.rankingScore != null;
    const score = hasOfficialScore ? d.rankingScore : docQuickScoreEstimate(d);
    const improvement = docLevelImprovement(d);
    const status = docStatusLabel(d);
    const email = d.userEmail || d.uid;
    return {
      uid: d.uid,
      name: d.userName || displayNameFromEmail(email),
      email,
      department: d.department || 'Unassigned',
      level: d.currentLevel || (d.assessmentResult && d.assessmentResult.level) || null,
      pendingChallenge: docPendingChallengeInfo(d),
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

// Top scorers, highest first — same score value/estimate-flag already
// computed in employeeRows(), just ranked and capped rather than
// re-derived.
function leaderboardHtml(rows, limit){
  const ranked = rows.filter(r => r.score != null).slice().sort((a, b) => b.score - a.score).slice(0, limit || 10);
  if(!ranked.length) return '<div class="s-empty">No scores yet.</div>';
  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="lrn-leaderboard">
      ${ranked.map((r, i) => `
        <div class="lrn-leaderboard-row">
          <span class="lrn-leaderboard-rank">${medals[i] || (i + 1)}</span>
          <div class="lrn-leaderboard-name">
            <strong>${r.name ? escapeHtml(r.name) : escapeHtml(r.email)}</strong>
            <span class="lrn-admin-table-dim">${escapeHtml(r.department)}</span>
          </div>
          <span class="lrn-leaderboard-score">${r.score}${r.scoreIsEstimate ? ' <span class="lrn-admin-table-dim">(est.)</span>' : ''}</span>
        </div>`).join('')}
    </div>`;
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
            ${col('rank', 'Rank')}
            ${col('score', 'Score')}
            ${col('statusLabel', 'Status')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const meta = r.level ? LEVEL_META[r.level] : null;
            const pc = r.pendingChallenge;
            const pcMeta = pc ? LEVEL_META[pc.levelKey] : null;
            const pcBadge = pc
              ? (pc.status === 'submitted'
                  ? `<span class="lrn-admin-pending-badge lrn-admin-pending-badge--submitted" title="${escapeHtml(pcMeta ? pcMeta.label : pc.levelKey)} challenge submitted, awaiting review">⏳ Awaiting review</span>`
                  : `<span class="lrn-admin-pending-badge lrn-admin-pending-badge--needs-improvement" title="${escapeHtml(pcMeta ? pcMeta.label : pc.levelKey)} challenge sent back for improvement">⏳ Needs improvement</span>`)
              : '';
            return `
              <tr class="lrn-admin-row-clickable" data-uid="${escapeHtml(r.uid)}">
                <td>${escapeHtml(r.name)}<div class="lrn-admin-table-dim">${escapeHtml(r.email)}</div><div class="lrn-admin-table-dept">${escapeHtml(r.department)}</div></td>
                <td>${meta ? `${meta.emoji} ${escapeHtml(meta.label)}` : '—'}${pcBadge ? `<div>${pcBadge}</div>` : ''}</td>
                <td>${r.lessons}</td>
                <td>${r.assessmentScore != null ? r.assessmentScore + '%' : '—'}</td>
                <td>${r.progressPct}%</td>
                <td>${r.lastActiveDate ? new Date(r.lastActiveDate).toLocaleDateString() : '—'}${r.daysSinceActive != null ? ` <span class="lrn-admin-table-dim">(${r.daysSinceActive}d ago)</span>` : ''}</td>
                <td>${r.streak}</td>
                <td>${r.rank != null ? '#' + r.rank + (r.rankTotal ? ' of ' + r.rankTotal : '') : '—'}</td>
                <td>${r.score}${r.scoreIsEstimate ? ' <span class="lrn-admin-table-dim" title="Official ranking not computed yet — this is a rough estimate from what we can see today.">(est.)</span>' : ''}</td>
                <td><span class="lrn-admin-status lrn-admin-status--${r.statusKey}">${escapeHtml(r.statusLabel)}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// Prev/Next pager for the employee table — `page` is 1-based. Returns '' when
// everything fits on one page, so no empty control bar shows up for small teams.
function employeeTablePaginationHtml(totalCount, page, pageSize){
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if(totalPages <= 1) return '';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);
  return `
    <div class="lrn-admin-pagination">
      <span class="lrn-admin-pagination-info">Showing ${start}–${end} of ${totalCount}</span>
      <div class="lrn-admin-pagination-controls">
        <button class="lrn-btn-text" id="lrnAdminPagePrev" ${page <= 1 ? 'disabled' : ''}>&larr; Previous</button>
        <span class="lrn-admin-pagination-page">Page ${page} of ${totalPages}</span>
        <button class="lrn-btn-text" id="lrnAdminPageNext" ${page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
      </div>
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
  const notAssessedCount = docs.length - total;

  const byLevel = {};
  LEARNING_LEVEL_ORDER.forEach(lv => { byLevel[lv] = 0; });
  assessed.forEach(d => {
    const lv = d.currentLevel || d.assessmentResult.level;
    if(byLevel[lv] != null) byLevel[lv]++;
  });

  let avgLevelKey = null;
  if(total){
    const avgIndex = assessed.reduce((sum, d) => {
      const lv = d.currentLevel || d.assessmentResult.level;
      return sum + Math.max(0, LEARNING_LEVEL_ORDER.indexOf(lv));
    }, 0) / total;
    avgLevelKey = LEARNING_LEVEL_ORDER[Math.round(avgIndex)];
  }

  const resourceCompletions = [];
  docs.forEach(d => {
    Object.entries(d.resourceProgress || {}).forEach(([entryId, rp]) => {
      if(rp && rp.status === 'completed') resourceCompletions.push({ uid: d.uid, entryId });
    });
  });
  const usersWithCompletion = new Set(resourceCompletions.map(r => r.uid));
  const completionRate = total ? Math.round((usersWithCompletion.size / total) * 100) : 0;

  const now = Date.now();
  const activeCount = docs.filter(d => d.lastActiveDate && (now - new Date(d.lastActiveDate).getTime()) <= INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000).length;

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

  return { total, notAssessedCount, avgLevelKey, byLevel, completionRate, resourcesCompletedTotal: resourceCompletions.length, activeCount, avgProgress, sortedGaps, sortedUsage };
}

// Average learning progress per department, always computed from the full
// (department-unfiltered) doc set — the point is comparing departments
// against each other, so it never uses the department-scoped subset.
function departmentProgressStats(docs){
  const depts = [...LIBRARY_DEPARTMENTS, 'Unassigned'];
  return depts.map(dept => {
    const deptDocs = docs.filter(d => (d.department || 'Unassigned') === dept);
    if(!deptDocs.length) return null;
    const avg = Math.round(deptDocs.reduce((sum, d) => sum + docOverallProgressPct(d), 0) / deptDocs.length);
    return { dept, avgProgress: avg, count: deptDocs.length };
  }).filter(Boolean).sort((a, b) => b.avgProgress - a.avgProgress);
}

function startOfWeekISO(d){
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}

// Aggregates real progressHistory snapshots (never invented data) across
// every doc in scope into one weekly activity count. Returns null when
// there's not enough real history to plot a meaningful trend.
function activityOverTimeSeries(docs){
  const events = docs.flatMap(d => (d.progressHistory || []).map(p => new Date(p.date))).filter(d => !isNaN(d));
  if(events.length < 2) return null;
  const tally = {};
  events.forEach(d => { const k = startOfWeekISO(d); tally[k] = (tally[k] || 0) + 1; });
  const sortedKeys = Object.keys(tally).sort();
  if(sortedKeys.length < 2) return null;
  const series = [];
  const cursor = new Date(sortedKeys[0]);
  const end = new Date(sortedKeys[sortedKeys.length - 1]);
  while(cursor <= end){
    const key = startOfWeekISO(cursor);
    series.push({ weekStart: key, count: tally[key] || 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  return series;
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

// Rough heuristic only, used purely to flag likely QA/test submissions for
// an admin's attention — never used to filter or hide anything, since a
// false positive here should never hide a real employee's work.
function isLikelyTestEmail(email){
  if(!email) return false;
  return /test|sample|rulecheck|qa\+|demo/i.test(email);
}

function pendingChallengesHtml(rows){
  if(!rows.length) return '<div class="s-empty">No challenges awaiting review.</div>';
  return rows.map(r => {
    const meta = LEVEL_META[r.levelKey];
    const challenge = challengeFor(r.levelKey, r.department);
    const testTag = isLikelyTestEmail(r.userEmail) ? ' <span class="lrn-admin-test-tag" title="Email looks like a QA/test account, not a real employee">TEST ACCOUNT</span>' : '';
    return `
      <div class="suggestion-item" data-uid="${escapeHtml(r.uid)}" data-level="${escapeHtml(r.levelKey)}" data-attempt="${r.attemptIndex}">
        <div class="s-meta">${escapeHtml(r.userEmail || r.uid)} · ${escapeHtml(r.department || 'Unassigned')} · ${meta.emoji} ${escapeHtml(meta.label)} · ${escapeHtml(new Date(r.attempt.submittedAt).toLocaleDateString())}${testTag}</div>
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

// Rounds a chart's y-axis ceiling up to a clean multiple of 4, so gridlines
// land on whole, readable numbers instead of the raw data max.
function niceAxisMax(max){
  if(max <= 4) return 4;
  return Math.ceil(max / 4) * 4;
}

function shortWeekLabel(iso){
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// One shared floating tooltip, lazily created and reused across every chart
// on the page (rather than a separate element per chart) so there's only
// ever one DOM node to position and show/hide.
function ensureChartTooltip(){
  let el = document.getElementById('lrnChartTooltip');
  if(!el){
    el = document.createElement('div');
    el.id = 'lrnChartTooltip';
    el.className = 'lrn-chart-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

// Wires hover for every [data-tooltip] element inside a freshly-rendered
// chart container — bars/points stay visually clean (no on-chart number
// clutter) and show their exact value only while the mouse is over them.
function bindChartTooltips(container){
  const tooltip = ensureChartTooltip();
  container.querySelectorAll('.lrn-chart-hit').forEach(el => {
    el.addEventListener('mouseenter', () => {
      tooltip.textContent = el.dataset.tooltip;
      tooltip.style.display = 'block';
    });
    el.addEventListener('mousemove', (ev) => {
      tooltip.style.left = (ev.clientX + 14) + 'px';
      tooltip.style.top = (ev.clientY + 14) + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

// Vertical bar chart with gridlines, axis labels, and a hover tooltip per
// bar (bound after render by bindChartTooltips — keeps the chart itself
// it's accessible for free). Same hand-built inline-SVG approach as
// progressGraphSvg() in learning.js: no charting library, no build step.
function levelDistributionChartSvg(byLevel, notAssessedCount){
  const cats = LEARNING_LEVEL_ORDER.map(lv => ({
    label: LEVEL_META[lv].label, color: LEVEL_META[lv].color, count: byLevel[lv] || 0
  }));
  cats.push({ label: 'Not Assessed', color: 'var(--silver)', count: notAssessedCount });
  const total = cats.reduce((s, c) => s + c.count, 0);

  const w = 720, h = 300, padL = 34, padR = 10, padT = 14, padB = 40;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const yMax = niceAxisMax(Math.max(...cats.map(c => c.count), 1));
  const steps = 4;
  const gap = 18;
  const barW = (plotW - gap * (cats.length - 1)) / cats.length;

  const gridlines = Array.from({ length: steps + 1 }, (_, i) => {
    const val = Math.round((yMax / steps) * i);
    const y = padT + plotH - (i / steps) * plotH;
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" class="lrn-chart-gridline"></line>
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="lrn-chart-axis-label">${val}</text>`;
  }).join('');

  const bars = cats.map((c, i) => {
    const x = padL + i * (barW + gap);
    const barH = (c.count / yMax) * plotH;
    const y = padT + plotH - barH;
    const pct = total ? Math.round((c.count / total) * 100) : 0;
    return `
      <rect class="lrn-chart-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH, 0).toFixed(1)}" rx="6" fill="${c.color}" data-tooltip="${escapeHtml(c.label)}: ${c.count} (${pct}%)"></rect>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(h - padB + 18).toFixed(1)}" text-anchor="middle" class="lrn-chart-axis-label">${escapeHtml(c.label)}</text>`;
  }).join('');

  return `
    <div class="lrn-chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="lrn-chart-svg">${gridlines}${bars}</svg>
    </div>`;
}

// Horizontal bar chart, same gridline/tooltip approach as above.
function departmentProgressChartSvg(deptStats){
  if(!deptStats.length) return '<div class="s-empty">No department data yet.</div>';
  const w = 760, padL = 132, padR = 46, padT = 10, padB = 30;
  const barH = 26, gap = 14;
  const n = deptStats.length;
  const plotH = n * barH + (n - 1) * gap;
  const h = padT + plotH + padB;
  const plotW = w - padL - padR;
  const xMax = 100, steps = 4;

  const gridlines = Array.from({ length: steps + 1 }, (_, i) => {
    const val = Math.round((xMax / steps) * i);
    const x = padL + (i / steps) * plotW;
    return `
      <line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" class="lrn-chart-gridline"></line>
      <text x="${x.toFixed(1)}" y="${(padT + plotH + 20).toFixed(1)}" text-anchor="middle" class="lrn-chart-axis-label">${val}%</text>`;
  }).join('');

  const bars = deptStats.map((d, i) => {
    const y = padT + i * (barH + gap);
    const barWidth = (d.avgProgress / xMax) * plotW;
    return `
      <text x="${padL - 10}" y="${(y + barH / 2 + 4).toFixed(1)}" text-anchor="end" class="lrn-chart-cat-label">${escapeHtml(d.dept)}</text>
      <rect class="lrn-chart-hit" x="${padL}" y="${y.toFixed(1)}" width="${Math.max(barWidth, 0).toFixed(1)}" height="${barH}" rx="6" fill="var(--oryx-blue)" data-tooltip="${escapeHtml(d.dept)}: ${d.avgProgress}% (${d.count} employee${d.count === 1 ? '' : 's'})"></rect>`;
  }).join('');

  return `
    <div class="lrn-chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="lrn-chart-svg">${gridlines}${bars}</svg>
    </div>`;
}

// Line chart with gridlines, axis labels, and a per-point marker/tooltip
// (not just the last point) — same no-library inline-SVG approach.
function activityOverTimeSvg(series){
  if(!series){
    return '<div class="s-empty">Not enough activity data yet.</div>';
  }
  const w = 900, h = 220, padL = 34, padR = 14, padT = 14, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const n = series.length;
  const xs = series.map((_, i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW));
  const maxCount = niceAxisMax(Math.max(...series.map(p => p.count), 1));
  const ys = series.map(p => padT + plotH - (p.count / maxCount) * plotH);
  const steps = 4;

  const gridlines = Array.from({ length: steps + 1 }, (_, i) => {
    const val = Math.round((maxCount / steps) * i);
    const y = padT + plotH - (i / steps) * plotH;
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" class="lrn-chart-gridline"></line>
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="lrn-chart-axis-label">${val}</text>`;
  }).join('');

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const points = xs.map((x, i) => {
    const tip = `${escapeHtml(shortWeekLabel(series[i].weekStart))}: ${series[i].count} activit${series[i].count === 1 ? 'y' : 'ies'}`;
    return `
      <circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4" fill="var(--oryx-blue)"></circle>
      <circle class="lrn-chart-hit" cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="10" fill="transparent" data-tooltip="${tip}"></circle>`;
  }).join('');

  const labelStep = Math.max(1, Math.ceil(n / 6));
  const xLabels = series.map((p, i) => {
    if(i !== 0 && i !== n - 1 && i % labelStep !== 0) return '';
    return `<text x="${xs[i].toFixed(1)}" y="${(h - padB + 20).toFixed(1)}" text-anchor="middle" class="lrn-chart-axis-label">${escapeHtml(shortWeekLabel(p.weekStart))}</text>`;
  }).join('');

  return `
    <div class="lrn-chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="lrn-chart-svg">
        ${gridlines}
        <path d="${path}" fill="none" stroke="var(--oryx-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
        ${points}
        ${xLabels}
      </svg>
    </div>`;
}

// Mirrors progressGraphSvg()/recentActivityHtml() in learning.js, but reads
// an arbitrary fetched employee doc instead of the signed-in user's own
// module-level `progress` global (which isn't the right employee here).
function employeeProgressGraphSvg(doc){
  const points = doc.progressHistory || [];
  if(points.length < 2){
    return `<div class="s-empty">Not enough activity yet to show a progress graph.</div>`;
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

function employeeRecentActivityHtml(doc){
  const history = (doc.progressHistory || []).slice(-5).reverse();
  if(!history.length){
    return `<div class="s-empty">No activity recorded yet.</div>`;
  }
  return history.map(h => `
    <div class="lrn-profile-activity-row">
      <span class="lrn-profile-activity-icon">📈</span>
      <div class="lrn-profile-activity-text">
        <strong>${h.xp} points total</strong>
        <span>${h.completedLessonsCount} lesson${h.completedLessonsCount === 1 ? '' : 's'} done · ${formatAssessmentDate(h.date)}</span>
      </div>
    </div>`).join('');
}

function employeeDetailHtml(doc, row){
  const meta = row.level ? LEVEL_META[row.level] : null;
  return `
    <div class="analytics-page-head">
      <button class="lrn-btn-text" id="lrnAdminDetailBack">&larr; Back to Employee Learning Progress</button>
      <h2>${row.name ? escapeHtml(row.name) : escapeHtml(row.email)}</h2>
      <p class="analytics-page-sub">${escapeHtml(row.email)} · ${escapeHtml(row.department)}</p>
    </div>
    <div class="lrn-profile-stats">
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">${meta ? meta.emoji : '⚪'}</div><div class="lrn-profile-stat-text"><span>AI Level</span><strong>${meta ? escapeHtml(meta.label) : 'Not assessed'}</strong></div></div>
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">📈</div><div class="lrn-profile-stat-text"><span>Progress</span><strong>${row.progressPct}%</strong></div></div>
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">🏆</div><div class="lrn-profile-stat-text"><span>Score</span><strong>${row.score}${row.scoreIsEstimate ? ' (est.)' : ''}</strong></div></div>
    </div>
    <div class="lrn-profile-stats">
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">📚</div><div class="lrn-profile-stat-text"><span>Lessons</span><strong>${row.lessons}</strong></div></div>
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">🔥</div><div class="lrn-profile-stat-text"><span>Streak</span><strong>${row.streak}</strong></div></div>
      <div class="lrn-profile-stat"><div class="lrn-profile-stat-icon">🥇</div><div class="lrn-profile-stat-text"><span>Rank</span><strong>${row.rank != null ? '#' + row.rank + (row.rankTotal ? ' of ' + row.rankTotal : '') : '—'}</strong></div></div>
    </div>
    <h3 class="analytics-section-head" style="margin-top:24px;">Progress Over Time</h3>
    <div class="lrn-profile-graph">${employeeProgressGraphSvg(doc)}</div>
    <h3 class="analytics-section-head" style="margin-top:24px;">Recent Learning Activity</h3>
    <div>${employeeRecentActivityHtml(doc)}</div>`;
}

function renderLearningAdmin(){
  if(!learningAdminDocs){
    learningAdminView.innerHTML = `<div class="analytics-page-head"><h2>AI Capability</h2><p class="analytics-page-sub">Loading…</p></div>`;
    fetchLearningAdminDocs().then(docs => { learningAdminDocs = docs; renderLearningAdmin(); }).catch(() => {
      learningAdminView.innerHTML = `<div class="analytics-page-head"><h2>AI Capability</h2><p class="analytics-page-sub">Could not load learning data. Check your connection and try again.</p></div>`;
    });
    return;
  }
  if(learningAdminDetailUid){
    const doc = learningAdminDocs.find(d => d.uid === learningAdminDetailUid);
    if(doc){
      const row = employeeRows([doc])[0];
      learningAdminView.innerHTML = employeeDetailHtml(doc, row);
      const backBtn = document.getElementById('lrnAdminDetailBack');
      if(backBtn) backBtn.addEventListener('click', () => { learningAdminDetailUid = null; renderLearningAdmin(); });
      return;
    }
    learningAdminDetailUid = null; // doc no longer found — fall through to the dashboard
  }

  const scopedDocs = learningAdminDept === 'all'
    ? learningAdminDocs
    : learningAdminDocs.filter(d => (d.department || 'Unassigned') === learningAdminDept);
  const stats = computeLearningStats(scopedDocs);
  const deptStats = departmentProgressStats(learningAdminDocs);
  const activitySeries = activityOverTimeSeries(scopedDocs);
  const avgLevelMeta = stats.avgLevelKey ? LEVEL_META[stats.avgLevelKey] : null;
  const maxGap = Math.max(1, ...stats.sortedGaps.map(([, c]) => c));
  const maxUsage = Math.max(1, ...stats.sortedUsage.map(u => u.count));
  const pendingChallenges = pendingChallengeSubmissions(scopedDocs);
  const allRows = employeeRows(scopedDocs);

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
    <h3 class="analytics-section-head" style="margin-top:24px;">Company AI Capability</h3>
    <div class="analytics-kpis analytics-kpis--five">
      <div class="analytics-kpi"><span class="analytics-kpi-label">Employees Assessed</span><span class="analytics-kpi-value">${stats.total}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Average AI Level</span><span class="analytics-kpi-value analytics-kpi-value--text">${avgLevelMeta ? avgLevelMeta.emoji + ' ' + escapeHtml(avgLevelMeta.label) : '—'}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Completion Rate</span><span class="analytics-kpi-value">${stats.completionRate}%</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Average Progress</span><span class="analytics-kpi-value">${stats.avgProgress}%</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Active Employees</span><span class="analytics-kpi-value">${stats.activeCount}</span></div>
    </div>

    <h4 class="analytics-section-head" style="margin-top:24px;">AI Level Distribution</h4>
    ${levelDistributionChartSvg(stats.byLevel, stats.notAssessedCount)}

    ${learningAdminDept === 'all' ? `
      <h4 class="analytics-section-head" style="margin-top:24px;">Progress by Department</h4>
      ${departmentProgressChartSvg(deptStats)}
    ` : `
      <p class="analytics-footnote" style="text-align:left;margin-top:16px;">Showing a single department — switch to "All Departments" to compare progress across departments.</p>
    `}

    <h4 class="analytics-section-head" style="margin-top:24px;">Learning Activity Over Time</h4>
    ${activityOverTimeSvg(activitySeries)}

    <h4 class="analytics-section-head" style="margin-top:24px;">Leaderboard</h4>
    ${leaderboardHtml(allRows, 10)}

    <h3 class="analytics-section-head" style="margin-top:32px;">Employee Learning Progress</h3>
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
    ${(() => {
      const filteredRows = filterAndSortEmployeeRows(allRows);
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / LEARNING_ADMIN_PAGE_SIZE));
      if(learningAdminPage > totalPages) learningAdminPage = totalPages;
      const pageStart = (learningAdminPage - 1) * LEARNING_ADMIN_PAGE_SIZE;
      const pageRows = filteredRows.slice(pageStart, pageStart + LEARNING_ADMIN_PAGE_SIZE);
      return employeeTableHtml(pageRows) + employeeTablePaginationHtml(filteredRows.length, learningAdminPage, LEARNING_ADMIN_PAGE_SIZE);
    })()}

    <h3 class="analytics-section-head" style="margin-top:28px;">Challenges Awaiting Review${pendingChallenges.length ? ` (${pendingChallenges.length})` : ''}</h3>
    <div id="learningAdminPendingChallenges">${pendingChallengesHtml(pendingChallenges)}</div>

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

    <p class="analytics-footnote">
      <button class="lrn-btn-text" id="learningAdminRefresh">Refresh data</button>
    </p>
  `;

  const refreshBtn = document.getElementById('learningAdminRefresh');
  if(refreshBtn) refreshBtn.addEventListener('click', () => { learningAdminDocs = null; renderLearningAdmin(); });

  bindChartTooltips(learningAdminView);
  bindPendingChallenges(learningAdminView);

  const deptSelect = document.getElementById('learningAdminDeptSelect');
  if(deptSelect) deptSelect.addEventListener('change', () => {
    learningAdminDept = deptSelect.value;
    learningAdminPage = 1;
    renderLearningAdmin();
  });

  const searchInput = document.getElementById('learningAdminSearch');
  if(searchInput){
    searchInput.addEventListener('input', () => {
      learningAdminSearch = searchInput.value;
      learningAdminPage = 1;
      renderLearningAdmin();
      const el = document.getElementById('learningAdminSearch');
      if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }
  const statusFilter = document.getElementById('learningAdminStatusFilter');
  if(statusFilter) statusFilter.addEventListener('change', () => {
    learningAdminStatusFilter = statusFilter.value;
    learningAdminPage = 1;
    renderLearningAdmin();
  });
  const pagePrevBtn = document.getElementById('lrnAdminPagePrev');
  if(pagePrevBtn) pagePrevBtn.addEventListener('click', () => {
    learningAdminPage = Math.max(1, learningAdminPage - 1);
    renderLearningAdmin();
  });
  const pageNextBtn = document.getElementById('lrnAdminPageNext');
  if(pageNextBtn) pageNextBtn.addEventListener('click', () => {
    learningAdminPage += 1;
    renderLearningAdmin();
  });
  learningAdminView.querySelectorAll('.lrn-admin-table th[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      learningAdminPage = 1;
      if(learningAdminSort.key === key){
        learningAdminSort.dir = learningAdminSort.dir === 'asc' ? 'desc' : 'asc';
      }else{
        learningAdminSort = { key, dir: 'desc' };
      }
      renderLearningAdmin();
    });
  });
  learningAdminView.querySelectorAll('.lrn-admin-table tbody tr[data-uid]').forEach(tr => {
    tr.addEventListener('click', () => {
      learningAdminDetailUid = tr.dataset.uid;
      renderLearningAdmin();
    });
  });
}

function enterLearningAdminMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitDeptFilesMode === 'function') exitDeptFilesMode();
  if(typeof exitSettingsMode === 'function') exitSettingsMode();
  if(typeof exitMyAiProgressMode === 'function') exitMyAiProgressMode();
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
  if(typeof exitMyAiProgressMode === 'function') exitMyAiProgressMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active, .sidebar-analytics-item.active').forEach(b => b.classList.remove('active'));
  openSettingsNavBtn.classList.add('active');
  hubMainEl.classList.add('settings-mode');
  if(typeof repositionAllTabIndicators === 'function') repositionAllTabIndicators();
  learningReportSettings = null; // always fetch fresh on entry
  renderSettingsPage();
}

if(openSettingsNavBtn) openSettingsNavBtn.addEventListener('click', enterSettingsMode);
