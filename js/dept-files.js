// ============= Department Files — a shared, per-department library of AI files =============
// Files live entirely in Supabase: the actual file in the "department-files" Storage bucket,
// and its details in the "department_files" table. Any signed-in staff member can add a file;
// everyone can view, open, and download. (Sign-in is enforced in the app UI; Supabase itself
// uses the public key, so keep this an internal-team feature.)

// Kept in step with the Other AI Tools department tabs (constants.js OTHER_TOOLS_CATS labels),
// so a file's department always matches a department shown under Other AI Tools.
const DEPARTMENTS = ['HR', 'Marketing', 'Sales', 'Business Support', 'Fabrication', 'Finance', 'Installation Operation', 'Supply Chain', 'Projects', 'Quarter Master'];
const DEPT_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

let deptFiles = [];
let deptFilesFilter = 'all';
let deptFileUploading = false;

const deptFilesView = document.getElementById('deptFilesView');
const openDeptFilesNav = document.getElementById('openDeptFilesNav');
const deptFileOverlay = document.getElementById('deptFileOverlay');

// ---- File-type helpers ------------------------------------------------------
function deptFileKind(nameOrType){
  const s = (nameOrType || '').toLowerCase();
  if(/\.pdf$|pdf/.test(s)) return { label: 'PDF', color: '#D64545' };
  if(/\.docx?$|word|msword|officedocument\.wordprocessing/.test(s)) return { label: 'DOC', color: '#2B579A' };
  if(/\.xlsx?$|\.csv$|excel|spreadsheet/.test(s)) return { label: 'XLS', color: '#217346' };
  if(/\.pptx?$|powerpoint|presentation/.test(s)) return { label: 'PPT', color: '#C43E1C' };
  if(/\.(png|jpe?g|gif|webp|bmp|svg)$|^image\//.test(s)) return { label: 'IMG', color: '#7A5AF8' };
  return { label: 'FILE', color: '#5b6b72' };
}
function formatBytes(bytes){
  if(!bytes && bytes !== 0) return '';
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function deptFileDate(ts){
  return ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
function mapDeptRow(r){
  return {
    id: r.id, title: r.title, description: r.description, department: r.department,
    fileName: r.file_name, fileType: r.file_type, fileSize: r.file_size,
    fileURL: r.file_url, storagePath: r.storage_path, uploadedBy: r.uploaded_by,
    createdAt: r.created_at ? Date.parse(r.created_at) : 0
  };
}

// ---- Load from Supabase -----------------------------------------------------
async function loadDeptFiles(){
  if(!sbClient) return;
  try{
    const { data, error } = await sbClient
      .from('department_files')
      .select('*')
      .order('created_at', { ascending: false });
    if(error) throw error;
    deptFiles = (data || []).map(mapDeptRow);
    const badge = document.querySelector('[data-platform-count="deptfiles"]');
    if(badge) badge.textContent = deptFiles.length;
    markDeptFileTabs();
    if(hubMainEl.classList.contains('dept-files-mode')) renderDeptFiles();
    // Files now appear inline within the Other AI Tools department views, so refresh that
    // view once the list loads (or changes).
    if(typeof activePlatform !== 'undefined' && activePlatform === 'other' && typeof render === 'function') render();
  }catch(e){
    console.error('Department files load error:', e);
  }
}

// ---- Enter / exit the full-page view ---------------------------------------
function enterDeptFilesMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  if(typeof exitLearningAdminMode === 'function') exitLearningAdminMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active, .sidebar-analytics-item.active')
    .forEach(b => b.classList.remove('active'));
  openDeptFilesNav.classList.add('active');
  hubMainEl.classList.add('dept-files-mode');
  if(typeof repositionAllTabIndicators === 'function') repositionAllTabIndicators();
  renderDeptFiles();
  loadDeptFiles(); // refresh in case someone else added a file
}
function exitDeptFilesMode(){
  if(!hubMainEl.classList.contains('dept-files-mode')) return;
  hubMainEl.classList.remove('dept-files-mode');
  openDeptFilesNav.classList.remove('active');
}

// ---- Render -----------------------------------------------------------------
function deptFileCardHtml(f){
  const kind = deptFileKind(f.fileName || f.fileType);
  const url = f.fileURL ? escapeHtml(f.fileURL) : '';
  const meta = [f.uploadedBy ? 'By ' + escapeHtml(f.uploadedBy) : '', deptFileDate(f.createdAt), formatBytes(f.fileSize)]
    .filter(Boolean).join(' &middot; ');
  const actions = url
    ? `<a class="df-btn df-open" href="${url}" target="_blank" rel="noopener">Open</a>
       <a class="df-btn df-download" href="${url}" target="_blank" rel="noopener" download="${escapeHtml(f.fileName || 'file')}">Download</a>`
    : `<span class="df-btn df-missing">File unavailable</span>`;
  const adminRemove = isAdmin ? `<button class="df-btn df-remove" data-id="${escapeHtml(f.id)}">Remove</button>` : '';
  return `
    <div class="df-card">
      <div class="df-card-icon" style="background:${kind.color}">${kind.label}</div>
      <div class="df-card-main">
        <span class="df-dept-badge">${escapeHtml(f.department || 'General')}</span>
        <p class="df-card-title">${escapeHtml(f.title || f.fileName || 'Untitled file')}</p>
        <p class="df-card-desc">${escapeHtml(f.description || '')}</p>
        <p class="df-card-meta">${meta}${f.fileName ? ' &middot; ' + escapeHtml(f.fileName) : ''}</p>
        <div class="df-card-actions">${actions}${adminRemove}</div>
      </div>
    </div>`;
}

function renderDeptFiles(){
  const chips = ['all', ...DEPARTMENTS].map(d => {
    const label = d === 'all' ? 'All departments' : d;
    const count = d === 'all' ? deptFiles.length : deptFiles.filter(f => f.department === d).length;
    return `<button class="df-chip${deptFilesFilter === d ? ' active' : ''}" data-dept="${escapeHtml(d)}">${escapeHtml(label)}<span class="df-chip-count">${count}</span></button>`;
  }).join('');

  const deptsToShow = deptFilesFilter === 'all' ? DEPARTMENTS : [deptFilesFilter];
  const sections = deptsToShow.map(dept => {
    const files = deptFiles.filter(f => f.department === dept);
    const body = files.length
      ? `<div class="df-grid">${files.map(deptFileCardHtml).join('')}</div>`
      : `<p class="df-empty">No files here yet. Be the first to add one.</p>`;
    return `
      <section class="df-section">
        <div class="df-section-head">
          <h3>${escapeHtml(dept)}</h3>
          <span class="df-section-count">${files.length} file${files.length === 1 ? '' : 's'}</span>
        </div>
        ${body}
      </section>`;
  }).join('');

  deptFilesView.innerHTML = `
    <div class="df-header">
      <div>
        <h1 class="df-title">Department Library</h1>
        <p class="df-sub">Helpful AI files, sorted by department. Click any file to open or download it.</p>
      </div>
      <button class="df-add-btn" id="dfAddBtn">+ Add a file</button>
    </div>
    <div class="df-chips">${chips}</div>
    <div class="df-sections">${sections}</div>`;

  deptFilesView.querySelector('#dfAddBtn').addEventListener('click', openDeptFileModal);
  deptFilesView.querySelectorAll('.df-chip').forEach(chip => {
    chip.addEventListener('click', () => { deptFilesFilter = chip.dataset.dept; renderDeptFiles(); });
  });
  deptFilesView.querySelectorAll('.df-remove').forEach(btn => {
    btn.addEventListener('click', () => removeDeptFile(btn.dataset.id));
  });
}

// ---- Upload modal -----------------------------------------------------------
function fillDeptSelect(){
  const sel = document.getElementById('dfDept');
  if(!sel.options.length){
    sel.innerHTML = '<option value="">Choose a department…</option>' +
      DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }
  if(deptFilesFilter !== 'all') sel.value = deptFilesFilter;
}
async function openDeptFileModal(){
  const signedIn = await ensureStaffSignedIn();
  if(!signedIn) return;
  fillDeptSelect();
  document.getElementById('dfTitle').value = '';
  document.getElementById('dfDesc').value = '';
  document.getElementById('dfFile').value = '';
  ['errDfTitle', 'errDfDept', 'errDfDesc', 'errDfFile'].forEach(id => { document.getElementById(id).style.display = 'none'; });
  document.getElementById('dfProgress').style.display = 'none';
  deptFileOverlay.classList.add('open');
}
function closeDeptFileModal(){ if(!deptFileUploading) deptFileOverlay.classList.remove('open'); }

async function submitDeptFile(){
  if(deptFileUploading) return;
  if(!sbClient){ alert('The file service is not available right now. Please refresh and try again.'); return; }

  const title = document.getElementById('dfTitle').value.trim();
  const dept = document.getElementById('dfDept').value;
  const desc = document.getElementById('dfDesc').value.trim();
  const file = document.getElementById('dfFile').files[0];

  const show = (id, on) => { document.getElementById(id).style.display = on ? 'block' : 'none'; };
  let ok = true;
  show('errDfTitle', !title); if(!title) ok = false;
  show('errDfDept', !dept); if(!dept) ok = false;
  show('errDfDesc', !desc); if(!desc) ok = false;
  show('errDfFile', !file); if(!file) ok = false;
  if(!ok) return;

  if(file.size > DEPT_FILE_MAX_BYTES){
    alert('That file is larger than 25 MB. Please upload a smaller file, or share it as a link instead.');
    return;
  }

  const user = firebase.auth().currentUser;
  const uploadedBy = (user && user.displayName) || 'Anonymous';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${dept.replace(/[^a-zA-Z0-9]/g, '_')}/${Date.now()}_${safeName}`;

  deptFileUploading = true;
  const saveBtn = document.getElementById('saveDeptFile');
  saveBtn.disabled = true; saveBtn.textContent = 'Uploading…';
  const progWrap = document.getElementById('dfProgress');
  const progBar = document.getElementById('dfProgressBar');
  const progText = document.getElementById('dfProgressText');
  progWrap.style.display = 'block'; progBar.classList.add('indeterminate'); progText.textContent = 'Uploading…';

  try{
    const up = await sbClient.storage.from(DEPT_FILES_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if(up.error) throw up.error;

    const { data: pub } = sbClient.storage.from(DEPT_FILES_BUCKET).getPublicUrl(path);
    const fileURL = pub.publicUrl;

    const ins = await sbClient.from('department_files').insert({
      title, description: desc, department: dept,
      file_name: file.name, file_type: file.type || '', file_size: file.size,
      file_url: fileURL, storage_path: path, uploaded_by: uploadedBy
    });
    if(ins.error) throw ins.error;

    deptFileUploading = false;
    progBar.classList.remove('indeterminate');
    saveBtn.disabled = false; saveBtn.textContent = 'Add file';
    deptFileOverlay.classList.remove('open');
    deptFilesFilter = dept;
    await loadDeptFiles();
    if(hubMainEl.classList.contains('dept-files-mode')) renderDeptFiles();
  }catch(e){
    console.error('Department file upload failed:', e);
    deptFileUploading = false;
    progBar.classList.remove('indeterminate');
    saveBtn.disabled = false; saveBtn.textContent = 'Add file';
    progWrap.style.display = 'none';
    alert('Sorry, the upload did not work. Check your connection and try again.');
  }
}

async function removeDeptFile(id){
  const f = deptFiles.find(x => x.id === id);
  if(!f) return;
  if(!confirm('Remove this file for everyone? This cannot be undone.')) return;
  try{
    if(f.storagePath){ await sbClient.storage.from(DEPT_FILES_BUCKET).remove([f.storagePath]); }
    const del = await sbClient.from('department_files').delete().eq('id', id);
    if(del.error) throw del.error;
    await loadDeptFiles();
  }catch(e){
    console.error('Department file remove failed:', e);
    alert('Could not remove the file. Check your connection and try again.');
  }
}

// ---- Inline "Files" section (shown inside an Other AI Tools department view) ----
// Returns the HTML for a department's files: a "Files" heading plus a grid of file cards
// (or a gentle empty note). Filtered to `deptLabel`, and further by `term` while searching.
function deptFilesSectionHtml(deptLabel, term){
  let files = deptFiles.filter(f => f.department === deptLabel);
  if(term){
    const t = term.toLowerCase();
    files = files.filter(f => [f.title, f.description, f.fileName].filter(Boolean).join(' ').toLowerCase().includes(t));
  }
  const count = files.length;
  const body = count
    ? `<div class="df-grid">${files.map(deptFileCardHtml).join('')}</div>`
    : `<p class="df-empty">No files here yet. Use “Share a Resource” to add one.</p>`;
  return `
    <div class="dept-inline-head">Department Files <span class="dept-inline-count">${count}</span></div>
    ${body}`;
}

// A small paperclip, so a department tab shows "there are files here" at a glance — even when
// its tool count is 0. Widely understood (email attachments) and needs no words on the bar.
const CAT_CLIP_SVG = '<span class="cat-clip" title="This team has files"><svg viewBox="0 0 24 24"><path d="M21.4 11.05l-8.5 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.33 3.33 0 1 1 4.71 4.71l-8.49 8.49a1.67 1.67 0 0 1-2.36-2.36l7.78-7.78"/></svg></span>';

// Mark every Other AI Tools department tab that currently has files, and clear the rest.
// Called after the file list loads or changes. The clip is a child of the tab, so it survives
// the overflow-menu hide/show; we also refresh the More menu so hidden tabs show it too.
function markDeptFileTabs(){
  const nav = document.getElementById('otherToolsNav');
  if(!nav || typeof CATEGORY_LABELS === 'undefined') return;
  const withFiles = new Set(deptFiles.map(f => f.department));
  nav.querySelectorAll('.cat-tab').forEach(tab => {
    const label = CATEGORY_LABELS[tab.dataset.cat];
    const has = label && withFiles.has(label);
    tab.classList.toggle('has-files', !!has);
    const existing = tab.querySelector('.cat-clip');
    if(has && !existing) tab.insertAdjacentHTML('beforeend', CAT_CLIP_SVG);
    else if(!has && existing) existing.remove();
  });
  if(typeof window.layoutOtherToolsOverflow === 'function') window.layoutOtherToolsOverflow();
}

// Upload a standalone attachment (used when an instruction is shared as a file). Stores the
// file in the same bucket and returns its public URL — no department_files row, so it doesn't
// show as a Department File; the URL is attached to the instruction entry instead.
async function uploadAttachmentFile(file){
  if(!sbClient) throw new Error('file-service-unavailable');
  if(file.size > DEPT_FILE_MAX_BYTES) throw new Error('file-too-large');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `instructions/${Date.now()}_${safeName}`;
  const up = await sbClient.storage.from(DEPT_FILES_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if(up.error) throw up.error;
  const { data: pub } = sbClient.storage.from(DEPT_FILES_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

// Upload level-up challenge evidence (screenshot/file). Same bucket, own path
// prefix keyed by uid — no department_files row (evidence isn't a shared
// department resource), just a raw upload returning a public URL for
// levelChallenges in learning.js.
async function uploadChallengeEvidence(file, uid){
  if(!sbClient) throw new Error('file-service-unavailable');
  if(file.size > DEPT_FILE_MAX_BYTES) throw new Error('file-too-large');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `challenge-evidence/${uid}/${Date.now()}_${safeName}`;
  const up = await sbClient.storage.from(DEPT_FILES_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if(up.error) throw up.error;
  const { data: pub } = sbClient.storage.from(DEPT_FILES_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

// Upload a file to a department (used by the Share a Resource form). Resolves true on success.
async function uploadDepartmentFile({ title, description, department, file }){
  if(!sbClient) throw new Error('file-service-unavailable');
  if(file.size > DEPT_FILE_MAX_BYTES) throw new Error('file-too-large');
  const user = firebase.auth().currentUser;
  const uploadedBy = (user && user.displayName) || 'Anonymous';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${department.replace(/[^a-zA-Z0-9]/g, '_')}/${Date.now()}_${safeName}`;

  const up = await sbClient.storage.from(DEPT_FILES_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if(up.error) throw up.error;

  const { data: pub } = sbClient.storage.from(DEPT_FILES_BUCKET).getPublicUrl(path);
  const ins = await sbClient.from('department_files').insert({
    title, description, department,
    file_name: file.name, file_type: file.type || '', file_size: file.size,
    file_url: pub.publicUrl, storage_path: path, uploaded_by: uploadedBy
  });
  if(ins.error) throw ins.error;
  await loadDeptFiles();
  return true;
}

// ---- Wiring -----------------------------------------------------------------
openDeptFilesNav.addEventListener('click', enterDeptFilesMode);
// Load the file list up front so it's ready when a department view is opened.
loadDeptFiles();
document.getElementById('closeDeptFile').addEventListener('click', closeDeptFileModal);
document.getElementById('cancelDeptFile').addEventListener('click', closeDeptFileModal);
document.getElementById('saveDeptFile').addEventListener('click', submitDeptFile);
deptFileOverlay.addEventListener('click', (ev) => { if(ev.target === deptFileOverlay) closeDeptFileModal(); });
