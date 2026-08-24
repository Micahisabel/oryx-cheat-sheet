// ============= Notification (browser notification on every new entry — always on for all staff) =============
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
      // Notifications are always on: make sure this staff member is subscribed to every
      // category. If the stored set is missing any, write the full set back once.
      const missingSome = ALL_NOTIFICATION_CATEGORIES.some(cat => !subscribedCats.has(cat));
      if(missingSome){
        notificationSubsCollection.doc(user.uid)
          .set({ categories: ALL_NOTIFICATION_CATEGORIES }, { merge: true })
          .catch(() => {});
      }
      if(notifPrefsOverlay.classList.contains('open')) renderNotifPrefsList();
    },
    () => { subscribedCats = new Set(); }
  );
});

// Ask the browser for permission to show notifications. Must be called from a user gesture
// (e.g. opening the notification panel, or tapping the Allow button) or the browser ignores it.
function requestNotifPermission(){
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission().then(() => {
      if(notifPrefsOverlay.classList.contains('open')) renderNotifPrefsList();
    });
  }
}

// Called from listenForEntries() for every entry that's brand-new this sync — fires a browser
// notification if the current signed-in user has notifications turned on.
function notifyIfSubscribed(entry){
  // Admin already gets a dedicated notification for new discoveries via notifyNewDiscovery()
  // (entries.js) regardless of this opt-in — skip here so a subscribed admin doesn't get two.
  if(isAdmin && entry.category === 'discoveries') return;
  // Don't notify someone about their own submission (only discoveries/other-tools entries
  // carry authorEmail today — entries from the +Add Entry form don't, so this only guards
  // the quick-share path where self-notification is most likely to actually happen).
  const currentUser = firebase.auth().currentUser;
  if(currentUser && entry.authorEmail && entry.authorEmail === currentUser.email) return;
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
  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  let statusHtml;
  if(!supported){
    statusHtml = `<p class="notif-status">Your browser does not support notifications, so new entries won’t pop up here.</p>`;
  }else if(perm === 'granted'){
    statusHtml = `<p class="notif-status notif-status-on"><span class="notif-status-dot"></span>You’ll get a notification for every new entry.</p>`;
  }else if(perm === 'denied'){
    statusHtml = `<p class="notif-status">Notifications are always on, but your browser is blocking them. Turn them on for this site in your browser settings to get alerts.</p>`;
  }else{
    statusHtml = `
      <p class="notif-status">Notifications are always on. Allow them once and you’ll get an alert for every new entry.</p>
      <button class="notif-allow-btn" id="notifAllowBtn">Allow notifications</button>`;
  }
  notifPrefsList.innerHTML = statusHtml;
  const allowBtn = document.getElementById('notifAllowBtn');
  if(allowBtn) allowBtn.addEventListener('click', requestNotifPermission);
}

function openNotifPrefsPanel(){
  notifPrefsOverlay.classList.add('open');
  renderNotifPrefsList();
  // Opening the panel is a user gesture, so it's a safe moment to ask for permission.
  requestNotifPermission();
  if(isAdmin){
    renderActivityList();
    markActivitySeen();
  }
}

document.getElementById('openNotifPrefs').addEventListener('click', openNotifPrefsPanel);
document.getElementById('closeNotifPrefs').addEventListener('click', () => notifPrefsOverlay.classList.remove('open'));
notifPrefsOverlay.addEventListener('click', (ev) => { if(ev.target === notifPrefsOverlay) notifPrefsOverlay.classList.remove('open'); });
