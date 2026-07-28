// ============= Roles: admin gate, suggestions, review queue =============
let isAdmin = false;
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

const ADMIN_EMAIL = 'micah@oryxdoors.com';

firebase.auth().onAuthStateChanged((user) => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  applyAdminUI();
});

adminToggle.addEventListener('click', async () => {
  if(isAdmin){
    await firebase.auth().signOut();
    return;
  }
  let savedEmail = '';
  try{ savedEmail = localStorage.getItem(ADMIN_EMAIL_KEY) || ''; }catch(e){}
  const email = prompt('Admin email:', savedEmail);
  if(email === null) return;
  const password = prompt('Password:');
  if(password === null) return;

  try{
    await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
  }catch(e){
    alert('Incorrect email or password.');
    return;
  }

  try{ localStorage.setItem(ADMIN_EMAIL_KEY, email.trim()); }catch(e){}

  let adminName = '';
  try{ adminName = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
  if(!adminName){
    const name = prompt('One more thing — what\'s your name? This is stamped on entries you edit, so the team knows who made each change.');
    if(name && name.trim()){
      try{ localStorage.setItem(AUTHOR_KEY, name.trim()); }catch(e){}
    }
  }
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
});
