// ---- Review queue (admin) ----
let knownSuggestionIds = null;
let suggestionsUnsub = null;

function notifyNewSuggestion(s){
  if(!isAdmin || !('Notification' in window) || Notification.permission !== 'granted') return;
  const logoEl = document.querySelector('.logo-img');
  const n = new Notification(`New suggestion from ${s.name || 'Anonymous'}`, {
    body: `${s.type || 'Request'}: ${s.title || s.text || ''}`.slice(0, 150),
    icon: logoEl ? logoEl.src : undefined
  });
  n.onclick = () => { window.focus(); n.close(); };
}

function listenForSuggestions(){
  if(suggestionsUnsub) return; // already listening
  suggestionsUnsub = suggestionsCollection.orderBy('createdAt', 'desc').onSnapshot(
    (snap) => {
      suggestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      reviewCount.textContent = suggestions.length;
      renderReviewList();

      const currentIds = new Set(suggestions.map(s => s.id));
      if(knownSuggestionIds !== null){
        suggestions
          .filter(s => !knownSuggestionIds.has(s.id))
          .forEach(notifyNewSuggestion);
      }
      knownSuggestionIds = currentIds;
    },
    (err) => { console.error('Suggestions sync error:', err); }
  );
}

function stopListeningForSuggestions(){
  if(suggestionsUnsub){ suggestionsUnsub(); suggestionsUnsub = null; }
  knownSuggestionIds = null;
  suggestions = [];
  reviewCount.textContent = '0';
  renderReviewList();
}

function renderReviewList(){
  if(!suggestions.length){
    reviewList.innerHTML = '<div class="s-empty">No suggestions waiting. When the team sends ideas, they appear here.</div>';
    return;
  }
  reviewList.innerHTML = suggestions.map(s => {
    const dateStr = new Date(s.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'});
    const typeStr = s.type ? escapeHtml(s.type) : 'Not sure';
    const platformStr = s.platform === 'chatgpt' ? 'ChatGPT' : 'Claude';
    return `
      <div class="suggestion-item" data-id="${s.id}">
        <div class="s-meta"><span>${typeStr} · ${platformStr}</span><span>${escapeHtml(s.name || 'Anonymous')} · ${dateStr}</span></div>
        ${s.title ? `<p class="s-title" style="font-weight:600;margin:0 0 6px;">${escapeHtml(s.title)}</p>` : ''}
        <p class="s-text">${escapeHtml(s.text)}</p>
        <div class="s-actions">
          <button class="btn-small solid s-create" data-id="${s.id}">Create entry</button>
          <button class="btn-small ghost s-dismiss" data-id="${s.id}">Dismiss</button>
        </div>
      </div>`;
  }).join('');

  reviewList.querySelectorAll('.s-create').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = suggestions.find(x => x.id === btn.dataset.id);
      if(s) createEntryFromSuggestion(s);
    });
  });
  reviewList.querySelectorAll('.s-dismiss').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('Dismiss this suggestion?')) return;
      btn.disabled = true;
      try{ await suggestionsCollection.doc(btn.dataset.id).delete(); }
      catch(e){ alert('Could not dismiss it. Try again.'); btn.disabled = false; }
    });
  });
}

function createEntryFromSuggestion(s){
  reviewOverlay.classList.remove('open');
  openOverlay();
  // Pre-load the AI helper with the suggestion so the admin can generate the fields.
  aiInput.value = s.text || '';
  if(s.title) document.getElementById('fTitle').value = s.title;
  if(s.platform) document.getElementById('fPlatform').value = s.platform;
  // If the suggestion is a link, drop it into the Link field too.
  if(isValidLink((s.text || '').trim())) document.getElementById('fLink').value = s.text.trim();
  currentSuggestionId = s.id;
  currentSuggestedBy = s.name && s.name !== 'Anonymous' ? s.name : '';
  setAiStatus('Loaded from suggestion. Click “Generate prompt & copy”, or fill the form manually, then Save.');
}

openReview.addEventListener('click', () => { reviewOverlay.classList.add('open'); });
document.getElementById('closeReview').addEventListener('click', () => reviewOverlay.classList.remove('open'));
reviewOverlay.addEventListener('click', (ev) => { if(ev.target === reviewOverlay) reviewOverlay.classList.remove('open'); });
