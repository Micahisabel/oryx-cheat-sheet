// ---- Suggest flow (any team member) ----
const sMode = document.getElementById('sMode');
const discoveryFields = document.getElementById('discoveryFields');
const requestFields = document.getElementById('requestFields');
const suggestSub = document.getElementById('suggestSub');
const saveSuggestBtn = document.getElementById('saveSuggest');

function updateSuggestMode(){
  const isDiscovery = sMode.value === 'discovery';
  discoveryFields.style.display = isDiscovery ? '' : 'none';
  requestFields.style.display = isDiscovery ? 'none' : '';
  suggestSub.textContent = isDiscovery
    ? 'Share a useful link — it publishes to Discoveries right away, no approval needed.'
    : 'Describe what you need — the admin will build it, test it, and publish it.';
  saveSuggestBtn.textContent = isDiscovery ? 'Publish discovery' : 'Send request';
}
sMode.addEventListener('change', updateSuggestMode);

function getVerifiedName(){
  const user = firebase.auth().currentUser;
  return user ? (user.displayName || user.email) : '';
}

const STAFF_EMAIL_DOMAIN = '@oryxdoors.com';

// ---- Staff sign-in modal (explicit Sign In / Create Account, sliding two-panel card) ----
const staffAuthOverlay = document.getElementById('staffAuthOverlay');
const authCard = document.getElementById('authCard');
const staffEmailInput = document.getElementById('staffEmail');
const staffPasswordInput = document.getElementById('staffPassword');
const errStaffEmail = document.getElementById('errStaffEmail');
const errStaffPassword = document.getElementById('errStaffPassword');
const staffForgotPassword = document.getElementById('staffForgotPassword');
const staffSignInBtn = document.getElementById('staffSignInBtn');

const staffDisplayNameInput = document.getElementById('staffDisplayName');
const staffSignupEmailInput = document.getElementById('staffSignupEmail');
const staffSignupPasswordInput = document.getElementById('staffSignupPassword');
const errSignupEmail = document.getElementById('errSignupEmail');
const errSignupPassword = document.getElementById('errSignupPassword');
const staffAuthSaveName = document.getElementById('staffAuthSaveName');
const signupNameField = document.getElementById('signupNameField');
const signupEmailField = document.getElementById('signupEmailField');
const signupPasswordField = document.getElementById('signupPasswordField');
const signupEyebrow = document.getElementById('signupEyebrow');
const signupHeading = document.getElementById('signupHeading');
const signupDek = document.getElementById('signupDek');
const signupDomainNote = document.getElementById('signupDomainNote');
const mobileSignupSwitch = document.getElementById('mobileSignupSwitch');

let staffAuthResolve = null;

function clearAuthErrors(){
  errStaffEmail.style.display = 'none';
  errStaffPassword.style.display = 'none';
  errSignupEmail.style.display = 'none';
  errSignupPassword.style.display = 'none';
  staffForgotPassword.style.display = 'none';
}

function resetSignupModeCopy(){
  signupEyebrow.textContent = 'Join the team';
  signupHeading.textContent = 'Create account';
  signupDek.textContent = 'Set up your account to suggest resources and get credited for them.';
  signupNameField.style.display = '';
  signupEmailField.style.display = '';
  signupPasswordField.style.display = '';
  signupDomainNote.style.display = '';
  mobileSignupSwitch.style.display = '';
  staffAuthSaveName.textContent = 'Create account';
}

function showLoginMode(){
  authCard.classList.remove('active');
  authCard.classList.remove('name-only');
}
function showSignupMode(){
  clearAuthErrors();
  resetSignupModeCopy();
  authCard.classList.add('active');
  authCard.classList.remove('name-only');
}
function showNameOnlyMode(){
  authCard.classList.add('active');
  authCard.classList.add('name-only');
  signupEyebrow.textContent = 'Almost done';
  signupHeading.textContent = 'One more thing';
  signupDek.textContent = 'What name should we show on things you add?';
  signupNameField.style.display = '';
  signupEmailField.style.display = 'none';
  signupPasswordField.style.display = 'none';
  signupDomainNote.style.display = 'none';
  mobileSignupSwitch.style.display = 'none';
  staffAuthSaveName.textContent = 'Save & continue';
  staffDisplayNameInput.value = '';
  staffDisplayNameInput.focus();
}

function closeStaffAuth(result){
  staffAuthOverlay.classList.remove('open');
  const resolve = staffAuthResolve;
  staffAuthResolve = null;
  if(resolve) resolve(result);
}

