// ---------- Add a Claude shortcut ----------
const shortcutOverlay = document.getElementById('shortcutOverlay');
const openAddShortcutBtn = document.getElementById('openAddShortcut');
const closeShortcutPanel = document.getElementById('closeShortcutPanel');
const cancelAddShortcut = document.getElementById('cancelAddShortcut');
const saveAddShortcut = document.getElementById('saveAddShortcut');
let editingShortcutId = null;

function openShortcutOverlay(){
  shortcutOverlay.classList.add('open');
  editingShortcutId = null;
  const cats = shortcutGroup === 'chatgpt' ? CHATGPT_SHORTCUT_CATS : CLAUDE_SHORTCUT_CATS;
  const scCategory = document.getElementById('scCategory');
  scCategory.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
  scCategory.value = activeCat;
  document.getElementById('shortcutPanelTitle').textContent = shortcutGroup === 'chatgpt' ? 'Add a ChatGPT shortcut' : 'Add a Claude shortcut';
  saveAddShortcut.textContent = 'Save shortcut';
  let savedAuthor = '';
  try{ savedAuthor = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
  document.getElementById('scAuthor').value = savedAuthor;
}

function openEditShortcut(entry){
  shortcutOverlay.classList.add('open');
  editingShortcutId = entry.id;
  const isChatgpt = CHATGPT_SHORTCUT_CATS.includes(entry.category);
  const cats = isChatgpt ? CHATGPT_SHORTCUT_CATS : CLAUDE_SHORTCUT_CATS;
  const scCategory = document.getElementById('scCategory');
  scCategory.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
  scCategory.value = entry.category;
  document.getElementById('shortcutPanelTitle').textContent = 'Edit shortcut';
  saveAddShortcut.textContent = 'Save changes';
  document.getElementById('scTitle').value = entry.title || '';
  document.getElementById('scKey').value = entry.shortcutKey || '';
  document.getElementById('scPurpose').value = entry.purpose || '';
  document.getElementById('scHowToUse').value = entry.howToUse || '';
  document.getElementById('scExample').value = entry.example || '';
  document.getElementById('scNotes').value = entry.notes || '';
  document.getElementById('scAuthor').value = entry.author || '';
}

function closeShortcutOverlay(){
  shortcutOverlay.classList.remove('open');
  editingShortcutId = null;
  document.getElementById('scTitle').value = '';
  document.getElementById('scKey').value = '';
  document.getElementById('scPurpose').value = '';
  document.getElementById('scHowToUse').value = '';
  document.getElementById('scExample').value = '';
  document.getElementById('scNotes').value = '';
  document.getElementById('errScTitle').style.display = 'none';
  document.getElementById('errScKey').style.display = 'none';
  document.getElementById('errScPurpose').style.display = 'none';
}

openAddShortcutBtn.addEventListener('click', openShortcutOverlay);
closeShortcutPanel.addEventListener('click', closeShortcutOverlay);
cancelAddShortcut.addEventListener('click', closeShortcutOverlay);
shortcutOverlay.addEventListener('click', (ev) => { if(ev.target === shortcutOverlay) closeShortcutOverlay(); });

saveAddShortcut.addEventListener('click', async () => {
  const title = document.getElementById('scTitle').value.trim();
  const shortcutKey = document.getElementById('scKey').value.trim();
  const purpose = document.getElementById('scPurpose').value.trim();
  const author = document.getElementById('scAuthor').value.trim();

  let valid = true;
  if(!title){ document.getElementById('errScTitle').style.display = 'block'; valid = false; }
  else { document.getElementById('errScTitle').style.display = 'none'; }
  if(!shortcutKey){ document.getElementById('errScKey').style.display = 'block'; valid = false; }
  else { document.getElementById('errScKey').style.display = 'none'; }
  if(!purpose){ document.getElementById('errScPurpose').style.display = 'block'; valid = false; }
  else { document.getElementById('errScPurpose').style.display = 'none'; }
  if(!valid) return;

  const isEditing = !!editingShortcutId;
  const existing = isEditing ? entries.find(e => e.id === editingShortcutId) : null;

  saveAddShortcut.disabled = true;
  saveAddShortcut.textContent = 'Saving…';

  const entryData = {
    category: document.getElementById('scCategory').value,
    title, shortcutKey, purpose,
    howToUse: document.getElementById('scHowToUse').value.trim(),
    example: document.getElementById('scExample').value.trim(),
    notes: document.getElementById('scNotes').value.trim(),
    link: '', tag: '', body: '', department: '',
    platform: shortcutGroup === 'chatgpt' ? 'chatgpt' : 'claude',
    author: author || 'Anonymous',
    suggestedBy: existing ? (existing.suggestedBy || '') : ''
  };
  if(isEditing){
    let editorName = '';
    try{ editorName = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
    entryData.lastEditedBy = editorName || author || 'Anonymous';
    entryData.lastEditedAt = Date.now();
  }else{
    entryData.createdAt = Date.now();
  }

  try{
    if(isEditing){
      await entriesCollection.doc(editingShortcutId).update(entryData);
    }else{
      await entriesCollection.add(entryData);
    }
    if(author){
      try{ localStorage.setItem(AUTHOR_KEY, author); }catch(e){}
    }
    closeShortcutOverlay();
  }catch(e){
    alert('Could not save that shortcut. Check your connection and try again.');
  }finally{
    saveAddShortcut.disabled = false;
    saveAddShortcut.textContent = isEditing ? 'Save changes' : 'Save shortcut';
  }
});
