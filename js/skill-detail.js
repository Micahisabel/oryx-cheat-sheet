const BACK_ARROW_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
const DOWNLOAD_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM12 4v8.17l3.59-3.58L17 10l-6 6-6-6 1.41-1.41L10 12.17V4h2z"/></svg>';

function openNoteDetail(entry){
  incrementViewCount(entry.id);
  const inner = document.getElementById('skillPageInner');
  const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  const pm = platformMeta(entry.platform);
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;
  const safeLink = entry.link && isValidLink(entry.link) ? entry.link : '';
  const thumbInner = entry.link ? linkThumbHtml(entry.link) : '';
  const thumbHtml = safeLink ? `<a class="card-thumb-link" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${thumbInner}</a>` : '';
  const titleFaviconUrl = isOtherToolsCategory(entry.category) && entry.link ? faviconUrlForLink(entry.link) : null;
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
        + detailParagraph(INSTALL_HELP_TEXT))
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
  } else {
    html += optionalBlock('Details', entry.body)
      + detailBlock(isLinkResource ? 'How to Use' : 'How to Download', isLinkResource ? USE_LINK_HELP_TEXT : DOWNLOAD_HELP_TEXT);
  }

  const lastEditedStr = entry.lastEditedBy
    ? `${entry.lastEditedBy} · ${new Date(entry.lastEditedAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})}`
    : '';

  html += (entry.link ? detailBlockHtml('Link', linkHtml) : '')
    + optionalBlock('Suggested by', entry.suggestedBy)
    + detailBlock('Added by', entry.author || 'Anonymous')
    + detailBlock('Date added', dateStr)
    + optionalBlock('Last edited by', lastEditedStr);

  if(!isLinkResource){
    const isSkillFile = isRichCategory(entry.category);
    html += `
      <div class="skill-download-bar">
        <h3>${isSkillFile ? 'Download this Claude Skill' : 'Download this entry'}</h3>
        <p>${isSkillFile
          ? 'Get a ready-to-use SKILL.md file — drop it into a folder named after the skill and Claude can run it directly, no copy-pasting needed.'
          : 'Save this entry as a Markdown (.md) file to keep, share, or upload into Claude.'}</p>
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
