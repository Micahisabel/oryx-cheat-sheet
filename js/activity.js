// ============= Activity (admin-only): badge + detail folded into the sidebar Notification panel =============
// "Directly added" = published straight to the library without going through the suggestion/review
// flow (i.e. Discoveries / Other AI Tools submitted via submitDiscovery() in suggest.js, which
// always stamps authorEmail). Entries added by the admin via +Add Entry never get authorEmail,
// so they're excluded automatically; entries the admin published via the same Suggest flow are
// excluded by checking authorEmail against ADMIN_EMAIL.
const activityCountEl = document.getElementById('activityCount');
const activityListEl = document.getElementById('activityList');

let activityLastSeenAt = 0;
let activityLastSeenUnsub = null;

function isStaffAddedEntry(e){
  return !!e.authorEmail && e.authorEmail !== ADMIN_EMAIL;
}

function updateActivityBadge(){
  const count = entries.filter(e => isStaffAddedEntry(e) && (e.createdAt || 0) > activityLastSeenAt).length;
  activityCountEl.textContent = count;
  activityCountEl.style.display = (isAdmin && count > 0) ? '' : 'none';
}

firebase.auth().onAuthStateChanged((user) => {
  if(activityLastSeenUnsub){ activityLastSeenUnsub(); activityLastSeenUnsub = null; }
  if(!user || user.email !== ADMIN_EMAIL){
    activityLastSeenAt = 0;
    return;
  }
  activityLastSeenUnsub = adminStateCollection.doc('activityFeed').onSnapshot(
    (doc) => {
      if(!doc.exists){
        // First time this feature has ever run — don't retroactively flag years of
        // pre-existing team submissions as "new". Baseline starts from right now.
        activityLastSeenAt = Date.now();
        adminStateCollection.doc('activityFeed').set({ lastSeenAt: activityLastSeenAt }).catch(() => {});
      }else{
        activityLastSeenAt = (doc.data().lastSeenAt) || 0;
      }
      updateActivityBadge();
      if(notifPrefsOverlay.classList.contains('open')) renderActivityList();
    },
    () => { activityLastSeenAt = 0; }
  );
});

// Called from openNotifPrefsPanel() (notifications.js) whenever an admin opens the panel.
function renderActivityList(){
  if(!isAdmin){ activityListEl.innerHTML = ''; return; }

  const items = entries
    .filter(isStaffAddedEntry)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);

  if(!items.length){
    activityListEl.innerHTML = '<h3 class="analytics-section-head" style="margin-top:24px;">Team activity</h3><div class="s-empty">No team-added entries yet.</div>';
    return;
  }

  const rowsHtml = items.map(e => {
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

  activityListEl.innerHTML = `<h3 class="analytics-section-head" style="margin-top:24px;">Team activity</h3>${rowsHtml}`;

  activityListEl.querySelectorAll('.activity-row').forEach(row => {
    row.addEventListener('click', () => {
      const entry = entries.find(e => e.id === row.dataset.id);
      if(entry){
        notifPrefsOverlay.classList.remove('open');
        openNoteDetail(entry);
      }
    });
  });
}

// Called from openNotifPrefsPanel() (notifications.js) whenever an admin opens the panel.
function markActivitySeen(){
  if(!isAdmin) return;
  const maxSeen = entries.filter(isStaffAddedEntry).reduce((m, e) => Math.max(m, e.createdAt || 0), activityLastSeenAt);
  adminStateCollection.doc('activityFeed').set({ lastSeenAt: maxSeen }, { merge: true }).catch(() => {});
}
