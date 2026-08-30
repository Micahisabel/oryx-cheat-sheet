searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  currentPage = 1;
  render();
});

const deptFilterEl = document.getElementById('deptFilter');
deptFilterEl.addEventListener('change', () => {
  activeDepartment = deptFilterEl.value;
  currentPage = 1;
  render();
});

let knownEntryIds = null;

const FAV_STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.3l7.1-.6L12 2l2.9 6.7 7.1.6-5.4 4.7 1.6 7z"/></svg>';

function notifyNewDiscovery(e){
  if(!isAdmin || !('Notification' in window) || Notification.permission !== 'granted') return;
  const logoEl = document.querySelector('.logo-img');
  const n = new Notification(`New discovery from ${e.author || 'Anonymous'}`, {
    body: (e.title || '').slice(0, 150),
    icon: logoEl ? logoEl.src : undefined
  });
  n.onclick = () => { window.focus(); n.close(); };
}

function listenForEntries(){
  entriesCollection.orderBy('createdAt', 'desc').onSnapshot(
    (snapshot) => {
      entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      syncStatusEl.textContent = 'Live · synced with team';
      syncStatusEl.className = 'sync-status live';
      render();

      const currentEntryIds = new Set(entries.map(e => e.id));
      if(knownEntryIds !== null){
        const newEntries = entries.filter(e => !knownEntryIds.has(e.id));
        newEntries.filter(e => e.category === 'discoveries').forEach(notifyNewDiscovery);
        newEntries.forEach(notifyIfSubscribed);
      }
      knownEntryIds = currentEntryIds;
    },
    (err) => {
      console.error('Firestore sync error:', err);
      syncStatusEl.textContent = 'Connection error — check setup';
      syncStatusEl.className = 'sync-status error';
    }
  );
}

// Live-sync the admin "used / not used" overrides for Other AI Tools. Runs for every
// visitor (not just admins) so the glass effect reflects the latest choice for everyone.
function listenForOtherToolsUsage(){
  adminStateCollection.doc('otherToolsUsage').onSnapshot(
    (doc) => {
      const data = doc.data();
      otherToolsUsage = (data && data.map) || {};
      render();
    },
    (err) => { console.error('Other-tools usage sync error:', err); }
  );
}

// Admin action: flip an Other AI Tools card between "used" (crisp) and "not used" (glass).
const usageToggleInFlight = new Set();
async function toggleOtherToolUsed(id){
  if(usageToggleInFlight.has(id)) return;
  const entry = entries.find(e => e.id === id);
  if(!entry) return;
  usageToggleInFlight.add(id);
  const next = !isOtherToolUsed(entry);
  try{
    // Nested-map merge updates just this id without disturbing the others.
    await adminStateCollection.doc('otherToolsUsage').set({ map: { [id]: next } }, { merge: true });
  }catch(e){
    alert('Could not update the used status. Check your connection and try again.');
  }finally{
    usageToggleInFlight.delete(id);
  }
}

