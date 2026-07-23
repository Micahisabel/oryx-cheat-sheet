const BACK_ARROW_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
const DOWNLOAD_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM12 4v8.17l3.59-3.58L17 10l-6 6-6-6 1.41-1.41L10 12.17V4h2z"/></svg>';

function openNoteDetail(entry){
  const inner = document.getElementById('skillPageInner');
  const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  const pm = platformMeta(entry.platform);
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;
  const thumbInner = entry.link ? linkThumbHtml(entry.link) : '';
  const thumbHtml = entry.link ? `<a class="card-thumb-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">${thumbInner}</a>` : '';
  const titleFaviconUrl = entry.category === 'other-tools' && entry.link ? faviconUrlForLink(entry.link) : null;
  const titleLogoHtml = titleFaviconUrl
    ? `<img class="skill-title-logo" src="${titleFaviconUrl}" alt="" onerror="this.style.display='none';">`
    : '';
  const linkHtml = entry.link
    ? `<a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">${escapeHtml(entry.link)}</a>`
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
        <div class="skill-title-row">${titleLogoHtml}<h1>${escapeHtml(entry.title)}</h1></div>
      </div>
    </div>
    <div class="skill-wrap">
  `;

  if(thumbHtml){
    html += `<div class="skill-thumb">${thumbHtml}</div>`;
  }

  const isLinkResource = entry.category === 'discoveries' || entry.category === 'other-tools';

  if(isRichCategory(entry.category)){
    html += optionalBlock('Purpose', entry.purpose || entry.body)
      + optionalBlock('Best For', entry.bestFor)
      + optionalBlock('Sample Prompts', entry.samplePrompt, 'detail-value mono')
      + optionalBlock('Example Output', entry.exampleOutput)
      + optionalBlock('Notes', entry.notes)
      + optionalBlock('Department', entry.department)
      + detailBlock('How to Download', DOWNLOAD_HELP_TEXT)
      + detailBlock('How to Install and Use It in Claude', entry.howToAccess && entry.howToAccess.trim() ? entry.howToAccess : INSTALL_HELP_TEXT)
      + optionalBlock('How This Helps Oryx Doors & Windows', entry.oryxTip, 'detail-tip');
  } else if(isShortcutCategory(entry.category)){
    html += optionalBlock('Shortcut / Command', entry.shortcutKey, 'detail-value mono')
      + optionalBlock('Purpose', entry.purpose)
      + optionalBlock('How to Use It', entry.howToUse)
      + optionalBlock('Example', entry.example, 'detail-value mono')
      + optionalBlock('Notes', entry.notes);
  } else {
    html += optionalBlock('Details', entry.body)
      + detailBlock(isLinkResource ? 'How to Use' : 'How to Download', isLinkResource ? USE_LINK_HELP_TEXT : DOWNLOAD_HELP_TEXT);
  }

  html += detailBlockHtml('Link', linkHtml)
    + optionalBlock('Suggested by', entry.suggestedBy)
    + detailBlock('Added by', entry.author || 'Anonymous')
    + detailBlock('Date added', dateStr);

  if(!isLinkResource){
    html += `
      <div class="skill-download-bar">
        <h3>Download this entry</h3>
        <p>Save this entry as a Markdown (.md) file to keep, share, or upload into Claude.</p>
        <button class="download-btn" id="downloadSkill">${DOWNLOAD_ICON_SVG} Download ${escapeHtml(CATEGORY_LABELS[entry.category] || 'Entry')} (.md)</button>
      </div>`;
  }
  html += `</div>`;

  inner.innerHTML = html;
  hydrateTikTokThumbs(inner);
  const page = document.getElementById('skillPage');
  page.classList.add('open');
  page.scrollTop = 0;
  document.getElementById('skillBack').addEventListener('click', closeDetail);
  const downloadBtn = document.getElementById('downloadSkill');
  if(downloadBtn) downloadBtn.addEventListener('click', () => downloadSkillMd(entry));
}
