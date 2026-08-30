function escapeHtml(str){
  // Must also escape quotes, not just &/</> — several call sites interpolate this
  // straight into an href/data-* attribute value, where a bare " or ' lets a
  // crafted link (e.g. https://x.com" onmouseover="...) break out and inject
  // a live event-handler attribute.
  return (str == null ? '' : String(str))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function isValidLink(url){
  try{ const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }catch(e){ return false; }
}

function panelSweepSvg(){
  return `<svg class="panel-sweep" viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg">
    <path d="M240 6 C170 6 120 40 85 150" stroke="white" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M240 20 C177 20 132 52 105 150" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
  </svg>`;
}
function detailBlock(label, value, valueClass){
  return `<div class="detail-block"><div class="detail-label">${escapeHtml(label)}</div><div class="${valueClass || 'detail-value'}">${escapeHtml(value)}</div></div>`;
}
function detailBlockHtml(label, valueHtml, valueClass){
  return `<div class="detail-block"><div class="detail-label">${escapeHtml(label)}</div><div class="${valueClass || 'detail-value'}">${valueHtml}</div></div>`;
}
function detailSection(heading, innerHtml){
  if(!innerHtml) return '';
  return `<div class="detail-section"><h3 class="detail-section-heading">${escapeHtml(heading)}</h3>${innerHtml}</div>`;
}

// Flowing, document-style presentation for a group of fields — a bold inline
// label followed by its value, as bullet points, instead of separate boxed rows.
function detailList(items){
  const lis = items
    .filter(item => item.value !== undefined && item.value !== null && String(item.value).trim())
    .map(item => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`)
    .join('');
  return lis ? `<ul class="detail-list">${lis}</ul>` : '';
}
function detailParagraph(text){
  if(!text || !String(text).trim()) return '';
  return `<p class="detail-text">${escapeHtml(text)}</p>`;
}
function detailTipParagraph(label, text){
  if(!text || !String(text).trim()) return '';
  return `<p class="detail-tip-text"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</p>`;
}

function closeDetail(){
  document.getElementById('skillPage').classList.remove('open');
}

function optionalBlock(label, value, valueClass){
  if(value === undefined || value === null || !String(value).trim()) return '';
  return detailBlock(label, value, valueClass);
}

const COPY_ICON_SVG = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const CHECK_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';

// Same content as optionalBlock/detailBlock, plus a copy button. `fieldName` must be a fixed,
// non-user-controlled string (e.g. 'shortcutKey') — the click handler reads entry[fieldName]
// directly rather than embedding the (possibly quote-containing) value in a data attribute.
function copyableBlock(label, value, valueClass, fieldName){
  if(value === undefined || value === null || !String(value).trim()) return '';
  return `<div class="detail-block">
    <div class="detail-label">${escapeHtml(label)}</div>
    <div class="detail-value-row">
      <div class="${valueClass || 'detail-value'}">${escapeHtml(value)}</div>
      <button class="copy-btn" data-field="${fieldName}" aria-label="Copy ${escapeHtml(label)}" title="Copy">${COPY_ICON_SVG}</button>
    </div>
  </div>`;
}

async function copyToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* fall through to legacy method */ }
  // Legacy fallback — works in many contexts where the async API is blocked.
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

// A skill's samplePrompt field holds one or more example prompts, one per line.
function splitSamplePrompts(text){
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
}

// Renders each sample prompt as its own copyable block. Copy buttons reference the
// prompt by index (a plain number, safe in a data attribute) and re-split entry.samplePrompt
// at click time, rather than embedding the (possibly quote-containing) prompt text directly.
function samplePromptsBlock(entry){
  const prompts = splitSamplePrompts(entry.samplePrompt);
  if(!prompts.length) return '';
  const label = prompts.length > 1 ? 'Sample Prompts' : 'Sample Prompt';
  const items = prompts.map((p, i) => `
    <div class="detail-value-row" style="margin-bottom:${i < prompts.length - 1 ? '10px' : '0'};">
      <div class="detail-value mono">${escapeHtml(p)}</div>
      <button class="copy-btn" data-sample-prompt-index="${i}" aria-label="Copy sample prompt" title="Copy">${COPY_ICON_SVG}</button>
    </div>`).join('');
  return `<div class="detail-block detail-block-flow"><div class="detail-subheading">${escapeHtml(label)}</div>${items}</div>`;
}

function wireSamplePromptCopyButtons(root, entry){
  const prompts = splitSamplePrompts(entry.samplePrompt);
  root.querySelectorAll('[data-sample-prompt-index]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = prompts[Number(btn.dataset.samplePromptIndex)] || '';
      const ok = await copyToClipboard(text);
      if(!ok) return;
      const originalHtml = btn.innerHTML;
      const originalLabel = btn.getAttribute('aria-label');
      btn.innerHTML = CHECK_ICON_SVG;
      btn.classList.add('copied');
      btn.setAttribute('aria-label', 'Copied!');
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', originalLabel);
      }, 1500);
    });
  });
}

function wireCopyButtons(root, entry){
  root.querySelectorAll('.copy-btn:not([data-sample-prompt-index])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = entry[btn.dataset.field] || '';
      const ok = await copyToClipboard(text);
      if(!ok) return;
      const originalHtml = btn.innerHTML;
      const originalLabel = btn.getAttribute('aria-label');
      btn.innerHTML = CHECK_ICON_SVG;
      btn.classList.add('copied');
      btn.setAttribute('aria-label', 'Copied!');
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', originalLabel);
      }, 1500);
    });
  });
}

function faviconUrlForLink(link){
  try{ return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(link).hostname)}&sz=64`; }
  catch(e){ return null; }
}

// A "link" that is really an uploaded file: either it lives in our department-files bucket, or it
// ends in a common document/image extension. Used so attached files show as a tidy file chip with
// a download button, not a long raw URL.
function isFileLink(url){
  if(!url) return false;
  return /\/department-files\//.test(url) || /\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf|png|jpe?g|gif|webp)(\?|#|$)/i.test(url);
}
// Pull a readable file name out of the URL, dropping the upload timestamp prefix we add
// (e.g. "1787480460331_Oryx_Brief.docx" -> "Oryx_Brief.docx").
function fileNameFromUrl(url){
  try{
    let name = decodeURIComponent((new URL(url).pathname.split('/').pop()) || 'file');
    return name.replace(/^\d{10,}_/, '') || 'file';
  }catch(e){ return 'file'; }
}
const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
// A download button labelled with the file name — used on the instruction detail page.
function fileDownloadHtml(url){
  return `<a class="file-download" href="${escapeHtml(url)}" target="_blank" rel="noopener" download><span class="file-download-icon">${FILE_ICON_SVG}</span><span class="file-download-name">${escapeHtml(fileNameFromUrl(url))}</span><span class="file-download-go">Open</span></a>`;
}

function platformMeta(platform){
  const map = {
    claude:  { label: 'Claude',        color: '#F5A623' },
    chatgpt: { label: 'ChatGPT',       color: '#34D399' },
    other:   { label: 'Other AI Tool', color: '#A78BFA' }
  };
  return map[platform] || map.claude;
}

const DOWNLOAD_HELP_TEXT = 'Click the "Download Skill (.md)" button at the bottom of this page. The file saves to your device as a Markdown (.md) file you can open, edit, or share with the team.';
const INSTRUCTION_HELP_TEXT = 'This guide is yours to adapt. Download it with the button below, then change it to fit the way you and your team work — add your own steps, wording, or examples. When it is helpful, share your version back with the team.';
const USE_LINK_HELP_TEXT = 'Open the link above to visit this tool.';
const INSTALL_HELP_TEXT = 'Click "Download SKILL.md" below, then put the file in its own folder named after the skill (e.g. showroom-follow-up/SKILL.md) inside your Claude Skills folder, or upload that folder into a Claude Project. Claude will read it and offer the skill automatically — no copy-pasting needed. To try it right away without installing, just paste the sample prompt above into a new Claude chat.';

function slugify(str){
  return (str || 'skill').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'skill';
}

// Builds a real Claude Skill file per Anthropic's Agent Skills spec: YAML frontmatter
// with only "name" (lowercase-hyphenated, matches the folder) and "description" (a
// single-line, third-person statement of what it does and when to use it — this is the
// text Claude actually matches against to decide whether to trigger the skill), followed
// by a Markdown body of task instructions. Folder metadata (install steps, department,
// links, attribution) is deliberately left out of the file — it's Oryx app context, not
// something Claude needs to run the skill. See: https://docs.claude.com/en/docs/agents-and-tools/agent-skills
function buildClaudeSkillMd(entry){
  const name = slugify(entry.title);
  const oneLine = (str) => String(str || '').replace(/\s+/g, ' ').trim();
  const purpose = oneLine(entry.purpose || entry.body);
  const bestFor = oneLine(entry.bestFor);
  let description = [purpose, bestFor ? `Use when: ${bestFor}` : '']
    .filter(Boolean).join(' ') || `Skill for ${entry.title || 'Untitled'}`;
  if(description.length > 1024) description = description.slice(0, 1021).trim() + '...';

  const lines = [];
  lines.push('---');
  lines.push(`name: ${name}`);
  lines.push(`description: ${JSON.stringify(description)}`);
  lines.push('---', '', `# ${entry.title || 'Untitled'}`, '');

  if(purpose) lines.push(purpose, '');

  const section = (title, val) => {
    if(val && String(val).trim()){ lines.push(`## ${title}`, '', String(val).trim(), ''); }
  };

  const instructionParts = [entry.notes, entry.oryxTip].map(v => String(v || '').trim()).filter(Boolean);
  if(instructionParts.length){
    lines.push('## Instructions', '', instructionParts.join('\n\n'), '');
  }

  section('Example', entry.exampleOutput);

  const prompts = splitSamplePrompts(entry.samplePrompt);
  if(prompts.length){
    lines.push(prompts.length > 1 ? '## Reference Prompts' : '## Reference Prompt', '');
    prompts.forEach(p => lines.push(`- ${p}`));
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}

function buildGenericMarkdown(entry){
  const pm = platformMeta(entry.platform);
  const plainLabel = CATEGORY_LABELS[entry.category] || entry.category;
  const techTerm = CATEGORY_TECH_TERMS[entry.category];
  const catLabel = techTerm ? `${plainLabel} (${techTerm})` : plainLabel;
  const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  const lines = [];
  lines.push(`# ${entry.title || 'Untitled'}`, '');
  lines.push(`- **AI platform:** ${pm.label}`);
  lines.push(`- **Category:** ${catLabel}`);
  if(entry.department) lines.push(`- **Department:** ${entry.department}`);
  lines.push(`- **Added by:** ${entry.author || 'Anonymous'}`);
  lines.push(`- **Date added:** ${dateStr}`, '');

  const section = (title, val) => {
    if(val && String(val).trim()){ lines.push(`## ${title}`, '', String(val).trim(), ''); }
  };

  if(isShortcutCategory(entry.category)){
    section('Shortcut / Command', entry.shortcutKey);
    section('Purpose', entry.purpose);
    section('How to Use It', entry.howToUse);
    section('Example', entry.example);
    section('Notes', entry.notes);
  } else {
    section('Details', entry.body);
  }
  section('Link', entry.link);

  // Claude/ChatGPT Prompt entries get a ready-made instruction telling the AI to remember the
  // shortcut. Built dynamically from this entry's own title/purpose/howToUse — never hard-coded.
  if(isPromptShortcutCategory(entry.category)){
    const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const title = oneLine(entry.title) || 'this shortcut';
    const purpose = oneLine(entry.purpose);
    const howTo = oneLine(entry.howToUse);
    lines.push('## Memory Instruction', '');
    lines.push('Please remember this shortcut for future conversations:', '');
    lines.push(`When I use "${title}", apply the following:`, '');
    if(purpose) lines.push(`- **What it means / does:** ${purpose}`);
    if(howTo) lines.push(`- **How I use it:** ${howTo}`);
    lines.push('');
    lines.push(`Please save this shortcut to your memory so I can use "${title}" in future conversations without having to explain what it means again.`);
  }

  return lines.join('\n');
}

// ---- Optional "Knowledge Check" quiz builder — shared by the Add Entry and Shortcut
// forms. A resource's knowledgeCheck field is either [] (no quiz — the entry detail
// page just shows a plain "Mark as complete" button) or 3-5 {question, options:
// [{text, correct}]} items. Kept deliberately simple: single-select, 2-4 options,
// exactly one marked correct per question.
function knowledgeCheckRowHtml(q, i){
  const question = (q && q.question) || '';
  const options = (q && q.options && q.options.length) ? q.options : [{text:'',correct:true},{text:'',correct:false}];
  return `
    <div class="kc-question" data-qi="${i}">
      <div class="kc-question-head">
        <input type="text" class="kc-question-text" placeholder="Question ${i + 1}" value="${escapeHtml(question)}">
        <button type="button" class="kc-remove-q" aria-label="Remove question">&times;</button>
      </div>
      <div class="kc-options">
        ${options.map((o, oi) => `
          <div class="kc-option">
            <input type="radio" name="kc-correct-${i}" class="kc-option-correct" ${o.correct ? 'checked' : ''}>
            <input type="text" class="kc-option-text" placeholder="Answer ${oi + 1}" value="${escapeHtml(o.text || '')}">
            <button type="button" class="kc-remove-opt" aria-label="Remove answer">&times;</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="kc-add-opt">+ Add answer</button>
    </div>`;
}
function buildKnowledgeCheckEditor(containerEl, addBtnEl){
  const MAX_QUESTIONS = 5, MAX_OPTIONS = 4;
  function renumber(){
    containerEl.querySelectorAll('.kc-question').forEach((q, i) => q.dataset.qi = i);
  }
  function addQuestion(q){
    if(containerEl.querySelectorAll('.kc-question').length >= MAX_QUESTIONS) return;
    containerEl.insertAdjacentHTML('beforeend', knowledgeCheckRowHtml(q, containerEl.children.length));
    renumber();
  }
  containerEl.addEventListener('click', (ev) => {
    if(ev.target.classList.contains('kc-remove-q')){
      ev.target.closest('.kc-question').remove();
      renumber();
    }else if(ev.target.classList.contains('kc-add-opt')){
      const optsEl = ev.target.previousElementSibling;
      if(optsEl.querySelectorAll('.kc-option').length >= MAX_OPTIONS) return;
      const qi = ev.target.closest('.kc-question').dataset.qi;
      optsEl.insertAdjacentHTML('beforeend', `
        <div class="kc-option">
          <input type="radio" name="kc-correct-${qi}" class="kc-option-correct">
          <input type="text" class="kc-option-text" placeholder="Answer">
          <button type="button" class="kc-remove-opt" aria-label="Remove answer">&times;</button>
        </div>`);
    }else if(ev.target.classList.contains('kc-remove-opt')){
      const optsEl = ev.target.closest('.kc-options');
      if(optsEl.querySelectorAll('.kc-option').length > 1) ev.target.closest('.kc-option').remove();
    }
  });
  if(addBtnEl) addBtnEl.addEventListener('click', () => addQuestion(null));
  return {
    reset(){ containerEl.innerHTML = ''; },
    setValue(list){
      containerEl.innerHTML = '';
      (list || []).forEach(q => addQuestion(q));
    },
    // Only questions with real text and at least 2 non-empty options (one marked
    // correct) are kept — an in-progress/incomplete row is silently dropped rather
    // than saved half-finished.
    getValue(){
      const out = [];
      containerEl.querySelectorAll('.kc-question').forEach(qEl => {
        const question = qEl.querySelector('.kc-question-text').value.trim();
        const options = [...qEl.querySelectorAll('.kc-option')].map(oEl => ({
          text: oEl.querySelector('.kc-option-text').value.trim(),
          correct: oEl.querySelector('.kc-option-correct').checked
        })).filter(o => o.text);
        if(question && options.length >= 2 && options.some(o => o.correct)) out.push({question, options});
      });
      return out;
    }
  };
}

function downloadSkillMd(entry){
  const isSkillFile = isRichCategory(entry.category);
  const md = isSkillFile ? buildClaudeSkillMd(entry) : buildGenericMarkdown(entry);
  const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isSkillFile ? `${slugify(entry.title)}.SKILL.md` : slugify(entry.title) + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
