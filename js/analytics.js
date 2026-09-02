// ============= Usage Analytics (admin only) — views/favorites tracked as counters on entries =============
const ANALYTICS_TRACKING_START = 'Jul 30, 2026';
const hubMainEl = document.querySelector('.hub-main');
const analyticsView = document.getElementById('analyticsView');
const openAnalyticsNavBtn = document.getElementById('openAnalyticsNav');
let analyticsSort = 'views'; // 'views' | 'favorites'

function incrementViewCount(id){
  entriesCollection.doc(id).update({
    viewCount: firebase.firestore.FieldValue.increment(1)
  }).catch(() => {});
}

// Called from every real navigation action (platform switch, category tab, shortcuts) so
// live Firestore updates while Analytics is open never silently kick the admin back out —
// only an actual click elsewhere in the sidebar/tabs should close it.
function exitAnalyticsMode(){
  if(!hubMainEl.classList.contains('analytics-mode')) return;
  hubMainEl.classList.remove('analytics-mode');
  openAnalyticsNavBtn.classList.remove('active');
}

function renderAnalytics(){
  const libraryEntries = entries.filter(e => !isShortcutCategory(e.category));
  const totalViews = libraryEntries.reduce((sum, e) => sum + (e.viewCount || 0), 0);
  const favoritedCount = libraryEntries.filter(e => (e.favCount || 0) > 0).length;
  const neverViewed = libraryEntries.filter(e => !(e.viewCount > 0)).length;

  const catTotals = {};
  libraryEntries.forEach(e => {
    const label = CATEGORY_LABELS[e.category] || e.category;
    catTotals[label] = (catTotals[label] || 0) + (e.viewCount || 0);
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const topCatLabel = sortedCats.length && sortedCats[0][1] > 0 ? sortedCats[0][0] : '—';
  const maxCat = Math.max(1, ...sortedCats.map(c => c[1]));

  const sortKey = analyticsSort === 'views' ? 'viewCount' : 'favCount';
  const top = libraryEntries
    .filter(e => (e[sortKey] || 0) > 0)
    .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
    .slice(0, 10);

  // How many entries each person has shared (counts every entry type, grouped by author).
  const authorTotals = {};
  entries.forEach(e => {
    const name = (e.author || '').trim() || 'Anonymous';
    authorTotals[name] = (authorTotals[name] || 0) + 1;
  });
  const sortedAuthors = Object.entries(authorTotals).sort((a, b) => b[1] - a[1]);
  const contributorCount = sortedAuthors.length;
  const maxAuthor = Math.max(1, ...sortedAuthors.map(a => a[1]));
  const topAuthors = sortedAuthors.slice(0, 12);

  analyticsView.innerHTML = `
    <div class="analytics-page-head">
      <h2>Usage Analytics</h2>
      <p class="analytics-page-sub">Views and favorites across the knowledge base</p>
    </div>
    <div class="analytics-kpis analytics-kpis--wide">
      <div class="analytics-kpi"><span class="analytics-kpi-label">Total Views</span><span class="analytics-kpi-value">${totalViews}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Favorited Entries</span><span class="analytics-kpi-value">${favoritedCount}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Never Viewed</span><span class="analytics-kpi-value">${neverViewed}</span></div>
      <div class="analytics-kpi"><span class="analytics-kpi-label">Top Category</span><span class="analytics-kpi-value analytics-kpi-value--text">${escapeHtml(topCatLabel)}</span></div>
    </div>
    <div class="analytics-section-head">
      <h3>Top Entries</h3>
      <div class="analytics-seg">
        <button class="analytics-seg-btn${analyticsSort === 'views' ? ' active' : ''}" data-sort="views">Views</button>
        <button class="analytics-seg-btn${analyticsSort === 'favorites' ? ' active' : ''}" data-sort="favorites">Favorites</button>
      </div>
    </div>
    ${top.length ? top.map((e, i) => `
      <div class="my-component-row analytics-row" data-id="${e.id}">
        <span class="analytics-rank">${i + 1}</span>
        <div class="analytics-row-main">
          <div class="my-component-title">${escapeHtml(e.title || 'Untitled')}</div>
          <div class="my-component-meta"><span>${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</span></div>
        </div>
        <span class="analytics-count">${e[sortKey] || 0}</span>
      </div>
    `).join('') : '<div class="s-empty">No views tracked yet.</div>'}
    <h3 class="analytics-section-head" style="margin-top:28px;">Views by Category</h3>
    <div class="analytics-cats">
      ${sortedCats.map(([label, count]) => `
        <div class="analytics-cat-row">
          <div class="analytics-cat-top"><span>${escapeHtml(label)}</span><span>${count}</span></div>
          <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round(count / maxCat * 100)}%;"></div></div>
        </div>
      `).join('')}
    </div>
    <div class="analytics-section-head" style="margin-top:28px;">
      <h3>Contributions by User</h3>
      <span class="analytics-contrib-count">${contributorCount} ${contributorCount === 1 ? 'contributor' : 'contributors'}</span>
    </div>
    <div class="analytics-cats">
      ${topAuthors.map(([name, count]) => `
        <div class="analytics-cat-row">
          <div class="analytics-cat-top"><span>${escapeHtml(name)}</span><span>${count}</span></div>
          <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round(count / maxAuthor * 100)}%;"></div></div>
        </div>
      `).join('')}
    </div>
    <p class="analytics-footnote">Tracking since ${ANALYTICS_TRACKING_START} · a view counts each time an entry is opened. Contributions count every entry a person has shared.</p>
  `;

  analyticsView.querySelectorAll('.analytics-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      analyticsSort = btn.dataset.sort;
      renderAnalytics();
    });
  });

  analyticsView.querySelectorAll('.analytics-row').forEach(row => {
    row.addEventListener('click', () => {
      const entry = entries.find(e => e.id === row.dataset.id);
      if(entry) openNoteDetail(entry);
    });
  });
}

function enterAnalyticsMode(){
  if(typeof exitDeptFilesMode === "function") exitDeptFilesMode();
  if(typeof exitLearningAdminMode === "function") exitLearningAdminMode();
  if(typeof exitSettingsMode === "function") exitSettingsMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active').forEach(b => b.classList.remove('active'));
  openAnalyticsNavBtn.classList.add('active');
  hubMainEl.classList.add('analytics-mode');
  repositionAllTabIndicators();
  renderAnalytics();
}

openAnalyticsNavBtn.addEventListener('click', enterAnalyticsMode);
