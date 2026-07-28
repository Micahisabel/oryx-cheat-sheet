// ============= Roles: admin auto-detection by email, suggestions, review queue =============
let isAdmin = false;
let currentSuggestionId = null;   // set when publishing from a suggestion
let currentSuggestedBy = '';
let suggestions = [];

const openSuggest = document.getElementById('openSuggest');
const openReview = document.getElementById('openReview');
const suggestOverlay = document.getElementById('suggestOverlay');
const reviewOverlay = document.getElementById('reviewOverlay');
const reviewList = document.getElementById('reviewList');
const reviewCount = document.getElementById('reviewCount');

function applyAdminUI(){
  openAdd.style.display = isAdmin ? '' : 'none';
  openReview.style.display = isAdmin ? '' : 'none';
  updateAddShortcutVisibility();
  render();  // re-render cards so Remove buttons show/hide
}

const ADMIN_EMAIL = 'micah@oryxdoors.com';

firebase.auth().onAuthStateChanged((user) => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  applyAdminUI();
  if(isAdmin && 'Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
});
