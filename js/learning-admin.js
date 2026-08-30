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

    <p class="analytics-footnote">
      <button class="lrn-btn-text" id="learningAdminRefresh">Refresh data</button>
    </p>
  `;

  const refreshBtn = document.getElementById('learningAdminRefresh');
  if(refreshBtn) refreshBtn.addEventListener('click', () => { learningAdminDocs = null; renderLearningAdmin(); });

  bindPendingChallenges(learningAdminView);

  const deptSelect = document.getElementById('learningAdminDeptSelect');
  if(deptSelect) deptSelect.addEventListener('change', () => {
    learningAdminDept = deptSelect.value;
    renderLearningAdmin();
  });
}

function enterLearningAdminMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitDeptFilesMode === 'function') exitDeptFilesMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active').forEach(b => b.classList.remove('active'));
  openLearningAdminNavBtn.classList.add('active');
  hubMainEl.classList.add('learning-admin-mode');
  repositionAllTabIndicators();
  learningAdminDocs = null; // always fetch fresh on entry
  learningAdminDept = 'all';
  renderLearningAdmin();
}

openLearningAdminNavBtn.addEventListener('click', enterLearningAdminMode);
