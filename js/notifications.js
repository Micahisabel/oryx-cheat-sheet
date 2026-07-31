// ============= Notification (browser notification on every new entry, opt-in per staff member) =============
let subscribedCats = new Set();
let notifSubsUnsub = null;

const ALL_NOTIFICATION_CATEGORIES = [
  'skills', 'commands', 'agents', 'mcps', 'plugins', 'discoveries',
  ...OTHER_TOOLS_CATS, ...CLAUDE_SHORTCUT_CATS, ...CHATGPT_SHORTCUT_CATS
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

async function setNotifyAll(enabled){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  const uid = firebase.auth().currentUser.uid;
  try{
    await notificationSubsCollection.doc(uid).set({
      categories: enabled ? ALL_NOTIFICATION_CATEGORIES : []
    }, { merge: true });
    if(enabled && 'Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission();
    }
  }catch(e){
    alert('Could not update your notification preferences. Check your connection and try again.');
  }
}

// Called from listenForEntries() for every entry that's brand-new this sync — fires a browser
// notification if the current signed-in user has notifications turned on.
function notifyIfSubscribed(entry){
  // Admin already gets a dedicated notification for new discoveries via notifyNewDiscovery()
  // (entries.js) regardless of this opt-in — skip here so a subscribed admin doesn't get two.
  if(isAdmin && entry.category === 'discoveries') return;
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
  const isOn = ALL_NOTIFICATION_CATEGORIES.every(cat => subscribedCats.has(cat));
  notifPrefsList.innerHTML = `
    <label class="notif-cat-row">
      <input type="checkbox" id="notifAllToggle" ${isOn ? 'checked' : ''}>
      <span>Notify me about every new entry</span>
    </label>
  `;
  document.getElementById('notifAllToggle').addEventListener('change', (ev) => setNotifyAll(ev.target.checked));
}

function openNotifPrefsPanel(){
  notifPrefsOverlay.classList.add('open');
  renderNotifPrefsList();
  if(isAdmin){
    renderActivityList();
    markActivitySeen();
  }
}

document.getElementById('openNotifPrefs').addEventListener('click', openNotifPrefsPanel);
document.getElementById('closeNotifPrefs').addEventListener('click', () => notifPrefsOverlay.classList.remove('open'));
notifPrefsOverlay.addEventListener('click', (ev) => { if(ev.target === notifPrefsOverlay) notifPrefsOverlay.classList.remove('open'); });
