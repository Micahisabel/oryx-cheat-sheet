const BACK_ARROW_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
const DOWNLOAD_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM12 4v8.17l3.59-3.58L17 10l-6 6-6-6 1.41-1.41L10 12.17V4h2z"/></svg>';

// A plain step-by-step guide, shown on an instruction's page, for putting the instruction into
// Claude and into ChatGPT. Wording is kept general (find the "Instructions" box) so it stays
// correct as those apps tweak their menus. `hasText` switches the copy step between "copy the
// text above" and "open the attached file" for file-only instructions.
function instructionStepsList(steps){
  return '<ol class="howto-list">' + steps.map(s => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>';
}
function instructionHowToHtml(hasFile, platform){
  // Built-in guidance shown automatically on every instruction — a one-line summary, then the
  // step-by-step for the tool this instruction is for (Claude OR ChatGPT, not both).
  const isChatGPT = platform === 'chatgpt';
  const toolName = isChatGPT ? 'ChatGPT' : 'Claude';
  const lead = hasFile
    ? 'Open the attached file, copy all the text inside, then paste it into your ' + toolName + ' instructions.'
    : 'Copy the instructions above, then paste them into your ' + toolName + ' instructions.';
  const copyStep = hasFile
    ? 'Open the attached file above and copy the text inside it.'
    : 'Copy the instructions above (use the Copy button).';
  const steps = isChatGPT ? [
    'Open ChatGPT at chatgpt.com and sign in.',
    copyStep,
    'Open a Project and its instructions, or go to Settings → Personalisation → Custom instructions.',
    'Paste the instructions in and save.',
    'ChatGPT now follows them across your chats.'
  ] : [
    'Open Claude at claude.ai and sign in.',
    copyStep,
    'Open your Project — or click your name, then Settings — to find the “Instructions” box.',
    'Paste the instructions in and save.',
    'Claude now keeps them in mind across your chats.'
  ];
  const dot = isChatGPT ? '#34D399' : '#F5A623';
  return '<p class="howto-lead">' + escapeHtml(lead) + '</p>'
    + '<div class="howto-card"><h4><span class="howto-dot" style="background:' + dot + '"></span>Add it to ' + toolName + '</h4>' + instructionStepsList(steps) + '</div>';
}


// ---- Video section (AI Tools & Files) ----------------------------------------
// Turns a pasted video link into an embedded player. Handles YouTube and Vimeo
// (the two most staff will paste) and any direct video file (.mp4/.webm/.mov,
// including files uploaded to our own storage). Anything else falls back to a
// plain "Watch the video" button so a working link is never lost.
function videoEmbedHtml(url){
  const raw = String(url || '').trim();
  if(!raw) return '';
  let id = null;
  let m = raw.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if(m){ id = m[1];
    return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${id}" title="Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m){
    return `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${m[1]}" title="Video" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if(/\.(mp4|webm|mov|m4v)(\?|$)/i.test(raw) || isFileLink(raw)){
    return `<div class="video-embed"><video src="${escapeHtml(raw)}" controls preload="metadata"></video></div>`;
  }
  return `<a class="video-link-btn" href="${escapeHtml(raw)}" target="_blank" rel="noopener">Watch the video</a>`;
}

// The Video section for an AI-tool page. Shows the player when a link is saved,
// or a calm placeholder when one isn't yet — so the section is ready before the
// video is.
function videoSectionHtml(entry){
  // videoUrl holds one link per line, so a tool can carry several clips. Each becomes
  // its own player, stacked in order; an empty field shows the placeholder.
  const links = String(entry.videoUrl || '')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const inner = links.length
    ? links.map(videoEmbedHtml).join('')
    : '<p class="video-empty">A short tutorial video will be added here soon.</p>';
  return detailSection('Video', `<div class="video-list">${inner}</div>`);
}

// A compact "About this tool" block for AI Tools & Files pages — folds Added by, Date added
// and Last edited by into one two-column section so it takes far less vertical space.
function aboutToolSectionHtml(entry, addedDateStr){
  const edited = !!entry.lastEditedBy;
  const editedDate = edited
    ? new Date(entry.lastEditedAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})
    : '';
  let cols = `<div class="tool-about-item">`
    + `<p class="tool-about-label">Added by</p>`
    + `<p class="tool-about-name">${escapeHtml(entry.author || 'Anonymous')}</p>`
    + `<p class="tool-about-date">${escapeHtml(addedDateStr)}</p></div>`;
  if(edited){
    cols += `<div class="tool-about-item">`
      + `<p class="tool-about-label">Last edited by</p>`
      + `<p class="tool-about-name">${escapeHtml(entry.lastEditedBy)}</p>`
      + `<p class="tool-about-date">${escapeHtml(editedDate)}</p></div>`;
  }
  return detailSection('About this tool', `<div class="tool-about">${cols}</div>`);
}

function openNoteDetail(entry){
  incrementViewCount(entry.id);
  const inner = document.getElementById('skillPageInner');
  const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  const pm = platformMeta(entry.platform);
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;
  const safeLink = entry.link && isValidLink(entry.link) ? entry.link : '';
  const thumbInner = entry.link ? linkThumbHtml(entry.link) : '';
  const thumbHtml = safeLink ? `<a class="card-thumb-link" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${thumbInner}</a>` : '';
  const titleFaviconUrl = (isOtherToolsCategory(entry.category) || entry.category === 'mcps') && entry.link ? faviconUrlForLink(entry.link) : null;
  const titleLogoHtml = titleFaviconUrl
    ? `<img class="skill-title-logo" src="${titleFaviconUrl}" alt="" onerror="this.style.display='none';">`
    : '';
  const linkHtml = safeLink
    ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${escapeHtml(safeLink)}</a>`
    : 'Not provided';

  let html = `
    <div class="skill-hero">
      ${panelSweepSvg()}
      <div class="skill-hero-inner">
        <button class="skill-back" id="skillBack">${BACK_ARROW_SVG} Back to ${escapeHtml(CATEGORY_PLURAL_LABELS[entry.category] || 'All Entries')}</button>
        <div class="skill-eyebrow">
          <span class="tag">${escapeHtml(catLabel)}</span>
          ${CATEGORY_TECH_TERMS[entry.category] ? `<span class="tag tag-tech">${escapeHtml(CATEGORY_TECH_TERMS[entry.category])}</span>` : ''}
          <span class="tag platform"><span class="platform-dot" style="background:${pm.color}"></span>${escapeHtml(pm.label)}</span>
        </div>
        <div class="skill-title-row">
          ${titleLogoHtml}<h1>${escapeHtml(entry.title)}</h1>
          <button class="card-fav-btn skill-fav-btn${favoriteIds.has(entry.id) ? ' active' : ''}" id="skillFavBtn" data-id="${entry.id}" aria-label="${favoriteIds.has(entry.id) ? 'Remove from favorites' : 'Add to favorites'}">${FAV_STAR_SVG}</button>
        </div>
      </div>
    </div>
    <div class="skill-wrap">
  `;

  if(thumbHtml){
    html += `<div class="skill-thumb">${thumbHtml}</div>`;
  }

  const isLinkResource = entry.category === 'discoveries' || isOtherToolsCategory(entry.category);
  const isInstruction = entry.category === 'instructions';

  if(isRichCategory(entry.category)){
    html += detailSection('Overview', detailList([
        {label: 'Purpose', value: entry.purpose || entry.body},
        {label: 'Best For', value: entry.bestFor},
        {label: 'Department', value: entry.department}
      ]))
      + detailSection('Try It',
        samplePromptsBlock(entry)
        + detailList([{label: 'Example Output', value: entry.exampleOutput}]))
      + detailSection('Setup',
        detailList([{label: 'How to Install and Use It in Claude', value: entry.howToAccess}])
        + (entry.category === 'mcps' ? '' : detailParagraph(INSTALL_HELP_TEXT)))
      + detailSection('Tips',
        detailList([{label: 'Notes', value: entry.notes}])
        + detailTipParagraph('How This Helps Oryx Doors & Windows', entry.oryxTip));
  } else if(isPromptShortcutCategory(entry.category)){
    html += optionalBlock('Purpose', entry.purpose)
      + copyableBlock('Sample Prompt', entry.samplePrompt, 'detail-value', 'samplePrompt')
      + optionalBlock('How to Use It', entry.howToUse);
  } else if(isShortcutCategory(entry.category)){
    html += copyableBlock('Shortcut / Command', entry.shortcutKey, 'detail-value mono', 'shortcutKey')
      + optionalBlock('Purpose', entry.purpose)
      + optionalBlock('How to Use It', entry.howToUse)
      + copyableBlock('Example', entry.example, 'detail-value mono', 'example')
      + optionalBlock('Notes', entry.notes);
  } else if(isInstruction){
    const hasText = !!(entry.body && String(entry.body).trim());
    const hasFile = !!(entry.link && isFileLink(entry.link));
    // With a file attached, the file is the real instruction and the typed text is a note for
    // the team. With no file, the typed text IS the instruction to paste into Claude/ChatGPT.
    const textTitle = hasFile ? 'Note' : 'The instructions';
    const textLabel = hasFile ? 'A note from the person who shared this' : 'Copy this, then paste it into Claude or ChatGPT';
    html += (hasText
        ? detailSection(textTitle, copyableBlock(textLabel, entry.body, 'detail-value instruction-body', 'body'))
        : '')
      + (hasFile ? detailSection('The file', fileDownloadHtml(entry.link)) : '')
      + detailSection('How to add this to ' + (entry.platform === 'chatgpt' ? 'ChatGPT' : 'Claude'), instructionHowToHtml(hasFile, entry.platform))
      + detailBlock('Make it your own', INSTRUCTION_HELP_TEXT);
  } else {
    const howTitle = isLinkResource ? 'How to Use' : 'How to Download';
    const howText = isLinkResource ? USE_LINK_HELP_TEXT : DOWNLOAD_HELP_TEXT;
    html += optionalBlock('Details', entry.body)
      + detailBlock(howTitle, howText);
  }

  const lastEditedStr = entry.lastEditedBy
    ? `${entry.lastEditedBy} · ${new Date(entry.lastEditedAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})}`
    : '';

  html += ((entry.link && !isInstruction) ? detailBlockHtml('Link', linkHtml) : '')
    + optionalBlock('Suggested by', entry.suggestedBy);

  if(isOtherToolsCategory(entry.category)){
    // AI Tools & Files pages: the how-to videos, then a compact About block at the very bottom.
    html += videoSectionHtml(entry)
      + aboutToolSectionHtml(entry, dateStr);
  }else{
    html += detailBlock('Added by', entry.author || 'Anonymous')
      + detailBlock('Date added', dateStr)
      + optionalBlock('Last edited by', lastEditedStr);
  }

  if(!isLinkResource){
    const isSkillFile = isRichCategory(entry.category) && entry.category !== 'mcps';
    html += `
      <div class="skill-download-bar">
        <h3>${isSkillFile ? 'Download this Claude Skill' : (isInstruction ? 'Download & make it your own' : 'Download this entry')}</h3>
        <p>${isSkillFile
          ? 'Get a ready-to-use SKILL.md file — drop it into a folder named after the skill and Claude can run it directly, no copy-pasting needed.'
          : (isInstruction
            ? 'Download this guide, then edit it to match your working style — add your own steps, notes, or examples.'
            : 'Save this entry as a Markdown (.md) file to keep, share, or upload into Claude.')}</p>
        <button class="download-btn" id="downloadSkill">${DOWNLOAD_ICON_SVG} ${isSkillFile ? 'Download SKILL.md' : `Download ${escapeHtml(CATEGORY_LABELS[entry.category] || 'Entry')} (.md)`}</button>
      </div>`;
  }
  html += `</div>`;

  inner.innerHTML = html;
  hydrateTikTokThumbs(inner);
  wireCopyButtons(inner, entry);
  wireSamplePromptCopyButtons(inner, entry);
  const page = document.getElementById('skillPage');
  page.classList.add('open');
  page.scrollTop = 0;
  document.getElementById('skillBack').addEventListener('click', closeDetail);
  const downloadBtn = document.getElementById('downloadSkill');
  if(downloadBtn) downloadBtn.addEventListener('click', () => downloadSkillMd(entry));
  const favBtn = document.getElementById('skillFavBtn');
  if(favBtn) favBtn.addEventListener('click', async () => {
    // Wait for the toggle to actually resolve (it may no-op if sign-in is cancelled or the
    // write fails) before reading favoriteIds, instead of optimistically assuming success —
    // this page's button isn't re-rendered by the favorites onSnapshot listener, so a wrong
    // optimistic flip here would otherwise never get corrected.
    await toggleFavorite(entry.id);
    favBtn.classList.toggle('active', favoriteIds.has(entry.id));
    favBtn.setAttribute('aria-label', favoriteIds.has(entry.id) ? 'Remove from favorites' : 'Add to favorites');
  });
}
