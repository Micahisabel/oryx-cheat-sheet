// ============= Favorites (per-user starred entries, stored in favorites/{uid}) =============
let favoriteIds = new Set();
let favoritesUnsub = null;

firebase.auth().onAuthStateChanged((user) => {
  if(favoritesUnsub){ favoritesUnsub(); favoritesUnsub = null; }
  if(!user){
    favoriteIds = new Set();
    render();
    return;
  }
  favoritesUnsub = favoritesCollection.doc(user.uid).onSnapshot(
    (doc) => {
      const data = doc.data();
      favoriteIds = new Set((data && data.entryIds) || []);
      render();
      if(myFavoritesOverlay.classList.contains('open')) renderMyFavoritesList();
    },
    () => { favoriteIds = new Set(); render(); }
  );
});

async function toggleFavorite(id){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  const uid = firebase.auth().currentUser.uid;
  const isFav = favoriteIds.has(id);
  try{
    await favoritesCollection.doc(uid).set({
      entryIds: isFav
        ? firebase.firestore.FieldValue.arrayRemove(id)
        : firebase.firestore.FieldValue.arrayUnion(id)
    }, { merge: true });
    entriesCollection.doc(id).update({
      favCount: firebase.firestore.FieldValue.increment(isFav ? -1 : 1)
    }).catch(() => {});
  }catch(e){
    alert('Could not update favorites. Check your connection and try again.');
  }
}

// ---- My Favorites panel ----
const myFavoritesOverlay = document.getElementById('myFavoritesOverlay');
const myFavoritesList = document.getElementById('myFavoritesList');

function renderMyFavoritesList(){
  const rows = entries.filter(e => favoriteIds.has(e.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if(!rows.length){
    myFavoritesList.innerHTML = '<div class="s-empty">No favorites yet — tap the star on an entry to save it here.</div>';
    return;
  }
  myFavoritesList.innerHTML = rows.map(r => `
    <div class="my-component-row" data-id="${r.id}">
      <div class="my-component-title">${escapeHtml(r.title || 'Untitled')}</div>
      <div class="my-component-meta">
        <span>${escapeHtml(r.platform || '')}</span>
        <span>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
      </div>
    </div>
  `).join('');
  myFavoritesList.querySelectorAll('.my-component-row').forEach(row => {
    row.addEventListener('click', () => {
      const entry = rows.find(r => r.id === row.dataset.id);
      if(entry){
        myFavoritesOverlay.classList.remove('open');
        openNoteDetail(entry);
      }
    });
  });
}

function openMyFavoritesPanel(){
  closeAccountMenu();
  const user = firebase.auth().currentUser;
  if(!user) return;
  myFavoritesOverlay.classList.add('open');
  renderMyFavoritesList();
}

document.getElementById('openMyFavorites').addEventListener('click', openMyFavoritesPanel);
document.getElementById('closeMyFavorites').addEventListener('click', () => myFavoritesOverlay.classList.remove('open'));
myFavoritesOverlay.addEventListener('click', (ev) => { if(ev.target === myFavoritesOverlay) myFavoritesOverlay.classList.remove('open'); });