document.getElementById('closeStaffAuth').addEventListener('click', () => closeStaffAuth(false));
staffAuthOverlay.addEventListener('click', (ev) => { if(ev.target === staffAuthOverlay) closeStaffAuth(false); });

document.getElementById('showSignup').addEventListener('click', showSignupMode);
document.getElementById('showLogin').addEventListener('click', () => { clearAuthErrors(); showLoginMode(); });
document.getElementById('mobileToSignup').addEventListener('click', showSignupMode);
document.getElementById('mobileToLogin').addEventListener('click', () => { clearAuthErrors(); showLoginMode(); });

staffForgotPassword.addEventListener('click', async () => {
  const email = staffForgotPassword.dataset.email;
  try{
    await firebase.auth().sendPasswordResetEmail(email);
    alert('Check your email for a link to reset your password, then come back and try again.');
  }catch(e){
    alert('Could not send the reset email. Check the address and try again.');
  }
});

staffSignInBtn.addEventListener('click', async () => {
  clearAuthErrors();
  const email = staffEmailInput.value.trim().toLowerCase();
  const password = staffPasswordInput.value;
  if(!email.endsWith(STAFF_EMAIL_DOMAIN)){
    errStaffEmail.style.display = 'block';
    return;
  }
  if(!password){
    errStaffPassword.textContent = 'Enter a password.';
    errStaffPassword.style.display = 'block';
    return;
  }

  staffSignInBtn.disabled = true; staffSignInBtn.textContent = 'Please wait…';
  try{
    await firebase.auth().signInWithEmailAndPassword(email, password);
    staffSignInBtn.disabled = false; staffSignInBtn.textContent = 'Sign in';
    if(!firebase.auth().currentUser.displayName){
      showNameOnlyMode();
    }else{
      closeStaffAuth(true);
    }
  }catch(e){
    staffSignInBtn.disabled = false; staffSignInBtn.textContent = 'Sign in';
    // This SDK can't reliably tell "no account" apart from "wrong password" here.
    errStaffPassword.textContent = 'Incorrect email or password — or no account yet. Try Create Account below.';
    errStaffPassword.style.display = 'block';
    staffForgotPassword.style.display = 'inline-block';
    staffForgotPassword.dataset.email = email;
  }
});

staffAuthSaveName.addEventListener('click', async () => {
  // Name-only catch-up: user is already signed in, just missing a display name.
  if(authCard.classList.contains('name-only')){
    const name = staffDisplayNameInput.value.trim();
    const user = firebase.auth().currentUser;
    if(name && user){
      try{ await user.updateProfile({ displayName: name }); }catch(e){}
    }
    refreshSignInPill();
    closeStaffAuth(true);
    return;
  }

  // Full account creation.
  clearAuthErrors();
  const name = staffDisplayNameInput.value.trim();
  const email = staffSignupEmailInput.value.trim().toLowerCase();
  const password = staffSignupPasswordInput.value;
  if(!email.endsWith(STAFF_EMAIL_DOMAIN)){
    errSignupEmail.style.display = 'block';
    return;
  }
  if(!password){
    errSignupPassword.textContent = 'Enter a password.';
    errSignupPassword.style.display = 'block';
    return;
  }

  staffAuthSaveName.disabled = true; staffAuthSaveName.textContent = 'Please wait…';
  try{
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    if(name){
      try{ await firebase.auth().currentUser.updateProfile({ displayName: name }); }catch(e){}
    }
    staffAuthSaveName.disabled = false; staffAuthSaveName.textContent = 'Create account';
    refreshSignInPill();
    closeStaffAuth(true);
  }catch(e){
    staffAuthSaveName.disabled = false; staffAuthSaveName.textContent = 'Create account';
    if(e.code === 'auth/email-already-in-use'){
      errSignupPassword.textContent = 'An account already exists for that email — try signing in instead.';
      errSignupPassword.style.display = 'block';
    }else if(e.code === 'auth/weak-password'){
      errSignupPassword.textContent = 'Password must be at least 6 characters.';
      errSignupPassword.style.display = 'block';
    }else{
      errSignupPassword.textContent = 'Could not create your account. Check your connection and try again.';
      errSignupPassword.style.display = 'block';
    }
  }
});

function openStaffAuthModal(){
  return new Promise((resolve) => {
    staffAuthResolve = resolve;
    staffEmailInput.value = '';
    staffPasswordInput.value = '';
    staffSignupEmailInput.value = '';
    staffSignupPasswordInput.value = '';
    staffDisplayNameInput.value = '';
    clearAuthErrors();
    resetSignupModeCopy();
    showLoginMode();
    staffAuthOverlay.classList.add('open');
    staffEmailInput.focus();
  });
}

