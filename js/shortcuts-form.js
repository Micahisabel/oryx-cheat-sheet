// ---------- Add a Claude shortcut ----------
const shortcutOverlay = document.getElementById('shortcutOverlay');
const openAddShortcutBtn = document.getElementById('openAddShortcut');
const closeShortcutPanel = document.getElementById('closeShortcutPanel');
const cancelAddShortcut = document.getElementById('cancelAddShortcut');
const saveAddShortcut = document.getElementById('saveAddShortcut');
let editingShortcutId = null;

const scKnowledgeCheckEditor = buildKnowledgeCheckEditor(
  document.getElementById('scKnowledgeCheck'),
  document.getElementById('scKnowledgeCheckAdd')
);

// Prompt categories use a different set of fields (Name, Purpose, Sample prompt,
// How to use it, ELI5) instead of the keyboard-shortcut fields. Toggle the form to match.
function applyShortcutFormMode(cat){
  const isPrompt = isPromptShortcutCategory(cat);
  document.getElementById('scKeyGroup').style.display = isPrompt ? 'none' : '';
  document.getElementById('scExampleGroup').style.display = isPrompt ? 'none' : '';
  document.getElementById('scNotesGroup').style.display = isPrompt ? 'none' : '';
  document.getElementById('scSamplePromptGroup').style.display = isPrompt ? '' : 'none';
  document.getElementById('scTitleLabel').textContent = isPrompt ? 'Name' : 'Label';
}

// Code categories are developer-oriented and stay admin-only (matches the tab hiding in
// admin.js) — everyone else can only pick Prompts / Desktop / Quick Commands.
function shortcutCatsFor(group){
  const all = group === 'chatgpt' ? CHATGPT_SHORTCUT_CATS : CLAUDE_SHORTCUT_CATS;
  const codeCat = group === 'chatgpt' ? 'chatgpt-shortcut-code' : 'shortcut-code';
  return isAdmin ? all : all.filter(c => c !== codeCat);
}

