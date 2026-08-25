const openAdd = document.getElementById('openAdd');
const closePanel = document.getElementById('closePanel');
const cancelAdd = document.getElementById('cancelAdd');
const saveAdd = document.getElementById('saveAdd');

const fCategory = document.getElementById('fCategory');
const simpleFields = document.getElementById('simpleFields');
const skillFields = document.getElementById('skillFields');
const overlayHeading = document.querySelector('#overlay h2');
const SKILL_FIELD_IDS = ['fPurpose','fSamplePrompt','fBestFor','fExampleOutput','fNotes','fHowToAccess','fOryxTip'];
const SKILL_FIELD_KEYS = {
  fPurpose:'purpose', fSamplePrompt:'samplePrompt', fBestFor:'bestFor',
  fExampleOutput:'exampleOutput', fNotes:'notes', fHowToAccess:'howToAccess', fOryxTip:'oryxTip'
};

// ---- Departments multi-select (chips) — applies to every resource type -------
// Stored back into the existing `department` field as a comma-separated string, so no new
// Firestore field is introduced (keeps the entry write within the rules' allowed shape).
const deptPickerEl = document.getElementById('fDepartments');
function buildDeptPicker(){
  deptPickerEl.innerHTML = LIBRARY_DEPARTMENTS.map(d =>
    `<button type="button" class="dept-chip" data-dept="${escapeHtml(d)}">${escapeHtml(d)}</button>`
  ).join('');
  deptPickerEl.querySelectorAll('.dept-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}
buildDeptPicker();
function setSelectedDepartments(list){
  const wanted = new Set((list || []).map(s => s.toLowerCase()));
  deptPickerEl.querySelectorAll('.dept-chip').forEach(chip => {
    chip.classList.toggle('selected', wanted.has(chip.dataset.dept.toLowerCase()));
  });
}
function getSelectedDepartments(){
  return [...deptPickerEl.querySelectorAll('.dept-chip.selected')].map(c => c.dataset.dept);
}
let editingEntryId = null;

function toggleEntryFields(){
  const isRich = isRichCategory(fCategory.value);
  simpleFields.style.display = isRich ? 'none' : '';
  skillFields.style.display = isRich ? '' : 'none';
  // The Video link field only applies to AI Tools & Files pages, which carry a Video section.
  const videoField = document.getElementById('fVideoField');
  if(videoField) videoField.style.display = isOtherToolsCategory(fCategory.value) ? '' : 'none';
}
fCategory.addEventListener('change', toggleEntryFields);

// ---------- AI helper (free copy-paste assist, no backend/API) ----------
const aiInput = document.getElementById('aiInput');
const aiResult = document.getElementById('aiResult');
const aiStatus = document.getElementById('aiStatus');
const aiOpenChat = document.getElementById('aiOpenChat');

function buildAiPrompt(desc){
  return `You are helping build a knowledge-base entry for Oryx Doors & Windows, a Dubai-based premium aluminium doors, windows, and shading company. Read the input at the bottom and turn it into a structured entry.

Return ONLY a JSON object — no explanation, no markdown code fences — with these exact keys:
- "category": one of "skills", "commands", "agents", "mcps", "plugins" (never "discoveries" — that category is submitted separately by team members and doesn't go through this form)
- "platform": "claude" or "chatgpt"
- "title": a short, clear name
- "department": the Oryx department it best fits (e.g. Sales and Marketing, Customer Service, Operations, HR, Finance, IT)
- "purpose": written formally, in the third person, in the style real Claude Skill descriptions use. Structure it as: (1) one or two sentences starting "This skill..." that state what it does and what it produces, (2) a sentence starting "The user provides..." that states what input is needed, (3) a sentence starting "They may include..." for optional extra context the user might add. Do not write in first or second person ("you"/"I") and do not simplify it for a general audience — this is a technical description of the skill's function and inputs.
- "bestFor": when someone should use it
- "samplePrompt": 2-3 reusable example prompts someone could paste straight into Claude, each covering a different common task. Put ONE prompt per line (no numbering, no blank lines between them).
- "exampleOutput": a short example of the result
- "notes": tips, gotchas, or limitations
- "howToAccess": brief steps to install and use it in Claude
- "oryxTip": how this specifically helps Oryx Doors & Windows

Rules:
- Do not include a link field — this is handled separately in the system, not generated here.
- "Added by" and "date added" are also handled separately, not generated here.
- "purpose", "samplePrompt", and "howToAccess" are required — never leave them empty. Every prompt in "samplePrompt" must be something someone can paste into Claude and run immediately, no placeholders like "[describe task]". "howToAccess" must be concrete steps, not a placeholder.
- Use UK English spelling. Be accurate — do not invent figures, prices, or claims.

INPUT:
"""
${desc}
"""`;
}

function setAiStatus(msg){ aiStatus.textContent = msg || ''; }

if(aiOpenChat){
  document.getElementById('fPlatform').addEventListener('change', (ev) => {
    aiOpenChat.href = ev.target.value === 'chatgpt' ? 'https://chatgpt.com/' : 'https://claude.ai/new';
    aiOpenChat.textContent = (ev.target.value === 'chatgpt' ? 'Open ChatGPT' : 'Open Claude') + ' ↗';
  });
}

document.getElementById('aiGenerate').addEventListener('click', async () => {
  const desc = aiInput.value.trim();
  if(!desc){ setAiStatus('Type a short description first.'); return; }
  const prompt = buildAiPrompt(desc);
  const copied = await copyToClipboard(prompt);
  if(copied){
    setAiStatus('✓ Prompt copied. Paste it into Claude or ChatGPT, then bring the answer back to Step 2.');
  }else{
    // Last resort — surface the prompt so it can be copied by hand.
    aiResult.value = prompt;
    setAiStatus('Clipboard was blocked. Copy the text now shown in the Step 2 box, run it in Claude/ChatGPT, then paste the answer back over it.');
  }
});

function parseAiResult(text){
  let t = (text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  const first = t.indexOf('{'), last = t.lastIndexOf('}');
  if(first === -1 || last === -1) return null;
  try{ return JSON.parse(t.slice(first, last + 1)); }catch(e){ return null; }
}

document.getElementById('aiFill').addEventListener('click', () => {
  const data = parseAiResult(aiResult.value);
  if(!data){ setAiStatus('Could not read that. Paste the full answer, including the { } part.'); return; }

  const cats = ['skills','commands','agents','mcps','plugins'];
  if(data.category && cats.includes(data.category)) fCategory.value = data.category;
  if(data.platform === 'claude' || data.platform === 'chatgpt') document.getElementById('fPlatform').value = data.platform;
  if(data.title) document.getElementById('fTitle').value = data.title;
  if(data.body != null) document.getElementById('fBody').value = data.body;

  Object.keys(SKILL_FIELD_KEYS).forEach(id => { if(data[SKILL_FIELD_KEYS[id]] != null) document.getElementById(id).value = data[SKILL_FIELD_KEYS[id]]; });
  if(data.department) setSelectedDepartments(entryDepartments({ department: String(data.department) }));

  toggleEntryFields();
  setAiStatus('✓ Form filled. Review the fields below, then Save entry.');
});

function openOverlay(){
  overlay.classList.add('open');
  editingEntryId = null;
  overlayHeading.textContent = 'Add an entry';
  saveAdd.textContent = 'Save entry';
  currentSuggestionId = null;
  currentSuggestedBy = '';
  let savedAuthor = '';
  try{ savedAuthor = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
  document.getElementById('fAuthor').value = savedAuthor;
  // Always start from a clean form — this can be called directly (e.g. from the
  // Review queue's "Create entry") without closeOverlay() running first, so a
  // draft left over from a prior, uncancelled Add Entry session must not leak in.
  document.getElementById('fPlatform').value = 'claude';
  document.getElementById('fCategory').value = 'skills';
  document.getElementById('fTitle').value = '';
  document.getElementById('fBody').value = '';
  document.getElementById('fLink').value = '';
  document.getElementById('fTag').value = '';
  document.getElementById('errTitle').style.display = 'none';
  document.getElementById('errBody').style.display = 'none';
  document.getElementById('errPurpose').style.display = 'none';
  document.getElementById('errSamplePrompt').style.display = 'none';
  document.getElementById('errHowToAccess').style.display = 'none';
  SKILL_FIELD_IDS.forEach(id => { document.getElementById(id).value = ''; });
  setSelectedDepartments([]);
  aiInput.value = '';
  aiResult.value = '';
  setAiStatus('');
  toggleEntryFields();
}
function closeOverlay(){
  overlay.classList.remove('open');
  editingEntryId = null;
  overlayHeading.textContent = 'Add an entry';
  saveAdd.textContent = 'Save entry';
  document.getElementById('fPlatform').value = 'claude';
  document.getElementById('fCategory').value = 'skills';
  toggleEntryFields();
  document.getElementById('fTitle').value = '';
  document.getElementById('fBody').value = '';
  document.getElementById('fLink').value = '';
  document.getElementById('fTag').value = '';
  document.getElementById('errTitle').style.display = 'none';
  document.getElementById('errBody').style.display = 'none';
  document.getElementById('errPurpose').style.display = 'none';
  document.getElementById('errSamplePrompt').style.display = 'none';
  document.getElementById('errHowToAccess').style.display = 'none';
  SKILL_FIELD_IDS.forEach(id => { document.getElementById(id).value = ''; });
  setSelectedDepartments([]);
  aiInput.value = '';
  aiResult.value = '';
  setAiStatus('');
  currentSuggestionId = null;
  currentSuggestedBy = '';
}

function openEditEntry(entry){
  overlay.classList.add('open');
  editingEntryId = entry.id;
  overlayHeading.textContent = 'Edit entry';
  saveAdd.textContent = 'Save changes';
  currentSuggestionId = null;
  currentSuggestedBy = entry.suggestedBy || '';

  document.getElementById('fPlatform').value = entry.platform || 'claude';
  fCategory.value = entry.category;
  toggleEntryFields();

  document.getElementById('fTitle').value = entry.title || '';
  document.getElementById('fBody').value = entry.body || '';
  document.getElementById('fTag').value = entry.tag || '';
  document.getElementById('fLink').value = entry.link || '';
  document.getElementById('fVideoUrl').value = entry.videoUrl || '';
  document.getElementById('fAuthor').value = entry.author || '';

  SKILL_FIELD_IDS.forEach(id => { document.getElementById(id).value = entry[SKILL_FIELD_KEYS[id]] || ''; });
  setSelectedDepartments(entryDepartments(entry));

  aiInput.value = '';
  aiResult.value = '';
  setAiStatus('');
  document.getElementById('errTitle').style.display = 'none';
  document.getElementById('errBody').style.display = 'none';
  document.getElementById('errPurpose').style.display = 'none';
  document.getElementById('errSamplePrompt').style.display = 'none';
  document.getElementById('errHowToAccess').style.display = 'none';
}

openAdd.addEventListener('click', openOverlay);
closePanel.addEventListener('click', closeOverlay);
cancelAdd.addEventListener('click', closeOverlay);
overlay.addEventListener('click', (ev) => { if(ev.target === overlay) closeOverlay(); });
saveAdd.addEventListener('click', async () => {
  const title = document.getElementById('fTitle').value.trim();
  const body = document.getElementById('fBody').value.trim();
  const link = document.getElementById('fLink').value.trim();
  const author = document.getElementById('fAuthor').value.trim();
  const category = fCategory.value;
  const isSkill = isRichCategory(category);

  const skillValues = {};
  SKILL_FIELD_IDS.forEach(id => {
    skillValues[id] = document.getElementById(id).value.trim();
  });

  let valid = true;
  if(!title){ document.getElementById('errTitle').style.display = 'block'; valid = false; }
  else { document.getElementById('errTitle').style.display = 'none'; }

  if(isSkill){
    if(!skillValues.fPurpose){ document.getElementById('errPurpose').style.display = 'block'; valid = false; }
    else { document.getElementById('errPurpose').style.display = 'none'; }
    if(!skillValues.fSamplePrompt){ document.getElementById('errSamplePrompt').style.display = 'block'; valid = false; }
    else { document.getElementById('errSamplePrompt').style.display = 'none'; }
    if(!skillValues.fHowToAccess){ document.getElementById('errHowToAccess').style.display = 'block'; valid = false; }
    else { document.getElementById('errHowToAccess').style.display = 'none'; }
  } else {
    if(!body){ document.getElementById('errBody').style.display = 'block'; valid = false; }
    else { document.getElementById('errBody').style.display = 'none'; }
  }

  if(link && !isValidLink(link)){
    alert('That link doesn\'t look valid. Include https:// or leave it blank.');
    valid = false;
  }
  if(!valid) return;

  const isEditing = !!editingEntryId;

  if(!isEditing){
    const normalizedTitle = title.toLowerCase();
    const existingMatch = entries.find(e =>
      e.category === category && (e.title || '').trim().toLowerCase() === normalizedTitle
    );
    if(existingMatch){
      const addedBy = existingMatch.author || 'someone';
      const proceed = confirm(
        `An entry titled "${title}" already exists in this category (added by ${addedBy}). Save this as a duplicate anyway?`
      );
      if(!proceed) return;
    }
  }

  saveAdd.disabled = true;
  saveAdd.textContent = 'Saving…';

  const entryData = {
    category, title, link,
    // Only AI Tools & Files pages show a Video section; other categories keep it blank.
    videoUrl: isOtherToolsCategory(category) ? document.getElementById('fVideoUrl').value.trim() : '',
    tag: document.getElementById('fTag').value,
    platform: document.getElementById('fPlatform').value,
    author: author || 'Anonymous',
    suggestedBy: currentSuggestedBy || '',
    body: isSkill ? '' : body,
    department: getSelectedDepartments().join(', '),
    purpose: isSkill ? skillValues.fPurpose : '',
    samplePrompt: isSkill ? skillValues.fSamplePrompt : '',
    bestFor: isSkill ? skillValues.fBestFor : '',
    exampleOutput: isSkill ? skillValues.fExampleOutput : '',
    notes: isSkill ? skillValues.fNotes : '',
    howToAccess: isSkill ? skillValues.fHowToAccess : '',
    oryxTip: isSkill ? skillValues.fOryxTip : ''
  };
  if(!isEditing){
    entryData.createdAt = Date.now();
    // Stamp the creator so notifyIfSubscribed can suppress a self-notification for the person adding it.
    entryData.authorEmail = (firebase.auth().currentUser && firebase.auth().currentUser.email) || '';
  }else{
    let editorName = '';
    try{ editorName = localStorage.getItem(AUTHOR_KEY) || ''; }catch(e){}
    entryData.lastEditedBy = editorName || author || 'Anonymous';
    entryData.lastEditedAt = Date.now();
  }

  try{
    if(isEditing){
      await entriesCollection.doc(editingEntryId).update(entryData);
    }else{
      await entriesCollection.add(entryData);
    }
    if(author){
      try{ localStorage.setItem(AUTHOR_KEY, author); }catch(e){}
    }
    // If this entry came from a suggestion, remove that suggestion from the queue.
    if(currentSuggestionId){
      try{ await suggestionsCollection.doc(currentSuggestionId).delete(); }catch(e){ /* leave it; admin can dismiss manually */ }
    }
    closeOverlay();
  }catch(e){
    alert(isEditing ? 'Could not save your changes. Check your connection and try again.' : 'Could not save that entry. Check your connection and try again.');
  }finally{
    saveAdd.disabled = false;
    saveAdd.textContent = isEditing ? 'Save changes' : 'Save entry';
  }
});
