// Overflow "More" menu for the Other AI Tools department bar.
// Instead of a horizontally-scrolling tab bar, department tabs that don't fit the row are
// hidden and collected into a "⋯ More" dropdown. When the currently-selected department is
// one of the hidden ones, the More button shows its name (and highlights) so the active
// choice is never lost off-screen.
(function(){
  const nav = otherToolsNav;
  if(!nav) return;

  // --- Build the More button + dropdown once, inside the department nav ---
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'cat-more-btn';
  moreBtn.id = 'otherToolsMore';
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.style.display = 'none';
  moreBtn.innerHTML =
    '<span class="cat-more-label">More</span>'
    + '<span class="cat-more-caret"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>';
  nav.appendChild(moreBtn);

  const menu = document.createElement('div');
  menu.className = 'cat-more-menu';
  menu.id = 'otherToolsMoreMenu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  nav.appendChild(menu);

  let laying = false;

  function deptTabs(){ return Array.from(nav.querySelectorAll('.cat-tab')); }

  // Fill the row with as many department tabs as fit the available width; the rest collapse
  // into the More menu. Width-based, so we use whatever space there is.
  function layout(){
    if(laying) return;
    if(nav.offsetParent === null) return; // nav is hidden (not on the Other AI Tools view)
    laying = true;

    const all = deptTabs();
    all.forEach(t => t.classList.remove('cat-hidden'));
    moreBtn.style.display = 'none';
    moreBtn.classList.remove('active');

    const cs = getComputedStyle(nav);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const gap = parseFloat(cs.columnGap || cs.gap) || 6;
    const inner = nav.clientWidth - padL - padR;

    // Everything already fits -> no More button needed.
    let total = 0;
    all.forEach((t, i) => { total += t.offsetWidth + (i ? gap : 0); });
    if(total <= inner + 0.5){
      menu.innerHTML = '';
      menu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
      const lbl = moreBtn.querySelector('.cat-more-label'); if(lbl) lbl.textContent = 'More';
      laying = false;
      return;
    }

    // Reserve room for the More button, then keep tabs left-to-right until they'd overflow.
    moreBtn.style.display = '';
    const budget = inner - (moreBtn.offsetWidth + gap);
    let used = 0, overflowing = false;
    const hidden = [];
    all.forEach((t, i) => {
      const w = t.offsetWidth + (i ? gap : 0);
      if(!overflowing && used + w <= budget){ used += w; }
      else { overflowing = true; hidden.push(t); }
    });
    // Always keep at least the first department in the bar.
    while(hidden.length && (all.length - hidden.length) < 1){ hidden.shift(); }

    hidden.forEach(t => t.classList.add('cat-hidden'));
    nav.scrollLeft = 0;

    // Build the dropdown from the hidden tabs, mirroring their live badge counts.
    menu.innerHTML = hidden.map(t => {
      const cat = t.dataset.cat;
      const label = CATEGORY_LABELS[cat] || cat;
      const icon = CATEGORY_ICON_PATHS[cat] || '';
      const count = (t.querySelector('.cat-badge') || {}).textContent || '0';
      return '<button class="cat-more-item' + (cat === activeCat ? ' active' : '') + '" role="menuitem" data-cat="' + cat + '">'
        + '<span class="cat-icon"><svg viewBox="0 0 24 24">' + icon + '</svg></span>'
        + escapeHtml(label)
        + '<span class="cat-badge">' + escapeHtml(count) + '</span></button>';
    }).join('');

    // If the selected department is hidden, surface it on the More button itself.
    const activeHidden = hidden.some(t => t.dataset.cat === activeCat);
    const labelEl = moreBtn.querySelector('.cat-more-label');
    if(activeHidden){
      moreBtn.classList.add('active');
      labelEl.textContent = CATEGORY_LABELS[activeCat] || 'More';
    } else {
      moreBtn.classList.remove('active');
      labelEl.textContent = 'More';
    }

    laying = false;
  }

  function openMenu(){
    if(!menu.innerHTML) return;
    const r = moreBtn.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    menu.hidden = false;
    moreBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu(){
    menu.hidden = true;
    moreBtn.setAttribute('aria-expanded', 'false');
  }

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden ? openMenu() : closeMenu();
  });

  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.cat-more-item');
    if(!item) return;
    activeCat = item.dataset.cat;
    nav.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === activeCat));
    currentPage = 1;
    closeMenu();
    render();
    repositionTabIndicator(nav, '.cat-tab-indicator', '.cat-tab.active');
    layout();
  });

  // Dismiss on outside click, Escape, or scroll.
  document.addEventListener('click', (e) => {
    if(menu.hidden) return;
    if(e.target.closest('#otherToolsMoreMenu') || e.target.closest('#otherToolsMore')) return;
    closeMenu();
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);

  // Recompute when the row size changes — this also fires when the nav switches from
  // display:none to flex on entering the Other AI Tools view.
  if('ResizeObserver' in window){
    const ro = new ResizeObserver(() => { closeMenu(); requestAnimationFrame(layout); });
    ro.observe(nav);
  }
  window.addEventListener('resize', () => { closeMenu(); layout(); });
  window.addEventListener('load', layout);

  // Exposed so entries.js can refresh the menu (and its counts) after a re-render.
  window.layoutOtherToolsOverflow = layout;

  requestAnimationFrame(layout);
})();
