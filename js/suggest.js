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

function applyVerifiedNameToForm(){
  const user = firebase.auth().currentUser;
  const verifiedName = user ? (user.displayName || user.email) : '';
  ['dName','sName'].forEach(id => {
    const el = document.getElementById(id);
    el.value = verifiedName;
    el.readOnly = !!user;
    el.placeholder = user ? '' : 'e.g. Sara — you\'ll confirm your @oryxdoors.com email when you submit';
  });
}

const STAFF_EMAIL_DOMAIN = '@oryxdoors.com';

// ---- Staff sign-in modal (replaces browser prompt() dialogs) ----
const staffAuthOverlay = document.getElementById('staffAuthOverlay');
const staffAuthStepCreds = document.getElementById('staffAuthStepCreds');
const staffAuthStepName = document.getElementById('staffAuthStepName');
const staffEmailInput = document.getElementById('staffEmail');
const staffPasswordInput = document.getElementById('staffPassword');
const staffDisplayNameInput = document.getElementById('staffDisplayName');
const errStaffEmail = document.getElementById('errStaffEmail');
const errStaffPassword = document.getElementById('errStaffPassword');
const staffForgotPassword = document.getElementById('staffForgotPassword');
const staffAuthContinue = document.getElementById('staffAuthContinue');

let staffAuthResolve = null;
let staffAuthStep = 'creds';

function showStaffAuthStep(step){
  staffAuthStep = step;
  staffAuthStepCreds.style.display = step === 'creds' ? '' : 'none';
  staffAuthStepName.style.display = step === 'name' ? '' : 'none';
  if(step === 'name'){
    staffDisplayNameInput.value = '';
    staffDisplayNameInput.focus();
  }
}

function closeStaffAuth(result){
  staffAuthOverlay.classList.remove('open');
  const resolve = staffAuthResolve;
  staffAuthResolve = null;
  if(resolve) resolve(result);
}

document.getElementById('closeStaffAuth').addEventListener('click', () => closeStaffAuth(staffAuthStep === 'name'));
document.getElementById('cancelStaffAuth').addEventListener('click', () => closeStaffAuth(false));
staffAuthOverlay.addEventListener('click', (ev) => { if(ev.target === staffAuthOverlay) closeStaffAuth(staffAuthStep === 'name'); });

staffForgotPassword.addEventListener('click', async () => {
  const email = staffForgotPassword.dataset.email;
  try{
    await firebase.auth().sendPasswordResetEmail(email);
    alert('Check your email for a link to reset your password, then come back and try again.');
  }catch(e){
    alert('Could not send the reset email. Check the address and try again.');
  }
});

staffAuthContinue.addEventListener('click', async () => {
  errStaffEmail.style.display = 'none';
  errStaffPassword.style.display = 'none';
  staffForgotPassword.style.display = 'none';

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

  staffAuthContinue.disabled = true; staffAuthContinue.textContent = 'Please wait…';

  try{
    await firebase.auth().signInWithEmailAndPassword(email, password);
    staffAuthContinue.disabled = false; staffAuthContinue.textContent = 'Continue';
    if(!firebase.auth().currentUser.displayName){
      showStaffAuthStep('name');
    }else{
      closeStaffAuth(true);
    }
    return;
  }catch(e){
    if(e.code !== 'auth/user-not-found' && e.code !== 'auth/invalid-credential'){
      errStaffPassword.textContent = 'Could not sign in. Check your connection and try again.';
      errStaffPassword.style.display = 'block';
      staffAuthContinue.disabled = false; staffAuthContinue.textContent = 'Continue';
      return;
    }
  }

  // No account yet with this email — create one.
  try{
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    staffAuthContinue.disabled = false; staffAuthContinue.textContent = 'Continue';
    showStaffAuthStep('name');
  }catch(e){
    staffAuthContinue.disabled = false; staffAuthContinue.textContent = 'Continue';
    if(e.code === 'auth/email-already-in-use'){
      // An account exists for this email but the password entered was wrong.
      errStaffPassword.textContent = 'That password didn\'t work.';
      errStaffPassword.style.display = 'block';
      staffForgotPassword.style.display = 'inline-block';
      staffForgotPassword.dataset.email = email;
    }else if(e.code === 'auth/weak-password'){
      errStaffPassword.textContent = 'Password must be at least 6 characters.';
      errStaffPassword.style.display = 'block';
    }else{
      errStaffPassword.textContent = 'Could not sign in. Check your connection and try again.';
      errStaffPassword.style.display = 'block';
    }
  }
});

document.getElementById('staffAuthSaveName').addEventListener('click', async () => {
  const name = staffDisplayNameInput.value.trim();
  const user = firebase.auth().currentUser;
  if(name && user){
    try{ await user.updateProfile({ displayName: name }); }catch(e){}
  }
  refreshSignInPill();
  closeStaffAuth(true);
});

function openStaffAuthModal(){
  return new Promise((resolve) => {
    staffAuthResolve = resolve;
    staffEmailInput.value = '';
    staffPasswordInput.value = '';
    showStaffAuthStep('creds');
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
      showStaffAuthStep('name');
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
    staffSignInLabel.textContent = user.displayName || user.email;
    staffSignInToggle.classList.add('signed-in');
  }else{
    staffSignInLabel.textContent = 'Sign In';
    staffSignInToggle.classList.remove('signed-in');
  }
}

firebase.auth().onAuthStateChanged(refreshSignInPill);

staffSignInToggle.addEventListener('click', async () => {
  if(firebase.auth().currentUser){
    await firebase.auth().signOut();
  }else{
    const signedIn = await ensureStaffSignedIn();
    if(signedIn) applyVerifiedNameToForm();
  }
});

function openSuggestPanel(){
  suggestOverlay.classList.add('open');
  sMode.value = 'discovery';
  updateSuggestMode();
  applyVerifiedNameToForm();
}
function closeSuggestPanel(){
  suggestOverlay.classList.remove('open');
  document.getElementById('dTitle').value = '';
  document.getElementById('dDesc').value = '';
  document.getElementById('dLink').value = '';
  document.getElementById('dPlatform').value = 'claude';
  document.getElementById('dName').value = '';
  document.getElementById('sTitle').value = '';
  document.getElementById('sText').value = '';
  document.getElementById('sType').value = 'Skill';
  document.getElementById('sPlatform').value = 'claude';
  document.getElementById('sWebsite').value = '';
  ['errDTitle','errDDesc','errDLink','errSTitle','errSText','errSName'].forEach(id => {
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
  applyVerifiedNameToForm();
  const name = document.getElementById('dName').value.trim();

  saveSuggestBtn.disabled = true; saveSuggestBtn.textContent = 'Publishing…';
  try{
    await entriesCollection.add({
      category: platform === 'other' ? 'other-tools' : 'discoveries', title, body: desc, link,
      platform, author: name || 'Anonymous', createdAt: Date.now()
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
  applyVerifiedNameToForm();
  const name = document.getElementById('sName').value.trim();

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
