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

function openSuggestPanel(){
  suggestOverlay.classList.add('open');
  sMode.value = 'discovery';
  updateSuggestMode();
  let savedName = '';
  try{ savedName = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
  document.getElementById('sName').value = savedName;
  document.getElementById('dName').value = savedName;
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
  ['errDTitle','errDDesc','errDLink','errSTitle','errSText','errSName'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}
openSuggest.addEventListener('click', openSuggestPanel);
document.getElementById('closeSuggest').addEventListener('click', closeSuggestPanel);
document.getElementById('cancelSuggest').addEventListener('click', closeSuggestPanel);
suggestOverlay.addEventListener('click', (ev) => { if(ev.target === suggestOverlay) closeSuggestPanel(); });

async function submitDiscovery(){
  const title = document.getElementById('dTitle').value.trim();
  const desc = document.getElementById('dDesc').value.trim();
  const link = document.getElementById('dLink').value.trim();
  const platform = document.getElementById('dPlatform').value;
  const name = document.getElementById('dName').value.trim();

  let ok = true;
  if(!title){ document.getElementById('errDTitle').style.display = 'block'; ok = false; } else document.getElementById('errDTitle').style.display = 'none';
  if(!desc){ document.getElementById('errDDesc').style.display = 'block'; ok = false; } else document.getElementById('errDDesc').style.display = 'none';
  if(!link){ document.getElementById('errDLink').style.display = 'block'; ok = false; } else document.getElementById('errDLink').style.display = 'none';
  if(!ok) return;

  saveSuggestBtn.disabled = true; saveSuggestBtn.textContent = 'Publishing…';
  try{
    await entriesCollection.add({
      category: platform === 'other' ? 'other-tools' : 'discoveries', title, body: desc, link,
      platform, author: name || 'Anonymous', createdAt: Date.now()
    });
    if(name){ try{ localStorage.setItem(AUTHOR_KEY, name); }catch(e){} }
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
  const title = document.getElementById('sTitle').value.trim();
  const text = document.getElementById('sText').value.trim();
  const type = document.getElementById('sType').value;
  const platform = document.getElementById('sPlatform').value;
  const name = document.getElementById('sName').value.trim();

  let ok = true;
  if(!title){ document.getElementById('errSTitle').style.display = 'block'; ok = false; } else document.getElementById('errSTitle').style.display = 'none';
  if(!text){ document.getElementById('errSText').style.display = 'block'; ok = false; } else document.getElementById('errSText').style.display = 'none';
  if(!name){ document.getElementById('errSName').style.display = 'block'; ok = false; } else document.getElementById('errSName').style.display = 'none';
  if(!ok) return;

  saveSuggestBtn.disabled = true; saveSuggestBtn.textContent = 'Sending…';
  try{
    await suggestionsCollection.add({
      title, text, type, platform, name, status: 'pending', createdAt: Date.now()
    });
    notifySlackOfRequest({ title, text, type, platform, name });
    try{ localStorage.setItem(AUTHOR_KEY, name); }catch(e){}
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
