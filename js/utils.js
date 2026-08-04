function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
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

function platformMeta(platform){
  const map = {
    claude:  { label: 'Claude',        color: '#F5A623' },
    chatgpt: { label: 'ChatGPT',       color: '#34D399' },
    other:   { label: 'Other AI Tool', color: '#A78BFA' }
  };
  return map[platform] || map.claude;
}

const DOWNLOAD_HELP_TEXT = 'Click the "Download Skill (.md)" button at the bottom of this page. The file saves to your device as a Markdown (.md) file you can open, edit, or share with the team.';
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
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;
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
  return lines.join('\n');
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
