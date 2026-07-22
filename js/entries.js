searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  currentPage = 1;
  render();
});

let knownEntryIds = null;

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
        entries
          .filter(e => e.category === 'discoveries' && !knownEntryIds.has(e.id))
          .forEach(notifyNewDiscovery);
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

function render(){
  const libraryEntries = entries.filter(e => !isShortcutCategory(e.category));
  const shortcutEntries = entries.filter(e => isShortcutCategory(e.category));

  if(viewMode === 'shortcuts'){
    recentStrip.style.display = 'none';
  }else{
    renderRecentStrip(libraryEntries);
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

  let filtered;
  if(viewMode === 'shortcuts'){
    filtered = shortcutEntries.filter(e => {
      if(e.category !== activeCat) return false;
      if(!searchTerm) return true;
      const haystack = [e.title, e.shortcutKey, e.purpose, e.howToUse, e.example, e.notes]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    }).sort((a,b) => b.createdAt - a.createdAt);
  } else {
    filtered = libraryEntries.filter(e => {
      const catMatch = activeCat === 'all' || e.category === activeCat;
      if(!catMatch) return false;
      const platformMatch = activePlatform === 'all' || (e.platform || 'claude') === activePlatform;
      if(!platformMatch) return false;
      if(!searchTerm) return true;
      const haystack = [e.title, e.body, e.purpose, e.bestFor, e.notes, e.department]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    }).sort((a,b) => b.createdAt - a.createdAt);

    const platformFilteredEntries = activePlatform === 'all' ? libraryEntries : libraryEntries.filter(e => (e.platform || 'claude') === activePlatform);
    const counts = { all: platformFilteredEntries.length, skills: 0, commands: 0, agents: 0, mcps: 0, plugins: 0, discoveries: 0, 'other-tools': 0 };
    platformFilteredEntries.forEach(e => { if(counts[e.category] !== undefined) counts[e.category]++; });
    Object.keys(counts).forEach(cat => {
      const el = sideNav.querySelector(`[data-count-for="${cat}"]`);
      if(el) el.textContent = counts[cat];
    });
  }

  countRow.textContent = filtered.length + (filtered.length === 1 ? ' entry' : ' entries');

  if(filtered.length === 0){
    grid.innerHTML = '<div class="empty">No entries here yet. Be the first to add one.</div>';
    pagination.innerHTML = '';
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
    let thumbInner = e.link ? linkThumbHtml(e.link) : '';
    if(!thumbInner) thumbInner = isShortcutCategory(e.category) ? shortcutBadgeHtml(e.shortcutKey) : cardPlaceholderHtml(e.category);
    const thumbHtml = e.link ? `<a class="card-thumb-link" href="${escapeHtml(e.link)}" target="_blank" rel="noopener">${thumbInner}</a>` : thumbInner;
    const linkHtml = e.link ? `<div class="card-link"><a href="${escapeHtml(e.link)}" target="_blank" rel="noopener">${escapeHtml(e.link)}</a></div>` : '';
    const dateStr = new Date(e.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'});
    const preview = (isRichCategory(e.category) || isShortcutCategory(e.category)) ? (e.purpose || e.body) : e.body;
    const tagChipHtml = e.tag ? `<span class="card-tag-chip">${escapeHtml(e.tag)}</span>` : '';
    const platformTagLabel = e.platform === 'other' ? 'Other AI Tools' : platformMeta(e.platform).label;
    const cardTagLabel = isRichCategory(e.category) && e.department ? e.department : (e.category === 'discoveries' ? platformTagLabel : (CATEGORY_LABELS[e.category] || e.category));
    return `
      <div class="card" data-id="${e.id}">
        ${thumbHtml}
        <span class="card-tag">${escapeHtml(cardTagLabel)}</span>
        <p class="card-title">${escapeHtml(e.title)}</p>
        <p class="card-body">${escapeHtml(preview)}</p>
        ${tagChipHtml}
        ${linkHtml}
        <div class="card-footer">
          <span>${escapeHtml(e.author || 'Anonymous')} · ${dateStr}</span>
          ${isAdmin ? `<button class="card-del" data-id="${e.id}">Remove</button>` : ''}
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

  grid.querySelectorAll('.card-del').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
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
}
