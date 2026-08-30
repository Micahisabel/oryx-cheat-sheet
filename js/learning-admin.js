// ============= Company AI Capability Dashboard (admin only) =============
// Mirrors js/analytics.js's shape (whole-collection read + client-side
// aggregation + bar-row rendering), applied to learningProgress docs instead
// of entries — a separate view/file, not a merge with the existing resource-
// usage Analytics tab. Requires the learningProgress/{uid} Firestore rule
// (admin read-all) added alongside this feature — see docs/ for the rule.
const learningAdminView = document.getElementById('learningAdminView');
const openLearningAdminNavBtn = document.getElementById('openLearningAdminNav');
let learningAdminDocs = null; // cached once per open, refreshed via the Refresh button

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

  const stats = computeLearningStats(learningAdminDocs);
  const maxGap = Math.max(1, ...stats.sortedGaps.map(([, c]) => c));
  const maxUsage = Math.max(1, ...stats.sortedUsage.map(u => u.count));

  learningAdminView.innerHTML = `
    <div class="analytics-page-head">
      <h2>AI Capability</h2>
      <p class="analytics-page-sub">How the whole company is progressing in AI knowledge</p>
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
}

function enterLearningAdminMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitDeptFilesMode === 'function') exitDeptFilesMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active').forEach(b => b.classList.remove('active'));
  openLearningAdminNavBtn.classList.add('active');
  hubMainEl.classList.add('learning-admin-mode');
  repositionAllTabIndicators();
  learningAdminDocs = null; // always fetch fresh on entry
  renderLearningAdmin();
}

openLearningAdminNavBtn.addEventListener('click', enterLearningAdminMode);