function detectPlatform(url){
  try{
    const host = new URL(url).hostname.replace(/^www\./, '');
    if(host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if(host.includes('tiktok.com')) return 'tiktok';
    if(host.includes('instagram.com')) return 'instagram';
    if(host.includes('facebook.com') || host.includes('fb.watch')) return 'facebook';
  }catch(e){ /* not a valid URL */ }
  return null;
}

function youTubeThumbUrl(url){
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

const PLAY_ICON_SVG = '<span class="link-play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';

function linkThumbHtml(link){
  const platform = detectPlatform(link);
  if(!platform) return '';

  if(platform === 'youtube'){
    const thumb = youTubeThumbUrl(link);
    if(thumb){
      return `<div class="link-thumb-wrap"><img class="link-thumb" src="${thumb}" alt="Video thumbnail" loading="lazy">${PLAY_ICON_SVG}</div>`;
    }
  }

  if(platform === 'tiktok'){
    return `<div class="link-thumb-wrap" data-thumb-platform="tiktok" data-thumb-url="${escapeHtml(link)}"><div class="link-thumb-badge-wrap"><span class="link-thumb-badge">TikTok</span></div></div>`;
  }

  // Instagram / Facebook thumbnails require an authenticated Meta Graph API call —
  // not available from the browser, so we show a platform badge instead.
  const label = platform === 'instagram' ? 'Instagram' : 'Facebook';
  return `<div class="link-thumb-badge-wrap"><span class="link-thumb-badge">${label}</span></div>`;
}

function faviconBadgeHtml(link, category){
  const faviconUrl = faviconUrlForLink(link);
  if(!faviconUrl) return '';
  const fallbackPath = CATEGORY_ICON_PATHS[category] || '';
  return `<div class="card-placeholder">
    <img class="card-favicon-img" src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='';">
    <svg viewBox="0 0 24 24" style="display:none">${fallbackPath}</svg>
  </div>`;
}

function hydrateTikTokThumbs(root){
  root.querySelectorAll('[data-thumb-platform="tiktok"]').forEach(async (el) => {
    const link = el.dataset.thumbUrl;
    try{
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
      if(!res.ok) return;
      const data = await res.json();
      if(data.thumbnail_url){
        el.innerHTML = `<img class="link-thumb" src="${data.thumbnail_url}" alt="Video thumbnail" loading="lazy">${PLAY_ICON_SVG}`;
      }
    }catch(e){ /* leave the TikTok badge in place */ }
  });
}

const RECENT_STRIP_MAX = 5;
const RECENT_STRIP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function relativeDateLabel(ts){
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / (24 * 60 * 60 * 1000));
  if(diffDays <= 0) return 'Today';
  if(diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function renderRecentStrip(libraryEntries){
  const now = Date.now();
  const recent = libraryEntries
    .filter(e => e.createdAt && (now - e.createdAt) <= RECENT_STRIP_WINDOW_MS)
    .filter(e => isAdmin || e.category !== 'skills')
    .sort((a,b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_STRIP_MAX);

  if(!recent.length){
    recentStrip.style.display = 'none';
    recentRow.innerHTML = '';
    return;
  }

  recentStrip.style.display = '';
  recentRow.innerHTML = recent.map(e => {
    const desc = (isRichCategory(e.category) || isShortcutCategory(e.category)) ? (e.purpose || e.body) : e.body;
    const platformLabel = e.platform === 'other' ? 'Other AI Tools' : platformMeta(e.platform).label;
    return `
      <div class="recent-card" data-id="${e.id}">
        <span class="recent-badge">New</span>
        <p class="recent-title">${escapeHtml(e.title)}</p>
        ${e.department ? `<p class="recent-dept">For ${escapeHtml(e.department)}</p>` : ''}
        <p class="recent-desc">${escapeHtml(desc || '')}</p>
        <div class="recent-footer">
          <span class="card-tag-chip recent-platform-tag">${escapeHtml(platformLabel)}</span>
          <span class="recent-date">${relativeDateLabel(e.createdAt)}</span>
        </div>
      </div>`;
  }).join('');

  recentRow.querySelectorAll('.recent-card').forEach(card => {
    card.addEventListener('click', () => {
      const entry = recent.find(e => e.id === card.dataset.id);
      if(entry) openNoteDetail(entry);
    });
  });
}

// Grid order: favourited entries first, then most-recent first. (favoriteIds lives in favorites.js;
// toggling a star re-renders, so a favourited card jumps to the front automatically.)
function favThenRecent(a, b){
  const fa = favoriteIds.has(a.id) ? 1 : 0, fb = favoriteIds.has(b.id) ? 1 : 0;
  return fb - fa || ((b.createdAt || 0) - (a.createdAt || 0));
}

// Other AI Tools department views list tools A-Z (by title) instead of newest-first, so a
// department with many tools stays easy to scan. Favourites still float to the top.
function favThenAlpha(a, b){
  const fa = favoriteIds.has(a.id) ? 1 : 0, fb = favoriteIds.has(b.id) ? 1 : 0;
  return fb - fa || String(a.title || '').localeCompare(String(b.title || ''), undefined, {sensitivity: 'base'});
}

// Within an Other AI Tools department view, show that department's uploaded files below its
// tools (Department Files is merged into Other AI Tools). Elsewhere this section stays hidden.
function renderOtherFilesSection(inOtherDept, toolCount){
  const sec = document.getElementById('otherFilesSection');
  const head = document.getElementById('toolsInlineHead');
  if(head){
    head.style.display = inOtherDept ? '' : 'none';
    // Count now lives beside the section heading (not on the department tab), matching
    // Department Files, so a team's tool total reads next to the tools themselves.
    if(inOtherDept){
      const n = toolCount || 0;
      head.innerHTML = 'Tools <span class="dept-inline-count">' + n + '</span>';
    }
  }
  if(!sec) return;
  if(!inOtherDept || typeof deptFilesSectionHtml !== 'function'){
    sec.style.display = 'none';
    sec.innerHTML = '';
    return;
  }
  const deptLabel = CATEGORY_LABELS[activeCat] || '';
  sec.style.display = '';
  sec.innerHTML = deptFilesSectionHtml(deptLabel, searchTerm);
  if(typeof removeDeptFile === 'function'){
    sec.querySelectorAll('.df-remove').forEach(btn => btn.addEventListener('click', () => removeDeptFile(btn.dataset.id)));
  }
}

function render(){
  // activity.js loads after this file; an early auth-state render (admin.js) can fire before
  // updateActivityBadge is defined, so guard the call.
  if(typeof updateActivityBadge === "function") updateActivityBadge();
  const libraryEntries = entries.filter(e => !isShortcutCategory(e.category));
  const shortcutEntries = entries.filter(e => isShortcutCategory(e.category));
  const inOtherDept = viewMode !== 'shortcuts' && activePlatform === 'other' && OTHER_TOOLS_CATS.includes(activeCat);

  if(viewMode === 'shortcuts' || activePlatform === 'other'){
    // Recently Added shows only on Claude and ChatGPT — not in AI Tools & Files.
    recentStrip.style.display = 'none';
  }else{
    // Per-platform: Claude shows recent Claude entries, ChatGPT shows ChatGPT — never mixed.
    renderRecentStrip(libraryEntries.filter(e => (e.platform || 'claude') === activePlatform));
  }

  document.getElementById('totalCount').textContent = libraryEntries.length;
  const platformCounts = { all: libraryEntries.length, claude: 0, chatgpt: 0, other: 0 };
  libraryEntries.forEach(e => {
    const p = e.platform || 'claude';
    if(platformCounts[p] !== undefined) platformCounts[p]++;
  });
  Object.keys(platformCounts).forEach(p => {
    const el = platformNav.querySelector(`[data-platform-count="${p}"]`);
    if(el) el.textContent = platformCounts[p];
  });

  const shortcutCounts = {};
  SHORTCUT_CATEGORIES.forEach(c => { shortcutCounts[c] = 0; });
  shortcutEntries.forEach(e => { if(shortcutCounts[e.category] !== undefined) shortcutCounts[e.category]++; });
  Object.keys(shortcutCounts).forEach(cat => {
    document.querySelectorAll(`[data-count-for="${cat}"]`).forEach(el => { el.textContent = shortcutCounts[cat]; });
  });

  // The department filter only makes sense for library resources, not shortcut commands.
  deptFilterEl.style.display = (viewMode === 'shortcuts') ? 'none' : '';

  let filtered;
  if(viewMode === 'shortcuts'){
    // While searching, look across all sub-tabs of the current shortcut group (Desktop/Code/Slash)
    // instead of just the selected one — a shortcut key shouldn't be findable only from its own tab.
    const groupCats = shortcutGroup === 'chatgpt' ? CHATGPT_SHORTCUT_CATS : CLAUDE_SHORTCUT_CATS;
    filtered = shortcutEntries.filter(e => {
      if(!groupCats.includes(e.category)) return false;
      // Code categories are admin-only — keep them out of non-admin views and search results.
      if(!isAdmin && (e.category === 'shortcut-code' || e.category === 'chatgpt-shortcut-code')) return false;
      if(!searchTerm) return e.category === activeCat;
      const haystack = [e.title, e.shortcutKey, e.purpose, e.samplePrompt, e.howToUse, e.example, e.notes]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    }).sort(favThenRecent);
  } else {
    filtered = libraryEntries.filter(e => {
      const platformMatch = activePlatform === 'all' || (e.platform || 'claude') === activePlatform;
      if(!platformMatch) return false;
      // Skills are admin-only — keep them out of non-admin views, Recently Added, and search.
      if(!isAdmin && e.category === 'skills') return false;
      // Department filter — works alongside search (e.g. "Excel" + Finance).
      if(activeDepartment !== 'all' && !entryDepartments(e).includes(activeDepartment)) return false;
      if(!searchTerm){
        return activeCat === 'all' || e.category === activeCat;
      }
      // While searching, look across all category tabs in the current platform view instead of
      // just the selected one, so a shortcut key or command isn't only findable from its own tab.
      const haystack = [e.title, e.body, e.purpose, e.bestFor, e.notes, e.department, e.samplePrompt, e.exampleOutput, e.oryxTip, e.howToAccess]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    }).sort(inOtherDept ? favThenAlpha : favThenRecent);

    const platformFilteredEntries = activePlatform === 'all' ? libraryEntries : libraryEntries.filter(e => (e.platform || 'claude') === activePlatform);
    const counts = { all: platformFilteredEntries.length, instructions: 0, skills: 0, commands: 0, agents: 0, mcps: 0, plugins: 0, discoveries: 0, 'other-tools': 0 };
    OTHER_TOOLS_CATS.forEach(c => { counts[c] = 0; });
    platformFilteredEntries.forEach(e => { if(counts[e.category] !== undefined) counts[e.category]++; });
    Object.keys(counts).forEach(cat => {
      document.querySelectorAll(`[data-count-for="${cat}"]`).forEach(el => { el.textContent = counts[cat]; });
    });
  }

  // Category explainer — show only in library view, for a category that has one, and not while searching.
  // Text is platform-specific; "All Platforms" and any other platform fall back to the Claude wording.
  // Category explainer. In the shortcuts view it's keyed by the shortcut sub-category. In the
  // library it's platform-specific and hidden on All Platforms (which mixes platforms, so a single
  // platform's wording and how-to link would be half-wrong). Hidden while searching.
  let explainer = null, link = null;
  if(!searchTerm){
    if(viewMode === 'shortcuts'){
      explainer = SHORTCUT_EXPLAINERS[activeCat] || null;
    } else {
      const explainerSet = CATEGORY_EXPLAINERS[activePlatform];
      if(explainerSet){
        explainer = explainerSet[activeCat] || null;
        link = (CATEGORY_EXPLAINER_LINKS[activePlatform] || {})[activeCat] || null;
      }
    }
  }
  // In the Other AI Tools view (and Connectors, which shares the same fade/badge/toggle),
  // explain what the faded/glass cards mean so every staff member understands it at a glance
  // — no separate announcement needed.
  const showOtherLegend = !searchTerm && viewMode !== 'shortcuts' && (activePlatform === 'other' || activeCat === 'mcps');
  const legendHtml = showOtherLegend
    ? `<span class="cat-explainer-legend">Faded tools are still being explored. Clear tools are in use.</span>`
    : '';
  if(explainer || legendHtml){
    // Content is developer-defined constants, but escape anyway to keep the innerHTML sink safe.
    const linkHtml = link
      ? `<a class="cat-explainer-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`
      : '';
    catExplainer.innerHTML = (explainer ? escapeHtml(explainer) + linkHtml : '') + legendHtml;
    catExplainer.style.display = '';
  }else{
    catExplainer.style.display = 'none';
  }

  countRow.textContent = filtered.length + (filtered.length === 1 ? ' entry' : ' entries');

  if(filtered.length === 0){
    grid.innerHTML = `<div class="empty">${inOtherDept ? 'No tools in this department yet.' : 'No entries here yet. Be the first to add one.'}</div>`;
    pagination.innerHTML = '';
    renderOtherFilesSection(inOtherDept, filtered.length);
    if(typeof layoutOtherToolsOverflow === 'function') layoutOtherToolsOverflow();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  if(currentPage < 1) currentPage = 1;
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if(totalPages <= 1){
    pagination.innerHTML = '';
  }else{
    pagination.innerHTML = `
      <button class="pagination-btn" id="pagePrev" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span class="pagination-status">Page ${currentPage} of ${totalPages}</span>
      <button class="pagination-btn" id="pageNext" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    const prevBtn = document.getElementById('pagePrev');
    const nextBtn = document.getElementById('pageNext');
    if(prevBtn) prevBtn.addEventListener('click', () => { currentPage--; render(); });
    if(nextBtn) nextBtn.addEventListener('click', () => { currentPage++; render(); });
  }

  grid.innerHTML = pageItems.map(e => {
    const safeLink = e.link && isValidLink(e.link) ? e.link : '';
    let thumbInner = e.link ? linkThumbHtml(e.link) : '';
    if(!thumbInner && (isOtherToolsCategory(e.category) || e.category === 'mcps') && e.link) thumbInner = faviconBadgeHtml(e.link, e.category);
    if(!thumbInner) thumbInner = isShortcutCategory(e.category) ? shortcutBadgeHtml(e.shortcutKey) : cardPlaceholderHtml(e.category);
    // Instructions, AI tools, Connectors and Video Discoveries all open their detail page on
    // click, so their thumb must NOT be a direct link — instructions would download the file,
    // AI tools/Connectors would jump to the external site, and Discoveries embed the video
    // on the page instead.
    const thumbLinksOut = safeLink && e.category !== 'instructions' && e.category !== 'discoveries' && e.category !== 'mcps' && !isOtherToolsCategory(e.category);
    const thumbHtml = thumbLinksOut ? `<a class="card-thumb-link" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${thumbInner}</a>` : thumbInner;
    const linkHtml = (safeLink && e.category !== 'instructions')
      ? (isFileLink(safeLink)
          ? `<div class="card-file"><a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener" download>${FILE_ICON_SVG}<span>${escapeHtml(fileNameFromUrl(safeLink))}</span></a></div>`
          : `<div class="card-link"><a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${escapeHtml(safeLink)}</a></div>`)
      : '';
    const dateStr = new Date(e.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'});
    const preview = (isRichCategory(e.category) || isShortcutCategory(e.category)) ? (e.purpose || e.body) : e.body;
    const tagChipHtml = e.tag ? `<span class="card-tag-chip">${escapeHtml(e.tag)}</span>` : '';
    const platformTagLabel = e.platform === 'other' ? 'Other AI Tools' : platformMeta(e.platform).label;
    const cardTagLabel = isRichCategory(e.category) && e.department ? e.department : (e.category === 'discoveries' ? platformTagLabel : (CATEGORY_LABELS[e.category] || e.category));
    // Shortcuts keep their type as the card tag (e.g. "Claude Prompt"), so a chosen department
    // gets its own small pill instead of replacing it (unlike rich categories above).
    const shortcutDeptHtml = (isShortcutCategory(e.category) && e.department) ? `<p class="card-dept">For ${escapeHtml(e.department)}</p>` : '';
    const isFav = favoriteIds.has(e.id);
    // In the mixed "All Platforms" view, show a Claude/ChatGPT badge so users can tell them apart.
    // (Skipped in single-platform views where it would be redundant, and for Other AI Tools /
    // Video Discoveries, which already identify themselves.)
    const showPlatformBadge = activePlatform === 'all' && (e.platform === 'claude' || e.platform === 'chatgpt') && e.category !== 'discoveries';
    const pmBadge = platformMeta(e.platform);
    const platformBadgeHtml = showPlatformBadge
      ? `<span class="card-platform-badge"><span class="platform-dot" style="background:${pmBadge.color}"></span>${escapeHtml(pmBadge.label)}</span>`
      : '';
    // Other AI Tools and Connectors the team hasn't used yet get a subtle frosted/glass look.
    const isUnusedTool = usesUsageStatus(e.category) && !isOtherToolUsed(e);
    const unusedBadgeHtml = isUnusedTool ? `<span class="card-unused-badge">Not used yet</span>` : '';
    // Admin-only control to mark an Other AI Tools / Connector card used / not used.
    const usedToggleHtml = (isAdmin && usesUsageStatus(e.category))
      ? `<button class="card-used-toggle${isUnusedTool ? '' : ' is-used'}" data-id="${e.id}">${isUnusedTool ? 'Mark used' : 'Mark unused'}</button>`
      : '';
    // Light per-type visual treatment on top of the shared card layout — media-forward
    // for video, doc-forward for instructions/skills, tool-forward for agents/connectors/
    // Other AI Tools. Purely a CSS modifier class; the render pipeline/data are unchanged.
    const cardTypeClass = e.category === 'discoveries' ? ' card--media'
      : (e.category === 'instructions' || e.category === 'skills') ? ' card--doc'
      : (e.category === 'agents' || e.category === 'mcps' || isOtherToolsCategory(e.category)) ? ' card--tool'
      : '';
    // Same 7-day freshness window as the Recently Added strip, surfaced on grid cards too.
    const isNew = e.createdAt && (Date.now() - e.createdAt) <= RECENT_STRIP_WINDOW_MS;
    const newBadgeHtml = isNew ? `<span class="badge badge-new card-new-badge">New</span>` : '';
    return `
      <div class="card${cardTypeClass}${isUnusedTool ? ' card-unused' : ''}" data-id="${e.id}">
        ${platformBadgeHtml}
        ${unusedBadgeHtml}
        <button class="card-fav-btn${isFav ? ' active' : ''}" data-id="${e.id}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">${FAV_STAR_SVG}</button>
        ${thumbHtml}
        <div class="card-tag-row"><span class="card-tag">${escapeHtml(cardTagLabel)}</span>${newBadgeHtml}</div>
        <p class="card-title">${escapeHtml(e.title)}</p>
        ${shortcutDeptHtml}
        <p class="card-body">${escapeHtml(preview)}</p>
        ${tagChipHtml}
        ${linkHtml}
        <div class="card-footer">
          <span>${escapeHtml(e.author || 'Anonymous')} · ${dateStr}</span>
          ${isAdmin ? `<span class="card-admin-actions">${usedToggleHtml}<button class="card-edit" data-id="${e.id}">Edit</button><button class="card-del" data-id="${e.id}">Remove</button></span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  hydrateTikTokThumbs(grid);

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const entry = filtered.find(e => e.id === card.dataset.id);
      if(entry) openNoteDetail(entry);
    });
  });

  grid.querySelectorAll('.card-thumb-link').forEach(link => {
    link.addEventListener('click', (ev) => ev.stopPropagation());
  });

  grid.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleFavorite(btn.dataset.id);
    });
  });

  grid.querySelectorAll('.card-used-toggle').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleOtherToolUsed(btn.dataset.id);
    });
  });

  grid.querySelectorAll('.card-edit').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const entry = entries.find(e => e.id === btn.dataset.id);
      if(!entry) return;
      if(isShortcutCategory(entry.category)) openEditShortcut(entry);
      else openEditEntry(entry);
    });
  });

  grid.querySelectorAll('.card-del').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if(!confirm('Remove this entry? This cannot be undone.')) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = 'Removing…';
      try{
        await entriesCollection.doc(id).delete();
      }catch(e){
        alert('Could not remove that entry. Check your connection and try again.');
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });

  renderOtherFilesSection(inOtherDept, filtered.length);

  // Keep the department "More" overflow menu (and its badge counts) in sync after a re-render.
  if(typeof layoutOtherToolsOverflow === 'function') layoutOtherToolsOverflow();
}
