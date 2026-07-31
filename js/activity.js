// ============= Activity (admin-only): badge + panel for entries the team added directly =============
// "Directly" = published straight to the library without going through the suggestion/review
// flow (i.e. Discoveries / Other AI Tools submitted via submitDiscovery() in suggest.js, which
// always stamps authorEmail). Entries added by the admin via +Add Entry never get authorEmail,
// so they're excluded automatically; entries the admin published via the same Suggest flow are
// excluded by checking authorEmail against ADMIN_EMAIL.
const activityOverlay = document.getElementById('activityOverlay');
const activityList = document.getElementById('activityList');
const activityCountEl = document.getElementById('activityCount');
const openActivityBtn = document.getElementById('openActivity');

let activityLastSeenAt = 0;
let activityLastSeenUnsub = null;

function isStaffAddedEntry(e){
  return !!e.authorEmail && e.authorEmail !== ADMIN_EMAIL;
}

function updateActivityBadge(){
  const count = entries.filter(e => isStaffAddedEntry(e) && (e.createdAt || 0) > activityLastSeenAt).length;
  activityCountEl.textContent = count;
}

firebase.auth().onAuthStateChanged((user) => {
  if(activityLastSeenUnsub){ activityLastSeenUnsub(); activityLastSeenUnsub = null; }
  if(!user || user.email !== ADMIN_EMAIL){
    activityLastSeenAt = 0;
    return;
  }
  activityLastSeenUnsub = adminStateCollection.doc('activityFeed').onSnapshot(
    (doc) => {
      activityLastSeenAt = (doc.data() && doc.data().lastSeenAt) || 0;
      updateActivityBadge();
      if(activityOverlay.classList.contains('open')) renderActivityList();
    },
    () => { activityLastSeenAt = 0; }
  );
});

function renderActivityList(){
  const items = entries
    .filter(isStaffAddedEntry)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);

  if(!items.length){
    activityList.innerHTML = '<div class="s-empty">No team-added entries yet.</div>';
    return;
  }

  activityList.innerHTML = items.map(e => {
    const catLabel = CATEGORY_LABELS[e.category] || e.category;
    const platformLabel = e.platform === 'other' ? 'Other AI Tools' : platformMeta(e.platform).label;
    const dateStr = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const isNew = (e.createdAt || 0) > activityLastSeenAt;
    return `
      <div class="suggestion-item activity-row${isNew ? ' activity-row--new' : ''}" data-id="${e.id}">
        <div class="s-meta"><span>${escapeHtml(catLabel)} · ${escapeHtml(platformLabel)}</span><span>${dateStr}</span></div>
        <p class="s-title" style="font-weight:600;margin:0 0 4px;">${escapeHtml(e.title)}</p>
        <p class="s-text" style="margin:0;">Added by ${escapeHtml(e.author || 'Anonymous')}${e.authorEmail ? ' · ' + escapeHtml(e.authorEmail) : ''}</p>
      </div>`;
  }).join('');

  activityList.querySelectorAll('.activity-row').forEach(row => {
    row.addEventListener('click', () => {
      const entry = entries.find(e => e.id === row.dataset.id);
      if(entry){
        activityOverlay.classList.remove('open');
        openNoteDetail(entry);
      }
    });
  });
}

function openActivityPanel(){
  activityOverlay.classList.add('open');
  renderActivityList();
  const maxSeen = entries.filter(isStaffAddedEntry).reduce((m, e) => Math.max(m, e.createdAt || 0), activityLastSeenAt);
  adminStateCollection.doc('activityFeed').set({ lastSeenAt: maxSeen }, { merge: true }).catch(() => {});
}

openActivityBtn.addEventListener('click', openActivityPanel);
document.getElementById('closeActivity').addEventListener('click', () => activityOverlay.classList.remove('open'));
activityOverlay.addEventListener('click', (ev) => { if(ev.target === activityOverlay) activityOverlay.classList.remove('open'); });
