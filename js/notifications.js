// ============= Notify on new entry (per-category browser notifications, opt-in per staff member) =============
let subscribedCats = new Set();
let notifSubsUnsub = null;

const NOTIFICATION_CATEGORY_GROUPS = [
  { label: 'Knowledge Base', cats: ['skills', 'commands', 'agents', 'mcps', 'plugins', 'discoveries'] },
  { label: 'Other AI Tools', cats: OTHER_TOOLS_CATS },
  { label: 'Claude Shortcuts', cats: CLAUDE_SHORTCUT_CATS },
  { label: 'ChatGPT Shortcuts', cats: CHATGPT_SHORTCUT_CATS }
];

firebase.auth().onAuthStateChanged((user) => {
  if(notifSubsUnsub){ notifSubsUnsub(); notifSubsUnsub = null; }
  if(!user){
    subscribedCats = new Set();
    return;
  }
  notifSubsUnsub = notificationSubsCollection.doc(user.uid).onSnapshot(
    (doc) => {
      const data = doc.data();
      subscribedCats = new Set((data && data.categories) || []);
      if(notifPrefsOverlay.classList.contains('open')) renderNotifPrefsList();
    },
    () => { subscribedCats = new Set(); }
  );
});

async function toggleNotifSubscription(category){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  const uid = firebase.auth().currentUser.uid;
  const isSubscribed = subscribedCats.has(category);
  try{
    await notificationSubsCollection.doc(uid).set({
      categories: isSubscribed
        ? firebase.firestore.FieldValue.arrayRemove(category)
        : firebase.firestore.FieldValue.arrayUnion(category)
    }, { merge: true });
    if(!isSubscribed && 'Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission();
    }
  }catch(e){
    alert('Could not update your notification preferences. Check your connection and try again.');
  }
}

// Called from listenForEntries() for every entry that's brand-new this sync — fires a browser
// notification if the current signed-in user has opted into that entry's category.
function notifyIfSubscribed(entry){
  if(!subscribedCats.has(entry.category)) return;
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  const logoEl = document.querySelector('.logo-img');
  const label = CATEGORY_LABELS[entry.category] || entry.category;
  const n = new Notification(`New ${label}: ${entry.title}`, {
    body: (entry.purpose || entry.body || '').slice(0, 150),
    icon: logoEl ? logoEl.src : undefined
  });
  n.onclick = () => {
    window.focus();
    n.close();
    openNoteDetail(entry);
  };
}

// ---- Notification preferences panel ----
const notifPrefsOverlay = document.getElementById('notifPrefsOverlay');
const notifPrefsList = document.getElementById('notifPrefsList');

function renderNotifPrefsList(){
  notifPrefsList.innerHTML = NOTIFICATION_CATEGORY_GROUPS.map(group => `
    <div class="notif-group">
      <div class="notif-group-label">${escapeHtml(group.label)}</div>
      ${group.cats.map(cat => `
        <label class="notif-cat-row">
          <input type="checkbox" data-cat="${cat}" ${subscribedCats.has(cat) ? 'checked' : ''}>
          <span>${escapeHtml(CATEGORY_LABELS[cat] || cat)}</span>
        </label>
      `).join('')}
    </div>
  `).join('');

  notifPrefsList.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => toggleNotifSubscription(box.dataset.cat));
  });
}

function openNotifPrefsPanel(){
  notifPrefsOverlay.classList.add('open');
  renderNotifPrefsList();
}

document.getElementById('openNotifPrefs').addEventListener('click', openNotifPrefsPanel);
document.getElementById('closeNotifPrefs').addEventListener('click', () => notifPrefsOverlay.classList.remove('open'));
notifPrefsOverlay.addEventListener('click', (ev) => { if(ev.target === notifPrefsOverlay) notifPrefsOverlay.classList.remove('open'); });
