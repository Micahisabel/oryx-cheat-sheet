// ============= Roles: admin gate, suggestions, review queue =============
let isAdmin = false;
try{ isAdmin = localStorage.getItem(ADMIN_KEY) === '1'; }catch(e){}
let currentSuggestionId = null;   // set when publishing from a suggestion
let currentSuggestedBy = '';
let suggestions = [];

const openSuggest = document.getElementById('openSuggest');
const openReview = document.getElementById('openReview');
const adminToggle = document.getElementById('adminToggle');
const suggestOverlay = document.getElementById('suggestOverlay');
const reviewOverlay = document.getElementById('reviewOverlay');
const reviewList = document.getElementById('reviewList');
const reviewCount = document.getElementById('reviewCount');

function applyAdminUI(){
  openAdd.style.display = isAdmin ? '' : 'none';
  openReview.style.display = isAdmin ? '' : 'none';
  adminToggle.textContent = isAdmin ? 'Admin ✓' : 'Admin';
  updateAddShortcutVisibility();
  render();  // re-render cards so Remove buttons show/hide
}

async function sha256Hex(text){
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

adminToggle.addEventListener('click', async () => {
  if(isAdmin){
    isAdmin = false;
    try{ localStorage.removeItem(ADMIN_KEY); }catch(e){}
    applyAdminUI();
    return;
  }
  const code = prompt('Enter the admin passcode:');
  if(code === null) return;
  let passcodeHash = '';
  try{
    const configDoc = await configCollection.doc('admin').get();
    passcodeHash = configDoc.exists ? configDoc.data().passcodeHash : '';
  }catch(e){
    alert('Could not verify passcode right now — check your connection and try again.');
    return;
  }
  const enteredHash = await sha256Hex(code);
  if(passcodeHash && enteredHash === passcodeHash){
    isAdmin = true;
    try{ localStorage.setItem(ADMIN_KEY, '1'); }catch(e){}
    let adminName = '';
    try{ adminName = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
    if(!adminName){
      const name = prompt('One more thing — what\'s your name? This is stamped on entries you edit, so the team knows who made each change.');
      if(name && name.trim()){
        try{ localStorage.setItem(AUTHOR_KEY, name.trim()); }catch(e){}
      }
    }
    applyAdminUI();
    if('Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission();
    }
  }else{
    alert('That passcode is not correct.');
  }
});
