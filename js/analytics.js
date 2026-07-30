// ============= Usage Analytics (admin only) — views/favorites tracked as counters on entries =============
const ANALYTICS_TRACKING_START = 'Jul 30, 2026';
const analyticsPage = document.getElementById('analyticsPage');
const analyticsPageInner = document.getElementById('analyticsPageInner');
let analyticsSort = 'views'; // 'views' | 'favorites'

function incrementViewCount(id){
  entriesCollection.doc(id).update({
    viewCount: firebase.firestore.FieldValue.increment(1)
  }).catch(() => {});
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

  const html = `
    <div class="skill-hero">
      ${panelSweepSvg()}
      <div class="skill-hero-inner">
        <button class="skill-back" id="analyticsBack">${BACK_ARROW_SVG} Back to Library</button>
        <div class="skill-eyebrow"><span class="tag">Admin</span></div>
        <div class="skill-title-row"><h1>Usage Analytics</h1></div>
      </div>
    </div>
    <div class="skill-wrap">
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
      <p class="analytics-footnote">Tracking since ${ANALYTICS_TRACKING_START} · a view counts each time an entry is opened.</p>
    </div>
  `;

  analyticsPageInner.innerHTML = html;

  document.getElementById('analyticsBack').addEventListener('click', closeAnalyticsPage);

  analyticsPageInner.querySelectorAll('.analytics-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      analyticsSort = btn.dataset.sort;
      renderAnalytics();
    });
  });

  analyticsPageInner.querySelectorAll('.analytics-row').forEach(row => {
    row.addEventListener('click', () => {
      const entry = entries.find(e => e.id === row.dataset.id);
      if(entry){
        closeAnalyticsPage();
        openNoteDetail(entry);
      }
    });
  });
}

function openAnalyticsPage(){
  analyticsPage.classList.add('open');
  analyticsPage.scrollTop = 0;
  renderAnalytics();
}

function closeAnalyticsPage(){
  analyticsPage.classList.remove('open');
}

document.getElementById('openAnalyticsNav').addEventListener('click', openAnalyticsPage);