function openShortcutOverlay(){
  shortcutOverlay.classList.add('open');
  editingShortcutId = null;
  const cats = shortcutCatsFor(shortcutGroup);
  const scCategory = document.getElementById('scCategory');
  scCategory.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
  scCategory.value = cats.includes(activeCat) ? activeCat : cats[0];
  applyShortcutFormMode(scCategory.value);
  document.getElementById('shortcutPanelTitle').textContent = shortcutGroup === 'chatgpt' ? 'Add a ChatGPT shortcut' : 'Add a Claude shortcut';
  saveAddShortcut.textContent = 'Save shortcut';
  let savedAuthor = '';
  try{ savedAuthor = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
  document.getElementById('scAuthor').value = savedAuthor;
  setScDepartments('');
  document.getElementById('scDifficulty').value = '';
  scKnowledgeCheckEditor.reset();
}

function openEditShortcut(entry){
  shortcutOverlay.classList.add('open');
  editingShortcutId = entry.id;
  const isChatgpt = CHATGPT_SHORTCUT_CATS.includes(entry.category);
  const cats = shortcutCatsFor(isChatgpt ? 'chatgpt' : 'claude');
  const scCategory = document.getElementById('scCategory');
  scCategory.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
  scCategory.value = entry.category;
  applyShortcutFormMode(entry.category);
  document.getElementById('shortcutPanelTitle').textContent = 'Edit shortcut';
  saveAddShortcut.textContent = 'Save changes';
  document.getElementById('scTitle').value = entry.title || '';
  document.getElementById('scKey').value = entry.shortcutKey || '';
  document.getElementById('scPurpose').value = entry.purpose || '';
  document.getElementById('scSamplePrompt').value = entry.samplePrompt || '';
  document.getElementById('scHowToUse').value = entry.howToUse || '';
  document.getElementById('scExample').value = entry.example || '';
  document.getElementById('scNotes').value = entry.notes || '';
  document.getElementById('scAuthor').value = entry.author || '';
  setScDepartments(entry.department || '');
  document.getElementById('scDifficulty').value = entry.difficulty || '';
  scKnowledgeCheckEditor.setValue(entry.knowledgeCheck || []);
}

function closeShortcutOverlay(){
  shortcutOverlay.classList.remove('open');
  editingShortcutId = null;
  document.getElementById('scTitle').value = '';
  document.getElementById('scKey').value = '';
  document.getElementById('scPurpose').value = '';
  document.getElementById('scSamplePrompt').value = '';
  document.getElementById('scHowToUse').value = '';
  document.getElementById('scExample').value = '';
  document.getElementById('scNotes').value = '';
  document.getElementById('errScTitle').style.display = 'none';
  document.getElementById('errScKey').style.display = 'none';
  document.getElementById('errScPurpose').style.display = 'none';
  document.getElementById('errScSamplePrompt').style.display = 'none';
  setScDepartments('');
  document.getElementById('scDifficulty').value = '';
  scKnowledgeCheckEditor.reset();
}

// Departments chip picker for the shortcut form (mirrors the Suggest form's dDepartments).
const scDeptPickerEl = document.getElementById('scDepartments');
if(scDeptPickerEl){
  scDeptPickerEl.innerHTML = LIBRARY_DEPARTMENTS.map(d =>
    `<button type="button" class="dept-chip" data-dept="${escapeHtml(d)}">${escapeHtml(d)}</button>`
  ).join('');
  scDeptPickerEl.querySelectorAll('.dept-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}
function getScDepartments(){
  return scDeptPickerEl ? [...scDeptPickerEl.querySelectorAll('.dept-chip.selected')].map(c => c.dataset.dept) : [];
}
function setScDepartments(deptStr){
  if(!scDeptPickerEl) return;
  const selected = (deptStr || '').split(',').map(s => s.trim()).filter(Boolean);
  scDeptPickerEl.querySelectorAll('.dept-chip').forEach(chip => {
    chip.classList.toggle('selected', selected.includes(chip.dataset.dept));
  });
}

openAddShortcutBtn.addEventListener('click', openShortcutOverlay);
closeShortcutPanel.addEventListener('click', closeShortcutOverlay);
cancelAddShortcut.addEventListener('click', closeShortcutOverlay);
shortcutOverlay.addEventListener('click', (ev) => { if(ev.target === shortcutOverlay) closeShortcutOverlay(); });
document.getElementById('scCategory').addEventListener('change', (ev) => applyShortcutFormMode(ev.target.value));

saveAddShortcut.addEventListener('click', async () => {
  const scCategoryValue = document.getElementById('scCategory').value;
  const isPrompt = isPromptShortcutCategory(scCategoryValue);
  const title = document.getElementById('scTitle').value.trim();
  const shortcutKey = document.getElementById('scKey').value.trim();
  const purpose = document.getElementById('scPurpose').value.trim();
  const samplePrompt = document.getElementById('scSamplePrompt').value.trim();
  const author = document.getElementById('scAuthor').value.trim();

  let valid = true;
  if(!title){ document.getElementById('errScTitle').style.display = 'block'; valid = false; }
  else { document.getElementById('errScTitle').style.display = 'none'; }
  // Prompts need a sample prompt; other shortcut types need the shortcut/command key.
  if(isPrompt){
    document.getElementById('errScKey').style.display = 'none';
    if(!samplePrompt){ document.getElementById('errScSamplePrompt').style.display = 'block'; valid = false; }
    else { document.getElementById('errScSamplePrompt').style.display = 'none'; }
  } else {
    document.getElementById('errScSamplePrompt').style.display = 'none';
    if(!shortcutKey){ document.getElementById('errScKey').style.display = 'block'; valid = false; }
    else { document.getElementById('errScKey').style.display = 'none'; }
  }
  if(!purpose){ document.getElementById('errScPurpose').style.display = 'block'; valid = false; }
  else { document.getElementById('errScPurpose').style.display = 'none'; }
  if(!valid) return;

  const isEditing = !!editingShortcutId;
  const existing = isEditing ? entries.find(e => e.id === editingShortcutId) : null;

  if(!isEditing){
    const normalizedTitle = title.toLowerCase();
    const existingMatch = entries.find(e =>
      e.category === scCategoryValue && (e.title || '').trim().toLowerCase() === normalizedTitle
    );
    if(existingMatch){
      const addedBy = existingMatch.author || 'someone';
      const proceed = confirm(
        `A shortcut titled "${title}" already exists in this category (added by ${addedBy}). Save this as a duplicate anyway?`
      );
      if(!proceed) return;
    }
  }

  saveAddShortcut.disabled = true;
  saveAddShortcut.textContent = 'Saving…';

  const entryData = {
    category: scCategoryValue,
    title,
    shortcutKey: isPrompt ? '' : shortcutKey,
    purpose,
    samplePrompt: isPrompt ? samplePrompt : '',
    howToUse: document.getElementById('scHowToUse').value.trim(),
    example: isPrompt ? '' : document.getElementById('scExample').value.trim(),
    notes: isPrompt ? '' : document.getElementById('scNotes').value.trim(),
    link: '', tag: '', body: '', department: getScDepartments().join(', '),
    difficulty: document.getElementById('scDifficulty').value,
    knowledgeCheck: scKnowledgeCheckEditor.getValue(),
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
    // Stamp the creator so notifyIfSubscribed can suppress a self-notification for the person adding it.
    entryData.authorEmail = (firebase.auth().currentUser && firebase.auth().currentUser.email) || '';
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