function ensureStaffSignedIn(){
  const user = firebase.auth().currentUser;
  if(user && user.displayName) return Promise.resolve(true);
  if(user){
    // Signed in but missing a display name (e.g. skipped it earlier) — catch it up.
    return new Promise((resolve) => {
      staffAuthResolve = resolve;
      showNameOnlyMode();
      staffAuthOverlay.classList.add('open');
    });
  }
  return openStaffAuthModal();
}

// ---- Header "Sign In" pill (reflects the same Firebase Auth session as staff sign-in) ----
const staffSignInToggle = document.getElementById('staffSignInToggle');
const staffSignInLabel = document.getElementById('staffSignInLabel');

function refreshSignInPill(){
  const user = firebase.auth().currentUser;
  if(user){
    const name = user.displayName || user.email;
    staffSignInLabel.textContent = isAdmin ? `${name} · Admin` : name;
    staffSignInToggle.classList.add('signed-in');
  }else{
    staffSignInLabel.textContent = 'Sign In';
    staffSignInToggle.classList.remove('signed-in');
  }
}

firebase.auth().onAuthStateChanged(refreshSignInPill);

// ---- Account dropdown (My Components / Sign Out) ----
const accountMenu = document.getElementById('accountMenu');
const accountMenuName = document.getElementById('accountMenuName');
const accountMenuEmail = document.getElementById('accountMenuEmail');

function closeAccountMenu(){ accountMenu.classList.remove('open'); }

staffSignInToggle.addEventListener('click', async () => {
  const user = firebase.auth().currentUser;
  if(user){
    accountMenuName.textContent = user.displayName || 'Signed in';
    accountMenuEmail.textContent = user.email;
    accountMenu.classList.toggle('open');
  }else{
    await ensureStaffSignedIn();
  }
});

document.addEventListener('click', (ev) => {
  if(!document.getElementById('accountWrap').contains(ev.target)) closeAccountMenu();
});

document.getElementById('accountSignOut').addEventListener('click', async () => {
  closeAccountMenu();
  await firebase.auth().signOut();
});

// ---- My Components (entries the signed-in user has published) ----
const myComponentsOverlay = document.getElementById('myComponentsOverlay');
const myComponentsList = document.getElementById('myComponentsList');

async function openMyComponentsPanel(){
  closeAccountMenu();
  const user = firebase.auth().currentUser;
  if(!user) return;
  myComponentsOverlay.classList.add('open');
  myComponentsList.innerHTML = '<div class="s-empty">Loading…</div>';
  try{
    const snap = await entriesCollection.where('authorEmail', '==', user.email).get();
    const rows = [];
    snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if(!rows.length){
      myComponentsList.innerHTML = '<div class="s-empty">You haven\'t suggested any resources yet.</div>';
      return;
    }
    myComponentsList.innerHTML = rows.map(r => `
      <div class="my-component-row" data-id="${r.id}">
        <div class="my-component-title">${escapeHtml(r.title || 'Untitled')}</div>
        <div class="my-component-meta">
          <span>${escapeHtml(r.platform || '')}</span>
          <span>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
        </div>
      </div>
    `).join('');
    myComponentsList.querySelectorAll('.my-component-row').forEach(row => {
      row.addEventListener('click', () => {
        const entry = rows.find(r => r.id === row.dataset.id);
        if(entry){
          myComponentsOverlay.classList.remove('open');
          openNoteDetail(entry);
        }
      });
    });
  }catch(e){
    myComponentsList.innerHTML = '<div class="s-empty">Could not load your components. Check your connection and try again.</div>';
  }
}
document.getElementById('openMyComponents').addEventListener('click', openMyComponentsPanel);
document.getElementById('closeMyComponents').addEventListener('click', () => myComponentsOverlay.classList.remove('open'));
myComponentsOverlay.addEventListener('click', (ev) => { if(ev.target === myComponentsOverlay) myComponentsOverlay.classList.remove('open'); });

