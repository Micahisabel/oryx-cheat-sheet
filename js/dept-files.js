// ============= Department Files — a shared, per-department library of AI files =============
// Files are stored in Firebase Storage; the details (title, description, department, download
// link) live in the departmentFiles Firestore collection. Any signed-in staff member can add
// a file; everyone can view, open, and download.

const DEPARTMENTS = ['HR', 'Finance', 'Projects', 'Supply Chain', 'Design', 'Installation', 'Business Support'];
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

// ---- Live sync --------------------------------------------------------------
function listenForDeptFiles(){
  deptFilesCollection.orderBy('createdAt', 'desc').onSnapshot(
    (snap) => {
      deptFiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const badge = document.querySelector('[data-platform-count="deptfiles"]');
      if(badge) badge.textContent = deptFiles.length;
      if(hubMainEl.classList.contains('dept-files-mode')) renderDeptFiles();
    },
    (err) => { console.error('Department files sync error:', err); }
  );
}

// ---- Enter / exit the full-page view ---------------------------------------
function enterDeptFilesMode(){
  if(typeof exitAnalyticsMode === 'function') exitAnalyticsMode();
  document.querySelectorAll('.platform-item.active, .platform-submenu-item.active, .sidebar-analytics-item.active')
    .forEach(b => b.classList.remove('active'));
  openDeptFilesNav.classList.add('active');
  hubMainEl.classList.add('dept-files-mode');
  if(typeof repositionAllTabIndicators === 'function') repositionAllTabIndicators();
  renderDeptFiles();
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
  const adminRemove = isAdmin ? `<button class="df-btn df-remove" data-id="${f.id}">Remove</button>` : '';
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
  let sections = deptsToShow.map(dept => {
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
  // If a department is filtered, pre-select it for convenience.
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
  const title = document.getElementById('dfTitle').value.trim();
  const dept = document.getElementById('dfDept').value;
  const desc = document.getElementById('dfDesc').value.trim();
  const fileInput = document.getElementById('dfFile');
  const file = fileInput.files[0];

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
  const path = `departmentFiles/${dept}/${Date.now()}_${safeName}`;

  deptFileUploading = true;
  const saveBtn = document.getElementById('saveDeptFile');
  saveBtn.disabled = true; saveBtn.textContent = 'Uploading…';
  const progWrap = document.getElementById('dfProgress');
  const progBar = document.getElementById('dfProgressBar');
  const progText = document.getElementById('dfProgressText');
  progWrap.style.display = 'block'; progBar.style.width = '0%'; progText.textContent = 'Uploading…';

  try{
    const ref = storage.ref().child(path);
    const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });
    await new Promise((resolve, reject) => {
      task.on('state_changed',
        (snap) => {
          const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          progBar.style.width = pct + '%'; progText.textContent = 'Uploading… ' + pct + '%';
        },
        reject,
        resolve
      );
    });
    const url = await ref.getDownloadURL();
    await deptFilesCollection.add({
      title, description: desc, department: dept,
      fileName: file.name, fileType: file.type || '', fileSize: file.size,
      fileURL: url, storagePath: path,
      uploadedBy, createdAt: Date.now()
    });
    deptFileUploading = false;
    saveBtn.disabled = false; saveBtn.textContent = 'Add file';
    deptFileOverlay.classList.remove('open');
    // Jump the view to the department we just added to.
    deptFilesFilter = dept;
    if(hubMainEl.classList.contains('dept-files-mode')) renderDeptFiles();
  }catch(e){
    console.error('Department file upload failed:', e);
    deptFileUploading = false;
    saveBtn.disabled = false; saveBtn.textContent = 'Add file';
    progWrap.style.display = 'none';
    const msg = (e && e.code === 'storage/unauthorized')
      ? 'Uploads are not switched on yet. Please ask the admin to enable file storage.'
      : 'Sorry, the upload did not work. Check your connection and try again.';
    alert(msg);
  }
}

async function removeDeptFile(id){
  const f = deptFiles.find(x => x.id === id);
  if(!f) return;
  if(!confirm('Remove this file for everyone? This cannot be undone.')) return;
  try{
    if(f.storagePath){ try{ await storage.ref().child(f.storagePath).delete(); }catch(_){ /* file already gone */ } }
    await deptFilesCollection.doc(id).delete();
  }catch(e){
    alert('Could not remove the file. Check your connection and try again.');
  }
}

// ---- Wiring -----------------------------------------------------------------
openDeptFilesNav.addEventListener('click', enterDeptFilesMode);
document.getElementById('closeDeptFile').addEventListener('click', closeDeptFileModal);
document.getElementById('cancelDeptFile').addEventListener('click', closeDeptFileModal);
document.getElementById('saveDeptFile').addEventListener('click', submitDeptFile);
deptFileOverlay.addEventListener('click', (ev) => { if(ev.target === deptFileOverlay) closeDeptFileModal(); });