function openSuggestPanel(){
  suggestOverlay.classList.add('open');
  sMode.value = 'discovery';
  updateSuggestMode();
}
function closeSuggestPanel(){
  suggestOverlay.classList.remove('open');
  document.getElementById('dTitle').value = '';
  document.getElementById('dDesc').value = '';
  document.getElementById('dLink').value = '';
  document.getElementById('dPlatform').value = 'claude';
  document.getElementById('sTitle').value = '';
  document.getElementById('sText').value = '';
  document.getElementById('sType').value = 'Skill';
  document.getElementById('sPlatform').value = 'claude';
  document.getElementById('sWebsite').value = '';
  ['errDTitle','errDDesc','errDLink','errSTitle','errSText'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

const SUBMIT_COOLDOWN_MS = 60000;
const LAST_SUBMIT_KEY = 'oryx-cheatsheet-last-submit';

function submitOnCooldown(){
  let last = 0;
  try{ last = Number(localStorage.getItem(LAST_SUBMIT_KEY)) || 0; }catch(e){}
  return Date.now() - last < SUBMIT_COOLDOWN_MS;
}
function markSubmitted(){
  try{ localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now())); }catch(e){}
}
openSuggest.addEventListener('click', openSuggestPanel);
document.getElementById('closeSuggest').addEventListener('click', closeSuggestPanel);
document.getElementById('cancelSuggest').addEventListener('click', closeSuggestPanel);
suggestOverlay.addEventListener('click', (ev) => { if(ev.target === suggestOverlay) closeSuggestPanel(); });

async function submitDiscovery(){
  if(document.getElementById('sWebsite').value.trim()){ closeSuggestPanel(); return; }
  if(submitOnCooldown()){ alert('Please wait a moment before sending another one.'); return; }

  const title = document.getElementById('dTitle').value.trim();
  const desc = document.getElementById('dDesc').value.trim();
  const link = document.getElementById('dLink').value.trim();
  const platform = document.getElementById('dPlatform').value;

  let ok = true;
  if(!title){ document.getElementById('errDTitle').style.display = 'block'; ok = false; } else document.getElementById('errDTitle').style.display = 'none';
  if(!desc){ document.getElementById('errDDesc').style.display = 'block'; ok = false; } else document.getElementById('errDDesc').style.display = 'none';
  if(!link){ document.getElementById('errDLink').style.display = 'block'; ok = false; } else document.getElementById('errDLink').style.display = 'none';
  if(!ok) return;

  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  const name = getVerifiedName();

  saveSuggestBtn.disabled = true; saveSuggestBtn.textContent = 'Publishing…';
  try{
    await entriesCollection.add({
      category: platform === 'other' ? 'other-tools' : 'discoveries', title, body: desc, link,
      platform, author: name || 'Anonymous', authorEmail: firebase.auth().currentUser.email, createdAt: Date.now()
    });
    markSubmitted();
    closeSuggestPanel();
    alert('Published! Your discovery is live in the Discoveries section.');
  }catch(e){
    alert('Could not publish that discovery. Check your connection and try again.');
  }finally{
    saveSuggestBtn.disabled = false; updateSuggestMode();
  }
}

function notifySlackOfRequest(s){
  // Posts to the Apps Script relay, which holds the real Slack webhook server-side.
  // no-cors + text/plain avoids Apps Script/Slack's lack of CORS support; fire-and-forget, never blocks the UI.
  fetch(NOTIFY_ENDPOINT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(s)
  }).catch(() => {});
}

async function submitRequest(){
  if(document.getElementById('sWebsite').value.trim()){ closeSuggestPanel(); return; }
  if(submitOnCooldown()){ alert('Please wait a moment before sending another one.'); return; }

  const title = document.getElementById('sTitle').value.trim();
  const text = document.getElementById('sText').value.trim();
  const type = document.getElementById('sType').value;
  const platform = document.getElementById('sPlatform').value;

  let ok = true;
  if(!title){ document.getElementById('errSTitle').style.display = 'block'; ok = false; } else document.getElementById('errSTitle').style.display = 'none';
  if(!text){ document.getElementById('errSText').style.display = 'block'; ok = false; } else document.getElementById('errSText').style.display = 'none';
  if(!ok) return;

  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  const name = getVerifiedName();

  saveSuggestBtn.disabled = true; saveSuggestBtn.textContent = 'Sending…';
  try{
    await suggestionsCollection.add({
      title, text, type, platform, name, status: 'pending', createdAt: Date.now()
    });
    markSubmitted();
    notifySlackOfRequest({ title, text, type, platform, name });
    closeSuggestPanel();
    alert('Thanks! Your request has been sent to the admin.');
  }catch(e){
    alert('Could not send that request. Check your connection and try again.');
  }finally{
    saveSuggestBtn.disabled = false; updateSuggestMode();
  }
}

saveSuggestBtn.addEventListener('click', () => {
  if(sMode.value === 'discovery') submitDiscovery();
  else submitRequest();
});
